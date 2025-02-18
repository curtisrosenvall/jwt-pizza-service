const { DB } = require('./src/database/database.js');

jest.setTimeout(30000);

beforeAll(async () => {
  // Wait for database initialization
  await new Promise(resolve => setTimeout(resolve, 2000));
});

afterAll(async () => {
  try {
    // Clean up database connections
    await DB.cleanup();
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (error) {
    console.error('Cleanup error:', error);
  }
});