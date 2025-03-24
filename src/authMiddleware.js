
const { recordAuthAttempt } = require('./metrics');


const trackAuthSuccess = (req, res, next) => {
  
  if (req.path === '/api/auth' && req.method === 'PUT') {
    console.log('[Auth Middleware] Monitoring login attempt at:', req.path);
    
    
    const originalSend = res.send;
    res.send = function(_body) {
      
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log('[Auth Middleware] Detected successful login');
        recordAuthAttempt(true);
      }
      
      
      return originalSend.apply(this, arguments);
    };
  }
  next();
};


const trackAuthFailure = (err, req, res, next) => {
    
    if (req.path === '/api/auth' && req.method === 'PUT') {
      console.log('[Auth Middleware] Potential auth failure detected:', err?.message || 'Unknown error');
      
      
      recordAuthAttempt(false);
    }
    
    
    next(err);
  };


const trackTokenValidation = (req, res, next) => {
  
  if (req.headers.authorization) {
    
    console.log('[Auth Middleware] Monitoring token validation for:', req.path);
    
    
    const originalSend = res.send;
    res.send = function(_body) {
      
      if (isProtectedEndpoint(req.path)) {
        if (res.statusCode === 401) {
          
          console.log('[Auth Middleware] Detected failed token validation');
          recordAuthAttempt(false);
        } else if (res.statusCode >= 200 && res.statusCode < 300) {
          
          console.log('[Auth Middleware] Detected successful token validation');
          recordAuthAttempt(true);
        }
      }
      
      
      return originalSend.apply(this, arguments);
    };
  }
  next();
};


function isProtectedEndpoint(path) {
  
  const protectedPaths = [
    '/api/auth/', 
    '/api/order',
    '/api/franchise'
  ];
  
  
  return protectedPaths.some(prefix => path.startsWith(prefix));
}



const trackAuth = (req, res, next) => {
    
    if (req.path === '/api/auth' && req.method === 'PUT') {
      console.log('[Auth Middleware] Monitoring login attempt');
      
      
      let authTracked = false;
      
      
      const trackOnce = (success) => {
        if (!authTracked) {
          authTracked = true;
          recordAuthAttempt(success);
        }
      };
      
      
      const originalJson = res.json;
      
      
      res.json = function(_body) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('[Auth Middleware] Successful login detected');
          trackOnce(true);
        } else {
          console.log('[Auth Middleware] Failed login detected:', res.statusCode);
          trackOnce(false);
        }
        return originalJson.apply(this, arguments);
      };
    }
    
    next();
  };

module.exports = {
  trackAuthSuccess,
  trackAuthFailure,
  trackTokenValidation,
  trackAuth
};