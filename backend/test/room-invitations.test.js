const assert = require('node:assert/strict');
const test = require('node:test');
const emailjs = require('@emailjs/nodejs');
const router = require('../src/routes/rooms');
const { rooms } = require('../src/signaling');

const handle = router.stack.find(layer => layer.route?.path === '/:code/invitations').route.stack.at(-1).handle;
async function invite(code, userId, email) {
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(v) { this.body = v; return this; } };
  await handle({ params: { code }, user: { id: userId }, body: { email } }, res, error => { throw error; });
  return res;
}
const stubSend = fn => { const original = Object.getOwnPropertyDescriptor(emailjs, 'send'); Object.defineProperty(emailjs, 'send', { value: fn, configurable: true }); return () => Object.defineProperty(emailjs, 'send', original); };
const KEYS = ['EMAILJS_SERVICE_ID', 'EMAILJS_INVITE_TEMPLATE_ID', 'EMAILJS_PUBLIC_KEY'];

test('invitations fall back to a mail draft when the email service rejects the send', async t => {
  const code = 'invite-fallback', saved = KEYS.map(k => process.env[k]);
  rooms.set(code, new Map([['socket', { userId: 'member', userName: 'Host' }]]));
  KEYS.forEach(k => { process.env[k] = 'placeholder'; });
  const restore = stubSend(async () => { throw { status: 400, text: 'The Public Key is invalid' }; });
  t.after(() => { rooms.delete(code); restore(); KEYS.forEach((k, i) => { if (saved[i] === undefined) delete process.env[k]; else process.env[k] = saved[i]; }); });
  const res = await invite(code, 'member', 'guest@example.com');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.mode, 'draft');
  assert.match(res.body.mailto, /^mailto:guest%40example\.com\?subject=/);
});

test('invitations are sent through EmailJS when it is configured', async t => {
  const code = 'invite-sent', saved = KEYS.map(k => process.env[k]); let params;
  rooms.set(code, new Map([['socket', { userId: 'member', userName: 'Host' }]]));
  KEYS.forEach(k => { process.env[k] = 'configured'; });
  const restore = stubSend(async (_service, _template, values) => { params = values; return { status: 200 }; });
  t.after(() => { rooms.delete(code); restore(); KEYS.forEach((k, i) => { if (saved[i] === undefined) delete process.env[k]; else process.env[k] = saved[i]; }); });
  const res = await invite(code, 'member', 'guest@example.com');
  assert.equal(res.body.mode, 'sent');
  assert.equal(params.to_email, 'guest@example.com');
  assert.match(params.meeting_link, /\/room\/invite-sent$/);
});
