const assert = require('node:assert/strict');
const test = require('node:test');
const router = require('../src/routes/rooms');

const route = router.stack.find(layer => layer.route?.path === '/ice-servers' && layer.route.methods.get);
const call = () => { const res = { json(v) { this.body = v; return this; } }; route.route.stack.at(-1).handle({ user: { id: 'u' } }, res); return res.body; };
const KEYS = ['TURN_URLS', 'TURN_USERNAME', 'TURN_CREDENTIAL'];
const withEnv = (t, values) => { const saved = KEYS.map(k => process.env[k]); KEYS.forEach(k => { if (values[k] === undefined) delete process.env[k]; else process.env[k] = values[k]; }); t.after(() => KEYS.forEach((k, i) => { if (saved[i] === undefined) delete process.env[k]; else process.env[k] = saved[i]; })); };

test('ice-servers is declared before the /:roomCode catch-all and requires sign-in', () => {
  const index = layer => router.stack.indexOf(layer);
  assert.ok(route, 'GET /ice-servers route exists');
  assert.ok(index(route) < index(router.stack.find(layer => layer.route?.path === '/:roomCode')));
  assert.ok(route.route.stack.length > 1, 'auth middleware runs first');
});

test('configured TURN relays are returned with their credentials', t => {
  withEnv(t, { TURN_URLS: 'turn:turn.example.com:3478, turns:turn.example.com:5349', TURN_USERNAME: 'meet', TURN_CREDENTIAL: 'secret' });
  const { iceServers } = call();
  assert.deepEqual(iceServers.at(-1), { urls: ['turn:turn.example.com:3478', 'turns:turn.example.com:5349'], username: 'meet', credential: 'secret' });
  assert.ok(iceServers.some(s => String(s.urls).startsWith('stun:')));
  assert.ok(!JSON.stringify(iceServers).includes('openrelay'));
});

test('without TURN settings the public fallback relay is used', t => {
  withEnv(t, {});
  assert.ok(JSON.stringify(call().iceServers).includes('openrelay.metered.ca'));
});

test('room participant lists require sign-in', () => {
  const layer = router.stack.find(l => l.route?.path === '/:code/participants' && l.route.methods.get);
  assert.ok(layer.route.stack.length > 1, 'auth middleware runs before the handler');
  assert.equal(layer.route.stack[0].handle, require('../src/middleware/auth'));
});
