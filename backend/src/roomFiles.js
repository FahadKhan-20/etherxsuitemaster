// Files shared in a meeting. Bytes travel over HTTP and live on disk; the meeting socket only carries
// metadata. (Sending 10 MB data URLs through the socket to every participant stalled control messages
// such as screen-share offers and multiplied memory on the server and in every browser.)
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const baseDir = path.join(__dirname, '../uploads/room-files');
const files = new Map(); // roomCode -> [{ id, name, size, type, sharedBy, sharedAt, path }]

const roomDir = code => path.join(baseDir, encodeURIComponent(code));
const publicFile = ({ id, name, size, type, sharedBy, sharedAt }) => ({ id, name, size, type, sharedBy, sharedAt });
const list = code => (files.get(code) || []).map(publicFile);

function add(code, { name, size, type, tempPath, sharedBy }) {
  const id = randomUUID();
  fs.mkdirSync(roomDir(code), { recursive: true });
  const target = path.join(roomDir(code), id);
  try {
    fs.renameSync(tempPath, target);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error; // temp dir on another filesystem
    fs.copyFileSync(tempPath, target);
    fs.rmSync(tempPath, { force: true });
  }
  const entry = { id, name: String(name).slice(0, 255), size, type: String(type || 'application/octet-stream').slice(0, 100), sharedBy, sharedAt: Date.now(), path: target };
  if (!files.has(code)) files.set(code, []);
  files.get(code).push(entry);
  return entry;
}

const get = (code, id) => (files.get(code) || []).find(f => f.id === id) || null;

function remove(code, id) {
  const entry = get(code, id);
  if (!entry) return false;
  files.set(code, files.get(code).filter(f => f.id !== id));
  fs.rm(entry.path, { force: true }, () => {});
  return true;
}

function removeAll(code) {
  files.delete(code);
  fs.rm(roomDir(code), { recursive: true, force: true }, () => {});
}

module.exports = { MAX_FILE_BYTES, baseDir, publicFile, list, add, get, remove, removeAll };
