const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs');
const path = require('path');
const User = require('../src/models/User');
const Recording = require('../src/models/Recording');
const MeetingSession = require('../src/models/MeetingSession');
const MeetingRoom = require('../src/models/MeetingRoom');
const authRouter = require('../src/routes/auth');
const recordingsRouter = require('../src/routes/recordings');
const { sweepRetention } = require('../src/retention');
const { query } = require('../src/config/db');

const handler = (router, p, m) => router.stack.find(l => l.route?.path === p && l.route.methods[m]).route.stack.at(-1).handle;
const res = () => ({ statusCode: 200, status(c) { this.statusCode = c; return this; }, json(v) { this.body = v; return this; } });
const { useDatabase, createUser } = require('./helpers/database');

test.before(useDatabase);

test('account preferences are validated and saved on the server', async () => {
  const id = (await createUser())._id;
  const save = handler(authRouter, '/me/preferences', 'put');
  const ok = res();
  await save({ user: { id }, body: { reminders: { enabled: true, minutes: 30 }, privacy: { retentionDays: 90, allowRecording: false } } }, ok, e => { throw e; });
  assert.equal(ok.statusCode, 200);
  assert.deepEqual(ok.body.data.preferences, { reminders: { enabled: true, minutes: 30 }, privacy: { retentionDays: 90, allowRecording: false } });
  const keep = res();
  await save({ user: { id }, body: { privacy: { retentionDays: null } } }, keep, e => { throw e; });
  assert.deepEqual(keep.body.data.preferences, { reminders: { enabled: true, minutes: 30 }, privacy: { retentionDays: null, allowRecording: false } }, 'only the sent key changes');
  for (const body of [{ reminders: { minutes: 7 } }, { privacy: { retentionDays: 3 } }, { privacy: { allowRecording: 'yes' } }, {}]) {
    const bad = res(); await save({ user: { id }, body }, bad, e => { throw e; });
    assert.equal(bad.statusCode, 400, JSON.stringify(body));
  }
});

test('recordings cannot be uploaded to a host who turned recording off', async () => {
  const owner = await createUser();
  await User.updatePreferences(owner._id, { privacy: { allowRecording: false } });
  const { roomCode } = await MeetingRoom.create({ roomCode: `no-rec-${Date.now()}`, hostUserId: owner._id, hostName: 'Host' });
  const uploads = path.join(__dirname, '../uploads'); fs.mkdirSync(uploads, { recursive: true });
  const filename = `pref-test-${Date.now()}.webm`; fs.writeFileSync(path.join(uploads, filename), 'x');
  const r = res();
  await handler(recordingsRouter, '/upload', 'post')({ user: { id: owner._id }, body: { roomCode }, file: { filename, originalname: 'a.webm', size: 1 } }, r, e => { throw e; });
  assert.equal(r.statusCode, 403);
  assert.equal(fs.existsSync(path.join(uploads, filename)), false, 'rejected upload is deleted');
});

test('retention removes only recordings and meeting history older than each user\'s chosen period', async () => {
  const now = new Date('2026-10-09T00:00:00Z'), day = 24 * 3600e3;
  const keeper = await createUser(), forever = await createUser();
  await User.updatePreferences(keeper._id, { privacy: { retentionDays: 30 } });
  const at = (user, daysAgo, filename) => query('insert into recordings (room_code, uploaded_by, filename, created_at) values ($1, $2, $3, $4)', ['r', user._id, filename, new Date(now - daysAgo * day)]);
  const session = (user, daysAgo) => query('insert into meeting_sessions (room_code, host, started_at, ended_at) values ($1, $2, $3, $3)', ['r', user._id, new Date(now - daysAgo * day)]);
  await at(keeper, 31, 'old.webm'); await at(keeper, 29, 'new.webm'); await at(forever, 400, 'kept.webm');
  await session(keeper, 31); await session(keeper, 31); await session(keeper, 29); await session(forever, 400);
  const deletedFiles = [];
  const result = await sweepRetention({ now: () => now, removeFile: async name => deletedFiles.push(name) });
  assert.deepEqual(deletedFiles, ['old.webm']);
  assert.deepEqual(result, { recordings: 1, sessions: 2 });
  assert.deepEqual((await Recording.findByOwner(keeper._id)).map(r => r.filename), ['new.webm']);
  assert.equal((await Recording.findByOwner(forever._id)).length, 1);
});
