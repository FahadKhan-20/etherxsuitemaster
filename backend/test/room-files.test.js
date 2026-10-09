const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Writable } = require('stream');
const router = require('../src/routes/rooms');
const roomFiles = require('../src/roomFiles');
const { rooms } = require('../src/signaling');

const route = (p, m) => router.stack.find(l => l.route?.path === p && l.route.methods[m]).route;
const response = () => { const chunks = []; const res = new Writable({ write(c, _e, cb) { chunks.push(c); cb(); } }); Object.assign(res, { statusCode: 200, headers: {}, status(c) { this.statusCode = c; return this; }, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, json(v) { this.body = v; this.end(); return this; } }); res.done = new Promise(r => res.on('finish', () => r(Buffer.concat(chunks)))); return res; };
const tempFile = text => { const p = path.join(os.tmpdir(), `rf-${Date.now()}-${Math.random()}`); fs.writeFileSync(p, text); return p; };

test('file routes require sign-in and an upload size limit', () => {
  const auth = require('../src/middleware/auth');
  assert.equal(route('/:code/files', 'post').stack[0].handle, auth);
  assert.equal(route('/:code/files/:id', 'get').stack[0].handle, auth);
  assert.equal(roomFiles.MAX_FILE_BYTES, 10 * 1024 * 1024);
});

test('members upload once; the room gets metadata only; only members can download', async t => {
  const code = 'files-room', emitted = [];
  rooms.set(code, new Map([['s1', { userId: 'member', userName: 'Member' }]]));
  t.after(() => { rooms.delete(code); roomFiles.removeAll(code); });
  const io = { to: room => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }) };
  const upload = route('/:code/files', 'post').stack.at(-1).handle;
  const outsider = response();
  await upload({ params: { code }, user: { id: 'stranger' }, file: { path: tempFile('x'), originalname: 'x.txt', size: 1, mimetype: 'text/plain' }, app: { get: () => io } }, outsider, e => { throw e; });
  assert.equal(outsider.statusCode, 403);
  const ok = response();
  await upload({ params: { code }, user: { id: 'member' }, file: { path: tempFile('hello'), originalname: 'notes.txt', size: 5, mimetype: 'text/plain' }, app: { get: () => io } }, ok, e => { throw e; });
  assert.equal(ok.statusCode, 201);
  const shared = emitted.find(e => e.event === 'file-shared');
  assert.equal(shared.room, code);
  assert.deepEqual(Object.keys(shared.payload).sort(), ['id', 'name', 'sharedAt', 'sharedBy', 'size', 'type']);
  const download = route('/:code/files/:id', 'get').stack.at(-1).handle;
  const denied = response();
  await download({ params: { code, id: shared.payload.id }, user: { id: 'stranger' } }, denied, e => { throw e; });
  assert.equal(denied.statusCode, 403);
  const got = response();
  await download({ params: { code, id: shared.payload.id }, user: { id: 'member' } }, got, e => { throw e; });
  assert.equal((await got.done).toString(), 'hello');
  assert.match(got.headers['content-disposition'], /^attachment;/);
});
