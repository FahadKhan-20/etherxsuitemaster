// Connects the app's database module to an in-memory Postgres (PGlite) once per test file.
const connectDB = require('../../src/config/db');
const User = require('../../src/models/User');

let ready = null;
function useDatabase() {
  if (!ready) {
    const { DATABASE_URL, NODE_ENV } = process.env, warn = console.warn;
    delete process.env.DATABASE_URL; process.env.NODE_ENV = 'test'; console.warn = () => {};
    ready = connectDB().finally(() => {
      if (DATABASE_URL !== undefined) process.env.DATABASE_URL = DATABASE_URL;
      process.env.NODE_ENV = NODE_ENV; console.warn = warn;
    });
  }
  return ready;
}

let count = 0;
const createUser = (fields = {}) => User.create({ name: 'Test user', email: `user${++count}-${Date.now()}@example.com`, authProvider: 'google', ...fields });

module.exports = { useDatabase, createUser };
