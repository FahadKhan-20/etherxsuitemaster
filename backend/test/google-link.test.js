const assert = require('node:assert/strict');
const test = require('node:test');
const passport = require('passport');
const { useDatabase, createUser } = require('./helpers/database');
const User = require('../src/models/User');

test.before(async () => {
  Object.assign(process.env, { GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret', GOOGLE_CALLBACK_URL: 'http://localhost/cb' });
  require('../src/config/passport')();
  await useDatabase();
});
const googleSignIn = (id, email, verified = true) => new Promise((resolve, reject) =>
  passport._strategy('google')._verify('a', 'r', { id, displayName: 'G', emails: [{ value: email }], _json: { email_verified: verified } }, (error, user) => (error ? reject(error) : resolve(user))));

test('Google sign-in with a password account\'s email is the same account', async () => {
  const email = `link-${Date.now()}@gmail.com`;
  const local = await createUser({ email, authProvider: 'local', password: 'hash' });
  const google = await googleSignIn('g-1', email);
  assert.equal(google._id, local._id);
  assert.equal((await User.findByEmail(email, { withPassword: true })).password, null, 'a password set before the email was proven is dropped');
  assert.equal((await googleSignIn('g-1', email))._id, local._id);
});

test('a password added after linking (via reset) survives later Google sign-ins', async () => {
  const email = `reset-${Date.now()}@gmail.com`;
  const user = await googleSignIn('g-2', email);
  await User.update(user._id, { password: 'new-hash' });
  await googleSignIn('g-2', email);
  assert.equal((await User.findByEmail(email, { withPassword: true })).password, 'new-hash');
});

test('an unverified Google email never links to an existing account', async () => {
  const email = `unverified-${Date.now()}@gmail.com`;
  await createUser({ email });
  await assert.rejects(googleSignIn('g-3', email, false), /Verify your Google account email/);
});
