const config = require('./config');

class Logger {
  constructor() {
    console.log('[Logger] Initializing logger with configuration:');
    console.log('[Logger] URL configured:', !!config.logging.url);
    if (!config.logging.url) {
      console.log('[Logger] WARNING: Grafana URL not configured in config.json');
    }
    console.log('[Logger] User ID configured:', !!config.logging.userId);
    console.log('[Logger] API Key configured:', !!(config.logging.apiKey && config.logging.apiKey.length > 0));
    console.log('[Logger] Source configured:', config.logging.source || 'undefined');
  }


  httpLogger = (req, res, next) => {
    console.log(`[Logger] HTTP Request: ${req.method} ${req.originalUrl || req.url}`);
    

    req._startTime = Date.now();
    
    const originalUrl = req.originalUrl || req.url;
    const method = req.method;
    
    const hasAuthorization = !!req.headers.authorization;
    
    const reqBody = req.body ? JSON.stringify(req.body) : '{}';
    
    const originalSend = res.send;
    
    res.send = function(resBody) {
      const responseTime = Date.now() - req._startTime;
      
      console.log(`[Logger] HTTP Response: ${method} ${originalUrl} - Status: ${res.statusCode} - Time: ${responseTime}ms`);
      
      let parsedResBody = resBody;
      if (typeof resBody === 'string') {
        try {
          parsedResBody = JSON.parse(resBody);
        } catch (error) {
          parsedResBody = resBody;
        }
      }
      
      const user = req.user || {}; 
      
      const logData = {
        authorized: hasAuthorization,
        path: originalUrl,
        method: method,
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        reqBody: reqBody,
        resBody: typeof parsedResBody === 'object' ? JSON.stringify(parsedResBody) : String(parsedResBody),
        userName: user.name || 'anonymous',
        userEmail: user.email || 'anonymous'
      };
      
      const level = this.statusToLogLevel(res.statusCode);
      this.log(level, 'http', logData);
            res.send = originalSend;
      return originalSend.call(res, resBody); 
    }.bind(this);
    
    next();
  };

  dbLogger = (query, params, user = null) => {
    console.log(`[Logger] Database Query: ${this.truncateSql(query).substring(0, 100)}${query.length > 100 ? '...' : ''}`);
    
    const logData = {
      query: this.truncateSql(query),
      params: params ? JSON.stringify(params) : null,
      ...(user && { userName: user.name || 'unknown', userEmail: user.email || 'unknown' })
    };
    
    this.log('info', 'database', logData);
  };

  factoryLogger = (endpoint, method, requestData, responseData, statusCode, user = null) => {
    console.log(`[Logger] Factory Service: ${method} ${endpoint} - Status: ${statusCode}`);
    
    const logData = {
      endpoint: endpoint,
      method: method,
      requestData: requestData ? JSON.stringify(requestData) : null,
      responseData: responseData ? JSON.stringify(responseData) : null,
      statusCode: statusCode,
      ...(user && { userName: user.name || 'unknown', userEmail: user.email || 'unknown' })
    };
    
    const level = this.statusToLogLevel(statusCode);
    this.log(level, 'factory', logData);
  };

  errorLogger = (err, req, res, next) => {
    console.log(`[Logger] Error: ${err.message}`);
    
    const user = req?.user || {}; 
    
    const logData = {
      message: err.message,
      stack: err.stack,
      path: req?.originalUrl || 'unknown',
      method: req?.method || 'unknown',
      statusCode: err.statusCode || 500,
      userName: user.name || 'anonymous',
      userEmail: user.email || 'anonymous'
    };
    
    this.log('error', 'exception', logData);
    next(err);
  };

  log(level, type, logData, user = null) {
    console.log(`[Logger] Logging ${level} event of type ${type}`);
    
    if (user && !logData.userName) {
      logData.userName = user.name || 'unknown';
      logData.userEmail = user.email || 'unknown';
    }
    
    const labels = { 
      component: config.logging.source, 
      level: level, 
      type: type,
      ...(logData.userEmail && logData.userEmail !== 'anonymous' && { user: logData.userEmail })
    };
    
    const values = [this.nowString(), this.sanitize(logData)];
    const logEvent = { streams: [{ stream: labels, values: [values] }] };

    if (process.env.NODE_ENV === 'development') {
      console.log(`[${level.toUpperCase()}] [${type}] ${JSON.stringify(this.sanitize(logData))}`);
    }

    this.sendLogToGrafana(logEvent);
  }

  statusToLogLevel(statusCode) {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
  }

  truncateSql(sql) {
    const maxLength = 2000; 
    if (sql && sql.length > maxLength) {
      return sql.substring(0, maxLength) + '... [truncated]';
    }
    return sql;
  }

  nowString() {
    return (Math.floor(Date.now()) * 1000000).toString();
  }

  sanitize(logData) {
    if (!logData) return '{}';
    
    let sanitizedData = JSON.stringify(logData);
    
    const patterns = [
      { regex: /\\"password\\":\s*\\"[^"]*\\"/g, replacement: '\\"password\\": \\"*****\\"' },
      { regex: /\\"[aA]uthorization\\":\s*\\"[^"]*\\"/g, replacement: '\\"Authorization\\": \\"*****\\"' },
    ];
    
    patterns.forEach(pattern => {
      sanitizedData = sanitizedData.replace(pattern.regex, pattern.replacement);
    });
    
    return sanitizedData;
  }

  sendLogToGrafana(event) {
    if (!config.logging.url) {
      return;
    }

    console.log(`[Logger] Attempting to send log to Grafana at: ${config.logging.url}`);
    
    const body = JSON.stringify(event);
    fetch(`${config.logging.url}`, {
      method: 'post',
      body: body,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.logging.userId}:${config.logging.apiKey}`,
      },
    }).then((res) => {
      if (!res.ok) {
        console.log(`[Logger] Failed to send log to Grafana: ${res.status} ${res.statusText}`);
      } else {
        console.log(`[Logger] Successfully sent log to Grafana: ${res.status}`);
      }
    }).catch(err => {
      console.error(`[Logger] Error sending log to Grafana: ${err.message}`);
    });
  }
}

module.exports = new Logger();