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

const handler = (router, p, m) => router.stack.find(l => l.route?.path === p && l.route.methods[m]).route.stack.at(-1).handle;
const res = () => ({ statusCode: 200, status(c) { this.statusCode = c; return this; }, json(v) { this.body = v; return this; } });
const stub = (t, obj, key, fn) => { const orig = obj[key]; obj[key] = fn; t.after(() => { obj[key] = orig; }); };

test('account preferences are validated and saved on the server', async t => {
  let update;
  stub(t, User, 'findByIdAndUpdate', async (_id, u) => { update = u; return { preferences: { reminders: { enabled: true, minutes: 30 }, privacy: { retentionDays: 90, allowRecording: false } } }; });
  const save = handler(authRouter, '/me/preferences', 'put');
  const ok = res();
  await save({ user: { id: 'u1' }, body: { reminders: { enabled: true, minutes: 30 }, privacy: { retentionDays: 90, allowRecording: false } } }, ok, e => { throw e; });
  assert.equal(ok.statusCode, 200);
  assert.deepEqual(update.$set, { 'preferences.reminders.enabled': true, 'preferences.reminders.minutes': 30, 'preferences.privacy.retentionDays': 90, 'preferences.privacy.allowRecording': false });
  const keep = res(); update = null;
  await save({ user: { id: 'u1' }, body: { privacy: { retentionDays: null } } }, keep, e => { throw e; });
  assert.deepEqual(update.$set, { 'preferences.privacy.retentionDays': null });
  for (const body of [{ reminders: { minutes: 7 } }, { privacy: { retentionDays: 3 } }, { privacy: { allowRecording: 'yes' } }, {}]) {
    const bad = res(); await save({ user: { id: 'u1' }, body }, bad, e => { throw e; });
    assert.equal(bad.statusCode, 400, JSON.stringify(body));
  }
});

test('recordings cannot be uploaded to a host who turned recording off', async t => {
  stub(t, MeetingRoom, 'findOne', q => ({ lean: async () => (q.roomCode === 'no-rec' ? { hostUserId: 'owner' } : null) }));
  stub(t, User, 'findById', id => ({ select: () => ({ lean: async () => (id === 'owner' ? { preferences: { privacy: { allowRecording: false } } } : null) }) }));
  const uploads = path.join(__dirname, '../uploads'); fs.mkdirSync(uploads, { recursive: true });
  const filename = `pref-test-${Date.now()}.webm`; fs.writeFileSync(path.join(uploads, filename), 'x');
  const r = res();
  await handler(recordingsRouter, '/upload', 'post')({ user: { id: 'owner' }, body: { roomCode: 'no-rec' }, file: { filename, originalname: 'a.webm', size: 1 } }, r, e => { throw e; });
  assert.equal(r.statusCode, 403);
  assert.equal(fs.existsSync(path.join(uploads, filename)), false, 'rejected upload is deleted');
});

test('retention removes only recordings and meeting history older than each user\'s chosen period', async t => {
  const now = new Date('2026-10-09T00:00:00Z');
  stub(t, User, 'find', () => ({ select: () => ({ lean: async () => [{ _id: 'keeper', preferences: { privacy: { retentionDays: 30 } } }] }) }));
  const deletedFiles = [];
  stub(t, Recording, 'find', async q => { assert.equal(q.uploadedBy, 'keeper'); assert.equal(q.createdAt.$lt.toISOString(), '2026-09-09T00:00:00.000Z'); return [{ filename: 'old.webm', deleteOne: async () => deletedFiles.push('old.webm') }]; });
  let sessionQuery;
  stub(t, MeetingSession, 'deleteMany', async q => { sessionQuery = q; return { deletedCount: 2 }; });
  const result = await sweepRetention({ now: () => now, removeFile: async () => {} });
  assert.deepEqual(deletedFiles, ['old.webm']);
  assert.equal(sessionQuery.host, 'keeper');
  assert.equal(result.recordings, 1);
});
