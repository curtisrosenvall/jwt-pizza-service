const { DB } = require('./src/database/database');

module.exports = async () => {
  console.log("Global Teardown: Closing DB connections if any.");
  await DB.cleanup(); 
};