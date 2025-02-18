const { DB } = require('./src/database/database');

module.exports = async () => {
  console.log("Global Teardown: Closing DB connections if any.");
  await DB.cleanup(); // or a custom method that ensures all pools/connections are closed
};