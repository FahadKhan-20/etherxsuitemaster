import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { getStoredUser } from '../utils/auth';
import { useWallet } from '../context/WalletContext';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

/**
 * Core WebRTC hook. Manages peer connections, socket events, and all
 * collaborative features: host controls, reactions, hand queue, network
 * quality polling, collaborative notes, and polls.
 *
 * @param {string} roomCode  - The meeting room code.
 * @param {object} [opts]    - Options object.
 * @param {Function} [opts.onKicked] - Called when the local user is removed by host.
 */
export function useWebRTC(roomCode, { onKicked, isHost } = {}) {
  const { account } = useWallet();
  const storedUser = getStoredUser();
  const userName = storedUser?.name || (account ? `${account.slice(0, 6)}…` : 'Anonymous');
  const fallbackIdRef = useRef(null);
  if (!fallbackIdRef.current) fallbackIdRef.current = crypto.randomUUID();
  const userId = storedUser?.id || account || fallbackIdRef.current;

  // ── Waiting Room State ──────────────────────────────────────────────────────
  const [admitted, setAdmitted]         = useState(!!isHost);
  const [denied, setDenied]             = useState(false);
  const [joinRequests, setJoinRequests] = useState([]);

  // ── Core media state ────────────────────────────────────────────────────────
  const [localStream, setLocalStream]       = useState(null);
  const [peers, setPeers]                   = useState({}); // socketId → { userName, userId, stream }
  const [micMuted, setMicMuted]             = useState(false);
  const [cameraOff, setCameraOff]           = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [noiseSuppressed, setNoiseSuppressed] = useState(false);
  const [roomLocked, setRoomLockedState]    = useState(false);
  const [spotlightId, setSpotlightId]       = useState('local');
  const [connectionError, setConnectionError] = useState('');

  // ── Feature 3: Reactions + Hand Queue ──────────────────────────────────────
  // reactions: [{id, emoji, socketId, userName}] — floating emoji overlays
  const [reactions, setReactions]   = useState([]);
  // handQueue: [{socketId, userName}] — ordered list of raised hands
  const [handQueue, setHandQueue]   = useState([]);
  const reactionIdRef = useRef(0);

  // ── Feature 4: Network Quality ─────────────────────────────────────────────
  // 'good' | 'fair' | 'poor' | 'offline'
  const [networkQuality, setNetworkQuality] = useState('good');

  // ── Feature 6: Collaborative Notes ─────────────────────────────────────────
  const [sharedNotes, setSharedNotes] = useState('');

  // ── Feature: Media Share (YouTube / video URL) ─────────────────────────────
  const [sharedMediaUrl, setSharedMediaUrl] = useState('');

  // ── Feature 7: Polls ───────────────────────────────────────────────────────
  const [polls, setPolls] = useState([]); // [{id, question, options, active}]

  // ── Feature: File Sharing ──────────────────────────────────────────────────
  const [sharedFiles, setSharedFiles] = useState([]); // [{id, name, size, type, url, sharedBy, sharedAt}]
  // fileNotifications: recently-shared files shown as an auto-dismissing
  // popup for everyone in the room — populated only from the real-time
  // 'file-shared' broadcast, never from the on-join 'files-state' history
  // load, so joining a room with existing files doesn't spam popups.
  const [fileNotifications, setFileNotifications] = useState([]);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const socketRef      = useRef(null);
  const pcsRef         = useRef({});           // socketId → RTCPeerConnection
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const noiseAudioCtxRef = useRef(null);       // AudioContext used while noise suppression is on
  const rawMicTrackRef = useRef(null);         // original (unfiltered) mic track, kept to revert to

  // ── Peer connection factory ─────────────────────────────────────────────────
  const createPC = useCallback((socketId, onStream) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track =>
        pc.addTrack(track, localStreamRef.current),
      );
    }

    const remoteStream = new MediaStream();
    pc.ontrack = ({ streams }) => {
      streams[0].getTracks().forEach(t => remoteStream.addTrack(t));
      onStream(remoteStream);
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socketRef.current?.emit('ice-candidate', { to: socketId, candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setPeers(prev => { const n = { ...prev }; delete n[socketId]; return n; });
        pc.close();
        delete pcsRef.current[socketId];
      }
    };

    pcsRef.current[socketId] = pc;
    return pc;
  }, []);

  // ── Main effect: media + socket ─────────────────────────────────────────────
  useEffect(() => {
    if (!roomCode) return;
    let cancelled = false;

    const init = async () => {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        } catch {
          setConnectionError('Could not access camera or microphone.');
          return;
        }
      }

      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
      localStreamRef.current = stream;
      setLocalStream(stream);

      const socket = io(import.meta.env.VITE_API_BASE_URL, { transports: ['websocket', 'polling'] });
      socketRef.current = socket;

      // ── Waiting Room Signaling ─────────────────────────────────────────────
      socket.on('join-request', ({ socketId, userId: uId, userName: uName }) => {
        if (isHost) {
          setJoinRequests(prev => {
            if (prev.some(r => r.socketId === socketId)) return prev;
            return [...prev, { socketId, userId: uId, userName: uName }];
          });
        }
      });

      socket.on('admitted', () => {
        setAdmitted(true);
        socket.emit('join-room', { roomCode, userId, userName });
        socket.emit('get-notes', { roomCode });
        socket.emit('get-media', { roomCode });
        socket.emit('get-files', { roomCode });
      });

      socket.on('denied', () => {
        setDenied(true);
      });

      // ── Core WebRTC signaling events ────────────────────────────────────────

      socket.on('existing-users', async (users) => {
        for (const u of users) {
          const pc = createPC(u.socketId, (remoteStream) => {
            setPeers(prev => ({ ...prev, [u.socketId]: { ...prev[u.socketId], stream: remoteStream } }));
          });
          setPeers(prev => ({ ...prev, [u.socketId]: { userName: u.userName, userId: u.userId, stream: null } }));
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('offer', { to: u.socketId, offer });
        }
      });

      socket.on('user-joined', ({ socketId, userName: uName, userId: uId }) => {
        setPeers(prev => ({ ...prev, [socketId]: { userName: uName, userId: uId, stream: null } }));
      });

      socket.on('offer', async ({ from, offer }) => {
        const pc = createPC(from, (remoteStream) => {
          setPeers(prev => ({ ...prev, [from]: { ...prev[from], stream: remoteStream } }));
        });
        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { to: from, answer });
      });

      socket.on('answer', async ({ from, answer }) => {
        await pcsRef.current[from]?.setRemoteDescription(answer);
      });

      socket.on('ice-candidate', async ({ from, candidate }) => {
        try { await pcsRef.current[from]?.addIceCandidate(candidate); } catch {}
      });

      socket.on('user-left', ({ socketId }) => {
        pcsRef.current[socketId]?.close();
        delete pcsRef.current[socketId];
        setPeers(prev => { const n = { ...prev }; delete n[socketId]; return n; });
        setSpotlightId(id => id === socketId ? 'local' : id);
        // Remove from hand queue on leave
        setHandQueue(q => q.filter(h => h.socketId !== socketId));
      });

      // ── Feature 1: Host controls ────────────────────────────────────────────

      // Host has force-muted us — disable audio tracks and update state
      socket.on('muted-by-host', () => {
        localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = false; });
        setMicMuted(true);
      });

      // Host has kicked us — invoke the caller-supplied callback
      socket.on('removed-from-room', () => {
        if (typeof onKicked === 'function') onKicked();
      });

      // Room lock state changed (by host) — broadcast to everyone including sender
      socket.on('room-locked', ({ locked }) => {
        setRoomLockedState(locked);
      });

      // ── Feature 3: Reactions + Hand Queue ──────────────────────────────────

      // A remote participant sent a reaction emoji
      socket.on('reaction', ({ emoji, socketId, userName: uName }) => {
        const id = ++reactionIdRef.current;
        setReactions(prev => [...prev, { id, emoji, socketId, userName: uName }]);
        // Auto-remove after 3 seconds
        setTimeout(() => {
          setReactions(prev => prev.filter(r => r.id !== id));
        }, 3000);
      });

      // A remote participant raised their hand
      socket.on('hand-raised', ({ socketId, userName: uName }) => {
        setHandQueue(q => {
          if (q.some(h => h.socketId === socketId)) return q;
          return [...q, { socketId, userName: uName }];
        });
      });

      // A remote participant lowered their hand (or disconnected)
      socket.on('hand-lowered', ({ socketId }) => {
        setHandQueue(q => q.filter(h => h.socketId !== socketId));
      });

      // ── Camera State Sync ────────────────────────────────────────────────

      // A remote participant turned their camera on/off — track it so their
      // tile shows the avatar instead of freezing on the last video frame.
      socket.on('camera-toggled', ({ socketId, isOff }) => {
        setPeers(prev => prev[socketId]
          ? { ...prev, [socketId]: { ...prev[socketId], videoOff: isOff } }
          : prev);
      });

      // ── Feature 6: Collaborative Notes ─────────────────────────────────────

      // Receive current notes state on connect
      socket.on('notes-state', ({ notes }) => {
        setSharedNotes(notes);
      });

      // Another participant updated the notes
      socket.on('notes-updated', ({ notes }) => {
        setSharedNotes(notes);
      });

      // ── Feature: Media Share ────────────────────────────────────────────────

      // Receive current shared media state on connect
      socket.on('media-state', ({ url }) => {
        setSharedMediaUrl(url);
      });

      // Another participant shared a new media URL
      socket.on('media-shared', ({ url }) => {
        setSharedMediaUrl(url);
      });

      // ── Feature 7: Polls ────────────────────────────────────────────────────

      // A new poll was created
      socket.on('poll-created', (poll) => {
        setPolls(prev => [...prev, poll]);
      });

      // A poll was updated (vote or end)
      socket.on('poll-updated', (updatedPoll) => {
        setPolls(prev => prev.map(p => p.id === updatedPoll.id ? updatedPoll : p));
      });

      // Join the room if host (already admitted); otherwise request admission
      if (isHost) {
        socket.emit('join-room', { roomCode, userId, userName });
        socket.emit('get-notes', { roomCode });
        socket.emit('get-media', { roomCode });
        socket.emit('get-files', { roomCode });
      } else {
        socket.emit('request-join', { roomCode, userId, userName });
      }
    };

    init().catch(() => setConnectionError('Failed to initialize video call.'));

    return () => {
      cancelled = true;
      Object.values(pcsRef.current).forEach(pc => pc.close());
      pcsRef.current = {};
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      socketRef.current?.disconnect();
    };
  }, [roomCode, userId, userName, createPC]); // onKicked intentionally excluded to avoid reconnect loop

  // ── Feature 4: Network Quality polling (every 5s) ───────────────────────────
  useEffect(() => {
    const interval = setInterval(async () => {
      const pcs = Object.values(pcsRef.current);
      if (!pcs.length) { setNetworkQuality('good'); return; }
      let totalRtt = 0, count = 0;
      for (const pc of pcs) {
        try {
          const stats = await pc.getStats();
          stats.forEach(r => {
            if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.currentRoundTripTime) {
              totalRtt += r.currentRoundTripTime * 1000; // convert seconds → ms
              count++;
            }
          });
        } catch {
          // Ignore stats errors for closed connections
        }
      }
      if (!count) return;
      const avg = totalRtt / count;
      setNetworkQuality(avg < 150 ? 'good' : avg < 350 ? 'fair' : 'poor');
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // ── Core media controls ─────────────────────────────────────────────────────

  const toggleMic = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMicMuted(m => !m);
  }, []);

  const toggleCamera = useCallback(async () => {
    if (!cameraOff) {
      // ── TURN OFF: stop track completely → kills hardware indicator light
      localStreamRef.current?.getVideoTracks().forEach(t => {
        t.stop();
        localStreamRef.current.removeTrack(t);
      });
      // Tell all peers: send a null/black track so their UI updates
      Object.values(pcsRef.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(null).catch(() => {});
      });
      // Tell peers explicitly so they show the avatar instead of a frozen frame
      socketRef.current?.emit('camera-toggled', { roomCode, isOff: true });
      setCameraOff(true);
    } else {
      // ── TURN ON: re-acquire camera → light comes back on only now
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newTrack = newStream.getVideoTracks()[0];
        // Add new track to local stream
        localStreamRef.current?.getVideoTracks().forEach(t => {
          t.stop();
          localStreamRef.current.removeTrack(t);
        });
        localStreamRef.current?.addTrack(newTrack);
        // Replace track in all peer connections
        Object.values(pcsRef.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video' || s.track === null);
          if (sender) sender.replaceTrack(newTrack).catch(() => {});
        });
        // Update the local stream state so VideoTile re-renders with new track
        setLocalStream(prev => {
          if (!prev) return prev;
          // Return the same stream object (now with new track) to trigger re-render
          return new MediaStream([...prev.getAudioTracks(), newTrack]);
        });
        socketRef.current?.emit('camera-toggled', { roomCode, isOff: false });
        setCameraOff(false);
      } catch (err) {
        console.error('Camera re-acquire failed:', err);
      }
    }
  }, [cameraOff, roomCode]);

  /**
   * Basic noise suppression: routes the mic track through a Web Audio
   * highpass + lowpass filter pair (cuts low-frequency rumble and
   * high-frequency hiss outside the human-voice band, ~200Hz-3.5kHz) and
   * sends the filtered track instead. This is a simple band-pass filter,
   * not full ML-based noise cancellation (e.g. RNNoise) — it reduces
   * steady background hum/hiss but won't remove other voices or
   * non-stationary noise.
   */
  const toggleNoiseSuppression = useCallback(() => {
    const currentTrack = localStreamRef.current?.getAudioTracks()[0];
    if (!currentTrack) return;

    if (!noiseAudioCtxRef.current) {
      // ── Turn ON: build the filter chain ────────────────────────────────
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const source = ctx.createMediaStreamSource(new MediaStream([currentTrack]));
        const highpass = ctx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 200;
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 3500;
        const destination = ctx.createMediaStreamDestination();
        source.connect(highpass).connect(lowpass).connect(destination);

        const filteredTrack = destination.stream.getAudioTracks()[0];
        rawMicTrackRef.current = currentTrack;
        noiseAudioCtxRef.current = ctx;

        localStreamRef.current.removeTrack(currentTrack);
        localStreamRef.current.addTrack(filteredTrack);
        Object.values(pcsRef.current).forEach(pc => {
          pc.getSenders().find(s => s.track?.kind === 'audio')?.replaceTrack(filteredTrack).catch(() => {});
        });
        setNoiseSuppressed(true);
      } catch (err) {
        console.error('Noise suppression setup failed:', err);
      }
    } else {
      // ── Turn OFF: revert to the raw mic track, tear down the filter chain ──
      const rawTrack = rawMicTrackRef.current;
      if (rawTrack) {
        localStreamRef.current.removeTrack(currentTrack);
        localStreamRef.current.addTrack(rawTrack);
        Object.values(pcsRef.current).forEach(pc => {
          pc.getSenders().find(s => s.track?.kind === 'audio')?.replaceTrack(rawTrack).catch(() => {});
        });
      }
      noiseAudioCtxRef.current.close().catch(() => {});
      noiseAudioCtxRef.current = null;
      rawMicTrackRef.current = null;
      setNoiseSuppressed(false);
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      const camTrack = localStreamRef.current?.getVideoTracks()[0];
      if (camTrack) {
        Object.values(pcsRef.current).forEach(pc => {
          pc.getSenders().find(s => s.track?.kind === 'video')?.replaceTrack(camTrack);
        });
      }
      setIsScreenSharing(false);
    } else {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        screenStreamRef.current = screen;
        const screenTrack = screen.getVideoTracks()[0];
        Object.values(pcsRef.current).forEach(pc => {
          pc.getSenders().find(s => s.track?.kind === 'video')?.replaceTrack(screenTrack);
        });
        screenTrack.onended = () => toggleScreenShare();
        setIsScreenSharing(true);
      } catch {}
    }
  }, [isScreenSharing]);

  // ── Feature 1: Host control emitters ───────────────────────────────────────

  /** Host: mute a remote participant by socket ID. */
  const muteParticipant = useCallback((socketId) => {
    socketRef.current?.emit('mute-participant', { to: socketId });
  }, []);

  /** Host: remove a remote participant from the room. */
  const kickParticipant = useCallback((socketId) => {
    socketRef.current?.emit('kick-participant', { to: socketId });
  }, []);

  /** Host: lock or unlock the room. */
  const setRoomLocked = useCallback((locked) => {
    socketRef.current?.emit('lock-room', { roomCode, locked });
  }, [roomCode]);

  // ── Feature 3: Reaction + hand emitters ────────────────────────────────────

  /** Send a floating emoji reaction to all other participants. */
  const sendReaction = useCallback((emoji) => {
    if (!roomCode) return;
    // Add locally so the sender also sees their own reaction
    const id = ++reactionIdRef.current;
    setReactions(prev => [...prev, { id, emoji, socketId: 'local', userName }]);
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== id));
    }, 3000);
    socketRef.current?.emit('reaction', { roomCode, emoji });
  }, [roomCode, userName]);

  /** Signal to others that the local user raised their hand. */
  const sendHandRaise = useCallback(() => {
    socketRef.current?.emit('raise-hand', { roomCode });
  }, [roomCode]);

  /** Signal to others that the local user lowered their hand. */
  const sendHandLower = useCallback(() => {
    socketRef.current?.emit('lower-hand', { roomCode });
  }, [roomCode]);

  // ── Feature 6: Notes emitter ────────────────────────────────────────────────

  /** Broadcast updated shared notes to all participants. */
  const updateNotes = useCallback((text) => {
    setSharedNotes(text);
    socketRef.current?.emit('update-notes', { roomCode, notes: text });
  }, [roomCode]);

  // ── Feature: Media Share emitter ────────────────────────────────────────────

  /** Share a video URL with everyone in the room. */
  const shareMedia = useCallback((url) => {
    setSharedMediaUrl(url);
    socketRef.current?.emit('share-media', { roomCode, url });
  }, [roomCode]);

  // ── Feature 7: Poll emitters ────────────────────────────────────────────────

  /** Host: create a new poll. options is an array of option strings. */
  const createPoll = useCallback((question, options) => {
    socketRef.current?.emit('create-poll', { roomCode, question, options });
  }, [roomCode]);

  /** Vote for an option in a poll by index. */
  const votePoll = useCallback((pollId, optionIndex) => {
    socketRef.current?.emit('vote-poll', { roomCode, pollId, optionIndex });
  }, [roomCode]);

  /** Host: end an active poll. */
  const endPoll = useCallback((pollId) => {
    socketRef.current?.emit('end-poll', { roomCode, pollId });
  }, [roomCode]);

  // ── Waiting Room Handlers ──────────────────────────────────────────────────
  const admitUser = useCallback((socketId) => {
    if (!isHost) return;
    socketRef.current?.emit('admit-user', { toSocketId: socketId });
    setJoinRequests(prev => prev.filter(r => r.socketId !== socketId));
  }, [isHost]);

  const denyUser = useCallback((socketId) => {
    if (!isHost) return;
    socketRef.current?.emit('deny-user', { toSocketId: socketId });
    setJoinRequests(prev => prev.filter(r => r.socketId !== socketId));
  }, [isHost]);

  // ── Feature: File Sharing callbacks ─────────────────────────────────────────

  // Listen for file-shared and files-state events (wired on socket connect)
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const onFileShared = (entry) => {
      setSharedFiles(prev => {
        if (prev.some(f => f.id === entry.id)) return prev;
        return [...prev, entry];
      });
      // Pop up a dismissible notification for everyone (including the
      // sharer, since the server echoes 'file-shared' back to them too).
      // Auto-removed after 8s; the X button in the UI can dismiss it early.
      setFileNotifications(prev => [...prev, entry]);
      setTimeout(() => {
        setFileNotifications(prev => prev.filter(f => f.id !== entry.id));
      }, 8000);
    };
    const onFilesState = ({ files }) => {
      setSharedFiles(files || []);
    };

    socket.on('file-shared', onFileShared);
    socket.on('files-state', onFilesState);

    return () => {
      socket.off('file-shared', onFileShared);
      socket.off('files-state', onFilesState);
    };
  }, [socketRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

  const shareFile = useCallback((file) => {
    const socket = socketRef.current;
    if (!socket || !roomCode) return;
    socket.emit('share-file', { roomCode, file });
  }, [roomCode]);

  /** Dismiss a file-share popup notification before its 8s auto-timeout. */
  const dismissFileNotification = useCallback((id) => {
    setFileNotifications(prev => prev.filter(f => f.id !== id));
  }, []);

  // ── Public API ──────────────────────────────────────────────────────────────

  return {
    // Core
    localStream, peers,
    micMuted, cameraOff, isScreenSharing,
    spotlightId, setSpotlightId,
    toggleMic, toggleCamera, toggleScreenShare,
    toggleNoiseSuppression, noiseSuppressed,
    userName, connectionError,
    // Waiting Room / Admission
    admitted, denied, joinRequests, admitUser, denyUser,
    // Feature 1: Host Controls
    muteParticipant, kickParticipant, setRoomLocked, roomLocked,
    // Feature 3: Reactions + Hand Queue
    reactions, handQueue,
    sendReaction, sendHandRaise, sendHandLower,
    // Feature 4: Network Quality
    networkQuality,
    // Feature 6: Collaborative Notes
    sharedNotes, updateNotes,
    // Feature: Media Share
    sharedMediaUrl, shareMedia,
    // Feature 7: Polls
    polls, createPoll, votePoll, endPoll,
    // Feature: File Sharing
    sharedFiles, shareFile,
    fileNotifications, dismissFileNotification,
  };
}
