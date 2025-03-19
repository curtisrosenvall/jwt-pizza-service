
const { recordPizzaSale } = require('./metrics');

// Middleware to track order creation and processing
const trackOrderCreation = (req, res, next) => {
    // Only track for order creation endpoint
    if (req.path === '/' && req.method === 'POST') {
      console.log('[Order Middleware] Monitoring order creation');
      
      // Save the original methods
      const originalSend = res.send;
      
      // Override send method to detect successful/failed orders
      res.send = function(_body) {
        try {
          // Still track metrics, but handle errors safely in test environment
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const orderItems = req.body?.items || [];
            recordPizzaSale(orderItems, true);
          } else {
            const orderItems = req.body?.items || [];
            recordPizzaSale(orderItems, false);
          }
        } catch (error) {
          // In test environment, log but don't let errors break the tests
          console.error('[Metrics] Error in order tracking:', error);
        }
        
        // Call the original send method
        return originalSend.apply(this, arguments);
      };
    }
    
    next();
  };


module.exports = {
  trackOrderCreation,
};