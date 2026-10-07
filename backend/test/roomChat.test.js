const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createRoomChatMessage,
  clearRoomChatState,
  roomChatQueues,
  roomChatSequences,
} = require('../src/services/roomChat');

function createModel() {
  const messages = [];
  return {
    messages,
    async findOne(query) {
      return messages.find(item => item.roomCode === query.roomCode && item.clientMessageId === query.clientMessageId) || null;
    },
    async create(message) {
      const saved = { ...message, _id: `message-${messages.length + 1}`, createdAt: new Date() };
      messages.push(saved);
      return saved;
    },
  };
}

test('enqueueRoomChat assigns sequential numbers and preserves ordering', async () => {
  const model = createModel();
  clearRoomChatState('room-a');
  const results = await Promise.all(
    ['one', 'two', 'three'].map((message, index) => createRoomChatMessage({
      roomCode: 'room-a',
      senderUserId: `user-${index}`,
      address: 'User',
      message,
      clientMessageId: `client-${index}`,
      model,
    }))
  );
  assert.deepEqual(results.map(item => item.sequence), [1, 2, 3]);
  assert.deepEqual(model.messages.map(item => item.message), ['one', 'two', 'three']);
  clearRoomChatState('room-a');
});

test('duplicate clientMessageId returns one message and does not consume a sequence', async () => {
  const model = createModel();
  clearRoomChatState('room-b');
  const [first, duplicate, next] = await Promise.all([
    createRoomChatMessage({ roomCode: 'room-b', senderUserId: 'user', address: 'User', message: 'same', clientMessageId: 'duplicate', model }),
    createRoomChatMessage({ roomCode: 'room-b', senderUserId: 'user', address: 'User', message: 'same', clientMessageId: 'duplicate', model }),
    createRoomChatMessage({ roomCode: 'room-b', senderUserId: 'other', address: 'Other', message: 'next', clientMessageId: 'next', model }),
  ]);
  assert.equal(first._id, duplicate._id);
  assert.equal(first.sequence, 1);
  assert.equal(next.sequence, 2);
  assert.equal(model.messages.length, 2);
  clearRoomChatState('room-b');
});

test('two concurrent senders cannot receive the same sequence number', async () => {
  const model = createModel();
  clearRoomChatState('room-c');
  const results = await Promise.all([
    createRoomChatMessage({ roomCode: 'room-c', senderUserId: 'host', address: 'Host', message: 'host', clientMessageId: 'host-1', model }),
    createRoomChatMessage({ roomCode: 'room-c', senderUserId: 'participant', address: 'Participant', message: 'participant', clientMessageId: 'participant-1', model }),
  ]);
  assert.deepEqual(new Set(results.map(item => item.sequence)), new Set([1, 2]));
  clearRoomChatState('room-c');
});

test('room chat state is reset after the last participant leaves', () => {
  roomChatQueues.set('room-d', Promise.resolve());
  roomChatSequences.set('room-d', 42);
  clearRoomChatState('room-d');
  assert.equal(roomChatQueues.has('room-d'), false);
  assert.equal(roomChatSequences.has('room-d'), false);
});
