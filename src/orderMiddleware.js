const { recordPizzaSale } = require('./metrics');

// Middleware to track order creation and processing
const trackOrderCreation = (req, res, next) => {
    // Only track for order creation endpoint
    if (req.path === '/' && req.method === 'POST') {
      console.log('[Order Middleware] Monitoring order creation');
      
      // Record start time for latency tracking
      const startTime = Date.now();
      
      // Save the original methods
      const originalSend = res.send;
      
      // Override send method to detect successful/failed orders
      res.send = function(_body) {
        try {
          // Calculate processing duration
          const duration = Date.now() - startTime;
          
          // Still track metrics, but handle errors safely in test environment
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const orderItems = req.body?.items || [];
            // Pass duration to recordPizzaSale
            recordPizzaSale(orderItems, true, duration);
          } else {
            const orderItems = req.body?.items || [];
            recordPizzaSale(orderItems, false, duration);
          }
          
          // Log the pizza creation latency
          console.log(`[Metrics] Pizza creation latency: ${duration}ms`);
        } catch (error) {
          // In test environment, log but don't let errors break the tests
          console.error('[Metrics] Error in order tracking:', error);
        }
        
        // Call the original send method
        return originalSend.apply(this, arguments);
      };
    }
    console.log(`[Metrics Debug] Sending pizza_creation_latency = ${duration}ms`);

    next();
  };


module.exports = {
  trackOrderCreation,
};