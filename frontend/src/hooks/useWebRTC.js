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
export function useWebRTC(roomCode, { onKicked } = {}) {
  const { account } = useWallet();
  const storedUser = getStoredUser();
  const userName = storedUser?.name || (account ? `${account.slice(0, 6)}…` : 'Anonymous');
  const userId = storedUser?.id || account || crypto.randomUUID();

  // ── Core media state ────────────────────────────────────────────────────────
  const [localStream, setLocalStream]       = useState(null);
  const [peers, setPeers]                   = useState({}); // socketId → { userName, userId, stream }
  const [micMuted, setMicMuted]             = useState(false);
  const [cameraOff, setCameraOff]           = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
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

  // ── Feature 7: Polls ───────────────────────────────────────────────────────
  const [polls, setPolls] = useState([]); // [{id, question, options, active}]

  // ── Refs ────────────────────────────────────────────────────────────────────
  const socketRef      = useRef(null);
  const pcsRef         = useRef({});           // socketId → RTCPeerConnection
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

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

      // ── Feature 6: Collaborative Notes ─────────────────────────────────────

      // Receive current notes state on connect
      socket.on('notes-state', ({ notes }) => {
        setSharedNotes(notes);
      });

      // Another participant updated the notes
      socket.on('notes-updated', ({ notes }) => {
        setSharedNotes(notes);
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

      // Join the room and request current notes
      socket.emit('join-room', { roomCode, userId, userName });
      socket.emit('get-notes', { roomCode });
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

  const toggleCamera = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setCameraOff(c => !c);
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

  // ── Public API ──────────────────────────────────────────────────────────────

  return {
    // Core
    localStream, peers,
    micMuted, cameraOff, isScreenSharing,
    spotlightId, setSpotlightId,
    toggleMic, toggleCamera, toggleScreenShare,
    userName, connectionError,
    // Feature 1: Host Controls
    muteParticipant, kickParticipant, setRoomLocked,
    // Feature 3: Reactions + Hand Queue
    reactions, handQueue,
    sendReaction, sendHandRaise, sendHandLower,
    // Feature 4: Network Quality
    networkQuality,
    // Feature 6: Collaborative Notes
    sharedNotes, updateNotes,
    // Feature 7: Polls
    polls, createPoll, votePoll, endPoll,
  };
}
