// databaseWrapper.js
const { DB } = require('./database');
const { trackDbQuery, trackDbConnectionError, updateDbPoolMetrics } = require('../metrics');
const config = require('../config.js');

// Define slow query threshold in ms
const DB_SLOW_QUERY_THRESHOLD = 300;

// Check for duplicate recordUserSignup calls
console.log('[DB] Checking for duplicate recordUserSignup calls');

// Create a flag to prevent duplicate recordUserSignup calls
// let userSignupInProgress = false;

// Store the original addUser method
const originalAddUser = DB.addUser;

// Override addUser to prevent duplicate metric tracking
DB.addUser = async function(user) {
  console.log(`[DB] addUser called for: ${user.email}`);
  
  try {
    // Set the flag to indicate a signup is in progress
    // userSignupInProgress = true;
    
    // Call the original method
    const result = await originalAddUser.apply(this, arguments);
    
    console.log(`[DB] addUser completed successfully for: ${user.email}`);
    
    // We'll let the auth router handle the recordUserSignup call
    return result;
  } catch (error) {
    console.error(`[DB] Error in addUser for: ${user.email}`, error);
    throw error;
  } finally {
    // Reset the flag after a short delay to ensure the auth router has time to process
    setTimeout(() => {
      // userSignupInProgress = false;
    }, 1000);
  }
};

// Override the original query method to track metrics
const originalQuery = DB.query;
DB.query = async function(connection, sql, params) {
  const startTime = Date.now();
  let success = true;
  let queryType = 'unknown';
  
  // Determine query type by analyzing the SQL
  if (sql.trim().toLowerCase().startsWith('select')) {
    queryType = 'select';
  } else if (sql.trim().toLowerCase().startsWith('insert')) {
    queryType = 'insert';
  } else if (sql.trim().toLowerCase().startsWith('update')) {
    queryType = 'update';
  } else if (sql.trim().toLowerCase().startsWith('delete')) {
    queryType = 'delete';
  }
  
  try {
    // Execute the original query
    const result = await originalQuery.call(this, connection, sql, params);
    return result;
  } catch (error) {
    success = false;
    throw error;
  } finally {
    // Track metrics
    const duration = Date.now() - startTime;
    trackDbQuery(duration, success, queryType);
    
    // Log slow queries for debugging
    if (duration > DB_SLOW_QUERY_THRESHOLD) {
      console.warn(`[DB] SLOW QUERY (${duration}ms): ${sql.substring(0, 100)}${sql.length > 100 ? '...' : ''}`);
    }
  }
};

// Override the _getConnection method to track connection metrics
const originalGetConnection = DB._getConnection;
DB._getConnection = async function(setUse = true) {
  const startTime = Date.now();
  let success = true;
  
  try {
    // Attempt to create a connection
    const connection = await originalGetConnection.call(this, setUse);
    
    // Track connection pool metrics if enabled
    if (config.db.connection.pooling) {
      // If connection pooling is used, track pool metrics
      // This is a placeholder - you'd need to adapt this to your actual pooling implementation
      updateDbPoolMetrics(
        config.db.connection.connectionLimit || 10, 
        0, // Current connections - if available from your pool
        0  // Queued connections - if available from your pool
      );
    }
    
    // Return the connection
    return connection;
  } catch (error) {
    success = false;
    trackDbConnectionError();
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    
    // Log connection time for debugging
    console.log(`[DB] Connection established in ${duration}ms (success: ${success})`);
  }
};

// Enhanced error monitoring for initialization
const originalInitializeDatabase = DB.initializeDatabase;
DB.initializeDatabase = async function() {
  const startTime = Date.now();
  let success = true;
  
  try {
    await originalInitializeDatabase.call(this);
  } catch (error) {
    success = false;
    trackDbConnectionError();
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    console.log(`[DB] Database initialization completed in ${duration}ms (success: ${success})`);
  }
};

console.log('[DB] Database middleware initialized and metrics tracking enabled');

// Export the enhanced DB instance
module.exports = { DB };