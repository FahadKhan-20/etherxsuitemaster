const test = require('node:test');
const assert = require('node:assert/strict');

const {
  waitingRooms,
  admittedUsers,
  bannedUsers,
  roomHosts,
  addWaitingUser,
  admitUser,
  denyUser,
  banUser,
  clearMeetingAdmissionState,
} = require('../src/signaling');

const roomCode = `test-${process.pid}`;

test.afterEach(() => clearMeetingAdmissionState(roomCode));

test('new participants are added to waiting', () => {
  const request = addWaitingUser(roomCode, 'user-a', 'A', 'socket-a');
  assert.equal(request.status, 'waiting');
  assert.equal(waitingRooms.get(roomCode).size, 1);
});

test('waiting requests are deduplicated by user id', () => {
  addWaitingUser(roomCode, 'user-a', 'A', 'socket-a');
  addWaitingUser(roomCode, 'user-a', 'A2', 'socket-b');
  assert.equal(waitingRooms.get(roomCode).size, 1);
  assert.equal(waitingRooms.get(roomCode).get('user-a').socketId, 'socket-b');
});

test('admit moves a user into persistent admission', () => {
  addWaitingUser(roomCode, 'user-a', 'A', 'socket-a');
  admitUser(roomCode, 'user-a');
  assert.equal(admittedUsers.get(roomCode).has('user-a'), true);
  assert.equal(waitingRooms.get(roomCode)?.has('user-a'), false);
});

test('admission survives a participant leaving', () => {
  admitUser(roomCode, 'user-a');
  assert.equal(admittedUsers.get(roomCode).has('user-a'), true);
});

test('multiple participants have independent admission state', () => {
  admitUser(roomCode, 'user-a');
  admitUser(roomCode, 'user-b');
  assert.deepEqual([...admittedUsers.get(roomCode)].sort(), ['user-a', 'user-b']);
});

test('unknown participants remain waiting until admitted', () => {
  addWaitingUser(roomCode, 'user-a', 'A', 'socket-a');
  assert.equal(admittedUsers.has(roomCode), false);
});

test('deny removes only the pending request', () => {
  addWaitingUser(roomCode, 'user-a', 'A', 'socket-a');
  denyUser(roomCode, 'user-a');
  assert.equal(waitingRooms.get(roomCode)?.has('user-a'), false);
  assert.equal(bannedUsers.has(roomCode), false);
});

test('kick bans the participant', () => {
  admitUser(roomCode, 'user-a');
  banUser(roomCode, 'user-a');
  assert.equal(bannedUsers.get(roomCode).has('user-a'), true);
});

test('kick removes admission', () => {
  admitUser(roomCode, 'user-a');
  banUser(roomCode, 'user-a');
  assert.equal(admittedUsers.get(roomCode)?.has('user-a'), false);
});

test('normal leave does not add a ban', () => {
  admitUser(roomCode, 'user-a');
  assert.equal(bannedUsers.has(roomCode), false);
});

test('room host state is independent from pending requests', () => {
  roomHosts.set(roomCode, 'host');
  addWaitingUser(roomCode, 'user-a', 'A', 'socket-a');
  assert.equal(roomHosts.get(roomCode), 'host');
  assert.equal(waitingRooms.get(roomCode).size, 1);
});

test('meeting cleanup clears all admission state', () => {
  roomHosts.set(roomCode, 'host');
  addWaitingUser(roomCode, 'user-a', 'A', 'socket-a');
  admitUser(roomCode, 'user-b');
  banUser(roomCode, 'user-c');
  clearMeetingAdmissionState(roomCode);
  assert.equal(waitingRooms.has(roomCode), false);
  assert.equal(admittedUsers.has(roomCode), false);
  assert.equal(bannedUsers.has(roomCode), false);
  assert.equal(roomHosts.has(roomCode), false);
});

test('cleanup is safe to repeat', () => {
  clearMeetingAdmissionState(roomCode);
  clearMeetingAdmissionState(roomCode);
  assert.equal(waitingRooms.has(roomCode), false);
});
