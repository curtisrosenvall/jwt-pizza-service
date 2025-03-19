const metrics = require('../metrics');
const { DB } = require('./database');

// Store original query method
const originalQuery = DB.query;

// Override query method to track performance
DB.query = async function(connection, sql, params) {
  const start = Date.now();
  let success = true;
  
  try {
    const result = await originalQuery.call(this, connection, sql, params);
    return result;
  } catch (error) {
    success = false;
    throw error;
  } finally {
    const duration = Date.now() - start;
    metrics.trackDbQuery(duration, success);
  }
};

// Store original getConnection method
const originalGetConnection = DB._getConnection;

// Override getConnection method to track performance
DB._getConnection = async function(setUse = true) {
  const start = Date.now();
  let success = true;
  
  try {
    const connection = await originalGetConnection.call(this, setUse);
    return connection;
  } catch (error) {
    success = false;
    throw error;
  } finally {
    const duration = Date.now() - start;
    // Track connection time as a DB query for simplicity
    metrics.trackDbQuery(duration, success);
  }
};

const originalAddUser = DB.addUser;

DB.addUser = async function(userData) {
    try {
      const result = await originalAddUser.call(this, userData);
      
      // Record the signup metric
      if (metrics && typeof metrics.recordUserSignup === 'function') {
        metrics.recordUserSignup({
          name: userData.name,
          email: userData.email
        });
      }
      
      return result;
    } catch (error) {
      throw error;
    }
  };

module.exports = DB; 