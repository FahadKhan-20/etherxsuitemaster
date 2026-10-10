const assert = require('node:assert/strict');
const test = require('node:test');
const ScheduledMeeting = require('../src/models/ScheduledMeeting');
const MeetingRoom = require('../src/models/MeetingRoom');
const router = require('../src/routes/schedules');
const auth = require('../src/middleware/auth');

const route = (p, m) => router.stack.find(l => l.route?.path === p && l.route.methods[m]).route;
const call = async (p, m, req) => { const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(v) { this.body = v; return this; } }; await route(p, m).stack.at(-1).handle({ params: {}, body: {}, ...req }, res, e => { throw e; }); return res; };
const owner = '507f1f77bcf86cd799439011';

function stubDb(t) {
  const saved = { create: ScheduledMeeting.create, find: ScheduledMeeting.find, findOneAndDelete: ScheduledMeeting.findOneAndDelete, roomCreate: MeetingRoom.create };
  const store = [], rooms = [];
  ScheduledMeeting.create = async doc => { const d = { _id: String(store.length + 1).padStart(24, '0'), ...doc }; store.push(d); return d; };
  ScheduledMeeting.find = q => ({ sort: () => ({ lean: async () => store.filter(d => String(d.owner) === String(q.owner)) }) });
  ScheduledMeeting.findOneAndDelete = async q => { const i = store.findIndex(d => d._id === q._id && String(d.owner) === String(q.owner)); return i < 0 ? null : store.splice(i, 1)[0]; };
  MeetingRoom.create = async doc => { rooms.push(doc); return doc; };
  t.after(() => { ScheduledMeeting.create = saved.create; ScheduledMeeting.find = saved.find; ScheduledMeeting.findOneAndDelete = saved.findOneAndDelete; MeetingRoom.create = saved.roomCreate; });
  return { store, rooms };
}

test('every schedule route requires sign-in', () => {
  for (const [p, m] of [['/', 'get'], ['/', 'post'], ['/:id', 'delete']]) assert.equal(route(p, m).stack[0].handle, auth, `${m} ${p}`);
});

test('scheduling registers a real room owned by the scheduler', async t => {
  const { store, rooms } = stubDb(t);
  const startAt = new Date(Date.now() + 3600e3).toISOString();
  const res = await call('/', 'post', { user: { id: owner, name: 'Host' }, body: { title: ' Sprint review ', startAt, duration: 45, recurring: 'weekly', participants: [' A@example.com ', 'a@example.com', 'b@example.com'] } });
  assert.equal(res.statusCode, 201);
  const meeting = res.body.data.meeting;
  assert.match(meeting.roomCode, /^etherx-[a-z0-9]{10}$/);
  assert.equal(meeting.title, 'Sprint review');
  assert.deepEqual(meeting.participants, ['a@example.com', 'b@example.com']);
  assert.deepEqual(rooms[0], { roomCode: meeting.roomCode, hostUserId: owner, hostName: 'Host', lastActiveAt: rooms[0].lastActiveAt });
  assert.equal(store.length, 1);
});

test('invalid schedules are rejected', async t => {
  stubDb(t);
  const later = new Date(Date.now() + 3600e3).toISOString();
  const bad = [{ title: 'x', startAt: later, duration: 4 }, { title: 'x', startAt: later, duration: 481 }, { title: '', startAt: new Date().toISOString(), duration: 30 }, { title: 'x', startAt: 'not a date', duration: 30 }, { title: 'x', startAt: new Date().toISOString(), duration: 0 }, { title: 'x', startAt: new Date().toISOString(), duration: 30, recurring: 'hourly' }];
  for (const body of bad) assert.equal((await call('/', 'post', { user: { id: owner }, body })).statusCode, 400, JSON.stringify(body));
});

test('schedules are listed and deleted per account', async t => {
  stubDb(t);
  const created = await call('/', 'post', { user: { id: owner, name: 'Host' }, body: { title: 'Mine', startAt: new Date(Date.now() + 1e6).toISOString(), duration: 30 } });
  const id = created.body.data.meeting._id;
  assert.equal((await call('/', 'get', { user: { id: '507f1f77bcf86cd799439099' } })).body.data.meetings.length, 0);
  assert.equal((await call('/', 'get', { user: { id: owner } })).body.data.meetings.length, 1);
  assert.equal((await call('/:id', 'delete', { user: { id: '507f1f77bcf86cd799439099' }, params: { id } })).statusCode, 404);
  assert.equal((await call('/:id', 'delete', { user: { id: owner }, params: { id } })).statusCode, 200);
});

test('past starts and invalid participant lists do not create schedules or rooms', async t => {
  const { store, rooms } = stubDb(t);
  const valid = { title: 'Plan', startAt: new Date(Date.now() + 3600e3).toISOString(), duration: 30 };
  for (const body of [
    { ...valid, startAt: new Date(Date.now() - 60000).toISOString() },
    { ...valid, participants: ['valid@example.com', 'invalid'] },
    { ...valid, participants: [''] },
    { ...valid, participants: 'valid@example.com' },
    { ...valid, participants: Array.from({ length: 101 }, (_, index) => `user${index}@example.com`) },
  ]) assert.equal((await call('/', 'post', { user: { id: owner }, body })).statusCode, 400);
  assert.equal(store.length, 0); assert.equal(rooms.length, 0);
});
