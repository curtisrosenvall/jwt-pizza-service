const { recordPizzaSale } = require('./metrics');


const trackOrderCreation = (req, res, next) => {
    
    if (req.path === '/' && req.method === 'POST') {
      console.log('[Order Middleware] Monitoring order creation');
      
      
      const startTime = Date.now();
      
      
      const originalSend = res.send;
      
      
      res.send = function(_body) {
        try {
          
          const duration = Date.now() - startTime;
          
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const orderItems = req.body?.items || [];
            
            recordPizzaSale(orderItems, true, duration);
          } else {
            const orderItems = req.body?.items || [];
            recordPizzaSale(orderItems, false, duration);
          }
          
          
          console.log(`[Metrics] Pizza creation latency: ${duration}ms`);
        } catch (error) {
          
          console.error('[Metrics] Error in order tracking:', error);
        }
        
        
        return originalSend.apply(this, arguments);
      };
    }


    next();
  };


module.exports = {
  trackOrderCreation,
};