const assert = require('node:assert/strict');
const test = require('node:test');
const router = require('../src/routes/rooms');
const ChatMessage = require('../src/models/ChatMessage');
const { rooms } = require('../src/signaling');

function handler(method) {
  return router.stack.find(layer => layer.route?.path === '/chat/:roomCode' && layer.route.methods[method]).route.stack.at(-1).handle;
}
async function request(method, roomCode, userId, body = {}) {
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
  await handler(method)({ params: { roomCode }, user: { id: userId, name: 'Account name' }, body, app: { get: () => null } }, res, error => { throw error; });
  return res;
}
test('chat denies waiting participants and users from other rooms', async t => {
  const code = 'chat-protected';
  rooms.set(code, new Map([['member', { userId: 'member', userName: 'Member' }]]));
  t.after(() => rooms.delete(code));
  for (const method of ['get', 'post']) {
    const res = await request(method, code, 'waiting', { message: 'Not admitted' });
    assert.equal(res.statusCode, 403);
    assert.equal((await request(method, 'other-room', 'member', { message: 'Wrong room' })).statusCode, 403);
  }
});
test('chat uses authenticated sender identity and chosen meeting name', async t => {
  const code = 'chat-identity', userId = '507f1f77bcf86cd799439011';
  rooms.set(code, new Map([['socket', { userId, userName: 'Chosen name' }]]));
  const original = ChatMessage.create; let saved;
  ChatMessage.create = async value => { saved = value; return value; };
  t.after(() => { rooms.delete(code); ChatMessage.create = original; });
  const res = await request('post', code, userId, { message: ' Hello ', address: 'Spoof', senderId: 'Spoof' });
  assert.equal(res.statusCode, 201);
  assert.deepEqual(saved, { roomCode: code, senderId: userId, address: 'Chosen name', message: 'Hello' });
});
