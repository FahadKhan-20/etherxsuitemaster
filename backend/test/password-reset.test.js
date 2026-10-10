const assert = require('node:assert/strict');
const test = require('node:test');
const crypto = require('crypto');
const emailjs = require('@emailjs/nodejs');
const { useDatabase, createUser } = require('./helpers/database');
const User = require('../src/models/User');
const router = require('../src/routes/auth');

const handler = p => router.stack.find(l => l.route?.path === p && l.route.methods.post).route.stack.at(-1).handle;
const call = async (p, req) => { const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(v) { this.body = v; return this; } }; await handler(p)(req, res, e => { throw e; }); return res; };
const EMAIL_ENV = { EMAILJS_SERVICE_ID: 's', EMAILJS_TEMPLATE_ID: 't', EMAILJS_PUBLIC_KEY: 'p', EMAILJS_PRIVATE_KEY: 'k' };
function withEnv(t, env) {
  const saved = Object.fromEntries(Object.keys({ ...EMAIL_ENV, NODE_ENV: 1, CLIENT_URL: 1 }).map(k => [k, process.env[k]]));
  for (const k of Object.keys(saved)) delete process.env[k];
  Object.assign(process.env, env);
  t.after(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
}
function captureLogs(t) {
  const lines = [], { log, error } = console;
  console.log = (...a) => lines.push(a.join(' ')); console.error = (...a) => lines.push(a.join(' '));
  t.after(() => { console.log = log; console.error = error; });
  return lines;
}
// @emailjs/nodejs exposes send through a getter, so stub it by redefining the property.
function stubSend(t, fn) {
  const original = Object.getOwnPropertyDescriptor(emailjs, 'send');
  const set = f => Object.defineProperty(emailjs, 'send', { value: f, configurable: true, enumerable: true, writable: true });
  set(fn); t.after(() => Object.defineProperty(emailjs, 'send', original));
  return set;
}
test.before(useDatabase);

test('production without EmailJS says so, for every address alike', async t => {
  withEnv(t, { NODE_ENV: 'production' });
  for (const email of [(await createUser()).email, 'nobody@example.com']) assert.equal((await call('/forgot-password', { body: { email } })).statusCode, 503);
});

test('the emailed link resets the password once, and is never written to production logs', async t => {
  withEnv(t, { ...EMAIL_ENV, NODE_ENV: 'production', CLIENT_URL: 'https://meet.example.com,https://other.example.com' });
  const logs = captureLogs(t);
  const user = await createUser();
  const sent = []; const setSend = stubSend(t, async (...a) => { sent.push(a); return { status: 200 }; });
  assert.equal((await call('/forgot-password', { body: { email: user.email } })).statusCode, 200);
  const url = sent[0][2].reset_url;
  assert.match(url, /^https:\/\/meet\.example\.com\/reset-password\/[0-9a-f]{64}$/);
  const token = url.split('/').pop();
  assert.equal((await call('/reset-password/:token', { params: { token }, body: { password: 'new-secret-1' } })).statusCode, 200);
  assert.ok((await User.findByEmail(user.email, { withPassword: true })).password, 'password set (works for Google-only accounts too)');
  assert.equal((await call('/reset-password/:token', { params: { token }, body: { password: 'again-secret' } })).statusCode, 400, 'link is single-use');

  setSend(async () => { throw { status: 403, text: 'API calls are disabled for non-browser applications' }; });
  assert.equal((await call('/forgot-password', { body: { email: user.email } })).statusCode, 200);
  assert.ok(logs.some(l => l.includes('non-browser applications')), 'the EmailJS reason is logged');
  assert.ok(!logs.some(l => /reset-password\/[0-9a-f]{64}/.test(l)), 'no reset link in production logs');
});
