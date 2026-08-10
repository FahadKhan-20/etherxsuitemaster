const { Server } = require('socket.io');

// roomCode -> Map<socketId, { socketId, userName, userId }>
const rooms = new Map();

// roomCode -> boolean (locked state)
let roomLocks = {};

// roomCode -> string (shared notes content)
const roomNotes = new Map();

// roomCode -> [{id, question, options:[{text,voters:[socketId]}], active}]
const roomPolls = new Map();

// roomCode -> string (currently shared media URL)
const roomMedia = new Map();

// roomCode -> [{id, name, size, type, url, sharedBy, sharedAt}]
const roomFiles = new Map();

function setupSignaling(httpServer, allowedOrigin) {
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigin,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    let currentRoom = null;

    socket.on('join-room', ({ roomCode, userId, userName }) => {
      currentRoom = roomCode;
      socket.join(roomCode);

      if (!rooms.has(roomCode)) rooms.set(roomCode, new Map());
      const room = rooms.get(roomCode);

      // Send existing participants to the new joiner
      const existing = Array.from(room.values());
      socket.emit('existing-users', existing);

      // Add new joiner to room
      room.set(socket.id, { socketId: socket.id, userId, userName });

      // Notify everyone else
      socket.to(roomCode).emit('user-joined', { socketId: socket.id, userId, userName });
    });

    socket.on('offer', ({ to, offer }) => {
      io.to(to).emit('offer', { from: socket.id, offer });
    });

    socket.on('answer', ({ to, answer }) => {
      io.to(to).emit('answer', { from: socket.id, answer });
    });

    socket.on('ice-candidate', ({ to, candidate }) => {
      io.to(to).emit('ice-candidate', { from: socket.id, candidate });
    });

    // ── Feature 1: Host Controls ──────────────────────────────────────────────

    /**
     * Force mute a specific participant by their socket ID.
     * Host emits this; target receives 'muted-by-host'.
     */
    socket.on('mute-participant', ({ to }) => {
      io.to(to).emit('muted-by-host');
    });

    /**
     * Remove a participant from the room.
     * Host emits this; target receives 'removed-from-room'.
     */
    socket.on('kick-participant', ({ to }) => {
      io.to(to).emit('removed-from-room');
    });

    /**
     * Lock or unlock the room so no new participants can join.
     * Broadcasts room-locked state to all participants.
     */
    socket.on('lock-room', ({ roomCode, locked }) => {
      roomLocks[roomCode] = locked;
      io.to(roomCode).emit('room-locked', { locked });
    });

    // ── Feature: Waiting Room / Admission ────────────────────────────────────
    socket.on('request-join', ({ roomCode, userId, userName }) => {
      socket.to(roomCode).emit('join-request', {
        socketId: socket.id,
        userId,
        userName
      });
    });

    socket.on('admit-user', ({ toSocketId }) => {
      io.to(toSocketId).emit('admitted');
    });

    socket.on('deny-user', ({ toSocketId }) => {
      io.to(toSocketId).emit('denied');
    });

    // ── Feature 3: Reactions + Hand Queue ────────────────────────────────────

    /**
     * Broadcast an emoji reaction to all other participants in the room.
     */
    socket.on('reaction', ({ roomCode, emoji }) => {
      const user = rooms.get(roomCode)?.get(socket.id);
      socket.to(roomCode).emit('reaction', {
        emoji,
        socketId: socket.id,
        userName: user?.userName,
      });
    });

    /**
     * Notify all participants that this user raised their hand.
     */
    socket.on('raise-hand', ({ roomCode }) => {
      const user = rooms.get(roomCode)?.get(socket.id);
      socket.to(roomCode).emit('hand-raised', {
        socketId: socket.id,
        userName: user?.userName,
      });
    });

    /**
     * Notify all participants that this user lowered their hand.
     */
    socket.on('lower-hand', ({ roomCode }) => {
      socket.to(roomCode).emit('hand-lowered', { socketId: socket.id });
    });

    // ── Feature 6: Collaborative Notes ───────────────────────────────────────

    /**
     * Update shared notes for the room and broadcast to all other participants.
     */
    socket.on('update-notes', ({ roomCode, notes }) => {
      roomNotes.set(roomCode, notes);
      socket.to(roomCode).emit('notes-updated', { notes });
    });

    /**
     * Request the current shared notes state for the room.
     * Returns the notes only to the requesting socket.
     */
    socket.on('get-notes', ({ roomCode }) => {
      socket.emit('notes-state', { notes: roomNotes.get(roomCode) || '' });
    });

    // ── Feature 7: Polls ──────────────────────────────────────────────────────

    /**
     * Create a new poll for the room. Broadcasts the poll to all participants.
     */
    socket.on('create-poll', ({ roomCode, question, options }) => {
      const poll = {
        id: Date.now(),
        question,
        options: options.map(t => ({ text: t, voters: [] })),
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
    socket.on('vote-poll', ({ roomCode, pollId, optionIndex }) => {
      const polls = roomPolls.get(roomCode) || [];
      const poll = polls.find(p => p.id === pollId);
      if (!poll) return;
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
    socket.on('end-poll', ({ roomCode, pollId }) => {
      const polls = roomPolls.get(roomCode) || [];
      const poll = polls.find(p => p.id === pollId);
      if (poll) {
        poll.active = false;
        io.to(roomCode).emit('poll-updated', poll);
      }
    });

    // ── Feature: Media Share (YouTube / video URL) ───────────────────────────

    /**
     * Share a video URL with the room. Broadcasts to all other participants.
     */
    socket.on('share-media', ({ roomCode, url }) => {
      roomMedia.set(roomCode, url);
      socket.to(roomCode).emit('media-shared', { url });
    });

    /**
     * Request the currently shared media URL for the room.
     * Returns it only to the requesting socket.
     */
    socket.on('get-media', ({ roomCode }) => {
      socket.emit('media-state', { url: roomMedia.get(roomCode) || '' });
    });

    // ── Camera State Sync ────────────────────────────────────────────────────

    /**
     * Share a file with all participants in the room.
     * The file payload contains base64 data URL, name, size, type.
     */
    socket.on('share-file', ({ roomCode, file }) => {
      const user = rooms.get(roomCode)?.get(socket.id);
      const entry = {
        id: Date.now() + '_' + socket.id,
        name: file.name,
        size: file.size,
        type: file.type,
        url: file.url, // base64 data URL
        sharedBy: user?.userName || 'Someone',
        sharedAt: Date.now(),
      };
      if (!roomFiles.has(roomCode)) roomFiles.set(roomCode, []);
      roomFiles.get(roomCode).push(entry);
      // Broadcast to all (including sender) so everyone's Files panel updates
      io.to(roomCode).emit('file-shared', entry);
    });

    /**
     * Request the current list of shared files for the room.
     * Returns to the requesting socket only.
     */
    socket.on('get-files', ({ roomCode }) => {
      socket.emit('files-state', { files: roomFiles.get(roomCode) || [] });
    });


    /**
     * Notify all other participants that this user's camera turned on/off,
     * so their tiles can show the avatar instead of a frozen last frame.
     */
    socket.on('camera-toggled', ({ roomCode, isOff }) => {
      socket.to(roomCode).emit('camera-toggled', { socketId: socket.id, isOff });
    });

    // ── Disconnect ────────────────────────────────────────────────────────────

    socket.on('disconnect', () => {
      if (currentRoom && rooms.has(currentRoom)) {
        rooms.get(currentRoom).delete(socket.id);
        if (rooms.get(currentRoom).size === 0) {
          rooms.delete(currentRoom);
          // Clean up room-level state when last participant leaves
          roomNotes.delete(currentRoom);
          roomPolls.delete(currentRoom);
          roomMedia.delete(currentRoom);
          roomFiles.delete(currentRoom);
          delete roomLocks[currentRoom];
        }
      }
      if (currentRoom) {
        socket.to(currentRoom).emit('user-left', { socketId: socket.id });
        // Lower hand on disconnect
        socket.to(currentRoom).emit('hand-lowered', { socketId: socket.id });
      }
    });
  });

  return io;
}

module.exports = { setupSignaling, rooms };
