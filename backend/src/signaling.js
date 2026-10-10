const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');

/** Video id from a YouTube link (youtube.com watch/shorts/live/embed, youtu.be), or null. */
function youtubeId(value) {
  let url;
  try { url = new URL(String(value || '')); } catch { return null; }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '');
  const id = host === 'youtu.be' ? url.pathname.slice(1).split('/')[0]
    : host === 'youtube.com' ? (url.searchParams.get('v') || (url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/) || [])[1]) : null;
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}
const { meetingMetrics } = require('./meetingMetrics');
const { safeAck, guardedOn } = require('./socketGuard');
const {registerMeetingExtensions,getMeetingPolicy,getGroup,meetingEnded,clearMeetingExtensions} = require('./meetingExtensions');

// roomCode -> Map<socketId, { socketId, userName, userId, isHost }>
const rooms = new Map();

// roomCode -> boolean (locked state)
let roomLocks = {};

// roomCode -> string (shared notes content)
const roomNotes = new Map();

// roomCode -> [{id, question, options:[{text,voters:[socketId]}], active}]
const roomPolls = new Map();

// roomCode -> string (currently shared media URL)
const roomMedia = new Map();
const roomMediaPlayback = new Map();

// roomCode -> [{id, name, size, type, url, sharedBy, sharedAt}]
const roomFiles = require('./roomFiles');


// roomCode -> [{id, title, done, createdBy}]
const roomAgenda = new Map();

// roomCode -> [{ socketId, userName }] — raised hands in the order they were raised
const roomHands = new Map();

// roomCode -> Set<userId> — everyone admitted during the current session (host included).
// A returning member (closed tab, refresh, dropped connection) is let straight back in
// instead of waiting for a host who may not be there to admit them.
const roomMembers = new Map();
// roomCode -> Set<userId> removed by a host. Their admission tickets stop working until a host admits them again.
const roomRemoved = new Map();
const ADMISSION_TICKET_TTL = '12h';

// An admission ticket lets an admitted participant rejoin without approval even after a server restart,
// when roomMembers and socket state are gone. It is not a sign-in token (auth middleware rejects `purpose`).
const issueAdmissionTicket = (roomCode, userId) =>
  jwt.sign({ purpose: 'admission', room: roomCode, uid: String(userId) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: ADMISSION_TICKET_TTL });
function ticketAdmits(ticket, roomCode, userId) {
  if (typeof ticket !== 'string' || !userId || roomRemoved.get(roomCode)?.has(String(userId))) return false;
  try {
    const claims = jwt.verify(ticket, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    return claims.purpose === 'admission' && claims.room === roomCode && claims.uid === String(userId);
  } catch {
    return false;
  }
}

// Shared files travel through the socket as base64 data URLs (files up to 10 MB, ~13.4 MB
// once encoded). socket.io's default 1 MB message limit silently drops the sharer's connection.
// Files go over HTTP (routes/rooms.js), so socket messages stay small: large ones block control traffic.
const MAX_SOCKET_MESSAGE_BYTES = 1e6;

// roomCode -> userId (host/presenter who controls the whiteboard)
const roomHosts = new Map();

// roomCode -> { userId, socketId, userName } | undefined — the one co-host, if any
const roomCoHosts = new Map();

// roomCode -> Set<socketId> — participants who currently have live captions switched on.
// While this is non-empty, everyone's browser transcribes its own mic (unless muted) for the captions.
const roomCaptionViewers = new Map();
// Room capacity includes the host. Media still uses full mesh, so load grows with room size.
const MAX_PARTICIPANTS = 50;
const CAPTION_MAX_CHARS = 300;        // longest caption line relayed
const CAPTION_MIN_INTERVAL_MS = 120;  // throttle for interim (not-yet-final) caption updates

/** True if userId currently holds host or co-host authority in roomCode. */
function isPrivileged(roomCode, userId) {
  if (!userId) return false;
  const key = String(roomCode || '').trim().toLowerCase();
  if (String(roomHosts.get(key)) === String(userId)) return true;
  const co = roomCoHosts.get(key);
  return !!(co && String(co.userId) === String(userId));
}

// Whiteboard operations a participant may send when the host allows drawing. Clearing, images, undo/redo
// (which act on everyone's strokes) and the laser stay with the host and co-host.
const PARTICIPANT_WHITEBOARD_OPS = new Set(['STROKE_START', 'STROKE_EXTEND', 'STROKE_END', 'STICKY_ADD', 'STICKY_UPDATE', 'STICKY_MOVE', 'STICKY_DELETE']);

// roomCode -> { lines, notes, uploadedImage, laser } (whiteboard state)
const roomWhiteboards = new Map();

// roomCode -> { startedAt, startedBy } for the browser-side recording session
const roomRecordings = new Map();
// roomCode -> socketId of the participant currently sharing their screen (one presenter at a time)
const roomScreenShares = new Map();

// roomCode (lowercase) -> { startedAt: Date, emptySince: number|null }
// A "session" begins when the first person joins an EMPTY room. Chat is shown per session,
// so re-using a room code (e.g. "Open My Room") doesn't bring back the previous meeting's history.
// A quick rejoin (page refresh) within the grace period continues the same session.
const SESSION_GRACE_MS = Number(process.env.SESSION_GRACE_MS) || 10 * 60 * 1000;
const roomSessions = new Map();

/** Start time of the room's current session, or null if nobody is (recently) in the room. */
function getSessionStart(roomCode) {
  const sess = roomSessions.get(String(roomCode || '').toLowerCase());
  return sess ? sess.startedAt : null;
}

function registerRoomHost(roomCode, userId, io) {
  const code = String(roomCode || '').trim().toLowerCase();
  roomHosts.set(code, String(userId));
  rooms.get(code)?.forEach(member => {
    member.isHost = String(member.userId) === String(userId);
    io?.to(member.socketId).emit('your-role', { isHost: member.isHost });
  });
}

/**
 * Apply a whiteboard operation to the in-memory room state. This mirrors the
 * frontend's operation model so late joiners receive an accurate board.
 */
function applyWhiteboardOp(board, op) {
  switch (op.type) {
    case 'STROKE_START':
      board.lines.push({ id: op.id, tool: op.tool, color: op.color, size: op.size, points: [op.point] });
      break;
    case 'STROKE_EXTEND': {
      const line = board.lines.find(l => l.id === op.id);
      if (line) line.points.push(op.point);
      break;
    }
    case 'STROKE_END':
      break;
    case 'STICKY_ADD':
      board.notes.push({ id: op.id, x: op.x, y: op.y, text: op.text, color: op.color });
      break;
    case 'STICKY_UPDATE': {
      const note = board.notes.find(n => n.id === op.id);
      if (note) note.text = op.text;
      break;
    }
    case 'STICKY_MOVE': {
      const note = board.notes.find(n => n.id === op.id);
      if (note) { note.x = op.x; note.y = op.y; }
      break;
    }
    case 'STICKY_DELETE':
      board.notes = board.notes.filter(n => n.id !== op.id);
      break;
    case 'UNDO':
      board.lines.pop();
      break;
    case 'REDO':
      if (op.line) board.lines.push(op.line);
      break;
    case 'CLEAR':
      board.lines = [];
      board.notes = [];
      break;
    case 'IMAGE_ADD':
      board.uploadedImage = op.url;
      break;
    case 'IMAGE_REMOVE':
      board.uploadedImage = '';
      break;
    case 'LASER':
      board.laser = { x: op.x, y: op.y, visible: op.visible };
      break;
    default:
      break;
  }
}


function setupSignaling(httpServer, allowedOrigin, SocketServer = Server, {
  resolveRoomOwner = async code => {
    const room = await require('./models/MeetingRoom').findByCode(code);
    return room?.hostUserId ? String(room.hostUserId) : null;
  },
  resolveRecordingAllowed = require('./recordingPolicy').hostAllowsRecording,
  notifyUsers = (...args) => require('./push').notifyUsers(...args),
  resolveUserAvatar = async id => {
    const user = await require('./models/User').findById(id);
    return user?.avatar || null;
  },
} = {}) {
  const io = new SocketServer(httpServer, {
    maxHttpBufferSize: MAX_SOCKET_MESSAGE_BYTES,
    cors: {
      origin: typeof allowedOrigin === 'function' ? allowedOrigin : allowedOrigin || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) throw new Error('Sign in to join this meeting.');
      const user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      if (!user.id) throw new Error('Invalid sign-in session.');
      const code = String(socket.handshake.auth?.roomCode || '').trim().toLowerCase();
      if (!code || code.length > 128) throw new Error('Invalid meeting code.');
      const owner = await resolveRoomOwner(code);
      if (!owner) throw new Error('Meeting not found. Ask the host to start it, then try again.');
      socket.data.user = { id: String(user.id), name: user.name || 'Participant', avatar: await resolveUserAvatar(String(user.id)) };
      socket.data.authorizedRoom = code;
      socket.data.roomOwnerId = String(owner);
      next();
    } catch (error) {
      next(new Error(error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' ? 'Your sign-in expired. Sign in again to join.' : error.message));
    }
  });

  /** Add/remove a caption viewer; tells the room when captions switch on (first viewer) or off (last viewer gone). */
  function setCaptionViewer(roomCode, socketId, on) {
    let viewers = roomCaptionViewers.get(roomCode);
    const wasActive = !!viewers && viewers.size > 0;
    if (on) {
      if (!viewers) { viewers = new Set(); roomCaptionViewers.set(roomCode, viewers); }
      viewers.add(socketId);
    } else if (viewers) {
      viewers.delete(socketId);
      if (viewers.size === 0) roomCaptionViewers.delete(roomCode);
    }
    const isActive = roomCaptionViewers.has(roomCode);
    if (isActive !== wasActive) io.to(roomCode).emit('captions-demand', { active: isActive });
  }

  /** Raise or lower one socket's hand and send the whole ordered queue to the room. */
  function setHand(roomCode, socketId, userName, raised) {
    const hands = (roomHands.get(roomCode) || []).filter(h => h.socketId !== socketId);
    if (raised) hands.push({ socketId, userName });
    if (hands.length) roomHands.set(roomCode, hands); else roomHands.delete(roomCode);
    io.to(roomCode).emit('hands-state', { hands });
  }

  io.on('connection', (socket) => {
    let currentRoom = null;

    // Every collaborative event requires membership in this authenticated connection's room.
    const onMember = (event, handler) => guardedOn(socket, event, (payload = {}, rawAck) => {
      const acknowledge = safeAck(rawAck);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;
      const room = currentRoom && rooms.get(currentRoom);
      const member = room?.get(socket.id);
      const requested = payload.roomCode && String(payload.roomCode).trim().toLowerCase();
      if (!member || (requested && requested !== currentRoom)) {
        acknowledge({ ok: false, error: 'Join this meeting first.' });
        return;
      }
      if (payload.to && !room.has(payload.to)) return;
      if (event === 'share-media' && !isPrivileged(currentRoom, member.userId)) return;
      if (payload.to && ['offer','answer','ice-candidate'].includes(event) && getGroup(currentRoom,socket.id)!==getGroup(currentRoom,payload.to)) return;
      const result = handler({ ...payload, roomCode: currentRoom }, acknowledge);
      if(['microphone-state','camera-toggled'].includes(event)||(['mute-participant','unmute-participant'].includes(event)&&isPrivileged(currentRoom,member.userId)))extension.roster();
      return result;
    });

    const extension = registerMeetingExtensions(io,socket,{roomCode:()=>currentRoom,getRoom:()=>rooms.get(currentRoom),privileged:isPrivileged,locked:code=>!!roomLocks[code],setHand,screenShares:roomScreenShares,recordings:roomRecordings,setNotes:(code,notes)=>roomNotes.set(code,notes),removeFile:(code,id)=>{roomFiles.remove(code,id);io.to(code).emit('files-state',{files:roomFiles.list(code)});},setPlayback:(code,state)=>roomMediaPlayback.set(code,state)});
    guardedOn(socket, 'join-room', (payload = {}) => {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;
      const { roomCode: rawCode, userName: chosenName, muted = false, videoOff = false } = payload;
      const userId = socket.data.user.id;
      const userName = String(chosenName || socket.data.user.name).trim().slice(0, 80);

      const roomCode = String(rawCode || '').trim().toLowerCase();
      if(meetingEnded(roomCode)){socket.emit('meeting-ended',{roomCode});return;}
      if (roomCode !== socket.data.authorizedRoom || (currentRoom && currentRoom !== roomCode)) return;
      if (!roomHosts.has(roomCode)) roomHosts.set(roomCode, socket.data.roomOwnerId);
      const ticketed = ticketAdmits(payload.ticket, roomCode, userId);
      if (!isPrivileged(roomCode, userId) && socket.data.admittedRoom !== roomCode && !roomMembers.get(roomCode)?.has(userId) && !ticketed) {
        socket.emit('room-error', { message: 'Host approval is required before joining.' });
        return;
      }
      if (rooms.get(roomCode)?.has(socket.id)) return;
      // One place in the meeting per account: joining again (another tab or device) replaces the earlier one.
      const replaced = [...(rooms.get(roomCode)?.values() || [])].filter(p => String(p.userId) === String(userId));
      if ((rooms.get(roomCode)?.size || 0) - replaced.length >= MAX_PARTICIPANTS) { socket.emit('room-full', { max: MAX_PARTICIPANTS }); return; }
      const existingRoom = rooms.get(roomCode);
      if (roomLocks[roomCode] && !isPrivileged(roomCode, userId) && !roomMembers.get(roomCode)?.has(userId) && !ticketed) {
        socket.emit('room-locked-error');
        return;
      }

      currentRoom = roomCode;
      socket.join(roomCode);

      if (!rooms.has(roomCode)) rooms.set(roomCode, new Map());
      const room = rooms.get(roomCode);

      // Start a new session if this room was empty for longer than the grace period (or never seen)
      {
        const sess = roomSessions.get(roomCode);
        const now = Date.now();
        if (!sess || (room.size === 0 && sess.emptySince && now - sess.emptySince > SESSION_GRACE_MS)) {
          roomSessions.set(roomCode, { startedAt: new Date(now), emptySince: null });
          roomMembers.delete(roomCode);
          meetingMetrics.finish(roomCode);
          meetingMetrics.start(roomCode, roomHosts.get(roomCode));
        } else {
          sess.emptySince = null;
        }
      }

      // Only the authenticated owner or a server-promoted participant holds host authority.
      if (userId) {
        if (!roomMembers.has(roomCode)) roomMembers.set(roomCode, new Set());
        roomMembers.get(roomCode).add(String(userId));
      }
      // A host returning from a new tab has lost its local host flag; the server's record is the truth.
      socket.emit('your-role', { isHost: String(roomHosts.get(roomCode)) === String(userId) });
      socket.emit('hands-state', { hands: roomHands.get(roomCode) || [] });

      // Send existing participants to the new joiner
      const existing = Array.from(room.values()).filter(p=>!replaced.includes(p)&&getGroup(roomCode,p.socketId)===getGroup(roomCode,socket.id));
      // Same for the co-host: a rejoining co-host takes the role to this socket, and every joiner learns who holds it.
      const coHost = roomCoHosts.get(roomCode);
      if (coHost && String(coHost.userId) === String(userId)) {
        coHost.socketId = socket.id;
        coHost.userName = userName;
        io.to(roomCode).emit('co-host-changed', { socketId: socket.id, userId: coHost.userId, userName });
      }
      socket.emit('co-host-changed', coHost ? { socketId: coHost.socketId, userId: coHost.userId, userName: coHost.userName } : { socketId: null, userId: null, userName: null });
      socket.emit('existing-users', existing);

      // Tell the new joiner if someone is already presenting
      const sharerId = roomScreenShares.get(roomCode);
      if (sharerId && room.has(sharerId) && getGroup(roomCode,sharerId)===getGroup(roomCode,socket.id)) {
        socket.emit('screen-share-state', { socketId: sharerId });
      }

      // Add new joiner to room
      room.set(socket.id, {
        socketId: socket.id,
        userId,
        userName,
        avatar: socket.data.user.avatar,
        isHost: String(roomHosts.get(roomCode)) === String(userId),
        selfMuted: !!muted,
        hostMuted: false,
        videoOff: !!videoOff,
      });
      socket.data.requestedRoom = null;
      socket.emit('admission-ticket', { ticket: issueAdmissionTicket(roomCode, userId) });
      meetingMetrics.joined(roomCode, userId, userName);
      // Removed after the new socket is in the room, so the account never looks absent (no host hand-off, no empty room).
      for (const previous of replaced) {
        const previousSocket = io.sockets.sockets.get(previous.socketId);
        io.to(previous.socketId).emit('session-replaced');
        if (previousSocket) previousSocket.disconnect();
      }
      extension.snapshot();
      // Guests may request entry before the host arrives or while the host reconnects.
      if (isPrivileged(roomCode, userId)) {
        for (const waiting of io.sockets.sockets.values()) {
          if (waiting.data.requestedRoom === roomCode && !room.has(waiting.id)) {
            socket.emit('join-request', { socketId: waiting.id, userId: waiting.data.user.id, userName: waiting.data.requestedName || waiting.data.user.name, roomCode });
          }
        }
      }
      console.info(`[participants] ${roomCode}: ${room.size} participant(s) in room`);

      if (roomRecordings.has(roomCode)) {
        socket.emit('recording-state', { state: 'recording', startedAt: roomRecordings.get(roomCode).startedAt });
      }

      // Live captions: apply this socket's caption-viewer choice (made before it was admitted / before a
      // reconnect finished joining), and tell the joiner if captions are already on in this room.
      if (socket.data.captionsOn) setCaptionViewer(roomCode, socket.id, true);
      if (roomCaptionViewers.has(roomCode)) socket.emit('captions-demand', { active: true });

      // Notify everyone else
      const joinedPayload = {
        socketId: socket.id,
        userId,
        userName,
        avatar: socket.data.user.avatar,
        isHost: String(roomHosts.get(roomCode)) === String(userId),
        isMuted: !!muted,
        mutedByHost: false,
        videoOff: !!videoOff,
      };
      if([...room.values()].every(p=>getGroup(roomCode,p.socketId)==='main')) socket.to(roomCode).emit('user-joined',joinedPayload);
      else for(const other of room.values())if(other.socketId!==socket.id&&getGroup(roomCode,other.socketId)===getGroup(roomCode,socket.id))io.to(other.socketId).emit('user-joined',joinedPayload);
    });

    onMember('offer', ({ to, offer }) => {
      io.to(to).emit('offer', { from: socket.id, offer });
    });

    onMember('answer', ({ to, answer }) => {
      io.to(to).emit('answer', { from: socket.id, answer });
    });

    onMember('ice-candidate', ({ to, candidate }) => {
      io.to(to).emit('ice-candidate', { from: socket.id, candidate });
    });

    // ── Feature 1: Host Controls ──────────────────────────────────────────────

    /**
     * Apply a host-controlled microphone state to one room member. The
     * command is only sent to the selected socket; the state broadcast keeps
     * every participant tile synchronized without granting them control.
     */
    const setParticipantHostMute = ({ roomCode, to, muted }) => {
      const room = rooms.get(roomCode);
      const sender = room?.get(socket.id);
      const target = room?.get(to);

      if (!room || !sender || !target) return;
      if (!isPrivileged(roomCode, sender.userId)) return;

      target.hostMuted = muted;
      const effectiveMuted = target.hostMuted || target.selfMuted;
      io.to(to).emit('participant-mute-command', {
        muted: effectiveMuted,
        mutedByHost: target.hostMuted,
      });
      io.to(roomCode).emit('participant-audio-state', {
        socketId: to,
        userId: target.userId,
        muted: effectiveMuted,
        mutedByHost: target.hostMuted,
      });
    };

    onMember('mute-participant', (payload) => {
      setParticipantHostMute({ ...payload, muted: true });
    });

    onMember('unmute-participant', (payload) => {
      setParticipantHostMute({ ...payload, muted: false });
    });

    /**
     * Track a participant's own microphone choice. A host mute remains the
     * authoritative effective state until the host explicitly releases it.
     */
    onMember('microphone-state', ({ roomCode, muted }) => {
      const room = rooms.get(roomCode);
      const member = room?.get(socket.id);
      if (!room || !member) return;

      member.selfMuted = !!muted;
      const effectiveMuted = member.hostMuted || member.selfMuted;
      io.to(roomCode).emit('participant-audio-state', {
        socketId: socket.id,
        userId: member.userId,
        muted: effectiveMuted,
        mutedByHost: member.hostMuted,
      });
    });

    /**
     * Remove a participant from the room.
     * Host emits this; target receives 'removed-from-room'.
     */
    onMember('kick-participant', ({ to }) => {
      const me = currentRoom && rooms.get(currentRoom)?.get(socket.id);
      if (!me || !isPrivileged(currentRoom, me.userId)) return;
      // A removed participant must be admitted again to come back.
      const target = rooms.get(currentRoom)?.get(to);
      if (target) {
        roomMembers.get(currentRoom)?.delete(String(target.userId));
        if (!roomRemoved.has(currentRoom)) roomRemoved.set(currentRoom, new Set());
        roomRemoved.get(currentRoom).add(String(target.userId));
      }
      const targetSocket = io.sockets.sockets.get(to);
      if (targetSocket) targetSocket.data.admittedRoom = null;
      io.to(to).emit('removed-from-room');
      if (targetSocket?.connected !== false) targetSocket?.disconnect(true);
    });

    /**
     * Lock or unlock the room so no new participants can join.
     * Broadcasts room-locked state to all participants.
     */
    onMember('lock-room', ({ roomCode, locked }) => {
      const me = rooms.get(roomCode)?.get(socket.id);
      if (!me || !isPrivileged(roomCode, me.userId)) return;
      roomLocks[roomCode] = locked;
      io.to(roomCode).emit('room-locked', { locked });
    });

    /**
     * Designate a co-host. Host-only. The co-host gets the same authority as the
     * host (mute/kick/lock/admit/agenda/whiteboard) and automatically becomes the
     * host if the host disconnects. One co-host at a time; naming a new one
     * replaces the previous one.
     */
    onMember('make-co-host', ({ roomCode, socketId }) => {
      const room = rooms.get(roomCode);
      const me = room?.get(socket.id);
      if (!room || !me || String(roomHosts.get(roomCode)) !== String(me.userId)) return; // host-only
      const target = room.get(socketId);
      if (!target) return;
      roomCoHosts.set(roomCode, { userId: target.userId, socketId: target.socketId, userName: target.userName });
      io.to(roomCode).emit('co-host-changed', { socketId: target.socketId, userId: target.userId, userName: target.userName });
    });

    /** Revoke the current co-host. Host-only. */
    onMember('remove-co-host', ({ roomCode }) => {
      const room = rooms.get(roomCode);
      const me = room?.get(socket.id);
      if (!room || !me || String(roomHosts.get(roomCode)) !== String(me.userId)) return; // host-only
      roomCoHosts.delete(roomCode);
      io.to(roomCode).emit('co-host-changed', { socketId: null, userId: null, userName: null });
    });

    // ── Feature: Waiting Room / Admission ────────────────────────────────────
    guardedOn(socket, 'request-join', (payload = {}) => {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload) || currentRoom) return;
      const { roomCode: rawCode, userName: chosenName } = payload;
      const userId = socket.data.user.id;
      const userName = String(chosenName || socket.data.user.name).trim().slice(0, 80);
      const roomCode = String(rawCode || '').trim().toLowerCase();
      if (roomCode !== socket.data.authorizedRoom) return;
      if(meetingEnded(roomCode)){socket.emit('meeting-ended',{roomCode});return;}
      if ((rooms.get(roomCode)?.size || 0) >= MAX_PARTICIPANTS) { socket.emit('room-full', { max: MAX_PARTICIPANTS }); return; }
      if (!roomHosts.has(roomCode)) roomHosts.set(roomCode, socket.data.roomOwnerId);
      if (isPrivileged(roomCode, userId)) { socket.data.admittedRoom = roomCode; socket.emit('admitted', { roomCode }); return; }
      // Someone already admitted this session is rejoining — no second approval (locked or not).
      if (userId && (roomMembers.get(roomCode)?.has(String(userId)) || ticketAdmits(payload.ticket, roomCode, userId))) {
        socket.data.admittedRoom = roomCode;
        socket.emit('admitted', { roomCode });
        return;
      }
      if (roomLocks[roomCode]) {
        socket.emit('room-locked-error');
        return;
      }
      if(!getMeetingPolicy(roomCode).waitingRoom){socket.data.admittedRoom=roomCode;socket.emit('admitted',{roomCode});return;}
      console.log(`[Signaling] request-join from ${userName} (${socket.id}) for room ${roomCode}`);
      socket.data.requestedRoom = roomCode;
      socket.data.requestedName = userName;
      socket.to(roomCode).emit('join-request', {
        socketId: socket.id,
        userId,
        userName,
        roomCode,
      });
      // Reaches the host and co-host on their phone even when the meeting tab is in the background.
      const hosts = [roomHosts.get(roomCode), roomCoHosts.get(roomCode)?.userId].filter(Boolean);
      Promise.resolve(notifyUsers(hosts, { title: `${userName} wants to join`, body: `Open the meeting to admit them (${roomCode}).`, url: `/room/${roomCode}`, tag: `join-${roomCode}-${userId}` }))
        .catch(error => console.error('Join request push failed:', error.message));
    });

    onMember('admit-user', ({ toSocketId, roomCode: clientRoomCode }) => {
      const roomKey = String(currentRoom || clientRoomCode || '').trim().toLowerCase();
      const room = roomKey ? rooms.get(roomKey) : null;
      const me = room?.get(socket.id);
      console.log(`[Signaling] admit-user received from socket ${socket.id} (user ${me?.userId}) for target ${toSocketId} in room ${roomKey}`);
      if (roomLocks[roomKey] || !me || !isPrivileged(roomKey, me.userId)) {
        console.warn(`[Signaling] admit-user rejected: not privileged or not in room. Socket: ${socket.id}, room: ${roomKey}`);
        return;
      }
      const requester = io.sockets.sockets.get(toSocketId);
      if (!requester || requester.data.requestedRoom !== roomKey || requester.data.authorizedRoom !== roomKey) return;
      requester.data.admittedRoom = roomKey;
      roomRemoved.get(roomKey)?.delete(String(requester.data.user.id));
      io.to(toSocketId).emit('admitted', { roomCode: roomKey });
      socket.to(roomKey).emit('join-request-cancelled', { socketId: toSocketId }); // clear the popup for other admins
      console.log(`[Signaling] 'admitted' emitted to socket ${toSocketId}`);
    });

    onMember('deny-user', ({ toSocketId, roomCode: clientRoomCode }) => {
      const roomKey = String(currentRoom || clientRoomCode || '').trim().toLowerCase();
      const room = roomKey ? rooms.get(roomKey) : null;
      const me = room?.get(socket.id);
      if (!me || !isPrivileged(roomKey, me.userId)) return;
      const requester = io.sockets.sockets.get(toSocketId);
      if (!requester || requester.data.requestedRoom !== roomKey) return;
      requester.data.admittedRoom = null;
      requester.data.requestedRoom = null;
      io.to(toSocketId).emit('denied', { roomCode: roomKey });
      socket.to(roomKey).emit('join-request-cancelled', { socketId: toSocketId });
    });

    // ── Feature 3: Reactions + Hand Queue ────────────────────────────────────

    /**
     * Broadcast an emoji reaction to all other participants in the room.
     */
    onMember('reaction', ({ roomCode, emoji }) => {
      // Relayed straight into other people's UI: short text only.
      if (typeof emoji !== 'string' || !emoji.trim() || emoji.length > 16) return;
      const user = rooms.get(roomCode)?.get(socket.id);
      meetingMetrics.count(roomCode, 'reactions');
      socket.to(roomCode).emit('reaction', {
        emoji,
        socketId: socket.id,
        userName: user?.userName,
      });
    });

    /**
     * Notify all participants that this user raised their hand.
     */
    onMember('raise-hand', () => {
      const user = currentRoom && rooms.get(currentRoom)?.get(socket.id);
      if (!user) return;
      setHand(currentRoom, socket.id, user.userName, true);
      meetingMetrics.count(currentRoom, 'hands');
    });

    /**
     * Lower a hand. Anyone may lower their own; host/co-host may lower anyone's (socketId).
     */
    onMember('lower-hand', ({ socketId } = {}) => {
      const me = currentRoom && rooms.get(currentRoom)?.get(socket.id);
      if (!me) return;
      const target = socketId || socket.id;
      if (target !== socket.id && !isPrivileged(currentRoom, me.userId)) return;
      setHand(currentRoom, target, null, false);
    });

    // ── Feature 6: Collaborative Notes ───────────────────────────────────────

    /**
     * Update shared notes for the room and broadcast to all other participants.
     */
    onMember('update-notes', ({ roomCode, notes }) => {
      roomNotes.set(roomCode, notes);
      socket.to(roomCode).emit('notes-updated', { notes });
    });

    /**
     * Request the current shared notes state for the room.
     * Returns the notes only to the requesting socket.
     */
    onMember('get-notes', ({ roomCode }) => {
      socket.emit('notes-state', { notes: roomNotes.get(roomCode) || '' });
    });

    // ── Feature 7: Polls ──────────────────────────────────────────────────────

    onMember('get-polls', ({ roomCode }) => {
      socket.emit('polls-state', { polls: roomPolls.get(roomCode) || [] });
    });

    /**
     * Create a new poll for the room. Broadcasts the poll to all participants.
     */
    onMember('create-poll', ({ roomCode, question, options }) => {
      if (typeof question !== 'string' || !question.trim() || !Array.isArray(options)) return;
      const choices = options.filter(o => typeof o === 'string' && o.trim()).map(o => o.trim().slice(0, 200));
      if (choices.length !== options.length || choices.length < 2 || choices.length > 10) return;
      const user = rooms.get(roomCode)?.get(socket.id);
      const poll = {
        id: randomUUID(), // Date.now() repeats for polls created in the same millisecond
        createdBy: user?.userName || 'Someone',
        createdById: socket.id,
        question: question.trim().slice(0, 300),
        options: choices.map(t => ({ text: t, voters: [] })),
        active: true,
      };
      if (!roomPolls.has(roomCode)) roomPolls.set(roomCode, []);
      roomPolls.get(roomCode).push(poll);
      io.to(roomCode).emit('poll-created', poll);
    });

    /**
     * Record a vote for a poll option. A participant can only vote for one
     * option at a time (previous vote is removed). Broadcasts updated poll.
     */
    onMember('vote-poll', ({ roomCode, pollId, optionIndex }) => {
      const polls = roomPolls.get(roomCode) || [];
      const poll = polls.find(p => p.id === pollId);
      if (!poll || !poll.active || !Number.isInteger(optionIndex) || !poll.options[optionIndex]) return;
      // Remove existing vote from all options
      poll.options.forEach(o => {
        o.voters = o.voters.filter(v => v !== socket.id);
      });
      // Record new vote
      if (poll.options[optionIndex]) {
        poll.options[optionIndex].voters.push(socket.id);
      }
      io.to(roomCode).emit('poll-updated', poll);
    });

    /**
     * End an active poll. Sets poll.active = false and broadcasts.
     */
    onMember('end-poll', ({ roomCode, pollId }) => {
      const polls = roomPolls.get(roomCode) || [];
      const poll = polls.find(p => p.id === pollId);
      const user = rooms.get(roomCode)?.get(socket.id);
      // Anyone may launch a poll; only its creator or a host/co-host may end it.
      if (poll && (poll.createdById === socket.id || isPrivileged(roomCode, user?.userId))) {
        poll.active = false;
        io.to(roomCode).emit('poll-updated', poll);
      }
    });

    // ── Feature: Media Share (YouTube / video URL) ───────────────────────────

    /**
     * Share a video URL with the room. Broadcasts to all other participants.
     */
    onMember('share-media', ({ roomCode, url,kind }) => {
      if(url && (typeof url!=='string'||!/^https?:\/\//i.test(url)))return;
      // YouTube pages play through YouTube's embedded player; store a canonical link for a real video id.
      let shared={url:url||'',kind:kind==='audio'?'audio':'video'};
      if(kind==='youtube'){const id=youtubeId(url);if(!id)return;shared={url:`https://www.youtube.com/watch?v=${id}`,kind:'youtube'};}
      roomMediaPlayback.delete(roomCode);
      roomMedia.set(roomCode, shared);
      io.to(roomCode).emit('media-shared', roomMedia.get(roomCode));
    });

    /**
     * Request the currently shared media URL for the room.
     * Returns it only to the requesting socket.
     */
    onMember('get-media', ({ roomCode }) => {
      socket.emit('media-state', roomMedia.get(roomCode) || {url:'',kind:'video'});
      const playback=roomMediaPlayback.get(roomCode);if(playback)socket.emit('media-playback',playback);
    });

    // ── Camera State Sync ────────────────────────────────────────────────────

    /**
     * Share a file with all participants in the room.
     * The file payload contains base64 data URL, name, size, type.
     */

    /**
     * Request the current list of shared files for the room.
     * Returns to the requesting socket only.
     */
    onMember('get-files', ({ roomCode }) => {
      socket.emit('files-state', { files: roomFiles.list(roomCode) });
    });

    // ── Feature: Meeting Agenda (host-only add/edit/complete) ───────────────

    /**
     * Add a new agenda topic. Host-only — presenters/attendees can view but
     * not modify the agenda. Broadcasts the full updated list to everyone
     * (including the sender) so the order/index stays consistent for all,
     * mirroring the Files broadcast pattern above.
     */
    onMember('add-agenda-item', ({ roomCode, title }) => {
      const user = rooms.get(roomCode)?.get(socket.id);
      if (!user || !isPrivileged(roomCode, user.userId)) return; // silently reject — not host/co-host
      if (!title || !title.trim()) return;
      const item = {
        id: require('crypto').randomUUID(),
        title: title.trim(),
        done: false,
        createdBy: user?.userName || 'Someone',
        createdById: socket.id, // lets the author skip their own "added to the agenda" popup
      };
      if (!roomAgenda.has(roomCode)) roomAgenda.set(roomCode, []);
      roomAgenda.get(roomCode).push(item);
      io.to(roomCode).emit('agenda-updated', roomAgenda.get(roomCode));
    });

    /**
     * Toggle an agenda item's completed state (host/presenter marks topics
     * done during the meeting). Host-only. Broadcasts the full list.
     */
    onMember('toggle-agenda-item', ({ roomCode, id }) => {
      const user = rooms.get(roomCode)?.get(socket.id);
      if (!user || !isPrivileged(roomCode, user.userId)) return; // silently reject — not host/co-host
      const items = roomAgenda.get(roomCode) || [];
      const item = items.find(i => i.id === id);
      if (!item) return;
      item.done = !item.done;
      item.toggledBy = user.userName; // who covered/reopened it, for the agenda popup
      item.toggledById = socket.id;
      io.to(roomCode).emit('agenda-updated', items);
    });

    /**
     * Reorder agenda items. Host-only. Client sends the full array of ids in
     * the new order; server rebuilds the list to match and broadcasts it.
     */
    onMember('reorder-agenda', ({ roomCode, orderedIds }) => {
      const user = rooms.get(roomCode)?.get(socket.id);
      if (!user || !isPrivileged(roomCode, user.userId)) return; // silently reject — not host/co-host
      const items = roomAgenda.get(roomCode) || [];
      const byId = new Map(items.map(i => [i.id, i]));
      const reordered = orderedIds.map(id => byId.get(id)).filter(Boolean);
      // Guard against a stale/partial id list clobbering items
      if (reordered.length !== items.length) return;
      roomAgenda.set(roomCode, reordered);
      io.to(roomCode).emit('agenda-updated', reordered);
    });

    /**
     * Remove an agenda item. Host-only. Broadcasts the full updated list.
     */
    onMember('delete-agenda-item', ({ roomCode, id }) => {
      const user = rooms.get(roomCode)?.get(socket.id);
      if (!user || !isPrivileged(roomCode, user.userId)) return; // silently reject — not host/co-host
      const items = (roomAgenda.get(roomCode) || []).filter(i => i.id !== id);
      roomAgenda.set(roomCode, items);
      io.to(roomCode).emit('agenda-updated', items);
    });

    /**
     * Request the current agenda for the room. Anyone can request (read-only)
     * — returns to the requesting socket only (used on join, mirroring
     * get-notes / get-media / get-files).
     */
    onMember('get-agenda', ({ roomCode }) => {
      socket.emit('agenda-state', { items: roomAgenda.get(roomCode) || [] });
    });

    /**
     * Notify all other participants that this user's camera turned on/off,
     * so their tiles can show the avatar instead of a frozen last frame.
     */
    onMember('camera-toggled', ({ roomCode, isOff }) => {
      rooms.get(roomCode).get(socket.id).videoOff = !!isOff;
      socket.to(roomCode).emit('camera-toggled', { socketId: socket.id, isOff });
    });

    // Recording commands use server-side membership and host state. Client
    // role flags are intentionally ignored.
    onMember('recording-start', async ({ roomCode }, acknowledge = () => {}) => {
      const room = rooms.get(roomCode);
      const member = room?.get(socket.id);
      if (!room || !member) return acknowledge({ ok: false, error: 'You are not a member of this room.' });
      if (!isPrivileged(roomCode, member.userId)) return acknowledge({ ok: false, error: 'Only the host can start recording.' });
      if (roomRecordings.has(roomCode)) return acknowledge({ ok: false, error: 'Recording is already active.' });
      try {
        if (!(await resolveRecordingAllowed(roomHosts.get(roomCode) || socket.data.roomOwnerId))) {
          return acknowledge({ ok: false, error: 'The host has turned recording off for their meetings.' });
        }
      } catch {
        return acknowledge({ ok: false, error: 'Could not check the recording setting. Try again.' });
      }
      if (roomRecordings.has(roomCode) || !rooms.get(roomCode)?.has(socket.id)) return acknowledge({ ok: false, error: 'Recording is already active.' });
      const recording = { startedAt: Date.now(), startedBy: member.userId };
      roomRecordings.set(roomCode, recording);
      io.to(roomCode).emit('recording-state', { state: 'recording', startedAt: recording.startedAt });
      acknowledge({ ok: true });
    });

    onMember('recording-stop', ({ roomCode }, acknowledge = () => {}) => {
      const room = rooms.get(roomCode);
      const member = room?.get(socket.id);
      if (!room || !member) return acknowledge({ ok: false, error: 'You are not a member of this room.' });
      if (!isPrivileged(roomCode, member.userId)) return acknowledge({ ok: false, error: 'Only the host can stop recording.' });
      if (!roomRecordings.has(roomCode)) return acknowledge({ ok: false, error: 'No recording is active.' });
      roomRecordings.delete(roomCode);
      io.to(roomCode).emit('recording-state', { state: 'idle' });
      acknowledge({ ok: true });
    });

    /**
     * Screen sharing: one presenter at a time. The client asks for the slot with an
     * acknowledgement callback; everyone else is told who is presenting.
     */
    onMember('screen-share-start', ({ roomCode } = {}, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      const room = rooms.get(roomCode);
      if (!room || !room.has(socket.id)) { reply({ ok: false, by: null }); return; }
      if (!isPrivileged(roomCode, room.get(socket.id).userId) && !getMeetingPolicy(roomCode).allowShare) { reply({ ok: false, error: 'Screen sharing is limited to hosts.' }); return; }
      const current = roomScreenShares.get(roomCode);
      if (current && current !== socket.id && room.has(current)) {
        reply({ ok: false, by: room.get(current)?.userName || null });
        return;
      }
      roomScreenShares.set(roomCode, socket.id);
      for(const peer of room.values())if(peer.socketId!==socket.id&&getGroup(roomCode,peer.socketId)===getGroup(roomCode,socket.id))io.to(peer.socketId).emit('screen-share-started',{socketId:socket.id});
      reply({ ok: true });
    });

    onMember('screen-share-stop', ({ roomCode } = {}) => {
      if (roomScreenShares.get(roomCode) !== socket.id) return;
      roomScreenShares.delete(roomCode);
      for(const peer of rooms.get(roomCode)?.values()||[])if(peer.socketId!==socket.id&&getGroup(roomCode,peer.socketId)===getGroup(roomCode,socket.id))io.to(peer.socketId).emit('screen-share-stopped',{socketId:socket.id});
    });

    // ── Feature: Live Collaborative Whiteboard ────────────────────────────────

    /**
     * Apply a whiteboard operation and broadcast it to the room.
     * Only the host/presenter (first joiner) is allowed to modify the board.
     * The operation is applied to the in-memory room state so late joiners
     * receive the current board via 'get-whiteboard'.
     */
    onMember('whiteboard-op', ({ roomCode, op }) => {
      const room = rooms.get(roomCode);
      const member = room?.get(socket.id);
      if (!member || !op || typeof op !== 'object') return; // not a room member
      // Host/co-host do anything; participants only draw and add notes, and only once the host allows it.
      if (!isPrivileged(roomCode, member.userId) && !(getMeetingPolicy(roomCode).allowDrawing && PARTICIPANT_WHITEBOARD_OPS.has(op.type))) return;

      if (!roomWhiteboards.has(roomCode)) {
        roomWhiteboards.set(roomCode, { lines: [], notes: [], uploadedImage: '', laser: { x: 0, y: 0, visible: false } });
      }
      const board = roomWhiteboards.get(roomCode);
      applyWhiteboardOp(board, op);
      // Broadcast to everyone else; the host already applied the op locally.
      socket.to(roomCode).emit('whiteboard-op', op);
    });

    /**
     * Request the current whiteboard state for the room.
     * Returns it only to the requesting socket (used by late joiners).
     */
    onMember('get-whiteboard', ({ roomCode }) => {
      socket.emit('whiteboard-state', {
        board: roomWhiteboards.get(roomCode) || { lines: [], notes: [], uploadedImage: '', laser: { x: 0, y: 0, visible: false } },
      });
    });

    // ── Disconnect ────────────────────────────────────────────────────────────

    /**
     * Live captions. Anyone can switch captions on for themselves. While at least one participant has
     * them on, every participant's browser transcribes its own microphone and sends the text here,
     * and we relay it to the room. Muted participants (self or host) are never captioned.
     */
    onMember('captions-set', (payload) => {
      const { roomCode, on } = payload || {};
      socket.data.captionsOn = !!on; // remembered so it also takes effect once this socket (re)joins the room
      const room = rooms.get(roomCode);
      if (!room || !room.has(socket.id)) return;
      setCaptionViewer(roomCode, socket.id, !!on);
      socket.emit('captions-demand', { active: roomCaptionViewers.has(roomCode) });
      if (on) {
        for (const [socketId, m] of room) {
          if (m.captionUnavailable && socketId !== socket.id) socket.emit('caption-unavailable', { socketId, userName: m.userName });
        }
      }
    });

    // A speaker whose browser has no working speech recognition; viewers show they are not captioned.
    onMember('caption-unavailable', ({ roomCode }) => {
      const member = rooms.get(roomCode)?.get(socket.id);
      if (!member || member.captionUnavailable) return;
      member.captionUnavailable = true;
      socket.to(roomCode).emit('caption-unavailable', { socketId: socket.id, userName: member.userName });
    });

    onMember('caption', (payload) => {
      const { roomCode, text, final } = payload || {};
      const member = rooms.get(roomCode)?.get(socket.id);
      if (!member || !roomCaptionViewers.has(roomCode)) return;
      if (member.selfMuted || member.hostMuted) return;
      if (typeof text !== 'string') return;
      const clean = text.replace(/\s+/g, ' ').trim().slice(-CAPTION_MAX_CHARS);
      if (!clean) return;
      const now = Date.now();
      if (!final && socket.data.lastCaptionAt && now - socket.data.lastCaptionAt < CAPTION_MIN_INTERVAL_MS) return;
      socket.data.lastCaptionAt = now;
      socket.to(roomCode).emit('caption', { socketId: socket.id, userName: member.userName, text: clean, final: !!final });
    });

    guardedOn(socket, 'disconnect', () => {
      const room = currentRoom ? rooms.get(currentRoom) : null;
      const departing = room?.get(socket.id);
      const hostLeftWhileRecording = departing
        && String(roomHosts.get(currentRoom)) === String(departing.userId)
        && roomRecordings.has(currentRoom);

      if (hostLeftWhileRecording) {
        roomRecordings.delete(currentRoom);
      }

      if (currentRoom && rooms.has(currentRoom)) {
        const leavingMember = departing;
        room.delete(socket.id);
        if (leavingMember) meetingMetrics.left(currentRoom, leavingMember.userId);
        console.info(`[participants] ${currentRoom}: ${room.size} participant(s) in room`);
        extension.roster();

        // A co-host who drops keeps the role (it belongs to the account) and gets it back on rejoin;
        // the host can still remove it. Until then the co-host has no socket to act from.

        // If the HOST disconnects and a co-host is present, promote them automatically
        // (not when the host is still here from the tab or device that replaced this one).
        const hostStillPresent = leavingMember && [...room.values()].some(p => String(p.userId) === String(leavingMember.userId));
        if (leavingMember && !hostStillPresent && room.size > 0 && String(roomHosts.get(currentRoom)) === String(leavingMember.userId)) {
          const newHost = roomCoHosts.get(currentRoom);
          if (newHost && room.has(newHost.socketId)) {
            roomHosts.set(currentRoom, newHost.userId);
            roomCoHosts.delete(currentRoom);
            const promoted = room.get(newHost.socketId);
            if (promoted) promoted.isHost = true;
            extension.roster();
            io.to(currentRoom).emit('host-transferred', {
              newHostSocketId: newHost.socketId,
              newHostUserId: newHost.userId,
              newHostUserName: newHost.userName,
            });
          }
        }

        if (room.size === 0) {
          rooms.delete(currentRoom);

          // Room is empty: remember when, so a quick rejoin keeps the session and a later one starts fresh
          const sessKey = String(currentRoom).toLowerCase();
          const sess = roomSessions.get(sessKey);
          if (sess) {
            sess.emptySince = Date.now();
            const timer = setTimeout(() => {
              const s = roomSessions.get(sessKey);
              if (s && s.emptySince && Date.now() - s.emptySince >= SESSION_GRACE_MS) {
                roomSessions.delete(sessKey);
                roomMembers.delete(sessKey);
                meetingMetrics.finish(sessKey);
              }
            }, SESSION_GRACE_MS + 1000);
            if (timer.unref) timer.unref();
          }
          // Clean up room-level state when last participant leaves
          roomNotes.delete(currentRoom);
          roomPolls.delete(currentRoom);
          roomMedia.delete(currentRoom);
          roomMediaPlayback.delete(currentRoom);
          clearMeetingExtensions(currentRoom);
          roomFiles.removeAll(currentRoom);

          roomAgenda.delete(currentRoom);
          roomHands.delete(currentRoom);

          roomHosts.delete(currentRoom);
          roomCoHosts.delete(currentRoom);
          roomWhiteboards.delete(currentRoom);
          roomRecordings.delete(currentRoom);
          roomScreenShares.delete(currentRoom);

          delete roomLocks[currentRoom];
        }
      }
      if (currentRoom && roomScreenShares.get(currentRoom) === socket.id) {
        roomScreenShares.delete(currentRoom);
        socket.to(currentRoom).emit('screen-share-stopped', { socketId: socket.id });
      }
      if (currentRoom) {
        if (hostLeftWhileRecording) {
          socket.to(currentRoom).emit('recording-state', { state: 'idle', error: 'Recording stopped because the host left.' });
        }
        setCaptionViewer(currentRoom, socket.id, false);
        socket.to(currentRoom).emit('user-left', { socketId: socket.id });
        if (roomHands.get(currentRoom)?.some(h => h.socketId === socket.id)) setHand(currentRoom, socket.id, null, false);
      } else if (socket.data.requestedRoom) {
        // Left the waiting room: drop the host's now-useless Admit popup for this socket.
        socket.to(socket.data.requestedRoom).emit('join-request-cancelled', { socketId: socket.id });
      }
    });
  });

  return io;
}

module.exports = { setupSignaling, rooms, getSessionStart, registerRoomHost, isPrivileged };
