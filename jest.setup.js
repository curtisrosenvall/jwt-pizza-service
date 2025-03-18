

// Create the config file with database credentials
const configContent = `
module.exports = {
  jwtSecret: 'test-secret',
  db: {
    connection: {
      host: 'localhost',
      user: 'root',
      password: 'theHood1335!',
      database: 'pizza_test',
      connectTimeout: 60000,
    },
    listPerPage: 10,
  },
  factory: {
    url: 'https://pizza-factory.cs329.click',
    apiKey: 'test-key',
  },
};
`;