const { DB } = require('./database');
const { trackDbQuery, trackDbConnectionError, updateDbPoolMetrics } = require('../metrics');
const config = require('../config.js');
const logger = require('../logger');


const DB_SLOW_QUERY_THRESHOLD = 300;

console.log('[DB] Checking for duplicate recordUserSignup calls');


const originalAddUser = DB.addUser;


DB.addUser = async function(user) {
  console.log(`[DB] addUser called for: ${user.email}`);
  
  try {

    logger.log('info', 'database', {
      operation: 'addUser',
      user: user.email 
    });
    
  
    const result = await originalAddUser.apply(this, arguments);
    
    console.log(`[DB] addUser completed successfully for: ${user.email}`);
    

    return result;
  } catch (error) {
    console.error(`[DB] Error in addUser for: ${user.email}`, error);
    
    logger.log('error', 'database', {
      operation: 'addUser',
      user: user.email,
      error: error.message
    });
    
    throw error;
  } finally {
    setTimeout(() => {

    }, 1000);
  }
};


const originalQuery = DB.query;
DB.query = async function(connection, sql, params) {
  const startTime = Date.now();
  let success = true;
  let queryType = 'unknown';
  

  if (sql.trim().toLowerCase().startsWith('select')) {
    queryType = 'select';
  } else if (sql.trim().toLowerCase().startsWith('insert')) {
    queryType = 'insert';
  } else if (sql.trim().toLowerCase().startsWith('update')) {
    queryType = 'update';
  } else if (sql.trim().toLowerCase().startsWith('delete')) {
    queryType = 'delete';
  }
  
  logger.dbLogger(sql, params);
  
  try {
    const result = await originalQuery.call(this, connection, sql, params);
    return result;
  } catch (error) {
    success = false;
    
    logger.log('error', 'database', {
      query: sql,
      params: params ? JSON.stringify(params) : null,
      error: error.message
    });
    
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    trackDbQuery(duration, success, queryType);
    
    if (duration > DB_SLOW_QUERY_THRESHOLD) {
      console.warn(`[DB] SLOW QUERY (${duration}ms): ${sql.substring(0, 100)}${sql.length > 100 ? '...' : ''}`);
      
      logger.log('warn', 'database', {
        query: sql,
        params: params ? JSON.stringify(params) : null,
        duration: duration,
        slow: true
      });
    }
  }
};

const originalGetConnection = DB._getConnection;
DB._getConnection = async function(setUse = true) {
  const startTime = Date.now();
  let success = true;
  
  logger.log('info', 'database', {
    operation: 'getConnection',
    host: config.db.connection.host,
    database: config.db.connection.database
  });
  
  try {
    const connection = await originalGetConnection.call(this, setUse);
    
    if (config.db.connection.pooling) {

      updateDbPoolMetrics(
        config.db.connection.connectionLimit || 10, 
        0,
        0  
      );
    }
    
    return connection;
  } catch (error) {
    success = false;
    trackDbConnectionError();
    
    logger.log('error', 'database', {
      operation: 'getConnection',
      host: config.db.connection.host,
      database: config.db.connection.database,
      error: error.message
    });
    
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    
    console.log(`[DB] Connection established in ${duration}ms (success: ${success})`);
  }
};

const originalInitializeDatabase = DB.initializeDatabase;
DB.initializeDatabase = async function() {
  const startTime = Date.now();
  let success = true;
  
  logger.log('info', 'database', {
    operation: 'initializeDatabase',
    host: config.db.connection.host,
    database: config.db.connection.database
  });
  
  try {
    await originalInitializeDatabase.call(this);
  } catch (error) {
    success = false;
    trackDbConnectionError();
    
    logger.log('error', 'database', {
      operation: 'initializeDatabase',
      host: config.db.connection.host,
      database: config.db.connection.database,
      error: error.message
    });
    
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    console.log(`[DB] Database initialization completed in ${duration}ms (success: ${success})`);
    
    logger.log('info', 'database', {
      operation: 'initializeDatabase',
      duration: duration,
      success: success
    });
  }
};

console.log('[DB] Database middleware initialized with Grafana logging and metrics tracking enabled');

module.exports = { DB };