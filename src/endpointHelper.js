const metrics = require('./metrics');

class StatusCodeError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(err => {
    // Log error details
    console.error(`[ERROR] ${req.method} ${req.path}: ${err.message}`);
    
    // Pass to next error handler
    next(err);
  });
};

module.exports = {
  asyncHandler,
  StatusCodeError,
};
