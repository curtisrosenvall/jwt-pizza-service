const mysql = require('mysql2/promise');
const config = require('./test.config');
const { tableCreateStatements } = require('./src/database/dbModel');

async function setupTestDatabase() {
  const connection = await mysql.createConnection({
    host: config.db.connection.host,
    user: config.db.connection.user,
    password: config.db.connection.password
  });

  try {
    
    await connection.query(`DROP DATABASE IF EXISTS ${config.db.connection.database}`);
    
    
    await connection.query(`CREATE DATABASE ${config.db.connection.database}`);
    await connection.query(`USE ${config.db.connection.database}`);
    
    
    for (const statement of tableCreateStatements) {
      await connection.query(statement);
    }
    
    console.log('Test database setup completed');
  } catch (error) {
    console.error('Error setting up test database:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

module.exports = setupTestDatabase;