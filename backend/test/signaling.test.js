const assert = require('node:assert/strict');
const test = require('node:test');
const jwt = require('jsonwebtoken');
const { setupSignaling, rooms, registerRoomHost } = require('../src/signaling');
process.env.JWT_SECRET = 'test-only-signaling-secret';

class FakeSocket {
  constructor(id, io, roomCode, userId = id, token) {
    this.id = id; this.io = io; this.data = {}; this.connected = true;
    this.handlers = new Map(); this.clientHandlers = new Map(); this.clientEvents = []; this.roomEvents = [];
    this.handshake = { auth: { roomCode, token: token === undefined ? jwt.sign({ id: userId, name: userId }, process.env.JWT_SECRET) : token } };
  }
  on(event, handler) { this.handlers.set(event, handler); }
  onClient(event, handler) { this.clientHandlers.set(event, handler); }
  emit(event, payload) { this.clientEvents.push({ event, payload }); this.clientHandlers.get(event)?.(payload); }
  trigger(event, payload, ack) { this.handlers.get(event)?.(payload, ack); }
  join() {}
  to() { return { emit: (event, payload) => this.roomEvents.push({ event, payload }) }; }
  disconnect() {
    if (!this.connected) return;
    this.connected = false; this.trigger('disconnect'); this.io.sockets.sockets.delete(this.id);
  }
}
class FakeServer {
  constructor(_server, options) { this.options = options; this.handlers = new Map(); this.middlewares = []; this.sockets = { sockets: new Map() }; this.emittedEvents = []; }
  use(handler) { this.middlewares.push(handler); }
  on(event, handler) { this.handlers.set(event, handler); }
  to(target) { return { emit: (event, payload) => { this.emittedEvents.push({ target, event, payload }); this.sockets.sockets.get(target)?.emit(event, payload); } }; }
  async connect(socket) {
    for (const middleware of this.middlewares) await new Promise((resolve, reject) => middleware(socket, error => error ? reject(error) : resolve()));
    this.sockets.sockets.set(socket.id, socket); this.handlers.get('connection')(socket);
  }
}
const events = (socket, event) => socket.clientEvents.filter(e => e.event === event);
function fixture(t, owner = 'host-user') {
  const code = `test-${t.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  const io = setupSignaling(null, '*', FakeServer, { resolveRoomOwner: () => owner });
  registerRoomHost(code, owner);
  t.after(() => { [...io.sockets.sockets.values()].forEach(s => s.disconnect()); rooms.delete(code); });
  const connect = async (id, userId = id, token) => { const socket = new FakeSocket(id, io, code, userId, token); await io.connect(socket); return socket; };
  const join = socket => socket.trigger('join-room', { roomCode: code, userName: socket.data.user.name });
  const host = async () => { const socket = await connect('host-socket', owner); join(socket); return socket; };
  const guest = async (admin, id, userId = id) => { const socket = await connect(id, userId); socket.trigger('request-join', { roomCode: code }); admin.trigger('admit-user', { roomCode: code, toSocketId: id }); join(socket); return socket; };
  return { code, io, connect, join, host, guest };
}

test('rejects sockets without a valid JWT before registering any handlers', async t => {
  const f = fixture(t);
  await assert.rejects(f.connect('missing', 'attacker', ''), /Sign in/);
  await assert.rejects(f.connect('forged', 'attacker', 'invalid'), /sign-in expired/);
  await assert.rejects(f.connect('expired', 'attacker', jwt.sign({ id: 'attacker' }, process.env.JWT_SECRET, { expiresIn: -1 })), /sign-in expired/);
  assert.equal(f.io.sockets.sockets.size, 0);
});
test('accepts socket messages big enough for a 10 MB shared file', t => {
  assert.ok(fixture(t).io.options.maxHttpBufferSize >= Math.ceil(10 * 1024 * 1024 * 4 / 3));
});
test('direct join cannot bypass approval or claim another user identity or host role', async t => {
  const f = fixture(t); const host = await f.host(); const attacker = await f.connect('attacker');
  attacker.trigger('join-room', { roomCode: f.code, userId: 'host-user', isHost: true, userName: 'Spoof' });
  assert.equal(rooms.get(f.code).size, 1);
  assert.equal(events(attacker, 'room-error').length, 1);
  attacker.trigger('request-join', { roomCode: f.code, userId: 'host-user', isHost: true });
  assert.equal(attacker.roomEvents.at(-1).payload.userId, 'attacker');
  host.trigger('admit-user', { roomCode: f.code, toSocketId: attacker.id });
  attacker.trigger('join-room', { roomCode: f.code, userId: 'host-user', isHost: true });
  assert.equal(rooms.get(f.code).get(attacker.id).userId, 'attacker');
  assert.equal(rooms.get(f.code).get(attacker.id).isHost, false);
});
test('only the registered authenticated owner starts a room', async t => {
  const f = fixture(t); const other = await f.connect('other');
  f.join(other); assert.equal(rooms.has(f.code), false);
  const host = await f.host(); assert.equal(rooms.get(f.code).get(host.id).isHost, true);
});
test('authenticated room owner can restore authority to an existing room', async t => {
  const f = fixture(t); const host = await f.host(); const owner = await f.guest(host, 'owner', 'owner-user');
  registerRoomHost(f.code, 'owner-user', f.io);
  assert.deepEqual(events(owner, 'your-role').at(-1).payload, { isHost: true });
  assert.deepEqual(events(host, 'your-role').at(-1).payload, { isHost: false });
  host.roomEvents = []; owner.roomEvents = [];
  host.trigger('whiteboard-op', { roomCode: f.code, op: { type: 'CLEAR' } });
  owner.trigger('whiteboard-op', { roomCode: f.code, op: { type: 'CLEAR' } });
  assert.equal(host.roomEvents.length, 0); assert.equal(owner.roomEvents.length, 1);
});
test('host approval applies only to requests for that same room', async t => {
  const f = fixture(t); const host = await f.host(); const guest = await f.connect('guest');
  host.trigger('admit-user', { roomCode: f.code, toSocketId: guest.id });
  assert.equal(events(guest, 'admitted').length, 0);
  guest.trigger('request-join', { roomCode: 'different-room' });
  assert.equal(guest.roomEvents.length, 0);
});
test('waiting participants cannot read or mutate room state or signal peers', async t => {
  const f = fixture(t); const host = await f.host(); const guest = await f.connect('guest');
  for (const event of ['get-notes', 'update-notes', 'get-polls', 'get-files', 'share-media', 'get-whiteboard', 'offer']) guest.trigger(event, { roomCode: f.code, notes: 'bad', to: host.id });
  assert.equal(guest.clientEvents.length, 0); assert.equal(guest.roomEvents.length, 0);
});
test('members cannot signal sockets in another room', async t => {
  const f = fixture(t); const host = await f.host(); const guest = await f.guest(host, 'guest');
  f.io.emittedEvents = [];
  guest.trigger('offer', { roomCode: f.code, to: 'outside', offer: {} });
  guest.trigger('get-notes', { roomCode: 'outside' });
  assert.equal(f.io.emittedEvents.length, 0);
});
test('only host can assign a co-host', async t => {
  const f = fixture(t); const host = await f.host(); const guest = await f.guest(host, 'guest');
  f.io.emittedEvents = [];
  guest.trigger('make-co-host', { roomCode: f.code, socketId: guest.id });
  assert.equal(f.io.emittedEvents.length, 0);
  host.trigger('make-co-host', { roomCode: f.code, socketId: guest.id });
  assert.ok(f.io.emittedEvents.some(e => e.event === 'co-host-changed' && e.payload.userId === 'guest'));
});
test('admitted participants rejoin without a second approval', async t => {
  const f = fixture(t); const host = await f.host(); const first = await f.guest(host, 'alice-first', 'alice'); first.disconnect();
  const again = await f.connect('alice-again', 'alice'); again.trigger('request-join', { roomCode: f.code });
  assert.equal(events(again, 'admitted').length, 1); assert.equal(again.roomEvents.length, 0);
  f.join(again); assert.ok(rooms.get(f.code).has(again.id));
});
test('returning host receives its server role even without a local host flag', async t => {
  const f = fixture(t); const host = await f.host(); const guest = await f.guest(host, 'guest');
  host.disconnect(); // Without a co-host, the owner retains authority.
  const back = await f.connect('host-back', 'host-user'); back.trigger('request-join', { roomCode: f.code });
  assert.equal(events(back, 'admitted').length, 1); f.join(back);
  assert.deepEqual(events(back, 'your-role').at(-1).payload, { isHost: true });
  guest.disconnect(); back.disconnect();
  const fresh = await f.connect('owner-again', 'host-user'); fresh.trigger('request-join', { roomCode: f.code }); f.join(fresh);
  assert.deepEqual(events(fresh, 'your-role').at(-1).payload, { isHost: true });
});
test('kick disconnects even an uncooperative client and requires readmission', async t => {
  const f = fixture(t); const host = await f.host(); const guest = await f.guest(host, 'guest');
  host.trigger('kick-participant', { to: guest.id });
  assert.equal(guest.connected, false); assert.equal(rooms.get(f.code).size, 1);
  const back = await f.connect('guest-back', 'guest'); back.trigger('request-join', { roomCode: f.code }); f.join(back);
  assert.equal(events(back, 'admitted').length, 0); assert.equal(rooms.get(f.code).size, 1);
});
test('locked room rejects new guests but allows current members to return', async t => {
  const f = fixture(t); const host = await f.host(); const guest = await f.guest(host, 'guest'); guest.disconnect();
  host.trigger('lock-room', { roomCode: f.code, locked: true });
  const newcomer = await f.connect('new'); newcomer.trigger('request-join', { roomCode: f.code });
  assert.equal(events(newcomer, 'room-locked-error').length, 1);
  const back = await f.connect('back', 'guest'); back.trigger('request-join', { roomCode: f.code }); f.join(back);
  assert.ok(rooms.get(f.code).has(back.id));
});
test('withdraws stale waiting requests when a participant leaves', async t => {
  const f = fixture(t); await f.host(); const waiting = await f.connect('waiting'); waiting.trigger('request-join', { roomCode: f.code });
  waiting.roomEvents = []; waiting.disconnect();
  assert.deepEqual(waiting.roomEvents, [{ event: 'join-request-cancelled', payload: { socketId: waiting.id } }]);
});
test('raised hands stay ordered and only hosts can lower someone else', async t => {
  const f = fixture(t); const host = await f.host(); const a = await f.guest(host, 'a'); const b = await f.guest(host, 'b');
  const hands = () => f.io.emittedEvents.filter(e => e.event === 'hands-state').at(-1).payload.hands.map(h => h.userName);
  a.trigger('raise-hand'); b.trigger('raise-hand'); assert.deepEqual(hands(), ['a', 'b']);
  b.trigger('lower-hand', { socketId: a.id }); assert.deepEqual(hands(), ['a', 'b']);
  host.trigger('lower-hand', { socketId: a.id }); assert.deepEqual(hands(), ['b']);
  b.disconnect(); assert.deepEqual(hands(), []);
  a.trigger('raise-hand'); const late = await f.guest(host, 'late');
  assert.deepEqual(events(late, 'hands-state').at(-1).payload.hands.map(h => h.userName), ['a']);
});
test('initial microphone and camera choices reach existing and new peers', async t => {
  const f = fixture(t); const host = await f.host(); const guest = await f.connect('guest');
  guest.trigger('request-join', { roomCode: f.code }); host.trigger('admit-user', { roomCode: f.code, toSocketId: guest.id });
  guest.trigger('join-room', { roomCode: f.code, muted: true, videoOff: true });
  const member = rooms.get(f.code).get(guest.id);
  assert.equal(member.selfMuted, true); assert.equal(member.videoOff, true);
  assert.ok(guest.roomEvents.some(e => e.event === 'user-joined' && e.payload.isMuted && e.payload.videoOff));
});
test('host receives requests that arrived before the host joined', async t => {
  const f = fixture(t); const waiting = await f.connect('waiting');
  waiting.trigger('request-join', { roomCode: f.code, userName: 'Waiting guest' });
  const host = await f.host();
  assert.equal(events(host, 'join-request').at(-1).payload.userName, 'Waiting guest');
  host.trigger('admit-user', { toSocketId: waiting.id }); f.join(waiting);
  assert.ok(rooms.get(f.code).has(waiting.id));
});
test('malformed socket payloads do not crash signaling or bypass admission', async t => {
  const f = fixture(t); const host = await f.host(); const waiting = await f.connect('waiting');
  for (const payload of [null, 'bad', 3, []]) {
    assert.doesNotThrow(() => waiting.trigger('join-room', payload));
    assert.doesNotThrow(() => waiting.trigger('request-join', payload));
    assert.doesNotThrow(() => host.trigger('offer', payload));
  }
  assert.equal(rooms.get(f.code).size, 1);
});

test('reference security policy blocks guest actions and admits without waiting only when unlocked',async t=>{
  const f=fixture(t),host=await f.host(),guest=await f.guest(host,'guest');let response;
  guest.trigger('meeting-policy-set',{roomCode:f.code,allowShare:false},r=>response=r);assert.equal(response.ok,false);
  host.trigger('meeting-policy-set',{roomCode:f.code,allowShare:false,waitingRoom:false},r=>response=r);assert.equal(response.ok,true);
  guest.trigger('screen-share-start',{roomCode:f.code},r=>response=r);assert.equal(response.ok,false);assert.match(response.error,/hosts/);
  const admitted=await f.connect('auto');admitted.trigger('request-join',{roomCode:f.code});assert.equal(events(admitted,'admitted').length,1);f.join(admitted);assert(rooms.get(f.code).has('auto'));
  host.trigger('lock-room',{roomCode:f.code,locked:true});const blocked=await f.connect('blocked');blocked.trigger('request-join',{roomCode:f.code});assert.equal(events(blocked,'admitted').length,0);
});
test('breakouts isolate signaling and permit only assigned guest rooms and host visits',async t=>{
  const f=fixture(t),host=await f.host(),a=await f.guest(host,'a'),b=await f.guest(host,'b');let reply;
  host.trigger('breakout-open',{roomCode:f.code,groups:[[a.id],[b.id]],minutes:5},r=>reply=r);assert.equal(reply.ok,true);
  const count=events(b,'offer').length;a.trigger('offer',{roomCode:f.code,to:b.id,offer:{sdp:'cross-room'}});assert.equal(events(b,'offer').length,count);
  a.trigger('breakout-visit',{roomCode:f.code,groupId:'breakout-2'},r=>reply=r);assert.equal(reply.ok,false);
  a.trigger('breakout-visit',{roomCode:f.code,groupId:'main'},r=>reply=r);assert.equal(reply.ok,true);
  a.trigger('breakout-visit',{roomCode:f.code,groupId:'breakout-1'},r=>reply=r);assert.equal(reply.ok,true);
  host.trigger('breakout-visit',{roomCode:f.code,groupId:'breakout-1'},r=>reply=r);assert.equal(reply.ok,true);
  const before=events(host,'offer').length;a.trigger('offer',{roomCode:f.code,to:host.id,offer:{sdp:'same-room'}});assert.equal(events(host,'offer').length,before+1);
  host.trigger('breakout-close',{roomCode:f.code},r=>reply=r);assert.equal(reply.ok,true);assert.equal(f.io.emittedEvents.filter(e=>e.event==='breakout-state').at(-1).payload,null);
});
test('reference rename, bandwidth request, file removal and end-all use authenticated membership',async t=>{
  const f=fixture(t),host=await f.host(),guest=await f.guest(host,'guest');let reply;
  guest.trigger('rename-participant',{roomCode:f.code,name:'Chosen Name'},r=>reply=r);assert.equal(reply.ok,true);assert.equal(rooms.get(f.code).get(guest.id).userName,'Chosen Name');
  guest.trigger('request-media-quality',{roomCode:f.code,low:true},r=>reply=r);assert.equal(events(host,'peer-quality-request').at(-1).payload.low,true);
  guest.trigger('share-file',{roomCode:f.code,file:{name:'bad',size:1,url:'javascript:alert(1)'}},r=>reply=r);assert.equal(reply.ok,false);
  guest.trigger('share-file',{roomCode:f.code,file:{name:'notes.txt',size:2,url:'data:text/plain;base64,aGk='}});const file=f.io.emittedEvents.filter(e=>e.event==='file-shared').at(-1).payload;
  guest.trigger('remove-shared-file',{roomCode:f.code,id:file.id},r=>reply=r);assert.equal(reply.ok,false);
  host.trigger('remove-shared-file',{roomCode:f.code,id:file.id},r=>reply=r);assert.equal(reply.ok,true);assert.deepEqual(f.io.emittedEvents.filter(e=>e.event==='files-state').at(-1).payload.files,[]);
  guest.trigger('end-meeting',{roomCode:f.code},r=>reply=r);assert.equal(reply.ok,false);assert.equal(host.connected,true);
  host.trigger('end-meeting',{roomCode:f.code,notes:'Saved summary'},r=>reply=r);assert.equal(reply.ok,true);assert.equal(guest.connected,false);assert.equal(host.connected,false);
});

test('host departure promotes co-host and publishes updated roster authority',async t=>{
  const f=fixture(t),host=await f.host(),guest=await f.guest(host,'successor');
  host.trigger('make-co-host',{roomCode:f.code,socketId:guest.id});host.disconnect();
  const last=f.io.emittedEvents.filter(e=>e.event==='roster-state').at(-1).payload.members;
  assert.equal(last.find(p=>p.socketId===guest.id).isHost,true);
  assert.equal(f.io.emittedEvents.filter(e=>e.event==='host-transferred').at(-1).payload.newHostSocketId,guest.id);
  let reply;guest.trigger('meeting-policy-set',{roomCode:f.code,waitingRoom:false},r=>reply=r);assert.equal(reply.ok,true);
});
