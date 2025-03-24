
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

const config = require('./src/config.js');
const dbModel = require('./src/database/dbModel.js'); 

module.exports = async function globalSetup() {
  console.log('Dropping and re-creating the test database...');

  
  const connection = await mysql.createConnection({
    host: config.db.connection.host,
    user: config.db.connection.user,
    password: config.db.connection.password,
  });

  
  await connection.query(`DROP DATABASE IF EXISTS ${config.db.connection.database}`);

  
  await connection.query(`CREATE DATABASE ${config.db.connection.database}`);
  await connection.query(`USE ${config.db.connection.database}`);

  
  for (const statement of dbModel.tableCreateStatements) {
    await connection.query(statement);
  }

  
  
  
  console.log('Seeding default admin user...');
  const hashedPass = await bcrypt.hash('admin', 10);

  
  const [insertResult] = await connection.execute(
    `INSERT INTO user (name, email, password) VALUES (?, ?, ?)`,
    ['常用名字', 'a@jwt.com', hashedPass]
  );
  const adminUserId = insertResult.insertId;

  
  await connection.execute(
    `INSERT INTO userRole (userId, role, objectId) VALUES (?, ?, ?)`,
    [adminUserId, 'admin', 0] 
  );

  
  await connection.end();
  console.log('Database setup complete. Default admin: a@jwt.com / admin');
};