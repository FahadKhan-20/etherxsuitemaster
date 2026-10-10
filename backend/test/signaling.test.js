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
function fixture(t, owner = 'host-user', avatars = {}) {
  const code = `test-${t.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  const io = setupSignaling(null, '*', FakeServer, { resolveRoomOwner: () => owner, resolveUserAvatar: id => avatars[id] || null });
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
test('socket messages stay small; files travel over HTTP instead', t => {
  assert.ok(fixture(t).io.options.maxHttpBufferSize <= 1e6);
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
test('an account is in the meeting once: joining again replaces the earlier tab or device', async t => {
  const f = fixture(t); const host = await f.host(); const first = await f.guest(host, 'alice-phone', 'alice');
  const second = await f.connect('alice-laptop', 'alice'); second.trigger('request-join', { roomCode: f.code }); f.join(second);
  assert.equal(events(first, 'session-replaced').length, 1); assert.equal(first.connected, false);
  assert.deepEqual([...rooms.get(f.code).values()].filter(p => p.userId === 'alice').map(p => p.socketId), ['alice-laptop']);
  assert.ok(!events(second, 'existing-users')[0].payload.some(p => p.socketId === 'alice-phone'), 'no peer connection to the replaced tab');
});
test('the host replacing their own tab keeps host authority even with a co-host present', async t => {
  const f = fixture(t); const host = await f.host(); const guest = await f.guest(host, 'guest');
  host.trigger('make-co-host', { roomCode: f.code, socketId: guest.id });
  const back = await f.connect('host-laptop', 'host-user'); back.trigger('request-join', { roomCode: f.code }); f.join(back);
  assert.equal(host.connected, false);
  assert.ok(!f.io.emittedEvents.some(e => e.event === 'host-transferred'));
  assert.deepEqual(events(back, 'your-role').at(-1).payload, { isHost: true });
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
test('account photos reach existing users, new peers and the roster without trusting join payloads', async t => {
  const avatars = { 'host-user': 'https://lh3.googleusercontent.com/host-photo', guest: 'https://lh3.googleusercontent.com/guest-photo' };
  const f = fixture(t, 'host-user', avatars);
  const host = await f.host();
  const guest = await f.connect('guest');
  guest.trigger('request-join', { roomCode: f.code });
  host.trigger('admit-user', { roomCode: f.code, toSocketId: guest.id });
  guest.trigger('join-room', { roomCode: f.code, videoOff: true, avatar: 'https://example.com/spoofed' });
  assert.equal(rooms.get(f.code).get(guest.id).avatar, avatars.guest);
  assert.equal(events(guest, 'existing-users').at(-1).payload.find(p => p.socketId === host.id).avatar, avatars['host-user']);
  assert.equal(guest.roomEvents.find(e => e.event === 'user-joined').payload.avatar, avatars.guest);
  const roster = f.io.emittedEvents.filter(e => e.event === 'roster-state').at(-1).payload.members;
  assert.equal(roster.find(p => p.socketId === guest.id).avatar, avatars.guest);
  const local = await f.guest(host, 'local');
  assert.equal(rooms.get(f.code).get(local.id).avatar, null);
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
test('breakouts isolate signaling and only the host or co-host switches rooms',async t=>{
  const f=fixture(t),host=await f.host(),a=await f.guest(host,'a'),b=await f.guest(host,'b');let reply;
  host.trigger('breakout-open',{roomCode:f.code,groups:[[a.id],[b.id]],minutes:5},r=>reply=r);assert.equal(reply.ok,true);
  const count=events(b,'offer').length;a.trigger('offer',{roomCode:f.code,to:b.id,offer:{sdp:'cross-room'}});assert.equal(events(b,'offer').length,count);
  for(const groupId of ['breakout-2','main','breakout-1']){a.trigger('breakout-visit',{roomCode:f.code,groupId},r=>reply=r);assert.equal(reply.ok,false,'participants cannot switch rooms: '+groupId);}
  host.trigger('breakout-visit',{roomCode:f.code,groupId:'breakout-1'},r=>reply=r);assert.equal(reply.ok,true);
  const before=events(host,'offer').length;a.trigger('offer',{roomCode:f.code,to:host.id,offer:{sdp:'same-room'}});assert.equal(events(host,'offer').length,before+1);
  host.trigger('breakout-close',{roomCode:f.code},r=>reply=r);assert.equal(reply.ok,true);assert.equal(f.io.emittedEvents.filter(e=>e.event==='breakout-state').at(-1).payload,null);
});
test('reference rename, bandwidth request, file removal and end-all use authenticated membership',async t=>{
  const f=fixture(t),host=await f.host(),guest=await f.guest(host,'guest');let reply;
  guest.trigger('rename-participant',{roomCode:f.code,name:'Chosen Name'},r=>reply=r);assert.equal(reply.ok,true);assert.equal(rooms.get(f.code).get(guest.id).userName,'Chosen Name');
  guest.trigger('request-media-quality',{roomCode:f.code,low:true},r=>reply=r);assert.equal(events(host,'peer-quality-request').at(-1).payload.low,true);
  const tmp=require('path').join(require('os').tmpdir(),'sig-file-'+Date.now());require('fs').writeFileSync(tmp,'hi');
  const file=require('../src/roomFiles').add(f.code,{name:'notes.txt',size:2,type:'text/plain',tempPath:tmp,sharedBy:'Guest'});
  guest.trigger('remove-shared-file',{roomCode:f.code,id:file.id},r=>reply=r);assert.equal(reply.ok,false);
  host.trigger('remove-shared-file',{roomCode:f.code,id:file.id},r=>reply=r);assert.equal(reply.ok,true);assert.deepEqual(f.io.emittedEvents.filter(e=>e.event==='files-state').at(-1).payload.files,[]);
  guest.trigger('end-meeting',{roomCode:f.code},r=>reply=r);assert.equal(reply.ok,false);assert.equal(host.connected,true);
  host.trigger('end-meeting',{roomCode:f.code,notes:'Saved summary'},r=>reply=r);assert.equal(reply.ok,true);assert.equal(guest.connected,false);assert.equal(host.connected,false);
});

test('a co-host who reconnects keeps the role and can still edit the whiteboard', async t => {
  const f = fixture(t); const host = await f.host(); const co = await f.guest(host, 'co-1', 'co-user');
  host.trigger('make-co-host', { roomCode: f.code, socketId: co.id }); co.disconnect();
  const back = await f.connect('co-2', 'co-user'); back.trigger('request-join', { roomCode: f.code });
  assert.equal(events(back, 'admitted').length, 1, 'co-host needs no new approval'); f.join(back);
  assert.deepEqual(events(back, 'co-host-changed').at(-1).payload, { socketId: 'co-2', userId: 'co-user', userName: 'co-user' });
  const before = host.clientEvents.length;
  back.trigger('whiteboard-op', { roomCode: f.code, op: { type: 'STROKE_START', id: 'l1', tool: 'pen', color: '#fff', size: 4, point: { x: 1, y: 1 } } });
  assert.ok(back.roomEvents.some(e => e.event === 'whiteboard-op'), 'stroke is broadcast'); assert.ok(host.clientEvents.length >= before);
});
test('joiners learn the current co-host', async t => {
  const f = fixture(t); const host = await f.host(); const co = await f.guest(host, 'co-a', 'co-a');
  host.trigger('make-co-host', { roomCode: f.code, socketId: co.id });
  const late = await f.guest(host, 'late');
  assert.equal(events(late, 'co-host-changed').at(-1).payload.socketId, 'co-a');
});
test('host departure promotes co-host and publishes updated roster authority',async t=>{
  const f=fixture(t),host=await f.host(),guest=await f.guest(host,'successor');
  host.trigger('make-co-host',{roomCode:f.code,socketId:guest.id});host.disconnect();
  const last=f.io.emittedEvents.filter(e=>e.event==='roster-state').at(-1).payload.members;
  assert.equal(last.find(p=>p.socketId===guest.id).isHost,true);
  assert.equal(f.io.emittedEvents.filter(e=>e.event==='host-transferred').at(-1).payload.newHostSocketId,guest.id);
  let reply;guest.trigger('meeting-policy-set',{roomCode:f.code,waitingRoom:false},r=>reply=r);assert.equal(reply.ok,true);
});

test('speakers whose browser cannot caption are announced to current and later caption viewers', async t => {
  const f = fixture(t);
  const h = await f.host();
  const g = await f.guest(h, 'guest-socket');
  h.trigger('captions-set', { roomCode: f.code, on: true });
  g.trigger('caption-unavailable', { roomCode: f.code });
  g.trigger('caption-unavailable', { roomCode: f.code });
  const relayed = g.roomEvents.filter(e => e.event === 'caption-unavailable');
  assert.deepEqual(relayed.map(e => e.payload), [{ socketId: 'guest-socket', userName: 'guest-socket' }]);
  const late = await f.guest(h, 'late-socket');
  late.trigger('captions-set', { roomCode: f.code, on: true });
  assert.deepEqual(events(late, 'caption-unavailable').map(e => e.payload), [{ socketId: 'guest-socket', userName: 'guest-socket' }]);
});

test('rooms admit 50 people including the host and reject a 51st through both join paths', async t => {
  const f = fixture(t);
  const h = await f.host();
  let lastGuest;
  for (let i = 1; i < 50; i++) {
    lastGuest = await f.guest(h, `guest-${i}`);
    assert.ok(rooms.get(f.code).has(lastGuest.id));
    assert.equal(events(lastGuest, 'room-full').length, 0);
  }
  assert.equal(rooms.get(f.code).size, 50);
  const late = await f.connect('late');
  late.trigger('request-join', { roomCode: f.code });
  assert.equal(events(late, 'room-full').length, 1);
  assert.deepEqual(events(late, 'room-full')[0].payload, { max: 50 });
  assert.equal(events(h, 'join-request').filter(e => e.payload.socketId === 'late').length, 0);
  late.data.admittedRoom = f.code;
  f.join(late);
  assert.equal(rooms.get(f.code).size, 50);
  assert.equal(events(late, 'room-full').length, 2);
  assert.deepEqual(events(late, 'room-full')[1].payload, { max: 50 });
  lastGuest.disconnect();
  assert.equal(rooms.get(f.code).size, 49);
  late.trigger('request-join', { roomCode: f.code });
  h.trigger('admit-user', { roomCode: f.code, toSocketId: late.id });
  f.join(late);
  assert.ok(rooms.get(f.code).has(late.id));
  assert.equal(rooms.get(f.code).size, 50);
  assert.equal(events(late, 'room-full').length, 2);
});

test('meeting metrics follow the session and are finished when the host ends the meeting', async t => {
  const { meetingMetrics } = require('../src/meetingMetrics');
  const f = fixture(t);
  const h = await f.host();
  const g = await f.guest(h, 'guest-socket');
  assert.equal(meetingMetrics.has(f.code), true);
  g.trigger('raise-hand', { roomCode: f.code });
  h.trigger('end-meeting', { roomCode: f.code }, () => {});
  assert.equal(meetingMetrics.has(f.code), false);
});

test('admitted participants get a ticket that readmits them after a server restart, unless removed', async t => {
  const f = fixture(t);
  const h = await f.host();
  const g = await f.guest(h, 'guest-socket', 'guest-user');
  const issued = events(g, 'admission-ticket').at(-1)?.payload.ticket;
  const claims = jwt.verify(issued, process.env.JWT_SECRET);
  assert.deepEqual([claims.purpose, claims.room, claims.uid], ['admission', f.code, 'guest-user']);
  // Same account after a restart: no server memory of the admission, only the ticket.
  const ticket = jwt.sign({ purpose: 'admission', room: f.code, uid: 'returning-user' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const back = await f.connect('returning-socket', 'returning-user');
  back.trigger('join-room', { roomCode: f.code, ticket });
  assert.equal(rooms.get(f.code).has('returning-socket'), true);
  // Someone else's ticket or no ticket: approval still required.
  const thief = await f.connect('thief-socket', 'thief-user');
  thief.trigger('join-room', { roomCode: f.code, ticket });
  thief.trigger('join-room', { roomCode: f.code });
  assert.equal(rooms.get(f.code).has('thief-socket'), false);
  // Removed participants cannot use their ticket.
  h.trigger('kick-participant', { roomCode: f.code, to: 'returning-socket' });
  const again = await f.connect('returning-socket-2', 'returning-user');
  again.trigger('request-join', { roomCode: f.code, ticket });
  again.trigger('join-room', { roomCode: f.code, ticket });
  assert.equal(rooms.get(f.code).has('returning-socket-2'), false);
  assert.equal(events(again, 'admitted').length, 0);
});

test('recording cannot start in a room whose host turned recording off', async t => {
  const code = 'test-recording-off';
  const io = setupSignaling(null, '*', FakeServer, { resolveRoomOwner: () => 'host-user', resolveUserAvatar: () => null, resolveRecordingAllowed: async owner => owner !== 'host-user' });
  registerRoomHost(code, 'host-user');
  t.after(() => { [...io.sockets.sockets.values()].forEach(s => s.disconnect()); rooms.delete(code); });
  const h = new FakeSocket('host-socket', io, code, 'host-user'); await io.connect(h);
  h.trigger('join-room', { roomCode: code, userName: 'Host' });
  let reply; await new Promise(resolve => h.trigger('recording-start', { roomCode: code }, r => { reply = r; resolve(); }));
  assert.equal(reply.ok, false);
  assert.match(reply.error, /turned recording off/);
});

test('malformed callbacks and payloads never throw out of an event handler', async t => {
  const f = fixture(t);
  const h = await f.host();
  const g = await f.guest(h, 'guest-socket');
  const rejections = [];
  const onRejection = e => rejections.push(e);
  process.on('unhandledRejection', onRejection);
  t.after(() => process.off('unhandledRejection', onRejection));
  for (const ack of ['not-a-function', 42, {}, null]) {
    for (const [socket, event, payload] of [
      [g, 'recording-start', { roomCode: f.code }], [h, 'recording-stop', { roomCode: f.code }],
      [g, 'share-file', { roomCode: f.code, file: 'nope' }], [g, 'breakout-visit', { roomCode: f.code, groupId: 'x' }],
      [h, 'create-poll', { roomCode: f.code, question: { $gt: '' }, options: 'not-an-array' }],
      [g, 'vote-poll', { roomCode: f.code, pollId: { a: 1 }, optionIndex: 'x' }],
    ]) assert.doesNotThrow(() => socket.trigger(event, payload, ack), `${event} with ack ${JSON.stringify(ack)}`);
  }
  await new Promise(r => setTimeout(r, 20));
  assert.deepEqual(rejections, []);
});

test('reactions relay only short text emoji', async t => {
  const f = fixture(t);
  const h = await f.host();
  const g = await f.guest(h, 'guest-socket');
  for (const emoji of [{ $$typeof: 'x' }, ['a'], 'x'.repeat(40), 7, null]) g.trigger('reaction', { roomCode: f.code, emoji });
  g.trigger('reaction', { roomCode: f.code, emoji: '👏' });
  assert.deepEqual(g.roomEvents.filter(e => e.event === 'reaction').map(e => e.payload.emoji), ['👏']);
});

test('polls created in the same instant get unique ids and clean text', async t => {
  const f = fixture(t);
  const h = await f.host();
  for (let i = 0; i < 100; i++) h.trigger('create-poll', { roomCode: f.code, question: `Q${i}`, options: ['Yes', 'No'] });
  const polls = f.io.emittedEvents.filter(e => e.event === 'poll-created').map(e => e.payload);
  assert.equal(polls.length, 100);
  assert.equal(new Set(polls.map(p => p.id)).size, 100);
  h.trigger('create-poll', { roomCode: f.code, question: 'Bad', options: [{ evil: true }, 'Ok'] });
  h.trigger('create-poll', { roomCode: f.code, question: 'Too few', options: ['One'] });
  assert.equal(f.io.emittedEvents.filter(e => e.event === 'poll-created').length, 100);
});

test('any participant can launch a poll; only its creator or a host can end it', async t => {
  const f = fixture(t);
  const h = await f.host();
  const g = await f.guest(h, 'guest-socket');
  const other = await f.guest(h, 'other-socket');
  g.trigger('create-poll', { roomCode: f.code, question: 'Lunch?', options: ['Yes', 'No'] });
  const poll = f.io.emittedEvents.find(e => e.event === 'poll-created')?.payload;
  assert.equal(poll?.question, 'Lunch?');
  const ended = () => f.io.emittedEvents.filter(e => e.event === 'poll-updated' && e.payload.active === false).length;
  other.trigger('end-poll', { roomCode: f.code, pollId: poll.id });
  assert.equal(ended(), 0);
  g.trigger('end-poll', { roomCode: f.code, pollId: poll.id });
  assert.equal(ended(), 1);
  g.trigger('create-poll', { roomCode: f.code, question: 'Again?', options: ['Yes', 'No'] });
  const second = f.io.emittedEvents.filter(e => e.event === 'poll-created')[1].payload;
  h.trigger('end-poll', { roomCode: f.code, pollId: second.id });
  assert.equal(ended(), 2);
});

test('agenda items carry who added and who covered them, for popups', async t => {
  const f = fixture(t);
  const h = await f.host();
  h.trigger('add-agenda-item', { roomCode: f.code, title: 'Budget' });
  const [item] = f.io.emittedEvents.filter(e => e.event === 'agenda-updated').at(-1).payload;
  assert.equal(item.createdById, h.id);
  h.trigger('toggle-agenda-item', { roomCode: f.code, id: item.id });
  const [covered] = f.io.emittedEvents.filter(e => e.event === 'agenda-updated').at(-1).payload;
  assert.equal(covered.done, true);
  assert.equal(covered.toggledById, h.id);
  assert.equal(typeof covered.toggledBy, 'string');
});

test('YouTube links are shared as an embedded player; other pages cannot claim that kind', async t => {
  const f = fixture(t);
  const h = await f.host();
  h.trigger('share-media', { roomCode: f.code, url: 'https://youtu.be/-S_9Kuy8faU?si=x', kind: 'youtube' });
  assert.deepEqual(f.io.emittedEvents.filter(e => e.event === 'media-shared').at(-1).payload, { url: 'https://www.youtube.com/watch?v=-S_9Kuy8faU', kind: 'youtube' });
  h.trigger('share-media', { roomCode: f.code, url: 'https://evil.example/x', kind: 'youtube' });
  assert.equal(f.io.emittedEvents.filter(e => e.event === 'media-shared').length, 1);
});
