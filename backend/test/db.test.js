const assert = require('node:assert/strict');
const test = require('node:test');
const connectDB = require('../src/config/db');

test('production refuses the in-memory database when Postgres is unreachable', async t => {
  const exit = process.exit, env = { ...process.env }, error = console.error, warn = console.warn;
  const urls = []; let code; const logged = [];
  class FailingPool { constructor({ connectionString }) { urls.push(connectionString); } async query() { throw new Error('connect ECONNREFUSED 127.0.0.1:5432'); } }
  process.exit = c => { code = c; };
  console.error = (...args) => logged.push(args.join(' ')); console.warn = () => {};
  process.env.NODE_ENV = 'production'; process.env.DATABASE_URL = 'postgresql://postgres:x@127.0.0.1:5432/postgres';
  t.after(() => { process.exit = exit; process.env.NODE_ENV = env.NODE_ENV; process.env.DATABASE_URL = env.DATABASE_URL; if (env.DATABASE_URL === undefined) delete process.env.DATABASE_URL; console.error = error; console.warn = warn; });
  await connectDB({ Pool: FailingPool });
  assert.equal(code, 1);
  assert.equal(urls.length, 1);
  assert.equal(connectDB.isConnected(), false, 'no embedded database is started');
  assert.match(logged.join('\n'), /DATABASE_URL/);
});

test('outside production an unreachable database falls back to in-memory Postgres with the schema applied', async t => {
  const { useDatabase, createUser } = require('./helpers/database');
  await useDatabase();
  const user = await createUser({ email: ' Mixed@Example.com ' });
  assert.equal(user.email, 'mixed@example.com');
  assert.deepEqual(user.preferences, { reminders: { enabled: true, minutes: 15 }, privacy: { retentionDays: null, allowRecording: true } });
  assert.equal('password' in user, false);
  assert.equal(await require('../src/models/User').findById('507f1f77bcf86cd799439011'), null, 'pre-Postgres ids find nothing');
  await assert.rejects(createUser({ email: 'mixed@example.com' }), { code: '23505' });
});
