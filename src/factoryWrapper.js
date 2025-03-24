const config = require('../config.js');
const logger = require('../logger');
const { trackFactoryRequest, trackFactoryError } = require('../metrics');

class FactoryService {
  constructor() {
    this.baseUrl = config.factory.url;
    this.apiKey = config.factory.apiKey;
  }

  async request(endpoint, method = 'GET', data = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const startTime = Date.now();
    let success = true;
    
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    logger.log('info', 'factory', {
      endpoint: endpoint,
      method: method,
      requestData: data ? JSON.stringify(this.sanitizeData(data)) : null
    });

    try {
      const response = await fetch(url, options);
      const responseData = await response.json();
      const duration = Date.now() - startTime;

      trackFactoryRequest(endpoint, method, response.status, duration);

      logger.factoryLogger(
        endpoint,
        method,
        this.sanitizeData(data),
        this.sanitizeData(responseData),
        response.status
      );

      if (!response.ok) {
        success = false;
        const error = new Error(`Factory service error: ${responseData.message || 'Unknown error'}`);
        error.status = response.status;
        error.responseData = responseData;
        throw error;
      }

      return responseData;
    } catch (error) {
      success = false;
      
      trackFactoryError(endpoint, method, error.status || 500);
      
      logger.log('error', 'factory', {
        endpoint: endpoint,
        method: method,
        requestData: data ? JSON.stringify(this.sanitizeData(data)) : null,
        error: error.message,
        status: error.status || 500
      });
      
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      console.log(`[Factory] ${method} ${endpoint} completed in ${duration}ms (success: ${success})`);
    }
  }

  sanitizeData(data) {
    if (!data) return null;
    
    const sanitized = JSON.parse(JSON.stringify(data));
    
    const sensitiveFields = [
      'password'
    ];
    
    const sanitizeObject = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      
      Object.keys(obj).forEach(key => {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
          obj[key] = '*****';
        } else if (typeof obj[key] === 'object') {
          sanitizeObject(obj[key]);
        }
      });
    };
    
    sanitizeObject(sanitized);
    return sanitized;
  }

  async get(endpoint) {
    return this.request(endpoint, 'GET');
  }

  async post(endpoint, data) {
    return this.request(endpoint, 'POST', data);
  }

  async put(endpoint, data) {
    return this.request(endpoint, 'PUT', data);
  }

  async delete(endpoint) {
    return this.request(endpoint, 'DELETE');
  }
}

module.exports = new FactoryService();