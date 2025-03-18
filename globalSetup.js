// globalSetup.js
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
// const jwt = require('jsonwebtoken');
const config = require('./src/config.js');
const dbModel = require('./src/database/dbModel.js'); // path may vary

module.exports = async function globalSetup() {
  console.log('Dropping and re-creating the test database...');

  // 1) Connect to MySQL server (without selecting a DB).
  const connection = await mysql.createConnection({
    host: config.db.connection.host,
    user: config.db.connection.user,
    password: config.db.connection.password,
  });

  // 2) Drop the DB if it exists.
  await connection.query(`DROP DATABASE IF EXISTS ${config.db.connection.database}`);

  // 3) Create a fresh DB, then USE it.
  await connection.query(`CREATE DATABASE ${config.db.connection.database}`);
  await connection.query(`USE ${config.db.connection.database}`);

  // 4) Create all tables from dbModel.tableCreateStatements
  for (const statement of dbModel.tableCreateStatements) {
    await connection.query(statement);
  }

  // 5) Insert the default admin user: a@jwt.com / admin
  //    You also need to insert the 'admin' role into userRole if your code
  //    depends on that table to determine roles.
  console.log('Seeding default admin user...');
  const hashedPass = await bcrypt.hash('admin', 10);

  // Insert into "user" table
  const [insertResult] = await connection.execute(
    `INSERT INTO user (name, email, password) VALUES (?, ?, ?)`,
    ['常用名字', 'a@jwt.com', hashedPass]
  );
  const adminUserId = insertResult.insertId;

  // Insert into "userRole" table (assuming role = 'admin' and objectId=0)
  await connection.execute(
    `INSERT INTO userRole (userId, role, objectId) VALUES (?, ?, ?)`,
    [adminUserId, 'admin', 0] // or use Role.Admin if you have that enum
  );

  // 6) Close the connection
  await connection.end();
  console.log('Database setup complete. Default admin: a@jwt.com / admin');
};