const config = require('./config');
const os = require('os');

// Store metrics data
const metrics = {
  requests: 0,
  latency: 0,
  statusCodes: {},
  endpoints: {},
  errors: 0,
  dbQueries: 0,
  dbErrors: 0,
  dbLatency: 0,
  get_requests: 0,
  post_requests: 0,
  put_requests: 0,
  delete_requests: 0,
  user_signUps: 0,
  user_signUps_delta: 0,
  // New database metrics
  dbQueryTypes: {
    select: 0,
    insert: 0,
    update: 0,
    delete: 0,
    unknown: 0
  },
  dbConnectionErrors: 0,
  dbQueryErrors: 0,
  dbSlowQueries: 0
};

// Track changes to metrics.user_signUps property
const trackMetricsChanges = () => {
  let userSignUpsValue = metrics.user_signUps;
  
  Object.defineProperty(metrics, 'user_signUps', {
    get: function() {
      return userSignUpsValue;
    },
    set: function(newValue) {
      if (newValue !== userSignUpsValue) {
        console.log(`---------- METRICS CHANGE DETECTED ----------`);
        console.log(`metrics.user_signUps changed: ${userSignUpsValue} -> ${newValue}`);
        
        // Log stack trace to find where the change came from
        const stack = new Error().stack;
        console.log('Changed from:');
        console.log(stack.split('\n').slice(1, 5).join('\n')); // Show 4 levels
        
        console.log('--------------------------------------------');
      }
      userSignUpsValue = newValue;
    },
    enumerable: true,
    configurable: true
  });
};

// Initialize the property tracker
trackMetricsChanges();

// Send metrics to Grafana every 5 seconds
setInterval(() => {
  // CPU usage (real data)
  const cpuValue = getCpuUsagePercentage();
  sendMetricToGrafana('cpu', cpuValue, 'gauge', '%');

  // Memory usage (real data)
  const memoryValue = getMemoryUsagePercentage();
  sendMetricToGrafana('memory', memoryValue, 'gauge', '%');

  // Request count (real data)
  sendMetricToGrafana('requests', metrics.requests, 'sum', '1');

  // Request count by method
  sendMetricToGrafana('get_requests', metrics.get_requests || 0, 'sum', '1');
  sendMetricToGrafana('post_requests', metrics.post_requests || 0, 'sum', '1');
  sendMetricToGrafana('put_requests', metrics.put_requests || 0, 'sum', '1');
  sendMetricToGrafana('delete_requests', metrics.delete_requests || 0, 'sum', '1');

  // Latency (real data)
  sendMetricToGrafana('latency', metrics.latency, 'sum', 'ms');

  // Error rate (real data)
  const errorRate = metrics.requests > 0 ? (metrics.errors / metrics.requests) * 100 : 0;
  sendMetricToGrafana('error_rate', errorRate, 'gauge', '%');

  // DB metrics
  sendMetricToGrafana('db_queries', metrics.dbQueries, 'sum', '1');
  sendMetricToGrafana('db_errors', metrics.dbErrors, 'sum', '1');
  sendMetricToGrafana('db_latency', metrics.dbLatency, 'sum', 'ms');
  console.log(`DEBUG: About to send user_signup metric, current value is ${metrics.user_signUps}`);
  if (metrics.user_signUps_delta > 0) {
    console.log(`Sending user_signup delta: ${metrics.user_signUps_delta}`);
    sendMetricToGrafana('user_signup', metrics.user_signUps, 'sum', '1');
    
    // Reset the delta after sending - MAKE SURE THIS LINE IS HERE
    metrics.user_signUps_delta = 0;
  }
  
  // New DB metrics
  sendMetricToGrafana('db_connection_errors', metrics.dbConnectionErrors, 'sum', '1');
  sendMetricToGrafana('db_query_errors', metrics.dbQueryErrors, 'sum', '1');
  sendMetricToGrafana('db_slow_queries', metrics.dbSlowQueries, 'sum', '1');
  
  // DB query types
  Object.entries(metrics.dbQueryTypes).forEach(([type, count]) => {
    sendMetricToGrafana(`db_query_${type}`, count, 'sum', '1');
  });
  
  // Average DB query time
  const avgDbQueryTime = metrics.dbQueries > 0 ? metrics.dbLatency / metrics.dbQueries : 0;
  sendMetricToGrafana('avg_db_query_time', avgDbQueryTime, 'gauge', 'ms');
  
  // DB error rate
  const dbErrorRate = metrics.dbQueries > 0 ? (metrics.dbErrors / metrics.dbQueries) * 100 : 0;
  sendMetricToGrafana('db_error_rate', dbErrorRate, 'gauge', '%');
}, 5000);

function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return cpuUsage * 100;
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return parseFloat(memoryUsage.toFixed(2));
}

function recordUserSignup(userData) {
  console.log('METRICS: Recording user signup for', userData.email);
  try {
    // Increment main counter
    metrics.user_signUps++;
    
    // Also increment the delta counter that tracks changes since last report
    metrics.user_signUps_delta++;
    
    // Log locally for debugging
    console.log(`[METRIC] User signup: ${userData.email}, total: ${metrics.user_signUps}, delta: ${metrics.user_signUps_delta}`);
  } catch (error) {
    console.error('Failed to record user signup metric:', error);
  }
}

// Wrap the original sendMetricToGrafana function
const originalSendMetricToGrafana = function(metricName, metricValue, type, unit) {
  if (!config.metrics || !config.metrics.apiKey || !config.metrics.url) {
    console.log(`[Metrics] Skipping metric ${metricName} - Missing configuration`);
    return;
  }
  const metric = {
    resourceMetrics: [
      {
        resource: {
          attributes: [
            {
              key: "service.name",
              value: { stringValue: config.metrics?.source || "jwt-pizza-service" }
            }
          ]
        },
        scopeMetrics: [
          {
            metrics: [
              {
                name: metricName,
                unit: unit,
                [type]: {
                  dataPoints: [
                    {
                      asInt: Math.round(metricValue),
                      timeUnixNano: Date.now() * 1000000,
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  };

  if (type === 'sum') {
    metric.resourceMetrics[0].scopeMetrics[0].metrics[0][type].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
    metric.resourceMetrics[0].scopeMetrics[0].metrics[0][type].isMonotonic = true;
  }

  const body = JSON.stringify(metric);
  
  // Use Basic auth with the full API key
  const encodedCredentials = Buffer.from(config.metrics.apiKey).toString('base64');
  
  fetch(`${config.metrics.url}`, {
    method: 'POST',
    body: body,
    headers: { 
      'Authorization': `Basic ${encodedCredentials}`, 
      'Content-Type': 'application/json' 
    },
  })
    .then((response) => {
      console.log(`[Metrics] Sent: ${metricName}, Status: ${response.status}`);
      if (!response.ok) {
        response.text().then((text) => {
          console.error(`[Metrics Error] Failed to push data to Grafana: ${text}`);
        });
      } else {
        console.log(`[Metrics] Successfully sent metric: ${metricName} = ${metricValue}`);
      }
      if (response.ok && metricName === 'user_signup') {
        console.log(`[Grafana Debug] Successfully sent user_signup metric: ${metricValue}`);
      }
    })
    .catch((error) => {
      console.error(`[Metrics Error] Error pushing metric ${metricName}:`, error);
    });
};

// Create instrumented version of sendMetricToGrafana
function sendMetricToGrafana(metricName, metricValue, type, unit) {
  if (metricName === 'user_signup') {
    console.log(`---------- SENDING USER SIGNUP METRIC ----------`);
    console.log(`Sending user_signup metric with value: ${metricValue}, type: ${type}, unit: ${unit}`);
    
    // Log stack trace
    const stack = new Error().stack;
    console.log('Called from:');
    console.log(stack.split('\n').slice(1, 5).join('\n')); // Show 4 levels
    
    console.log(`-----------------------------------------------`);
  }
  
  return originalSendMetricToGrafana(metricName, metricValue, type, unit);
}

// Request tracking middleware
const requestTracker = (req, res, next) => {
  const start = Date.now();
  
  // Track request count
  metrics.requests++;
  
  // Track request by method
  const method = req.method.toLowerCase();
  metrics[`${method}_requests`] = (metrics[`${method}_requests`] || 0) + 1;
  
  // Track endpoint usage
  const endpoint = `${req.method} ${req.path}`;
  metrics.endpoints[endpoint] = (metrics.endpoints[endpoint] || 0) + 1;
  
  // Capture original end method
  const originalEnd = res.end;
  
  // Override end method to capture metrics
  res.end = function(...args) {
    // Calculate request duration
    const duration = Date.now() - start;
    metrics.latency += duration;
    
    // Track status codes
    const statusCode = res.statusCode;
    metrics.statusCodes[statusCode] = (metrics.statusCodes[statusCode] || 0) + 1;
    
    // Track errors
    if (statusCode >= 400) {
      metrics.errors++;
      
      // Send error metric immediately for critical errors
      if (statusCode >= 500) {
        sendMetricToGrafana('server_error', 1, 'sum', '1');
      }
    }
    
    // Call original end method
    return originalEnd.apply(this, args);
  };
  
  next();
};

// Enhanced database metrics tracking
const trackDbQuery = (duration, success = true, queryType = 'unknown') => {
  // Increment total query count
  metrics.dbQueries++;
  
  // Add query duration to total latency
  metrics.dbLatency += duration;
  
  // Track by query type
  if (metrics.dbQueryTypes[queryType] !== undefined) {
    metrics.dbQueryTypes[queryType]++;
  } else {
    metrics.dbQueryTypes.unknown++;
  }
  
  // Track if it was a slow query (threshold defined in databaseWrapper.js)
  if (duration > 300) { // 300ms threshold
    metrics.dbSlowQueries++;
    sendMetricToGrafana('db_slow_query', 1, 'sum', '1');
  }
  
  // Track errors
  if (!success) {
    metrics.dbErrors++;
    metrics.dbQueryErrors++;
  }
};

// Track database connection errors
const trackDbConnectionError = () => {
  metrics.dbConnectionErrors++;
  sendMetricToGrafana('db_connection_error', 1, 'sum', '1');
};

// Update connection pool metrics
const updateDbPoolMetrics = (totalConnections, usedConnections, queueSize = 0) => {
  // These metrics might not be directly applicable to your MySQL implementation
  // but we'll keep the function for future use
  sendMetricToGrafana('db_pool_size', totalConnections, 'gauge', '1');
  sendMetricToGrafana('db_pool_used', usedConnections, 'gauge', '1');
  sendMetricToGrafana('db_pool_queue', queueSize, 'gauge', '1');
};

// Get current metrics for API endpoint
const getMetrics = () => {
  const avgLatency = metrics.requests > 0 ? metrics.latency / metrics.requests : 0;
  const errorRate = metrics.requests > 0 ? (metrics.errors / metrics.requests) * 100 : 0;
  const dbErrorRate = metrics.dbQueries > 0 ? (metrics.dbErrors / metrics.dbQueries) * 100 : 0;
  const avgDbLatency = metrics.dbQueries > 0 ? metrics.dbLatency / metrics.dbQueries : 0;
  
  return {
    system: {
      cpu: getCpuUsagePercentage().toFixed(2) + '%',
      memory: getMemoryUsagePercentage().toFixed(2) + '%',
      uptime: formatUptime(process.uptime())
    },
    http: {
      totalRequests: metrics.requests,
      errors: metrics.errors,
      errorRate: errorRate.toFixed(2) + '%',
      avgLatency: avgLatency.toFixed(2) + 'ms',
      statusCodes: metrics.statusCodes,
      topEndpoints: getTopEndpoints(5),
      requestsByMethod: {
        get: metrics.get_requests || 0,
        post: metrics.post_requests || 0,
        put: metrics.put_requests || 0,
        delete: metrics.delete_requests || 0
      }
    },
    database: {
      totalQueries: metrics.dbQueries,
      errors: metrics.dbErrors,
      errorRate: dbErrorRate.toFixed(2) + '%',
      avgLatency: avgDbLatency.toFixed(2) + 'ms',
      connectionErrors: metrics.dbConnectionErrors,
      queryErrors: metrics.dbQueryErrors,
      slowQueries: metrics.dbSlowQueries,
      queryTypes: metrics.dbQueryTypes
    },
    users: {
      signups: metrics.user_signUps
    }
  };
};

// Helper function to get top N endpoints by usage
function getTopEndpoints(n) {
  return Object.entries(metrics.endpoints)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .reduce((obj, [key, value]) => {
      obj[key] = value;
      return obj;
    }, {});
}

// Helper function to format uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  seconds %= 86400;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  
  return parts.join(' ');
}

// Log message about debugging being enabled
console.log('[Metrics] Enhanced debugging for user signup tracking enabled');

module.exports = {
  requestTracker,
  trackDbQuery,
  trackDbConnectionError,
  updateDbPoolMetrics,
  getMetrics,
  recordUserSignup
};