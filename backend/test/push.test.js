const assert = require('node:assert/strict');
const test = require('node:test');
const { useDatabase, createUser } = require('./helpers/database');
const { query } = require('../src/config/db');
const router = require('../src/routes/push');
const PushSubscription = require('../src/models/PushSubscription');
const { nextStart, dueReminders } = require('../src/reminders');

const handler = (p, m) => router.stack.find(l => l.route?.path === p && l.route.methods[m]).route.stack.at(-1).handle;
const call = async (p, m, req) => { const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(v) { this.body = v; return this; } }; await handler(p, m)({ body: {}, ...req }, res, e => { throw e; }); return res; };
const SUB = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'BKey', auth: 'auth' } };
test.before(useDatabase);

test('devices subscribe only when push is set up, with a valid subscription', async t => {
  const saved = process.env.VAPID_PUBLIC_KEY; t.after(() => { if (saved === undefined) delete process.env.VAPID_PUBLIC_KEY; else process.env.VAPID_PUBLIC_KEY = saved; });
  const user = await createUser();
  delete process.env.VAPID_PUBLIC_KEY;
  assert.equal((await call('/subscribe', 'post', { user: { id: user._id }, body: { subscription: SUB } })).statusCode, 503);
  process.env.VAPID_PUBLIC_KEY = 'public';
  assert.equal((await call('/key', 'get', {})).body.publicKey, 'public');
  for (const bad of [null, { endpoint: 'http://insecure', keys: SUB.keys }, { endpoint: SUB.endpoint }]) {
    assert.equal((await call('/subscribe', 'post', { user: { id: user._id }, body: { subscription: bad } })).statusCode, 400);
  }
  assert.equal((await call('/subscribe', 'post', { user: { id: user._id }, body: { subscription: SUB } })).statusCode, 201);
  assert.equal((await PushSubscription.forUsers([user._id])).length, 1);
  await call('/unsubscribe', 'post', { user: { id: user._id }, body: { endpoint: SUB.endpoint } });
  assert.equal((await PushSubscription.forUsers([user._id])).length, 0);
});

test('repeating meetings remind before their next occurrence', () => {
  const first = Date.parse('2026-10-01T09:00:00Z');
  assert.equal(nextStart(first, 'weekly', Date.parse('2026-10-10T12:00:00Z')), Date.parse('2026-10-15T09:00:00Z'));
  assert.equal(nextStart(first, 'daily', Date.parse('2026-10-10T08:00:00Z')), Date.parse('2026-10-10T09:00:00Z'));
  assert.equal(nextStart(first, 'none', Date.parse('2026-10-10T08:00:00Z')), first);
});

test('a reminder is due at each person\'s own lead time, for the owner and invited account holders', async () => {
  const owner = await createUser(); const guest = await createUser(); const outsider = await createUser();
  await query('update users set reminder_minutes = 30 where id = $1', [guest._id]);
  const start = Date.now() + 3 * 60 * 60 * 1000;
  await query("insert into scheduled_meetings (owner, title, start_at, duration, participants, room_code) values ($1, 'Review', $2, 30, $3, 'room-r')", [owner._id, new Date(start), [guest.email]]);
  const at = minutes => dueReminders(start - minutes * 60 * 1000);
  assert.deepEqual((await at(15)).filter(r => r.roomCode === 'room-r').map(r => r.userId), [owner._id], 'owner at 15 minutes (default)');
  assert.deepEqual((await at(30)).filter(r => r.roomCode === 'room-r').map(r => r.userId), [guest._id], 'invited user at their 30 minutes');
  assert.ok(!(await at(15)).some(r => r.userId === outsider._id));
});
