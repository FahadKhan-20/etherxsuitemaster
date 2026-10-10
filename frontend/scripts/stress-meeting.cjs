// Isolated loopback benchmark: real Socket.IO server and Chrome WebRTC connections.
// No production accounts, schedules, or external services are used.
const fs = require('node:fs');
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { monitorEventLoopDelay } = require('node:perf_hooks');
const puppeteer = require('puppeteer-core');
const { io: client } = require('socket.io-client');
const { Server } = require('../../backend/node_modules/socket.io');
const jwt = require('../../backend/node_modules/jsonwebtoken');
const { setupSignaling, rooms, registerRoomHost } = require('../../backend/src/signaling');
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const until = async predicate => { const deadline = Date.now() + 15000; while (!predicate()) { if (Date.now() > deadline) throw Error('Signaling timed out'); await delay(10); } };
const report = { scope: 'Local loopback: 50 real signaling clients; one media endpoint with 49 bidirectional peers. Not 50 distributed full-mesh browsers or a TURN/WAN benchmark.', signaling: {}, media: {} };

function chromeUsage(root) {
  const processes = new Map();
  for (const name of fs.readdirSync('/proc').filter(name => /^\d+$/.test(name))) {
    try {
      const text = fs.readFileSync(`/proc/${name}/stat`, 'utf8');
      const fields = text.slice(text.lastIndexOf(')') + 2).split(' ');
      processes.set(Number(name), { parent: Number(fields[1]), ticks: Number(fields[11]) + Number(fields[12]), rss: Number(fields[21]) * 4096 });
    } catch { /* A short-lived Chrome process exited. */ }
  }
  const selected = new Set([root]);
  let changed = true;
  while (changed) { changed = false; for (const [pid, process] of processes) if (selected.has(process.parent) && !selected.has(pid)) { selected.add(pid); changed = true; } }
  const result = { ticks: 0, rss: 0 };
  for (const pid of selected) { const process = processes.get(pid); if (process) { result.ticks += process.ticks; result.rss += process.rss; } }
  return result;
}

async function signaling() {
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  const server = http.createServer();
  const room = `stress-${crypto.randomUUID()}`;
  const io = setupSignaling(server, '*', Server, { resolveRoomOwner: () => 'stress-host', resolveUserAvatar: () => null });
  registerRoomHost(room, 'stress-host');
  const sockets = [];
  const histogram = monitorEventLoopDelay({ resolution: 10 });
  histogram.enable();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const connect = (user, host = false, late = false) => new Promise((resolve, reject) => {
    const socket = client(base, { transports: ['websocket'], reconnection: false, auth: { token: jwt.sign({ id: user, name: user }, process.env.JWT_SECRET), roomCode: room } });
    sockets.push(socket);
    const timer = setTimeout(() => reject(Error(`Join timeout: ${user}`)), 15000);
    socket.on('connect_error', reject);
    socket.on('connect', () => socket.emit(host ? 'join-room' : 'request-join', { roomCode: room }));
    socket.on('admitted', () => socket.emit('join-room', { roomCode: room, muted: true, videoOff: true }));
    socket.once(late ? 'room-full' : 'existing-users', payload => { clearTimeout(timer); resolve({ socket, payload }); });
    if (host) socket.on('join-request', request => socket.emit('admit-user', { roomCode: room, toSocketId: request.socketId }));
  });
  try {
    const started = performance.now();
    const cpu = process.cpuUsage();
    const host = await connect('stress-host', true);
    const guests = await Promise.all(Array.from({ length: 49 }, (_, index) => connect(`stress-${index}`)));
    assert.equal(rooms.get(room).size, 50);
    const joinMs = performance.now() - started;
    const extra = await connect('stress-overflow', false, true);
    assert.equal(extra.payload.max, 50);
    extra.socket.disconnect();
    const receive = new Promise(resolve => guests[0].socket.once('offer', resolve));
    host.socket.emit('offer', { roomCode: room, to: guests[0].socket.id, offer: { type: 'offer', sdp: 'transport-benchmark' } });
    const offer = await receive;
    assert.equal(offer.from, host.socket.id);
    const reconnectStart = performance.now();
    const oldIds = guests.slice(0, 10).map(({ socket }) => socket.id);
    guests.slice(0, 10).forEach(({ socket }) => socket.disconnect());
    await until(() => rooms.get(room).size === 40);
    await Promise.all(Array.from({ length: 10 }, (_, index) => connect(`stress-${index}`)));
    await until(() => rooms.get(room).size === 50);
    assert(oldIds.every(id => !rooms.get(room).has(id)));
    const usage = process.cpuUsage(cpu);
    report.signaling = { participants: 50, joinMs: Math.round(joinMs), overflowRejected: true, reconnectingParticipants: 10, reconnectMs: Math.round(performance.now() - reconnectStart), staleSocketIdsRemoved: true, cpuMs: Math.round((usage.user + usage.system) / 1000), eventLoopP95Ms: Number((histogram.percentile(95) / 1e6).toFixed(2)), heapMiB: Number((process.memoryUsage().heapUsed / 1048576).toFixed(1)) };
  } finally {
    histogram.disable();
    sockets.forEach(socket => socket.disconnect());
    await new Promise(resolve => io.close(resolve));
  }
}

async function media() {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('about:blank');
    await page.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
      document.body.append(canvas);
      const context = canvas.getContext('2d'); let frame = 0;
      window.paint = setInterval(() => { context.fillStyle = `hsl(${frame++ % 360} 80% 45%)`; context.fillRect(0, 0, 320, 180); context.fillStyle = '#fff'; context.fillRect(frame % 280, 40, 40, 40); }, 66);
      const audio = new AudioContext(); await audio.resume();
      const oscillator = audio.createOscillator(); const gain = audio.createGain(); gain.gain.value = .02;
      const destination = audio.createMediaStreamDestination(); oscillator.connect(gain).connect(destination); oscillator.start();
      const stream = canvas.captureStream(15); stream.addTrack(destination.stream.getAudioTracks()[0]);
      window.benchmark = { stream, audio, oscillator, pairs: [] };
      window.addPeer = async () => {
        const pair = [new RTCPeerConnection({ iceServers: [] }), new RTCPeerConnection({ iceServers: [] })];
        for (const [index, pc] of pair.entries()) {
          for (const track of stream.getTracks()) pc.addTrack(track, stream);
          pc.onicecandidate = event => { if (event.candidate) pair[1 - index].addIceCandidate(event.candidate).catch(() => {}); };
          pc.ontrack = event => { if (pc.video) return; const video = document.createElement('video'); pc.video = video; video.muted = true; video.autoplay = true; video.srcObject = event.streams[0]; video.width = 80; document.body.append(video); video.play().catch(() => {}); };
        }
        const offer = await pair[0].createOffer(); await pair[0].setLocalDescription(offer); await pair[1].setRemoteDescription(offer);
        const answer = await pair[1].createAnswer(); await pair[1].setLocalDescription(answer); await pair[0].setRemoteDescription(answer);
        window.benchmark.pairs.push(pair);
      };
      window.mediaStats = async () => {
        const result = { bytesSent: 0, bytesReceived: 0, framesDecoded: 0, framesEncoded: 0, packetsLost: 0, packetsReceived: 0, connected: 0 };
        for (const pair of window.benchmark.pairs) {
          const pc = pair[0]; if (pc.connectionState === 'connected') result.connected++;
          for (const stat of (await pc.getStats()).values()) {
            if (stat.type === 'outbound-rtp') { result.bytesSent += stat.bytesSent || 0; result.framesEncoded += stat.framesEncoded || 0; }
            if (stat.type === 'inbound-rtp') { result.bytesReceived += stat.bytesReceived || 0; result.framesDecoded += stat.framesDecoded || 0; result.packetsLost += stat.packetsLost || 0; result.packetsReceived += stat.packetsReceived || 0; }
          }
        }
        return result;
      };
      for (let index = 0; index < 49; index++) await window.addPeer();
    });
    await page.waitForFunction(() => window.benchmark.pairs.every(pair => pair.every(pc => pc.connectionState === 'connected')), { timeout: 45000 });
    const before = await page.evaluate(() => window.mediaStats());
    const cpuBefore = chromeUsage(browser.process().pid);
    const sampleStart = performance.now();
    await delay(10000);
    const after = await page.evaluate(() => window.mediaStats());
    const cpuAfter = chromeUsage(browser.process().pid);
    const seconds = (performance.now() - sampleStart) / 1000;
    assert.equal(after.connected, 49); assert(after.bytesSent > before.bytesSent); assert(after.bytesReceived > before.bytesReceived);
    report.media = { participantEquivalent: 50, bidirectionalPeerConnections: 49, sampleSeconds: Number(seconds.toFixed(1)), source: 'Synthetic 320x180 video at 15fps plus audio; one Chrome process hosts both sides.', outboundMbps: Number(((after.bytesSent - before.bytesSent) * 8 / seconds / 1e6).toFixed(2)), inboundMbps: Number(((after.bytesReceived - before.bytesReceived) * 8 / seconds / 1e6).toFixed(2)), decodedFpsPerPeer: Number(((after.framesDecoded - before.framesDecoded) / seconds / 49).toFixed(1)), encodedFpsPerPeer: Number(((after.framesEncoded - before.framesEncoded) / seconds / 49).toFixed(1)), packetsLost: after.packetsLost - before.packetsLost, chromeCpuPercentOneCore: Number(((cpuAfter.ticks - cpuBefore.ticks) / seconds).toFixed(1)), chromeRssMiB: Number((cpuAfter.rss / 1048576).toFixed(1)) };
    const reconnectStart = performance.now();
    await page.evaluate(async () => {
      const old = window.benchmark.pairs.shift(); old.forEach(pc => { pc.close(); pc.video?.remove(); });
      await window.addPeer();
    });
    await page.waitForFunction(() => window.benchmark.pairs.every(pair => pair.every(pc => pc.connectionState === 'connected')), { timeout: 15000 });
    report.media.peerRecreationMs = Math.round(performance.now() - reconnectStart);
    await page.evaluate(() => { clearInterval(window.paint); window.benchmark.pairs.flat().forEach(pc => pc.close()); window.benchmark.stream.getTracks().forEach(track => track.stop()); window.benchmark.oscillator.stop(); window.benchmark.audio.close(); });
  } finally { await browser.close(); }
}

(async () => {
  const log = console.log; console.log = () => {};
  try { await signaling(); await media(); } finally { console.log = log; }
  report.completedAt = new Date().toISOString();
  fs.writeFileSync(process.env.STRESS_REPORT_PATH || '/tmp/etherx-meeting-stress.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
