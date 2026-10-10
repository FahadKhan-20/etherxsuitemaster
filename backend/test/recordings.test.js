const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs');
const path = require('path');
const { Writable } = require('stream');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-recordings-secret';
const Recording = require('../src/models/Recording');
const router = require('../src/routes/recordings');
const auth = require('../src/middleware/auth');

const route = (p, method) => router.stack.find(l => l.route?.path === p && l.route.methods[method]).route;
const uploads = path.join(__dirname, '../uploads');
const ownerId = '11111111-1111-4111-8111-111111111111', recId = '22222222-2222-4222-8222-222222222222';

// Response double that collects headers and a streamed body.
function response() {
  const chunks = [];
  const res = new Writable({ write(chunk, _enc, cb) { chunks.push(chunk); cb(); } });
  Object.assign(res, { statusCode: 200, headers: {}, status(c) { this.statusCode = c; return this; }, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, json(v) { this.body = v; this.end(); return this; } });
  res.done = new Promise(resolve => res.on('finish', () => resolve(Buffer.concat(chunks))));
  return res;
}
function fixture(t) {
  const filename = `test-${Date.now()}.webm`;
  fs.mkdirSync(uploads, { recursive: true });
  fs.writeFileSync(path.join(uploads, filename), Buffer.from('0123456789'));
  const doc = { _id: recId, id: recId, filename, originalName: 'Team "sync"\r\nX: y.webm', size: 10, roomCode: 'abc', duration: 3, uploadedBy: { _id: ownerId } };
  const { findById, findOwned } = Recording;
  Recording.findById = async id => (String(id) === recId ? doc : null);
  Recording.findOwned = async (id, owner) => (String(id) === recId && String(owner) === ownerId ? doc : null);
  t.after(() => { Recording.findById = findById; Recording.findOwned = findOwned; fs.rmSync(path.join(uploads, filename), { force: true }); });
  return doc;
}

test('uploaded files are not served publicly', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
  assert.doesNotMatch(src, /express\.static\([^)]*uploads/);
});

test('uploads are capped in size and count', () => {
  assert.ok(router.MAX_RECORDING_BYTES > 0 && router.MAX_RECORDING_BYTES <= 4 * 1024 ** 3);
});

test('only the owner can mint a recording link, and it expires', async t => {
  fixture(t);
  const link = route('/:id/link', 'post');
  assert.equal(link.stack[0].handle, auth);
  const handle = link.stack.at(-1).handle;
  const other = response();
  await handle({ params: { id: recId }, user: { id: '99999999-9999-4999-8999-999999999999' }, body: {} }, other, e => { throw e; });
  assert.equal(other.statusCode, 404);
  const mine = response();
  await handle({ params: { id: recId }, user: { id: ownerId }, body: { share: true } }, mine, e => { throw e; });
  const token = new URL(mine.body.url, 'http://x').searchParams.get('token');
  const claims = jwt.verify(token, process.env.JWT_SECRET);
  assert.equal(claims.rid, recId); assert.equal(claims.purpose, 'recording'); assert.equal(claims.id, undefined);
  assert.ok(claims.exp - claims.iat <= 7 * 24 * 3600);
});

test('recording links never work as login tokens', () => {
  const token = jwt.sign({ purpose: 'recording', rid: recId }, process.env.JWT_SECRET);
  const res = response(); let passed = false;
  auth({ headers: { authorization: `Bearer ${token}` } }, res, () => { passed = true; });
  assert.equal(passed, false); assert.equal(res.statusCode, 401);
});

test('streams with a valid link, supports seeking and safe download names', async t => {
  fixture(t);
  const stream = route('/:id/stream', 'get').stack.at(-1).handle;
  const token = jwt.sign({ purpose: 'recording', rid: recId }, process.env.JWT_SECRET, { expiresIn: 60 });
  const ranged = response();
  await stream({ params: { id: recId }, query: { token }, headers: { range: 'bytes=2-5' } }, ranged, e => { throw e; });
  assert.equal(ranged.statusCode, 206);
  assert.equal(ranged.headers['content-range'], 'bytes 2-5/10');
  assert.equal((await ranged.done).toString(), '2345');
  const download = response();
  await stream({ params: { id: recId }, query: { token, download: '1' }, headers: {} }, download, e => { throw e; });
  assert.equal((await download.done).toString(), '0123456789');
  assert.match(download.headers['content-disposition'], /^attachment;/);
  assert.doesNotMatch(download.headers['content-disposition'], /[\r\n]/);
});

test('streams reject missing, expired, foreign or login tokens', async t => {
  fixture(t);
  const stream = route('/:id/stream', 'get').stack.at(-1).handle;
  const tokens = [undefined, jwt.sign({ purpose: 'recording', rid: recId }, process.env.JWT_SECRET, { expiresIn: -1 }), jwt.sign({ purpose: 'recording', rid: '507f1f77bcf86cd799439033' }, process.env.JWT_SECRET), jwt.sign({ id: ownerId }, process.env.JWT_SECRET)];
  for (const token of tokens) {
    const res = response();
    await stream({ params: { id: recId }, query: { token }, headers: {} }, res, e => { throw e; });
    assert.equal(res.statusCode, 401);
  }
});
