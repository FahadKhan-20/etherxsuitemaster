const { randomUUID } = require('crypto');
const ChatMessage = require('../models/ChatMessage');

const roomChatSequences = new Map();
const roomChatQueues = new Map();
const roomChatGenerations = new Map();

function enqueueRoomChat(roomCode, task) {
  const previous = roomChatQueues.get(roomCode) || Promise.resolve();
  const next = previous.then(task, task);
  const queued = next.finally(() => {
    if (roomChatQueues.get(roomCode) === queued) roomChatQueues.delete(roomCode);
  });
  roomChatQueues.set(roomCode, queued);
  return next;
}

async function createRoomChatMessage({
  roomCode,
  senderUserId,
  address,
  message,
  audience = 'everyone',
  clientMessageId,
  emit,
  model = ChatMessage,
}) {
  const normalizedClientMessageId = typeof clientMessageId === 'string' && clientMessageId.trim()
    ? clientMessageId.trim()
    : randomUUID();

  const generation = roomChatGenerations.get(roomCode) || 0;
  return enqueueRoomChat(roomCode, async () => {
    if ((roomChatGenerations.get(roomCode) || 0) !== generation) {
      throw new Error('Chat room session is no longer active.');
    }
    const existing = await model.findOne({ roomCode, clientMessageId: normalizedClientMessageId });
    if (existing) return existing;

    const nextSequence = (roomChatSequences.get(roomCode) || 0) + 1;
    const chatMessage = await model.create({
      roomCode,
      sequence: nextSequence,
      clientMessageId: normalizedClientMessageId,
      senderUserId: String(senderUserId),
      address,
      message,
      audience: audience === 'host' ? 'host' : 'everyone',
    });
    roomChatSequences.set(roomCode, nextSequence);
    if (emit) emit(chatMessage);
    return chatMessage;
  });
}

function clearRoomChatState(roomCode) {
  roomChatQueues.delete(roomCode);
  roomChatSequences.delete(roomCode);
  roomChatGenerations.set(roomCode, (roomChatGenerations.get(roomCode) || 0) + 1);
}

module.exports = {
  enqueueRoomChat,
  createRoomChatMessage,
  clearRoomChatState,
  roomChatQueues,
  roomChatSequences,
};
