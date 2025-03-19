const config = require('./config');
const os = require('os');

// Store metrics data
const metrics = {
  // HTTP metrics
  requests: 0,
  latency: 0,
  statusCodes: {},
  endpoints: {},
  errors: 0,
  get_requests: 0,
  post_requests: 0,
  put_requests: 0,
  delete_requests: 0,
  
  // User metrics
  user_signUps: 0,
  user_signUps_delta: 0,
  active_users: 0,
  active_user_sessions: new Map(), // Maps user token/ID to last activity timestamp
  
  // Authentication metrics
  auth_attempts: 0,
  auth_success: 0,
  auth_failure: 0,
  
  // Authentication rates
  auth_attempts_per_minute: 0,
  auth_success_per_minute: 0,
  auth_failure_per_minute: 0,
  
  // Current minute counters for auth
  current_minute_auth_attempts: 0,
  current_minute_auth_success: 0,
  current_minute_auth_failure: 0,
  
  // Pizza sales metrics
  pizza_sales: 0,
  pizza_sales_failures: 0,
  pizza_revenue: 0,
  
  // Per-minute rates for pizza
  pizza_sales_per_minute: 0,
  pizza_failures_per_minute: 0,
  pizza_revenue_per_minute: 0,
  
  // Current minute counters for pizza
  current_minute_pizza_sales: 0,
  current_minute_pizza_failures: 0,
  current_minute_pizza_revenue: 0,
  
  // Request rate metrics
  requests_per_minute: 0,
  get_requests_per_minute: 0,
  post_requests_per_minute: 0,
  put_requests_per_minute: 0,
  delete_requests_per_minute: 0,
  
  // Current minute counters
  current_minute_requests: 0,
  current_minute_get: 0,
  current_minute_post: 0,
  current_minute_put: 0,
  current_minute_delete: 0,
  
  // Time tracking
  last_minute_timestamp: Date.now(),
  
  // Database metrics
  dbQueries: 0,
  dbErrors: 0,
  dbLatency: 0,
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

// Track recent signups to prevent duplicates
const recentSignups = new Map();

// Track recent pizza orders to prevent duplicates
const recentOrders = new Map();

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

// Calculate requests per minute
function calculateRequestsPerMinute() {
  const now = Date.now();
  const elapsedMs = now - metrics.last_minute_timestamp;
  
  // Only update if at least 5 seconds have passed
  if (elapsedMs >= 5000) {
    // Calculate requests per minute (scaled based on elapsed time)
    const minuteRatio = 60000 / elapsedMs;
    
    metrics.requests_per_minute = Math.round(metrics.current_minute_requests * minuteRatio);
    metrics.get_requests_per_minute = Math.round(metrics.current_minute_get * minuteRatio);
    metrics.post_requests_per_minute = Math.round(metrics.current_minute_post * minuteRatio);
    metrics.put_requests_per_minute = Math.round(metrics.current_minute_put * minuteRatio);
    metrics.delete_requests_per_minute = Math.round(metrics.current_minute_delete * minuteRatio);
    
    // Authentication metrics per minute
    metrics.auth_attempts_per_minute = Math.round(metrics.current_minute_auth_attempts * minuteRatio);
    metrics.auth_success_per_minute = Math.round(metrics.current_minute_auth_success * minuteRatio);
    metrics.auth_failure_per_minute = Math.round(metrics.current_minute_auth_failure * minuteRatio);
    
    // Pizza metrics per minute
    metrics.pizza_sales_per_minute = Math.round(metrics.current_minute_pizza_sales * minuteRatio);
    metrics.pizza_failures_per_minute = Math.round(metrics.current_minute_pizza_failures * minuteRatio);
    metrics.pizza_revenue_per_minute = parseFloat((metrics.current_minute_pizza_revenue * minuteRatio).toFixed(8));
    
    // Reset counters
    metrics.current_minute_requests = 0;
    metrics.current_minute_get = 0;
    metrics.current_minute_post = 0;
    metrics.current_minute_put = 0;
    metrics.current_minute_delete = 0;
    metrics.current_minute_auth_attempts = 0;
    metrics.current_minute_auth_success = 0;
    metrics.current_minute_auth_failure = 0;
    metrics.current_minute_pizza_sales = 0;
    metrics.current_minute_pizza_failures = 0;
    metrics.current_minute_pizza_revenue = 0;
    
    // Update timestamp
    metrics.last_minute_timestamp = now;
    
    // Log the calculated values (only if there were requests)
    if (metrics.requests_per_minute > 0) {
      console.log(`[Metrics] Requests per minute: ${metrics.requests_per_minute} (total)`);
    }
    
    // Log authentication rates (only if there were auth attempts)
    if (metrics.auth_attempts_per_minute > 0) {
      console.log(`[Metrics] Auth attempts per minute: ${metrics.auth_attempts_per_minute} ` +
                 `(Success: ${metrics.auth_success_per_minute}, ` +
                 `Failure: ${metrics.auth_failure_per_minute})`);
    }
    
    // Log pizza metrics (only if there were orders)
    if (metrics.pizza_sales_per_minute > 0 || metrics.pizza_failures_per_minute > 0) {
      console.log(`[Metrics] Pizza metrics - Sales: ${metrics.pizza_sales_per_minute}/min, ` +
                 `Failures: ${metrics.pizza_failures_per_minute}/min, ` +
                 `Revenue: ${metrics.pizza_revenue_per_minute.toFixed(8)} BTC/min`);
    }
  }
}

// Record an authentication attempt
function recordAuthAttempt(success) {
  try {
    // Increment total counters
    metrics.auth_attempts++;
    metrics.current_minute_auth_attempts++;
    
    // Track success/failure
    if (success) {
      metrics.auth_success++;
      metrics.current_minute_auth_success++;
      console.log('[Metrics] Recorded successful authentication');
    } else {
      metrics.auth_failure++;
      metrics.current_minute_auth_failure++;
      console.log('[Metrics] Recorded failed authentication');
    }
  } catch (error) {
    console.error('[Metrics] Error recording auth attempt:', error);
  }
}

// Record pizza sale or failure
function recordPizzaSale(items, success = true) {
  try {
    // Generate a simple identifier for this order to prevent duplicates
    const orderItems = items || [];
    const orderId = `${Date.now()}-${orderItems.length}`;
    
    // Check for duplicate orders in close succession
    if (recentOrders.has(orderId)) {
      console.log(`[Metrics] Prevented duplicate order tracking: ${orderId}`);
      return;
    }
    
    // Record this order
    recentOrders.set(orderId, Date.now());
    
    // Clean up old order entries
    if (recentOrders.size > 100) {
      const expireTime = Date.now() - 5000; // 5 seconds
      for (const [key, time] of recentOrders.entries()) {
        if (time < expireTime) {
          recentOrders.delete(key);
        }
      }
    }
    
    if (success) {
      // Count total pizzas sold
      const pizzaCount = orderItems.length;
      metrics.pizza_sales += pizzaCount;
      metrics.current_minute_pizza_sales += pizzaCount;
      
      // Calculate revenue
      const revenue = orderItems.reduce((total, item) => total + (parseFloat(item.price) || 0), 0);
      metrics.pizza_revenue += revenue;
      metrics.current_minute_pizza_revenue += revenue;
      
      console.log(`[Metrics] Recorded sale of ${pizzaCount} pizzas, revenue: ${revenue.toFixed(8)} BTC`);
    } else {
      // Track failures
      metrics.pizza_sales_failures++;
      metrics.current_minute_pizza_failures++;
      console.log('[Metrics] Recorded pizza order failure');
    }
  } catch (error) {
    console.error('[Metrics] Error recording pizza sale:', error);
  }
}

// Update active users count
function updateActiveUserCount() {
  const now = Date.now();
  const activeWindowMs = 15 * 60 * 1000; // 15 minutes in milliseconds
  const expiryTime = now - activeWindowMs;
  
  // Remove expired sessions
  for (const [token, timestamp] of metrics.active_user_sessions.entries()) {
    if (timestamp < expiryTime) {
      metrics.active_user_sessions.delete(token);
    }
  }
  
  // Update the active users count
  metrics.active_users = metrics.active_user_sessions.size;
  
  // Only log if there are active users
  if (metrics.active_users > 0) {
    console.log(`[Metrics] Active users in last 15 minutes: ${metrics.active_users}`);
  }
}

// Record user activity
function recordUserActivity(token) {
  if (!token) return;
  
  // Update the last activity timestamp for this user
  metrics.active_user_sessions.set(token, Date.now());
}

// Send metrics to Grafana every 5 seconds
setInterval(() => {
  // Calculate requests per minute
  calculateRequestsPerMinute();
  
  // Update active users count
  updateActiveUserCount();

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

  // Requests per minute
  sendMetricToGrafana('requests_per_minute', metrics.requests_per_minute, 'gauge', 'rpm');
  sendMetricToGrafana('get_requests_per_minute', metrics.get_requests_per_minute, 'gauge', 'rpm');
  sendMetricToGrafana('post_requests_per_minute', metrics.post_requests_per_minute, 'gauge', 'rpm');
  sendMetricToGrafana('put_requests_per_minute', metrics.put_requests_per_minute, 'gauge', 'rpm');
  sendMetricToGrafana('delete_requests_per_minute', metrics.delete_requests_per_minute, 'gauge', 'rpm');

  // Authentication metrics
  sendMetricToGrafana('auth_attempts_per_minute', metrics.auth_attempts_per_minute, 'gauge', 'rpm');
  sendMetricToGrafana('auth_success_per_minute', metrics.auth_success_per_minute, 'gauge', 'rpm');
  sendMetricToGrafana('auth_failure_per_minute', metrics.auth_failure_per_minute, 'gauge', 'rpm');

  // Pizza metrics
  sendMetricToGrafana('pizza_sales_per_minute', metrics.pizza_sales_per_minute, 'gauge', 'pizzas/min');
  sendMetricToGrafana('pizza_failures_per_minute', metrics.pizza_failures_per_minute, 'gauge', 'failures/min');
  sendMetricToGrafana('pizza_revenue_per_minute', metrics.pizza_revenue_per_minute, 'gauge', 'BTC/min');

  // Active users
  sendMetricToGrafana('active_users', metrics.active_users, 'gauge', 'users');

  // Latency (real data)
  sendMetricToGrafana('latency', metrics.latency, 'sum', 'ms');

  // Error rate (real data)
  const errorRate = metrics.requests > 0 ? (metrics.errors / metrics.requests) * 100 : 0;
  sendMetricToGrafana('error_rate', errorRate, 'gauge', '%');

  // DB metrics
  sendMetricToGrafana('db_queries', metrics.dbQueries, 'sum', '1');
  sendMetricToGrafana('db_errors', metrics.dbErrors, 'sum', '1');
  sendMetricToGrafana('db_latency', metrics.dbLatency, 'sum', 'ms');
  
  // User signup metrics
  if (metrics.user_signUps_delta > 0) {
    console.log(`Sending user_signup delta: ${metrics.user_signUps_delta}`);
    sendMetricToGrafana('user_signup', metrics.user_signUps_delta, 'sum', '1');
    
    // Reset the delta after sending
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

// Helper function to read auth token
function readAuthToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    return authHeader.split(' ')[1];
  }
  return null;
}

function recordUserSignup(userData) {
  const email = userData?.email || 'unknown';
  
  // Check if this email was recently counted (within 2 seconds)
  const now = Date.now();
  if (recentSignups.has(email)) {
    const lastTime = recentSignups.get(email);
    if (now - lastTime < 2000) { // 2 seconds
      console.log(`[METRICS] Prevented duplicate signup for ${email} (${now - lastTime}ms since last call)`);
      return;
    }
  }
  
  // Record this signup time
  recentSignups.set(email, now);
  
  // Clean up old entries periodically
  if (recentSignups.size > 100) {
    const expireTime = now - 5000; // 5 seconds
    for (const [key, time] of recentSignups.entries()) {
      if (time < expireTime) {
        recentSignups.delete(key);
      }
    }
  }
  
  console.log('METRICS: Recording user signup for', email);
  try {
    // Increment main counter
    metrics.user_signUps++;
    
    // Also increment the delta counter that tracks changes since last report
    metrics.user_signUps_delta++;
    
    // Log locally for debugging
    console.log(`[METRIC] User signup: ${email}, total: ${metrics.user_signUps}, delta: ${metrics.user_signUps_delta}`);
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
      // Only log important metrics or errors
      const isImportantMetric = [
        'user_signup', 
        'active_users', 
        'auth_success_per_minute', 
        'auth_failure_per_minute',
        'pizza_sales_per_minute',
        'pizza_failures_per_minute',
        'pizza_revenue_per_minute'
      ].includes(metricName);
      
      if (!response.ok) {
        response.text().then((text) => {
          console.error(`[Metrics Error] Failed to push data to Grafana: ${text}`);
        });
      } else if (isImportantMetric) {
        console.log(`[Metrics] Successfully sent metric: ${metricName} = ${metricValue}`);
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
  }
  
  return originalSendMetricToGrafana(metricName, metricValue, type, unit);
}

// Request tracking middleware
const requestTracker = (req, res, next) => {
  try {
    const start = Date.now();
    
    // Track request count
    metrics.requests++;
    metrics.current_minute_requests++;
    
    // Track request by method
    const method = req.method.toLowerCase();
    metrics[`${method}_requests`] = (metrics[`${method}_requests`] || 0) + 1;
    
    // Also increment the current minute counter for this method
    switch (method) {
      case 'get':
        metrics.current_minute_get++;
        break;
      case 'post':
        metrics.current_minute_post++;
        break;
      case 'put':
        metrics.current_minute_put++;
        break;
      case 'delete':
        metrics.current_minute_delete++;
        break;
    }
    
    // Track endpoint usage
    const endpoint = `${req.method} ${req.path}`;
    metrics.endpoints[endpoint] = (metrics.endpoints[endpoint] || 0) + 1;
    
    // Record user activity if authenticated
    try {
      const token = readAuthToken(req);
      if (token) {
        recordUserActivity(token);
      }
    } catch (activityError) {
      console.error('[Metrics] Error recording user activity:', activityError);
    }
    
    // Capture original end method
    const originalEnd = res.end;
    
    // Override end method to capture metrics
    res.end = function(...args) {
      try {
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
      } catch (error) {
        console.error('[Metrics] Error in response end handler:', error);
      }
      
      // Call original end method
      return originalEnd.apply(this, args);
    };
    
    next();
  } catch (error) {
    console.error('[Metrics] Error in requestTracker middleware:', error);
    next(); // Continue even if there's an error in metrics
  }
};

// Enhanced database metrics tracking with error handling
const trackDbQuery = (duration, success = true, queryType = 'unknown') => {
  try {
    // Increment total query count
    metrics.dbQueries++;
    
    // Add query duration to total latency
    metrics.dbLatency += duration;
    
    // Track by query type (with safeguards)
    if (queryType && metrics.dbQueryTypes[queryType] !== undefined) {
      metrics.dbQueryTypes[queryType]++;
    } else {
      metrics.dbQueryTypes.unknown++;
    }
    
    // Track if it was a slow query
    if (duration > 300) { // 300ms threshold
      metrics.dbSlowQueries++;
    }
    
    // Track errors
    if (!success) {
      metrics.dbErrors++;
      metrics.dbQueryErrors++;
    }
  } catch (error) {
    console.error('[Metrics] Error tracking DB query:', error);
  }
};

// Track database connection errors
const trackDbConnectionError = () => {
  try {
    metrics.dbConnectionErrors++;
  } catch (error) {
    console.error('[Metrics] Error tracking DB connection error:', error);
  }
};

// Update connection pool metrics
const updateDbPoolMetrics = (totalConnections, usedConnections, queueSize = 0) => {
  try {
    sendMetricToGrafana('db_pool_size', totalConnections, 'gauge', '1');
    sendMetricToGrafana('db_pool_used', usedConnections, 'gauge', '1');
    sendMetricToGrafana('db_pool_queue', queueSize, 'gauge', '1');
  } catch (error) {
    console.error('[Metrics] Error updating DB pool metrics:', error);
  }
};

// Get current metrics for API endpoint
const getMetrics = () => {
  const avgLatency = metrics.requests > 0 ? metrics.latency / metrics.requests : 0;
  const errorRate = metrics.requests > 0 ? (metrics.errors / metrics.requests) * 100 : 0;
  const dbErrorRate = metrics.dbQueries > 0 ? (metrics.dbErrors / metrics.dbQueries) * 100 : 0;
  const avgDbLatency = metrics.dbQueries > 0 ? metrics.dbLatency / metrics.dbQueries : 0;
  const authSuccessRate = metrics.auth_attempts > 0 ? (metrics.auth_success / metrics.auth_attempts) * 100 : 0;
  const pizzaSuccessRate = (metrics.pizza_sales + metrics.pizza_sales_failures) > 0 ? 
    (metrics.pizza_sales / (metrics.pizza_sales + metrics.pizza_sales_failures)) * 100 : 0;
  
  return {
    system: {
      cpu: getCpuUsagePercentage().toFixed(2) + '%',
      memory: getMemoryUsagePercentage().toFixed(2) + '%',
      uptime: formatUptime(process.uptime())
    },
    http: {
      totalRequests: metrics.requests,
      requestsPerMinute: metrics.requests_per_minute,
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
      },
      requestsPerMinuteByMethod: {
        get: metrics.get_requests_per_minute,
        post: metrics.post_requests_per_minute,
        put: metrics.put_requests_per_minute,
        delete: metrics.delete_requests_per_minute
      }
    },
    authentication: {
      totalAttempts: metrics.auth_attempts,
      successfulAttempts: metrics.auth_success,
      failedAttempts: metrics.auth_failure,
      attemptsPerMinute: metrics.auth_attempts_per_minute,
      successPerMinute: metrics.auth_success_per_minute,
      failurePerMinute: metrics.auth_failure_per_minute,
      successRate: authSuccessRate.toFixed(2) + '%'
    },
    pizza: {
      totalSales: metrics.pizza_sales,
      totalFailures: metrics.pizza_sales_failures,
      totalRevenue: metrics.pizza_revenue.toFixed(8) + ' BTC',
      salesPerMinute: metrics.pizza_sales_per_minute,
      failuresPerMinute: metrics.pizza_failures_per_minute,
      revenuePerMinute: metrics.pizza_revenue_per_minute.toFixed(8) + ' BTC/min',
      successRate: pizzaSuccessRate.toFixed(2) + '%'
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
      signups: metrics.user_signUps,
      activeUsers: metrics.active_users
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

// Log message about metrics being enabled
console.log('[Metrics] Metrics system initialized');
// Log message about metrics being enabled
console.log('[Metrics] Metrics system initialized');

module.exports = {
  requestTracker,
  trackDbQuery,
  trackDbConnectionError,
  updateDbPoolMetrics,
  getMetrics,
  recordUserSignup,
  recordUserActivity,
  recordAuthAttempt,
  recordPizzaSale
};