const config = require('./config');
const os = require('os');


const metrics = {
  
  // requests: 0,
  latency: 0,
  statusCodes: {},
  endpoints: {},
  errors: 0,
  get_requests: 0,
  post_requests: 0,
  put_requests: 0,
  delete_requests: 0,
  last_pizza_sale_timestamp: Date.now(),
  
  
  user_signUps: 0,
  user_signUps_delta: 0,
  active_users: 0,
  active_user_sessions: new Map(), 
  
  
  // auth_attempts: 0,
  auth_success: 0,
  auth_failure: 0,
  
  
  auth_attempts_per_minute: 0,
  auth_success_per_minute: 0,
  auth_failure_per_minute: 0,
  
  
  current_minute_auth_attempts: 0,
  current_minute_auth_success: 0,
  current_minute_auth_failure: 0,
  
  
  pizza_sales: 0,
  pizza_sales_failures: 0,
  pizza_revenue: 0,
  
  
  pizza_sales_per_minute: 0,
  pizza_failures_per_minute: 0,
  pizza_revenue_per_minute: 0,
  total_pizzas_last_order: 0,
  
  
  current_minute_pizza_sales: 0,
  current_minute_pizza_failures: 0,
  current_minute_pizza_revenue: 0,
  
  // Pizza latency metrics
  pizza_latency_total: 0,
  pizza_latency_count: 0,
  pizza_latency_avg: 0,
  pizza_latency_max: 0,
  pizza_latency_min: Infinity,
  
  // Pizza latency per minute
  pizza_latency_per_minute: 0,
  current_minute_pizza_latency: 0,
  current_minute_pizza_latency_count: 0,
  
  // Pizza processing stages latency metrics
  pizza_preparation_latency: 0,
  pizza_baking_latency: 0,
  pizza_packaging_latency: 0,
  pizza_payment_processing_latency: 0,
  
  
  requests_per_minute: 0,
  get_requests_per_minute: 0,
  post_requests_per_minute: 0,
  put_requests_per_minute: 0,
  delete_requests_per_minute: 0,
  
  
  current_minute_requests: 0,
  current_minute_get: 0,
  current_minute_post: 0,
  current_minute_put: 0,
  current_minute_delete: 0,
  
  
  last_minute_timestamp: Date.now(),
  
  
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


const factoryMetrics = {
  requests: {},
  errors: {},
  durations: []
};


const recentSignups = new Map();


const recentOrders = new Map();


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
        
        
        const stack = new Error().stack;
        console.log('Changed from:');
        console.log(stack.split('\n').slice(1, 5).join('\n')); 
        
        console.log('--------------------------------------------');
      }
      userSignUpsValue = newValue;
    },
    enumerable: true,
    configurable: true
  });
};


trackMetricsChanges();


function calculateRequestsPerMinute() {
  const now = Date.now();
  const elapsedMs = now - metrics.last_minute_timestamp;
  
  if (now - metrics.last_pizza_sale_timestamp > 30000) { // 30 seconds
    metrics.current_minute_pizza_sales = 0;
  }
  
  if (elapsedMs >= 5000) {
    
    const minuteRatio = 60000 / elapsedMs;
    
    metrics.requests_per_minute = Math.round(metrics.current_minute_requests * minuteRatio);
    metrics.get_requests_per_minute = Math.round(metrics.current_minute_get * minuteRatio);
    metrics.post_requests_per_minute = Math.round(metrics.current_minute_post * minuteRatio);
    metrics.put_requests_per_minute = Math.round(metrics.current_minute_put * minuteRatio);
    metrics.delete_requests_per_minute = Math.round(metrics.current_minute_delete * minuteRatio);
    
    
    metrics.auth_attempts_per_minute = Math.round(metrics.current_minute_auth_attempts * minuteRatio);
    metrics.auth_success_per_minute = Math.round(metrics.current_minute_auth_success * minuteRatio);
    metrics.auth_failure_per_minute = Math.round(metrics.current_minute_auth_failure * minuteRatio);
    
    
    metrics.pizza_sales_per_minute = metrics.current_minute_pizza_sales;
    metrics.pizza_failures_per_minute = Math.round(metrics.current_minute_pizza_failures * minuteRatio);
    metrics.pizza_revenue_per_minute = parseFloat((metrics.current_minute_pizza_revenue * minuteRatio).toFixed(8));
    
    // New pizza latency calculation
    if (metrics.current_minute_pizza_latency_count > 0) {
      // Calculate average latency per minute
      metrics.pizza_latency_per_minute = Math.round(
        metrics.current_minute_pizza_latency / metrics.current_minute_pizza_latency_count
      );
    } else {
      metrics.pizza_latency_per_minute = 0;
    }
    
    
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
    metrics.current_minute_pizza_latency = 0;
    metrics.current_minute_pizza_latency_count = 0;
    
    
    metrics.last_minute_timestamp = now;
    
    
    if (metrics.requests_per_minute > 0) {
      console.log(`[Metrics] Requests per minute: ${metrics.requests_per_minute} (total)`);
    }
    
    
    if (metrics.auth_attempts_per_minute > 0) {
      console.log(`[Metrics] Auth attempts per minute: ${metrics.auth_attempts_per_minute} ` +
                 `(Success: ${metrics.auth_success_per_minute}, ` +
                 `Failure: ${metrics.auth_failure_per_minute})`);
    }
    
    
    if (metrics.pizza_sales_per_minute > 0 || metrics.pizza_failures_per_minute > 0) {
      console.log(`[Metrics] Pizza metrics - Sales: ${metrics.pizza_sales_per_minute}/min, ` +
                 `Failures: ${metrics.pizza_failures_per_minute}/min, ` +
                 `Revenue: ${metrics.pizza_revenue_per_minute.toFixed(8)} BTC/min, ` +
                 `Avg Latency: ${metrics.pizza_latency_per_minute}ms`);
    }
  }
}


function recordAuthAttempt(success) {
  try {
    
    // metrics.auth_attempts++;
    metrics.current_minute_auth_attempts++;
    
    
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


function recordPizzaSale(items, success = true, duration = 0, stagesLatency = {}) {
  try {
    metrics.last_pizza_sale_timestamp = Date.now();
    const orderItems = items || [];
    const orderId = `${Date.now()}-${orderItems.length}`;
    
    
    if (recentOrders.has(orderId)) {
      console.log(`[Metrics] Prevented duplicate order tracking: ${orderId}`);
      return;
    }
    

    
    recentOrders.set(orderId, Date.now());
    
    
    if (recentOrders.size > 100) {
      const expireTime = Date.now() - 5000; 
      for (const [key, time] of recentOrders.entries()) {
        if (time < expireTime) {
          recentOrders.delete(key);
        }
      }
    }
    
    if (success) {
      
      const pizzaCount = orderItems.length;
      console.log('[Metrics Debug] Order items:', JSON.stringify(orderItems));
      console.log('[Metrics Debug] Recording order with ID:', orderId);
      metrics.pizza_sales += pizzaCount;
      metrics.current_minute_pizza_sales += pizzaCount;
      
      metrics.total_pizzas_last_order = pizzaCount;
      sendMetricToGrafana('total_pizzas_last_order', pizzaCount, 'gauge', 'pizzas');
      
      const revenue = orderItems.reduce((total, item) => total + (parseFloat(item.price) || 0), 0);
      metrics.pizza_revenue += revenue;
      metrics.current_minute_pizza_revenue += revenue;
      
      console.log(`[Metrics] Recorded sale of ${pizzaCount} pizzas, revenue: ${revenue.toFixed(8)} BTC`);
      
      // Enhanced latency tracking
      if (duration > 0) {
        // Update total latency metrics
        metrics.pizza_latency_total += duration;
        metrics.pizza_latency_count++;
        
        // Update per-minute latency metrics
        metrics.current_minute_pizza_latency += duration;
        metrics.current_minute_pizza_latency_count++;
        
        // Update min/max latency
        metrics.pizza_latency_max = Math.max(metrics.pizza_latency_max, duration);
        metrics.pizza_latency_min = duration < metrics.pizza_latency_min ? duration : metrics.pizza_latency_min;
        
        // Calculate average latency
        metrics.pizza_latency_avg = metrics.pizza_latency_total / metrics.pizza_latency_count;
        
        // Log latency
        console.log(`[Metrics] Pizza order processing time: ${duration}ms (avg: ${metrics.pizza_latency_avg.toFixed(2)}ms)`);
        
        // Send latency metric to Grafana
        sendMetricToGrafana('pizza_order_latency', duration, 'gauge', 'ms');
        sendMetricToGrafana('pizza_order_latency_avg', metrics.pizza_latency_avg, 'gauge', 'ms');
      }
      
      // Track detailed processing stages if provided
      if (stagesLatency) {
        if (stagesLatency.preparation) {
          metrics.pizza_preparation_latency += stagesLatency.preparation;
          sendMetricToGrafana('pizza_preparation_latency', stagesLatency.preparation, 'gauge', 'ms');
        }
        
        if (stagesLatency.baking) {
          metrics.pizza_baking_latency += stagesLatency.baking;
          sendMetricToGrafana('pizza_baking_latency', stagesLatency.baking, 'gauge', 'ms');
        }
        
        if (stagesLatency.packaging) {
          metrics.pizza_packaging_latency += stagesLatency.packaging;
          sendMetricToGrafana('pizza_packaging_latency', stagesLatency.packaging, 'gauge', 'ms');
        }
        
        if (stagesLatency.payment) {
          metrics.pizza_payment_processing_latency += stagesLatency.payment;
          sendMetricToGrafana('pizza_payment_processing_latency', stagesLatency.payment, 'gauge', 'ms');
        }
      }
    } else {
      
      metrics.pizza_sales_failures++;
      metrics.current_minute_pizza_failures++;
      console.log('[Metrics] Recorded pizza order failure');
      
      // Also track latency for failed orders if available
      if (duration > 0) {
        sendMetricToGrafana('pizza_failed_order_latency', duration, 'gauge', 'ms');
      }
    }
  } catch (error) {
    console.error('[Metrics] Error recording pizza sale:', error);
  }
}

function updateActiveUserCount() {
  const now = Date.now();
  const activeWindowMs = 15 * 60 * 1000; 
  const expiryTime = now - activeWindowMs;
  
  
  for (const [token, timestamp] of metrics.active_user_sessions.entries()) {
    if (timestamp < expiryTime) {
      metrics.active_user_sessions.delete(token);
    }
  }
  
  
  metrics.active_users = metrics.active_user_sessions.size;
  
  
  if (metrics.active_users > 0) {
    console.log(`[Metrics] Active users in last 15 minutes: ${metrics.active_users}`);
  }
}


function recordUserActivity(token) {
  if (!token) return;
  
  
  metrics.active_user_sessions.set(token, Date.now());
}


setInterval(() => {
  
  calculateRequestsPerMinute();
  
  
  updateActiveUserCount();

  
  const cpuValue = getCpuUsagePercentage();
  sendMetricToGrafana('cpu', cpuValue, 'gauge', '%');

  
  const memoryValue = getMemoryUsagePercentage();
  sendMetricToGrafana('memory', memoryValue, 'gauge', '%');

  
  // sendMetricToGrafana('requests', metrics.requests, 'sum', '1');

  
  sendMetricToGrafana('get_requests', metrics.get_requests || 0, 'sum', '1');
  sendMetricToGrafana('post_requests', metrics.post_requests || 0, 'sum', '1');
  sendMetricToGrafana('put_requests', metrics.put_requests || 0, 'sum', '1');
  sendMetricToGrafana('delete_requests', metrics.delete_requests || 0, 'sum', '1');

  
  sendMetricToGrafana('requests_per_minute', metrics.requests_per_minute, 'gauge', 'rpm');
  sendMetricToGrafana('get_requests_per_minute', metrics.get_requests_per_minute, 'gauge', 'rpm');
  sendMetricToGrafana('post_requests_per_minute', metrics.post_requests_per_minute, 'gauge', 'rpm');
  sendMetricToGrafana('put_requests_per_minute', metrics.put_requests_per_minute, 'gauge', 'rpm');
  sendMetricToGrafana('delete_requests_per_minute', metrics.delete_requests_per_minute, 'gauge', 'rpm');

  
  sendMetricToGrafana('auth_attempts_per_minute', metrics.auth_attempts_per_minute, 'gauge', 'rpm');
  sendMetricToGrafana('auth_success_per_minute', metrics.auth_success_per_minute, 'gauge', 'rpm');
  sendMetricToGrafana('auth_failure_per_minute', metrics.auth_failure_per_minute, 'gauge', 'rpm');

  
  sendMetricToGrafana('pizza_sales_per_minute', metrics.pizza_sales_per_minute, 'gauge', 'pizzas/min');
  sendMetricToGrafana('pizza_failures_per_minute', metrics.pizza_failures_per_minute, 'gauge', 'failures/min');
  sendMetricToGrafana('pizza_revenue_per_minute', metrics.pizza_revenue_per_minute, 'gauge', 'BTC/min');

  // Add new pizza latency metrics
  sendMetricToGrafana('pizza_order_latency_avg', metrics.pizza_latency_avg, 'gauge', 'ms');
  sendMetricToGrafana('pizza_latency_per_minute', metrics.pizza_latency_per_minute, 'gauge', 'ms');
  sendMetricToGrafana('pizza_latency_max', metrics.pizza_latency_max, 'gauge', 'ms');
  sendMetricToGrafana('pizza_latency_min', metrics.pizza_latency_min === Infinity ? 0 : metrics.pizza_latency_min, 'gauge', 'ms');
  sendMetricToGrafana('total_pizzas_last_order', metrics.total_pizzas_last_order, 'gauge', 'pizzas');

  
  sendMetricToGrafana('active_users', metrics.active_users, 'gauge', 'users');

  
  sendMetricToGrafana('latency', metrics.latency, 'sum', 'ms');

  
  const errorRate = metrics.requests > 0 ? (metrics.errors / metrics.requests) * 100 : 0;
  sendMetricToGrafana('error_rate', errorRate, 'gauge', '%');

  
  sendMetricToGrafana('db_queries', metrics.dbQueries, 'sum', '1');
  sendMetricToGrafana('db_errors', metrics.dbErrors, 'sum', '1');
  sendMetricToGrafana('db_latency', metrics.dbLatency, 'sum', 'ms');
  
  
  if (metrics.user_signUps_delta > 0) {
    console.log(`Sending user_signup delta: ${metrics.user_signUps_delta}`);
    sendMetricToGrafana('user_signup', metrics.user_signUps_delta, 'sum', '1');
    
    
    metrics.user_signUps_delta = 0;
  }
  
  
  sendMetricToGrafana('db_connection_errors', metrics.dbConnectionErrors, 'sum', '1');
  sendMetricToGrafana('db_query_errors', metrics.dbQueryErrors, 'sum', '1');
  sendMetricToGrafana('db_slow_queries', metrics.dbSlowQueries, 'sum', '1');
  
  
  Object.entries(metrics.dbQueryTypes).forEach(([type, count]) => {
    sendMetricToGrafana(`db_query_${type}`, count, 'sum', '1');
  });
  
  
  const avgDbQueryTime = metrics.dbQueries > 0 ? metrics.dbLatency / metrics.dbQueries : 0;
  sendMetricToGrafana('avg_db_query_time', avgDbQueryTime, 'gauge', 'ms');
  
  
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


function readAuthToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    return authHeader.split(' ')[1];
  }
  return null;
}

function recordUserSignup(userData) {
  const email = userData?.email || 'unknown';
  
  
  const now = Date.now();
  if (recentSignups.has(email)) {
    const lastTime = recentSignups.get(email);
    if (now - lastTime < 2000) { 
      console.log(`[METRICS] Prevented duplicate signup for ${email} (${now - lastTime}ms since last call)`);
      return;
    }
  }
  
  
  recentSignups.set(email, now);
  
  
  if (recentSignups.size > 100) {
    const expireTime = now - 5000; 
    for (const [key, time] of recentSignups.entries()) {
      if (time < expireTime) {
        recentSignups.delete(key);
      }
    }
  }
  
  console.log('METRICS: Recording user signup for', email);
  try {
    
    metrics.user_signUps++;
    
    
    metrics.user_signUps_delta++;
    
    
    console.log(`[METRIC] User signup: ${email}, total: ${metrics.user_signUps}, delta: ${metrics.user_signUps_delta}`);
  } catch (error) {
    console.error('Failed to record user signup metric:', error);
  }
}



function originalSendMetricToGrafana(metricName, metricValue, type, unit) {
  if (!config.metrics || !config.metrics.apiKey || !config.metrics.url) {
    console.log(`[Metrics] Skipping metric ${metricName} - Missing configuration`);
    return;
  }
  
  
  const isDecimalValue = Number(metricValue) !== Math.floor(Number(metricValue));
  
  
  let dataPoint;
  
  if (isDecimalValue) {
    
    dataPoint = { asDouble: Number(metricValue) };
    console.log(`[Metrics Debug] Using asDouble for decimal metric ${metricName} = ${metricValue}`);
  } else {
    
    dataPoint = { asInt: Math.round(Number(metricValue)) };
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
                      ...dataPoint,
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
  
  
  if (metricName === 'pizza_revenue_per_minute') {
    console.log(`[Metrics Debug] Sending revenue metric payload:`);
    console.log(JSON.stringify(metric, null, 2));
  }
  
  
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
      
      const isImportantMetric = [
        'user_signup', 
        'active_users', 
        'auth_success_per_minute', 
        'auth_failure_per_minute',
        'pizza_sales_per_minute',
        'pizza_failures_per_minute',
        'pizza_revenue_per_minute',
        'pizza_order_latency_avg',
        'pizza_latency_per_minute'
      ].includes(metricName);
      
      if (!response.ok) {
        response.text().then((text) => {
          console.error(`[Metrics Error] Failed to push data to Grafana: ${text}`);
        });
      } else if (isImportantMetric) {
        
        const valueTypeStr = isDecimalValue ? 'asDouble' : 'asInt';
        console.log(`[Metrics] Successfully sent metric: ${metricName} = ${metricValue} (using ${valueTypeStr})`);
      }
    })
    .catch((error) => {
      console.error(`[Metrics Error] Error pushing metric ${metricName}:`, error);
    });
}


function sendMetricToGrafana(metricName, metricValue, type, unit) {
  if (metricName === 'user_signup') {
    console.log(`---------- SENDING USER SIGNUP METRIC ----------`);
    console.log(`Sending user_signup metric with value: ${metricValue}, type: ${type}, unit: ${unit}`);
  }
  
  return originalSendMetricToGrafana(metricName, metricValue, type, unit);
}


const requestTracker = (req, res, next) => {
  try {
    const start = Date.now();
    
    // Increment total requests
    // metrics.requests++;
    metrics.current_minute_requests++;
    
    // Update method-specific counters - Fixed to use explicit properties
    const method = req.method.toLowerCase();
    switch (method) {
      case 'get':
        metrics.get_requests++;
        metrics.current_minute_get++;
        break;
      case 'post':
        metrics.post_requests++;
        metrics.current_minute_post++;
        break;
      case 'put':
        metrics.put_requests++;
        metrics.current_minute_put++;
        break;
      case 'delete':
        metrics.delete_requests++;
        metrics.current_minute_delete++;
        break;
      default:
        console.log(`[Metrics] Unknown HTTP method: ${req.method}`);
    }
    
    // Track endpoints
    const endpoint = `${req.method} ${req.path}`;
    metrics.endpoints[endpoint] = (metrics.endpoints[endpoint] || 0) + 1;
    
    // Record user activity
    try {
      const token = readAuthToken(req);
      if (token) {
        recordUserActivity(token);
      }
    } catch (activityError) {
      console.error('[Metrics] Error recording user activity:', activityError);
    }
    
    // Track response
    const originalEnd = res.end;
    
    res.end = function(...args) {
      try {
        // Calculate request duration
        const duration = Date.now() - start;
        
        // Update latency metrics
        metrics.latency += duration;
        
        // Send latency metric to Grafana
        sendMetricToGrafana('request_latency', duration, 'gauge', 'ms');
      } catch (error) {
        console.error('[Metrics] Error in response end handler:', error);
      }
      
      // Call the original end method
      return originalEnd.apply(this, args);
    };
    
    next();
  } catch (error) {
    console.error('[Metrics] Error in requestTracker middleware:', error);
    next(); 
  }
};

const trackDbQuery = (duration, success = true, queryType = 'unknown') => {
  try {
    metrics.dbQueries++;
    
    metrics.dbLatency += duration;
    
    if (queryType && metrics.dbQueryTypes[queryType] !== undefined) {
      metrics.dbQueryTypes[queryType]++;
    } else {
      metrics.dbQueryTypes.unknown++;
    }
    

    if (duration > 300) { 
      metrics.dbSlowQueries++;
    }
    

    if (!success) {
      metrics.dbErrors++;
      metrics.dbQueryErrors++;
    }
  } catch (error) {
    console.error('[Metrics] Error tracking DB query:', error);
  }
};

const trackDbConnectionError = () => {
  try {
    metrics.dbConnectionErrors++;
  } catch (error) {
    console.error('[Metrics] Error tracking DB connection error:', error);
  }
};

const updateDbPoolMetrics = (totalConnections, usedConnections, queueSize = 0) => {
  try {
    sendMetricToGrafana('db_pool_size', totalConnections, 'gauge', '1');
    sendMetricToGrafana('db_pool_used', usedConnections, 'gauge', '1');
    sendMetricToGrafana('db_pool_queue', queueSize, 'gauge', '1');
  } catch (error) {
    console.error('[Metrics] Error updating DB pool metrics:', error);
  }
};

function trackFactoryRequest(endpoint, method, statusCode, duration) {
  const key = `${method}:${endpoint}`;
  
  if (!factoryMetrics.requests[key]) {
    factoryMetrics.requests[key] = {
      success: 0,
      failure: 0,
      totalDuration: 0,
      count: 0
    };
  }
  
  factoryMetrics.requests[key].count++;
  factoryMetrics.requests[key].totalDuration += duration;
  

  if (statusCode >= 200 && statusCode < 300) {
    factoryMetrics.requests[key].success++;
  } else {
    factoryMetrics.requests[key].failure++;
  }
  

  factoryMetrics.durations.push({
    endpoint,
    method,
    statusCode,
    duration,
    timestamp: Date.now()
  });
  

  if (factoryMetrics.durations.length > 1000) {
    factoryMetrics.durations.shift();
  }
  
  
}

function trackFactoryError(endpoint, method, statusCode) {
  const key = `${method}:${endpoint}:${statusCode}`;
  

  if (!factoryMetrics.errors[key]) {
    factoryMetrics.errors[key] = 0;
  }
  factoryMetrics.errors[key]++;
  

  console.log(`[Metrics] Factory error: ${method} ${endpoint} - Status: ${statusCode}`);
}

function getFactoryMetrics() {
  return {
    ...factoryMetrics,
    summary: {
      totalRequests: Object.values(factoryMetrics.requests).reduce((sum, val) => sum + val.count, 0),
      totalErrors: Object.values(factoryMetrics.errors).reduce((sum, val) => sum + val, 0),
      averageDuration: factoryMetrics.durations.length > 0 
        ? factoryMetrics.durations.reduce((sum, val) => sum + val.duration, 0) / factoryMetrics.durations.length 
        : 0
    }
  };
}



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
      // totalRequests: metrics.requests,
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
      successRate: pizzaSuccessRate.toFixed(2) + '%',
      // Add latency metrics
      avgLatency: metrics.pizza_latency_avg.toFixed(2) + 'ms',
      maxLatency: metrics.pizza_latency_max + 'ms',
      minLatency: (metrics.pizza_latency_min === Infinity ? 0 : metrics.pizza_latency_min) + 'ms',
      latencyPerMinute: metrics.pizza_latency_per_minute + 'ms',
      processingStages: {
        preparation: metrics.pizza_preparation_latency > 0 ? (metrics.pizza_preparation_latency / metrics.pizza_latency_count).toFixed(2) + 'ms' : '0ms',
        baking: metrics.pizza_baking_latency > 0 ? (metrics.pizza_baking_latency / metrics.pizza_latency_count).toFixed(2) + 'ms' : '0ms',
        packaging: metrics.pizza_packaging_latency > 0 ? (metrics.pizza_packaging_latency / metrics.pizza_latency_count).toFixed(2) + 'ms' : '0ms',
        payment: metrics.pizza_payment_processing_latency > 0 ? (metrics.pizza_payment_processing_latency / metrics.pizza_latency_count).toFixed(2) + 'ms' : '0ms'
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
      signups: metrics.user_signUps,
      activeUsers: metrics.active_users
    }
  };
};


function getTopEndpoints(n) {
  return Object.entries(metrics.endpoints)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .reduce((obj, [key, value]) => {
      obj[key] = value;
      return obj;
    }, {});
}
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
  recordPizzaSale,
  trackFactoryRequest,
  trackFactoryError,
  getFactoryMetrics
};