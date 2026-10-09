const assert = require('node:assert/strict');
const test = require('node:test');
const { createMeetingMetrics } = require('../src/meetingMetrics');

test('a session records attendance time per account, counts activity and saves once when it ends', async () => {
  let now = 1_000_000; const saved = [];
  const metrics = createMeetingMetrics({ now: () => now, save: async doc => saved.push(doc) });
  metrics.start('room', 'host');
  metrics.joined('room', 'host', 'Host');
  now += 60_000; metrics.joined('room', 'guest', 'Guest');
  metrics.joined('room', 'guest', 'Guest'); // second tab of the same account
  metrics.count('room', 'chat'); metrics.count('room', 'hands'); metrics.count('room', 'reactions'); metrics.count('room', 'reactions');
  now += 120_000; metrics.left('room', 'guest'); // one tab closes: still present
  now += 60_000; metrics.left('room', 'guest');
  now += 60_000; metrics.left('room', 'host');
  await metrics.finish('room');
  await metrics.finish('room');
  assert.equal(saved.length, 1);
  const s = saved[0];
  assert.equal(s.roomCode, 'room'); assert.equal(s.host, 'host');
  assert.equal(s.endedAt - s.startedAt, 300_000);
  assert.deepEqual(s.participants.map(p => [p.user, p.name, p.seconds]), [['host', 'Host', 300], ['guest', 'Guest', 180]]);
  assert.deepEqual(s.counts, { chat: 1, hands: 1, reactions: 2 });
});

test('sessions nobody attended are not saved; unknown rooms are ignored', async () => {
  const saved = [];
  const metrics = createMeetingMetrics({ save: async doc => saved.push(doc) });
  metrics.count('nowhere', 'chat'); metrics.left('nowhere', 'x');
  metrics.start('empty', 'host');
  await metrics.finish('empty');
  assert.equal(saved.length, 0);
});

test('a failed save does not throw into signaling', async () => {
  const metrics = createMeetingMetrics({ save: async () => { throw new Error('db down'); }, log: () => {} });
  metrics.start('r', 'h'); metrics.joined('r', 'h', 'H');
  await metrics.finish('r');
});
