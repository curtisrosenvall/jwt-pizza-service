const mysql = require('mysql2/promise');
const config = require('./test.config');

async function clearTestData() {
  const connection = await mysql.createConnection(config.db.connection);
  try {
    // Clear tables in correct order due to foreign key constraints
    await connection.query('DELETE FROM orderItem');
    await connection.query('DELETE FROM dinerOrder');
    await connection.query('DELETE FROM store');
    await connection.query('DELETE FROM userRole');
    await connection.query('DELETE FROM franchise');
    await connection.query('DELETE FROM auth');
    await connection.query('DELETE FROM user');
    
    // Reset auto-increment counters
    await connection.query('ALTER TABLE user AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE franchise AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE store AUTO_INCREMENT = 1');
  } finally {
    await connection.end();
  }
}

module.exports = {
  clearTestData
};