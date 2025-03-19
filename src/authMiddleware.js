// auth-middleware.js
const { recordAuthAttempt } = require('./metrics');

// Middleware to track authentication success
const trackAuthSuccess = (req, res, next) => {
  // Only intercept for the login endpoint (PUT /api/auth)
  if (req.path === '/api/auth' && req.method === 'PUT') {
    console.log('[Auth Middleware] Monitoring login attempt at:', req.path);
    
    // Capture original send method to intercept the response
    const originalSend = res.send;
    res.send = function(_body) {
      // If this is a successful response (2xx status code)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log('[Auth Middleware] Detected successful login');
        recordAuthAttempt(true);
      }
      
      // Call the original send method
      return originalSend.apply(this, arguments);
    };
  }
  next();
};

// Middleware to track authentication failures
const trackAuthFailure = (err, req, res, next) => {
    // Check if this is an auth endpoint
    if (req.path === '/api/auth' && req.method === 'PUT') {
      console.log('[Auth Middleware] Potential auth failure detected:', err?.message || 'Unknown error');
      
      // Record the failure - do this for any error on the auth endpoint
      recordAuthAttempt(false);
    }
    
    // Continue to the next error handler
    next(err);
  };

// Middleware to track token validation attempts
const trackTokenValidation = (req, res, next) => {
  // Only process requests with an Authorization header
  if (req.headers.authorization) {
    // Log that we're tracking this request
    console.log('[Auth Middleware] Monitoring token validation for:', req.path);
    
    // Capture the original send method
    const originalSend = res.send;
    res.send = function(_body) {
      // If this is an endpoint that requires auth
      if (isProtectedEndpoint(req.path)) {
        if (res.statusCode === 401) {
          // Token validation failed
          console.log('[Auth Middleware] Detected failed token validation');
          recordAuthAttempt(false);
        } else if (res.statusCode >= 200 && res.statusCode < 300) {
          // Token validation succeeded
          console.log('[Auth Middleware] Detected successful token validation');
          recordAuthAttempt(true);
        }
      }
      
      // Call the original send method
      return originalSend.apply(this, arguments);
    };
  }
  next();
};

// Helper function to determine if an endpoint is protected
function isProtectedEndpoint(path) {
  // List of paths that require authentication
  const protectedPaths = [
    '/api/auth/', // User update endpoints
    '/api/order',
    '/api/franchise'
  ];
  
  // Check if the path starts with any of the protected paths
  return protectedPaths.some(prefix => path.startsWith(prefix));
}

// Middleware to track authentication success/failure without using error middleware
// Modify trackAuth middleware to count only once per request:
const trackAuth = (req, res, next) => {
    // Only track for login endpoint
    if (req.path === '/api/auth' && req.method === 'PUT') {
      console.log('[Auth Middleware] Monitoring login attempt');
      
      // Add a flag to ensure we only count once
      let authTracked = false;
      
      // Track the authentication result exactly once
      const trackOnce = (success) => {
        if (!authTracked) {
          authTracked = true;
          recordAuthAttempt(success);
        }
      };
      
      // Save the original methods
      const originalJson = res.json;
      
      // Only intercept the primary response method
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