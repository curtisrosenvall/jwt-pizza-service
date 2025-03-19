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
  delete_requests: 0
};

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

function sendMetricToGrafana(metricName, metricValue, type, unit) {
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
      })
      .catch((error) => {
        console.error(`[Metrics Error] Error pushing metric ${metricName}:`, error);
      });
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

// Database metrics tracking
const trackDbQuery = (duration, success = true) => {
  metrics.dbQueries++;
  metrics.dbLatency += duration;
  
  if (!success) {
    metrics.dbErrors++;
  }
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
      avgLatency: avgDbLatency.toFixed(2) + 'ms'
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

module.exports = {
  requestTracker,
  trackDbQuery,
  getMetrics
};