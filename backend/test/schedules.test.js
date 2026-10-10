const assert = require('node:assert/strict');
const test = require('node:test');
const ScheduledMeeting = require('../src/models/ScheduledMeeting');
const MeetingRoom = require('../src/models/MeetingRoom');
const router = require('../src/routes/schedules');
const auth = require('../src/middleware/auth');

const route = (p, m) => router.stack.find(l => l.route?.path === p && l.route.methods[m]).route;
const call = async (p, m, req) => { const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(v) { this.body = v; return this; } }; await route(p, m).stack.at(-1).handle({ params: {}, body: {}, ...req }, res, e => { throw e; }); return res; };
const { useDatabase, createUser } = require('./helpers/database');
let owner, other;
test.before(async () => { await useDatabase(); owner = (await createUser())._id; other = (await createUser())._id; });

test('every schedule route requires sign-in', () => {
  for (const [p, m] of [['/', 'get'], ['/', 'post'], ['/:id', 'delete']]) assert.equal(route(p, m).stack[0].handle, auth, `${m} ${p}`);
});

test('scheduling registers a real room owned by the scheduler', async () => {
  const startAt = new Date(Date.now() + 3600e3).toISOString();
  const res = await call('/', 'post', { user: { id: owner, name: 'Host' }, body: { title: ' Sprint review ', startAt, duration: 45, recurring: 'weekly', participants: [' A@example.com ', 'a@example.com', 'b@example.com'] } });
  assert.equal(res.statusCode, 201);
  const meeting = res.body.data.meeting;
  assert.match(meeting.roomCode, /^etherx-[a-z0-9]{10}$/);
  assert.equal(meeting.title, 'Sprint review');
  assert.deepEqual(meeting.participants, ['a@example.com', 'b@example.com']);
  const room = await MeetingRoom.findByCode(meeting.roomCode);
  assert.equal(room.hostUserId, owner); assert.equal(room.hostName, 'Host');
  assert.equal((await ScheduledMeeting.findByOwner(owner)).filter(m => m.roomCode === meeting.roomCode).length, 1);
});

test('invalid schedules are rejected', async () => {
  const later = new Date(Date.now() + 3600e3).toISOString();
  const bad = [{ title: 'x', startAt: later, duration: 4 }, { title: 'x', startAt: later, duration: 481 }, { title: '', startAt: new Date().toISOString(), duration: 30 }, { title: 'x', startAt: 'not a date', duration: 30 }, { title: 'x', startAt: new Date().toISOString(), duration: 0 }, { title: 'x', startAt: new Date().toISOString(), duration: 30, recurring: 'hourly' }];
  for (const body of bad) assert.equal((await call('/', 'post', { user: { id: owner }, body })).statusCode, 400, JSON.stringify(body));
});

test('schedules are listed and deleted per account', async () => {
  const mine = (await call('/', 'get', { user: { id: owner } })).body.data.meetings.length;
  const created = await call('/', 'post', { user: { id: owner, name: 'Host' }, body: { title: 'Mine', startAt: new Date(Date.now() + 1e6).toISOString(), duration: 30 } });
  const id = created.body.data.meeting._id;
  assert.equal((await call('/', 'get', { user: { id: other } })).body.data.meetings.length, 0);
  assert.equal((await call('/', 'get', { user: { id: owner } })).body.data.meetings.length, mine + 1);
  assert.equal((await call('/:id', 'delete', { user: { id: other }, params: { id } })).statusCode, 404);
  assert.equal((await call('/:id', 'delete', { user: { id: owner }, params: { id: 'not-an-id' } })).statusCode, 404);
  assert.equal((await call('/:id', 'delete', { user: { id: owner }, params: { id } })).statusCode, 200);
  assert.equal((await call('/', 'get', { user: { id: owner } })).body.data.meetings.length, mine);
});

test('past starts and invalid participant lists do not create schedules or rooms', async t => {
  const create = { meeting: ScheduledMeeting.create, room: MeetingRoom.create }, created = [];
  ScheduledMeeting.create = async doc => { created.push(doc); }; MeetingRoom.create = async doc => { created.push(doc); };
  t.after(() => { ScheduledMeeting.create = create.meeting; MeetingRoom.create = create.room; });
  const valid = { title: 'Plan', startAt: new Date(Date.now() + 3600e3).toISOString(), duration: 30 };
  for (const body of [
    { ...valid, startAt: new Date(Date.now() - 60000).toISOString() },
    { ...valid, participants: ['valid@example.com', 'invalid'] },
    { ...valid, participants: [''] },
    { ...valid, participants: 'valid@example.com' },
    { ...valid, participants: Array.from({ length: 101 }, (_, index) => `user${index}@example.com`) },
  ]) assert.equal((await call('/', 'post', { user: { id: owner }, body })).statusCode, 400);
  assert.equal(created.length, 0);
});
