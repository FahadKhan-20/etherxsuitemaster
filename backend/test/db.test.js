const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');

test('production refuses the in-memory database when MongoDB is unreachable', async t => {
  const { connect } = mongoose, exit = process.exit, env = process.env.NODE_ENV, error = console.error, warn = console.warn;
  const uris = []; let code; const logged = [];
  mongoose.connect = async uri => { uris.push(uri); throw new Error('connect ECONNREFUSED 127.0.0.1:27017'); };
  process.exit = c => { code = c; };
  console.error = (...args) => logged.push(args.join(' ')); console.warn = () => {};
  process.env.NODE_ENV = 'production';
  t.after(() => { mongoose.connect = connect; process.exit = exit; process.env.NODE_ENV = env; console.error = error; console.warn = warn; });
  await connectDB();
  assert.equal(code, 1);
  assert.equal(uris.length, 1, 'no embedded database is started');
  assert.match(logged.join('\n'), /MONGO_URI/);
});
