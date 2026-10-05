const assert = require('node:assert/strict');
const test = require('node:test');
const { setupSignaling, rooms, registerRoomHost } = require('../src/signaling');

class FakeSocket {
  constructor(id, io) {
    this.id = id;
    this.io = io;
    this.handlers = new Map();
    this.clientHandlers = new Map();
    this.clientEvents = [];
    this.roomEvents = [];
  }

  on(event, handler) {
    this.handlers.set(event, handler);
  }

  onClient(event, handler) {
    this.clientHandlers.set(event, handler);
  }

  emit(event, payload) {
    this.clientEvents.push({ event, payload });
    this.clientHandlers.get(event)?.(payload);
  }

  trigger(event, payload) {
    this.handlers.get(event)?.(payload);
  }

  join() {}

  to() {
    const socket = this;
    return { emit: (event, payload) => socket.roomEvents.push({ event, payload }) };
  }

  disconnect() {
    this.trigger('disconnect');
    this.io.sockets.sockets.delete(this.id);
  }
}

class FakeServer {
  constructor() {
    this.handlers = new Map();
    this.sockets = { sockets: new Map() };
  }

  on(event, handler) {
    this.handlers.set(event, handler);
  }

  to(socketId) {
    return {
      emit: (event, payload) => {
        this.sockets.sockets.get(socketId)?.emit(event, payload);
      },
    };
  }

  connect(socket) {
    this.sockets.sockets.set(socket.id, socket);
    this.handlers.get('connection')(socket);
  }
}

test('logs the remaining participant count when an admin removes someone', (t) => {
  const roomCode = 'participant-count-test';
  const originalInfo = console.info;
  const logs = [];
  console.info = (message) => logs.push(message);

  t.after(() => {
    console.info = originalInfo;
    rooms.delete(roomCode);
  });

  const io = setupSignaling(null, '*', FakeServer);

  const host = new FakeSocket('host-socket', io);
  const participant = new FakeSocket('participant-socket', io);
  io.connect(host);
  io.connect(participant);

  host.trigger('join-room', {
    roomCode,
    userId: 'host-user',
    userName: 'Host',
    isHost: true,
  });
  participant.trigger('join-room', {
    roomCode,
    userId: 'participant-user',
    userName: 'Participant',
    isHost: false,
  });
  participant.onClient('removed-from-room', () => participant.disconnect());

  host.trigger('kick-participant', { to: participant.id });

  assert.equal(rooms.get(roomCode).size, 1);
  assert.ok(logs.includes(`[participants] ${roomCode}: 1 participant(s) in room`));
  assert.ok(participant.clientEvents.some(({ event }) => event === 'removed-from-room'));

  host.disconnect();
});

test('registers the authenticated room owner as the signaling host', (t) => {
  const roomCode = 'registered-host-test';
  t.after(() => rooms.delete(roomCode));

  const io = setupSignaling(null, '*', FakeServer);
  const firstJoiner = new FakeSocket('first-socket', io);
  const roomOwner = new FakeSocket('owner-socket', io);
  firstJoiner.roomEvents = [];
  roomOwner.roomEvents = [];
  io.connect(firstJoiner);
  io.connect(roomOwner);

  firstJoiner.trigger('join-room', { roomCode, userId: 'other-user', userName: 'Other' });
  roomOwner.trigger('join-room', { roomCode, userId: 'owner-user', userName: 'Owner' });
  firstJoiner.roomEvents = [];
  roomOwner.roomEvents = [];
  registerRoomHost(roomCode, 'owner-user', io);

  firstJoiner.trigger('whiteboard-op', { roomCode, op: { type: 'CLEAR' } });
  roomOwner.trigger('whiteboard-op', { roomCode, op: { type: 'CLEAR' } });

  assert.equal(firstJoiner.roomEvents.length, 0);
  assert.deepEqual(roomOwner.roomEvents, [{ event: 'whiteboard-op', payload: { type: 'CLEAR' } }]);

  firstJoiner.disconnect();
  roomOwner.disconnect();
});

test('only the registered room host can assign a co-host', (t) => {
  const roomCode = 'co-host-permissions-test';
  const io = setupSignaling(null, '*', FakeServer);
  const host = new FakeSocket('host-socket', io);
  const participant = new FakeSocket('participant-socket', io);
  io.connect(host);
  io.connect(participant);

  host.trigger('join-room', { roomCode, userId: 'host-user', userName: 'Host', isHost: true });
  participant.trigger('join-room', { roomCode, userId: 'participant-user', userName: 'Participant' });
  registerRoomHost(roomCode.toUpperCase(), { toString: () => 'host-user' });

  participant.trigger('set-co-host', { roomCode, to: participant.id, isCoHost: true });
  assert.equal(rooms.get(roomCode).get(participant.id).isCoHost, false);
  assert.ok(participant.clientEvents.some(({ event }) => event === 'meeting-permission-denied'));

  host.trigger('set-co-host', { roomCode, to: participant.id, isCoHost: true });
  assert.equal(rooms.get(roomCode).get(participant.id).isCoHost, true);

  host.disconnect();
  participant.disconnect();
  t.after(() => rooms.delete(roomCode));
});