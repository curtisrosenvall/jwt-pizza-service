module.exports = {
    jwtSecret: 'test-secret-key',
    db: {
      connection: {
        host: 'localhost',
        user: 'root', // adjust based on your MySQL setup
        password: 'theHood1335!', // adjust based on your MySQL setup
        database: 'jwt_pizza_test',
        connectTimeout: 10000,
      },
      listPerPage: 10
    }
  };