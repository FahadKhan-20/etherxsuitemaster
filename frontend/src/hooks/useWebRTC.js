import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { getStoredUser, getAuthToken } from '../utils/auth';
import { acquireMeetingMedia, audioConstraint, deviceConstraint, listMeetingDevices } from '../utils/meetingMedia';
import { useWallet } from '../context/WalletContext';
import apiClient from '../utils/apiClient';

// Used until (or if) the backend's /api/rooms/ice-servers answers with the configured relay.
const FALLBACK_ICE_SERVERS = [
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
 * quality polling, collaborative notes, polls, and meeting agenda.
 *
 * @param {string} roomCode  - The meeting room code.
 * @param {object} [opts]    - Options object.
 * @param {Function} [opts.onKicked] - Called when the local user is removed by host.
 */
export function useWebRTC(roomCode, { onKicked, isHost, initialMedia, videoEffects = false, enabled = true } = {}) {
  const normalizedCode = (roomCode || '').trim().toLowerCase();
  const { account } = useWallet();
  const storedUser = getStoredUser();
  const userNameRef = useRef(initialMedia?.userName || storedUser?.name || (account ? `${account.slice(0, 6)}…` : 'Anonymous'));
  const userName = userNameRef.current;
  const fallbackIdRef = useRef(null);
  if (!fallbackIdRef.current) fallbackIdRef.current = crypto.randomUUID();
  const userIdRef = useRef(storedUser?.id || account || fallbackIdRef.current);
  const userId = userIdRef.current;

  // ── Waiting Room State ──────────────────────────────────────────────────────
  const [admitted, setAdmitted] = useState(!!isHost);
  const admittedRef = useRef(!!isHost);
  useEffect(() => { admittedRef.current = admitted; }, [admitted]);
  const [denied, setDenied] = useState(false);
  const [joinRequests, setJoinRequests] = useState([]);

  // ── Host / co-host authority ────────────────────────────────────────────────
  // Only the server can grant host authority; the local hint only starts the join flow.
  const [amHost, setAmHost] = useState(false);
  const [coHost, setCoHost] = useState(null); // { socketId, userId, userName } | null
  const [lockedOut, setLockedOut] = useState(false);
  const [roomFull, setRoomFull] = useState(false);
  const isCoHost = !!(coHost && coHost.userId === userId);
  const canHost = amHost || isCoHost; // current host authority, host OR co-host

  // ── Core media state ────────────────────────────────────────────────────────
  const [localStream, setLocalStream] = useState(null);
  const [peers, setPeers] = useState({}); // socketId → { userName, userId, stream }
  const [micMuted, setMicMuted] = useState(initialMedia?.audioEnabled === false);
  const [hostMuted, setHostMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(initialMedia?.videoEnabled === false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [screenSharerId, setScreenSharerId] = useState(null);   // socketId of the remote presenter, if any
  const [screenShareNotice, setScreenShareNotice] = useState('');
  const [noiseSuppressed, setNoiseSuppressed] = useState(true);
  const [roomLocked, setRoomLockedState] = useState(false);
  const [spotlightId, setSpotlightId] = useState('local');
  const [connectionError, setConnectionError] = useState('');
  const [mediaError, setMediaError] = useState('');
  const [devices, setDevices] = useState({ cameras: [], microphones: [], speakers: [] });
  const [selectedDevices, setSelectedDevices] = useState(initialMedia?.devices || {});
  const selectedDevicesRef = useRef(initialMedia?.devices || {});
  const initialMediaRef = useRef(initialMedia);
  const outgoingVideoRef = useRef(null);
  const peerQualityRef = useRef({});
  const applyPeerQuality = async (id,pc) => { for(const sender of pc.getSenders())if(sender.track?.kind==='video'&&sender.setParameters){try{const parameters=sender.getParameters();parameters.encodings=parameters.encodings?.length?parameters.encodings:[{}];parameters.encodings.forEach(encoding=>{encoding.maxBitrate=peerQualityRef.current[id]?350000:1800000;encoding.maxFramerate=peerQualityRef.current[id]?15:30;});await sender.setParameters(parameters);}catch{}} };

  const effectsRef = useRef(videoEffects); effectsRef.current = videoEffects;
  const mediaGenerationRef = useRef(0);
  const cameraOffRef = useRef(initialMedia?.videoEnabled === false);
  const cameraRequestRef = useRef(0);
  const micMutedRef = useRef(micMuted); micMutedRef.current = micMuted;
  const hostMutedRef = useRef(hostMuted); hostMutedRef.current = hostMuted;


  // ── Feature 3: Reactions + Hand Queue ──────────────────────────────────────
  // reactions: [{id, emoji, socketId, userName}] — floating emoji overlays
  const [reactions, setReactions] = useState([]);
  // handQueue: [{socketId, userName}] — ordered list of raised hands
  const [handQueue, setHandQueue] = useState([]);
  const reactionIdRef = useRef(0);

  // ── Feature 4: Network Quality ─────────────────────────────────────────────
  // 'good' | 'fair' | 'poor' | 'offline'
  const [networkQuality, setNetworkQuality] = useState('good');

  // ── Feature 6: Collaborative Notes ─────────────────────────────────────────
  const [sharedNotes, setSharedNotes] = useState('');

  // ── Feature: Media Share (YouTube / video URL) ─────────────────────────────
  const [sharedMediaUrl, setSharedMediaUrl] = useState('');
  const [sharedMediaKind,setSharedMediaKind]=useState('video');

  // ── Feature 7: Polls ───────────────────────────────────────────────────────
  const [polls, setPolls] = useState([]); // [{id, question, options, active}]
  // pollNotifications: popup shown to everyone EXCEPT the poll's creator the
  // moment a poll is launched. Auto-dismisses after 15s.
  const [pollNotifications, setPollNotifications] = useState([]);

  // ── Feature: File Sharing ──────────────────────────────────────────────────
  const [sharedFiles, setSharedFiles] = useState([]); // [{id, name, size, type, url, sharedBy, sharedAt}]
  // fileNotifications: recently-shared files shown as an auto-dismissing
  // popup for everyone in the room — populated only from the real-time
  // 'file-shared' broadcast, never from the on-join 'files-state' history
  // load, so joining a room with existing files doesn't spam popups.
  const [fileNotifications, setFileNotifications] = useState([]);

  // ── Feature: Meeting Agenda ─────────────────────────────────────────────────
  const [agendaItems, setAgendaItems] = useState([]); // [{id, title, done, createdBy}]
  const [agendaReady, setAgendaReady] = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const socketRef = useRef(null);
  // Tracks when the socket is created so consumers (e.g. Whiteboard) can
  // reliably receive the live socket reference via the public API.
  const [socketReady, setSocketReady] = useState(false);
  const pcsRef = useRef({});           // socketId → RTCPeerConnection
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const screenAudioMixRef = useRef(null);      // { ctx, track } — mic + screen audio mixed while sharing
  const iceServersRef = useRef(FALLBACK_ICE_SERVERS);
  const noiseSuppressedRef = useRef(true);
  const micMonitorRef = useRef(null);            // enabled clone of the muted mic, for the "you're talking while muted" meter
  const [micMonitorStream, setMicMonitorStream] = useState(null);      // browser noise suppression requested for every mic capture

  // ── Per-peer remote stream registry ────────────────────────────────────────
  // Keeps one stable MediaStream per remote peer so VideoTile's srcObject
  // never needs to be replaced — we just mutate the track list in place and
  // force a re-render by updating the peers state with a new stream wrapper.
  const remoteStreamsRef = useRef({}); // socketId → MediaStream
  const pendingCandidatesRef = useRef({}); // socketId → [candidate]

  // ── Peer connection factory ─────────────────────────────────────────────────
  // createPC creates a NEW RTCPeerConnection for socketId.
  // For renegotiation on an EXISTING connection use the 'offer' handler below.
  const createPC = useCallback((socketId, onStream) => {
    // Close any pre-existing PC for this peer before creating a new one
    if (pcsRef.current[socketId]) {
      pcsRef.current[socketId].close();
    }
    pendingCandidatesRef.current[socketId] = [];

    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });

    const local = localStreamRef.current;
    const screenTrack = screenStreamRef.current?.getVideoTracks()[0] || null;
    const audioTrack = screenAudioMixRef.current?.track || local?.getAudioTracks()[0];
    const rawVideo = local?.getVideoTracks().find(t => t.enabled && t.readyState === 'live');
    const videoTrack = screenTrack || (cameraOffRef.current ? null : outgoingVideoRef.current || (effectsRef.current ? null : rawVideo));
    if (audioTrack) pc.addTrack(audioTrack, local);
    else pc.addTransceiver('audio', { direction: 'sendrecv' });
    if (videoTrack) pc.addTrack(videoTrack, local);
    else pc.addTransceiver('video', { direction: 'sendrecv' });

    // Reuse or create a stable MediaStream for this peer.
    // Reusing the same object means the <video> srcObject stays valid;
    // we update its tracks in ontrack and force a re-render via onStream.
    if (!remoteStreamsRef.current[socketId]) {
      remoteStreamsRef.current[socketId] = new MediaStream();
    }
    const remoteStream = remoteStreamsRef.current[socketId];

    pc.ontrack = ({ track, streams }) => {
      // Replace any existing track of the same kind so we never accumulate
      // stale camera/screen tracks on the same stream object.
      remoteStream.getTracks()
        .filter(t => t.kind === track.kind)
        .forEach(t => remoteStream.removeTrack(t));
      remoteStream.addTrack(track);
      // Notify VideoTile by passing a NEW MediaStream wrapper that contains
      // the same underlying tracks — this changes the object reference so
      // VideoTile's useEffect re-runs and reassigns srcObject.
      onStream(new MediaStream(remoteStream.getTracks()));
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socketRef.current?.emit('ice-candidate', { to: socketId, candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if(pc.connectionState==='connected')applyPeerQuality(socketId,pc);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setPeers(prev => { const n = { ...prev }; delete n[socketId]; return n; });
        pc.close();
        delete pcsRef.current[socketId];
        delete remoteStreamsRef.current[socketId];
        delete pendingCandidatesRef.current[socketId];
      }
    };

    pcsRef.current[socketId] = pc;
    return pc;
  }, []);

  // ── Video-sender helpers (used by camera + screen share) ────────────────────
  // Senders are looked up through transceivers: a sender whose track is null
  // (camera off) can't be found with getSenders().find(s => s.track?.kind === 'video').

  /** Send a fresh offer on an existing connection (adds/enables a media line). */
  const renegotiate = useCallback(async (socketId, pc) => {
    try {
      if (pc.signalingState !== 'stable') {
        await new Promise((resolve) => {
          const done = () => {
            if (pc.signalingState === 'stable') { pc.removeEventListener('signalingstatechange', done); resolve(); }
          };
          pc.addEventListener('signalingstatechange', done);
          setTimeout(resolve, 4000);
        });
      }
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('offer', { to: socketId, offer });
    } catch (err) {
      console.error('Renegotiation failed:', err);
    }
  }, []);

  /**
   * Point one peer's outgoing video at `track` (camera, screen, or null to clear).
   * Uses replaceTrack when the video line is already negotiated for sending;
   * otherwise (peer joined while we had no camera, or the line is receive-only)
   * it enables the line and renegotiates.
   */
  const setPeerVideo = useCallback(async (socketId, pc, track) => {
    const tr = pc.getTransceivers().find(t => t.receiver.track.kind === 'video');
    const canSend = !!tr && tr.mid !== null &&
      (tr.currentDirection === 'sendrecv' || tr.currentDirection === 'sendonly');
    if (canSend || !track) {
      await tr?.sender.replaceTrack(track);
      return;
    }
    if (tr) {
      tr.direction = 'sendrecv';
      await tr.sender.replaceTrack(track);
    } else {
      pc.addTrack(track, localStreamRef.current || new MediaStream([track]));
    }
    await renegotiate(socketId, pc);
  }, [renegotiate]);

  // ── Main effect: media + socket ─────────────────────────────────────────────
  useEffect(() => {
    if (!roomCode || !enabled) return;
    let cancelled = false;

    const generation = ++mediaGenerationRef.current;
    setPeers({});setIsScreenSharing(false);setScreenStream(null);setScreenSharerId(null);
    const init = async () => {
      let stream = initialMediaRef.current?.stream;
      if (!stream || stream.getTracks().some(t => t.readyState === 'ended')) {
        const result = await acquireMeetingMedia({ devices: selectedDevicesRef.current, audio: initialMediaRef.current?.audioEnabled !== false, video: initialMediaRef.current?.videoEnabled !== false, noiseSuppression: noiseSuppressedRef.current });
        stream = result.stream;
        if (!cancelled) setMediaError(result.error);
      }
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
      // Camera-off lobby tracks must release the physical device, including older disabled streams.
      stream.getVideoTracks().forEach(track => {
        if (initialMediaRef.current?.videoEnabled === false || !track.enabled) {
          stream.removeTrack(track); track.stop();
        }
      });
      // A lobby stream may carry the browser default; show what the microphone actually does.
      const suppressing = stream.getAudioTracks()[0]?.getSettings?.().noiseSuppression;
      if (typeof suppressing === 'boolean') { noiseSuppressedRef.current = suppressing; setNoiseSuppressed(suppressing); }
      localStreamRef.current = stream;
      setLocalStream(new MediaStream(stream.getTracks()));
      const muted = !stream.getAudioTracks().some(t => t.enabled);
      setMicMuted(muted); micMutedRef.current = muted;
      cameraOffRef.current = !stream.getVideoTracks().some(t => t.enabled);
      setCameraOff(cameraOffRef.current);
      try { const available = await listMeetingDevices(); if (!cancelled) setDevices(available); } catch { /* Optional device list. */ }
      try {
        const { data } = await apiClient.get('/api/rooms/ice-servers');
        if (Array.isArray(data?.iceServers) && data.iceServers.length) iceServersRef.current = data.iceServers;
      } catch { /* Keep the fallback servers. */ }
      if (cancelled || generation !== mediaGenerationRef.current) return;

      const socketUrl =
        import.meta.env.VITE_SOCKET_URL ||
        import.meta.env.VITE_API_BASE_URL ||
        (typeof window !== 'undefined' ? window.location.origin : '');
      const socket = io(socketUrl || undefined, { transports: ['websocket', 'polling'], auth: { token: getAuthToken(), roomCode: normalizedCode } });
      socketRef.current = socket;
      setSocketReady(false);

      // ── Waiting Room Signaling ─────────────────────────────────────────────
      // Kept for everyone; the UI only shows them while this user holds host/co-host authority
      // (which can change mid-meeting via co-host, host transfer or a host returning in a new tab).
      socket.on('join-request', ({ socketId, userId: uId, userName: uName }) => {
        setJoinRequests(prev => {
          if (prev.some(r => r.socketId === socketId)) return prev;
          return [...prev, { socketId, userId: uId, userName: uName }];
        });
      });

      // The requester left the waiting room, or another host/co-host already answered.
      socket.on('join-request-cancelled', ({ socketId }) => {
        setJoinRequests(prev => prev.filter(r => r.socketId !== socketId));
      });

      // Server's view of my role on (re)join — restores host controls for a host who came back in a new tab.
      socket.on('your-role', ({ isHost: serverSaysHost }) => {
        setAmHost(!!serverSaysHost);
      });

      // Lets this tab rejoin without host approval after a server restart (kept per tab, like the host flag).
      socket.on('admission-ticket', ({ ticket }) => {
        try { sessionStorage.setItem(`etherx_ticket:${normalizedCode}`, ticket); } catch { /* storage unavailable */ }
      });
      const admissionTicket = () => { try { return sessionStorage.getItem(`etherx_ticket:${normalizedCode}`) || undefined; } catch { return undefined; } };

      socket.on('admitted', () => {
        admittedRef.current = true;
        setAdmitted(true);
        socket.emit('join-room', { roomCode: normalizedCode, userName: userNameRef.current, muted: micMutedRef.current, videoOff: !localStreamRef.current?.getVideoTracks().some(t => t.enabled), ticket: admissionTicket() });
        socket.emit('get-notes', { roomCode: normalizedCode });
        socket.emit('get-media', { roomCode: normalizedCode });
        socket.emit('get-files', { roomCode: normalizedCode });
        socket.emit('get-agenda', { roomCode: normalizedCode });
        socket.emit('get-polls', { roomCode: normalizedCode });
      });

      socket.on('denied', () => {
        setDenied(true);
      });

      // ── Core WebRTC signaling events ────────────────────────────────────────

      socket.on('peer-quality-request',({socketId,low})=>{peerQualityRef.current[socketId]=!!low;if(pcsRef.current[socketId])applyPeerQuality(socketId,pcsRef.current[socketId]);});
      socket.on('existing-users', async (users) => {
        for (const u of users) {
          const pc = createPC(u.socketId, (remoteStream) => {
            setPeers(prev => ({ ...prev, [u.socketId]: { ...prev[u.socketId], stream: remoteStream } }));
          });
          setPeers(prev => ({
            ...prev,
            [u.socketId]: {
              userName: u.userName,
              userId: u.userId,
              stream: null,
              isMuted: !!u.selfMuted,
              mutedByHost: !!u.hostMuted,
              videoOff: !!u.videoOff,
              isHost: !!u.isHost,
            },
          }));
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('offer', { to: u.socketId, offer });
        }
      });

      socket.on('user-joined', ({ socketId, userName: uName, userId: uId, isHost: peerIsHost, isMuted, mutedByHost, videoOff }) => {
        setPeers(prev => ({ ...prev, [socketId]: { userName: uName, userId: uId, stream: null, isHost: !!peerIsHost, isMuted: !!isMuted, mutedByHost: !!mutedByHost, videoOff: !!videoOff } }));
      });

      socket.on('offer', async ({ from, offer }) => {
        // If a PC already exists for this peer it is a renegotiation offer
        // (e.g. screen-share started). Reuse the existing connection instead
        // of creating a new one — creating a new PC would destroy the
        // established ICE connection and lose all existing tracks.
        let pc = pcsRef.current[from];
        if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
          pc = createPC(from, (remoteStream) => {
            setPeers(prev => ({ ...prev, [from]: { ...prev[from], stream: remoteStream } }));
          });
        } else {
          // Renegotiation: update the ontrack handler so new tracks from the
          // screen-share are delivered to the correct peers state entry.
          const onStream = (remoteStream) => {
            setPeers(prev => ({ ...prev, [from]: { ...prev[from], stream: remoteStream } }));
          };
          if (!remoteStreamsRef.current[from]) {
            remoteStreamsRef.current[from] = new MediaStream();
          }
          const remoteStream = remoteStreamsRef.current[from];
          pc.ontrack = ({ track }) => {
            remoteStream.getTracks()
              .filter(t => t.kind === track.kind)
              .forEach(t => remoteStream.removeTrack(t));
            remoteStream.addTrack(track);
            onStream(new MediaStream(remoteStream.getTracks()));
          };
        }
        await pc.setRemoteDescription(offer);

        // Drain any pending ICE candidates that arrived before the remote description was set
        if (pendingCandidatesRef.current[from]?.length) {
          for (const cand of pendingCandidatesRef.current[from]) {
            try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (e) { console.warn('Queued ICE failed:', e); }
          }
          pendingCandidatesRef.current[from] = [];
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { to: from, answer });
      });

      socket.on('answer', async ({ from, answer }) => {
        const pc = pcsRef.current[from];
        if (pc) {
          await pc.setRemoteDescription(answer);
          if (pendingCandidatesRef.current[from]?.length) {
            for (const cand of pendingCandidatesRef.current[from]) {
              try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (e) { console.warn('Queued ICE failed:', e); }
            }
            pendingCandidatesRef.current[from] = [];
          }
        }
      });

      socket.on('ice-candidate', async ({ from, candidate }) => {
        if (!candidate) return;
        const pc = pcsRef.current[from];
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.warn('Direct addIceCandidate failed:', e);
          }
        } else {
          if (!pendingCandidatesRef.current[from]) {
            pendingCandidatesRef.current[from] = [];
          }
          pendingCandidatesRef.current[from].push(candidate);
        }
      });

      socket.on('user-left', ({ socketId }) => {
        pcsRef.current[socketId]?.close();
        delete pcsRef.current[socketId];
        delete remoteStreamsRef.current[socketId];
        delete pendingCandidatesRef.current[socketId];
        setPeers(prev => { const n = { ...prev }; delete n[socketId]; return n; });
        setSpotlightId(id => id === socketId ? 'local' : id);
        setScreenSharerId(id => id === socketId ? null : id);
      });

      // ── Feature 1: Host controls ────────────────────────────────────────────

      // Apply a server-authorized host command to the local audio track.
      socket.on('participant-mute-command', ({ muted, mutedByHost }) => {
        localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !muted; });
        setMicMuted(!!muted); micMutedRef.current = !!muted;
        setHostMuted(!!mutedByHost); hostMutedRef.current = !!mutedByHost;
      });

      // Keep every remote tile synchronized with effective audio state.
      socket.on('participant-audio-state', ({ socketId, muted, mutedByHost }) => {
        setPeers(prev => prev[socketId]
          ? { ...prev, [socketId]: { ...prev[socketId], isMuted: !!muted, mutedByHost: !!mutedByHost } }
          : prev);
      });

      // Host has kicked us — invoke the caller-supplied callback
      socket.on('removed-from-room', () => {
        if (typeof onKicked === 'function') onKicked();
      });

      // Room lock state changed (by host) — broadcast to everyone including sender
      socket.on('room-locked', ({ locked }) => {
        setRoomLockedState(locked);
      });

      // This room is locked — my join/request-join was rejected before I got in.
      socket.on('room-locked-error', () => {
        setLockedOut(true);
      });

      // Shared files. The server echoes 'file-shared' to the sharer too, so everyone gets the popup
      // (auto-removed after 8s; the X button in the UI can dismiss it early).
      socket.on('file-shared', (entry) => {
        setSharedFiles(prev => prev.some(f => f.id === entry.id) ? prev : [...prev, entry]);
        setFileNotifications(prev => [...prev, entry]);
        setTimeout(() => setFileNotifications(prev => prev.filter(f => f.id !== entry.id)), 8000);
      });
      socket.on('files-state', ({ files }) => setSharedFiles(files || []));

      // Display the room capacity reported by the server.
      socket.on('room-full', ({ max }) => {
        setAdmitted(false); setRoomFull(true);
        setConnectionError(`This meeting is full (${max} people max). Try again when someone leaves.`);
      });

      // Co-host designation changed (host set or cleared it) — everyone is told.
      socket.on('co-host-changed', ({ socketId, userId: coUserId, userName: coName }) => {
        setCoHost(socketId ? { socketId, userId: coUserId, userName: coName } : null);
      });

      // The host disconnected and I (or someone else) was promoted to host.
      socket.on('host-transferred', ({ newHostUserId }) => {
        setCoHost(null);
        setAmHost(newHostUserId === userId);
        setPeers(prev => Object.fromEntries(Object.entries(prev).map(([id, peer]) => [id, { ...peer, isHost: peer.userId === newHostUserId }])));
      });

      // ── Feature 3: Reactions + Hand Queue ──────────────────────────────────

      // A remote participant sent a reaction emoji
      socket.on('reaction', ({ emoji, socketId, userName: uName } = {}) => {
        // Rendered as text in everyone's UI: ignore anything that is not a short string.
        if (typeof emoji !== 'string' || emoji.length > 16) return;
        const id = ++reactionIdRef.current;
        setReactions(prev => [...prev, { id, emoji, socketId, userName: uName }]);
        // Auto-remove after 3 seconds
        setTimeout(() => {
          setReactions(prev => prev.filter(r => r.id !== id));
        }, 3000);
      });

      // Ordered raised-hand queue (including my own), sent by the server on join and on every change
      socket.on('hands-state', ({ hands }) => {
        setHandQueue(hands || []);
      });

      // ── Camera State Sync ────────────────────────────────────────────────

      // A remote participant turned their camera on/off — track it so their
      // tile shows the avatar instead of freezing on the last video frame.
      socket.on('camera-toggled', ({ socketId, isOff }) => {
        setPeers(prev => prev[socketId]
          ? { ...prev, [socketId]: { ...prev[socketId], videoOff: isOff } }
          : prev);
      });

      // ── Screen share sync ─────────────────────────────────────────────────
      socket.on('screen-share-started', ({ socketId }) => setScreenSharerId(socketId));
      socket.on('screen-share-stopped', ({ socketId }) => setScreenSharerId(id => (id === socketId ? null : id)));
      socket.on('screen-share-state', ({ socketId }) => setScreenSharerId(socketId));

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
      socket.on('media-state', ({ url,kind }) => {
        setSharedMediaKind(kind || (/\.(mp3|wav|ogg|m4a|aac|flac)(\?|$)/i.test(url||'')?'audio':'video'));
        setSharedMediaUrl(url);
      });

      // Another participant shared a new media URL
      socket.on('media-shared', ({ url,kind }) => {
        setSharedMediaKind(kind || (/\.(mp3|wav|ogg|m4a|aac|flac)(\?|$)/i.test(url||'')?'audio':'video'));
        setSharedMediaUrl(url);
      });

      // ── Feature 7: Polls ────────────────────────────────────────────────────

      // A new poll was created
      socket.on('poll-created', (poll) => {
        console.log('[poll-created] received:', poll);
        setPolls(prev => [...prev, poll]);
        if (poll.createdById !== socket.id) {
          setPollNotifications(prev => [...prev, poll]);
          setTimeout(() => {
            setPollNotifications(prev => prev.filter(p => p.id !== poll.id));
          }, 15000);
        }
      });

      // A poll was updated (vote or end)
      socket.on('poll-updated', (updatedPoll) => {
        setPolls(prev => prev.map(p => p.id === updatedPoll.id ? updatedPoll : p));
      });

      // Existing polls on join
      socket.on('polls-state', ({ polls: existing }) => {
        setPolls(existing || []);
      });

      // ── Feature: Meeting Agenda ──────────────────────────────────────────────

      // Full agenda list on connect
      socket.on('agenda-state', ({ items }) => {
        setAgendaItems(items);
        setAgendaReady(true);
      });

      // Full agenda list after any add/toggle/reorder/delete
      socket.on('agenda-updated', (items) => {
        setAgendaItems(items);
      });

      /**
 * (Re)join the signaling room. Fires on the first connection AND on every
 * automatic socket.io reconnect (dropped wifi, laptop sleep, a backgrounded
 * tab getting throttled, etc.) — without this, a reconnected socket is never
 * re-added to the server's room, so a teammate's join-request would silently
 * never reach the host again, even though the host's tab looks fine.
 */
      const joinOrRequestJoin = () => {
        if (isHost || admittedRef.current) {
          socket.emit('join-room', { roomCode: normalizedCode, userName: userNameRef.current, muted: micMutedRef.current, videoOff: !localStreamRef.current?.getVideoTracks().some(t => t.enabled), ticket: admissionTicket() });
          socket.emit('get-notes', { roomCode: normalizedCode });
          socket.emit('get-media', { roomCode: normalizedCode });
          socket.emit('get-files', { roomCode: normalizedCode });
          socket.emit('get-agenda', { roomCode: normalizedCode });
          socket.emit('get-polls', { roomCode: normalizedCode });
        } else {
          socket.emit('request-join', { roomCode: normalizedCode, userName: userNameRef.current, ticket: admissionTicket() });
        }
      };
      // 'connect' fires for the initial connection too, so this alone covers both cases —
      // no separate one-off call is needed (that would double-fire on the first connect).
      // After a reconnect every socket id may be new (always so after a server restart, which cannot send
      // 'user-left' for sockets it never knew). Drop old peer connections; 'existing-users' rebuilds them.
      let connectedBefore = false;
      socket.on('connect', () => {
        if (connectedBefore) {
          Object.values(pcsRef.current).forEach(pc => pc.close());
          pcsRef.current = {}; remoteStreamsRef.current = {}; pendingCandidatesRef.current = {};
          setPeers({}); setSpotlightId('local'); setScreenSharerId(null);
        }
        connectedBefore = true;
        setSocketReady(true); setAgendaReady(false); setConnectionError(''); joinOrRequestJoin();
      });
      socket.on('connect_error', error => { setSocketReady(false); setConnectionError(error.message || 'Could not connect. Please check your connection and sign-in.'); });
      socket.on('disconnect', () => { setSocketReady(false); });
      socket.on('room-error', ({ message }) => setConnectionError(message));
    };

    init().catch(() => setConnectionError('Failed to initialize video call.'));

    return () => {
      cancelled = true;
      mediaGenerationRef.current++;
      cameraRequestRef.current++;
      Object.values(pcsRef.current).forEach(pc => pc.close());
      pcsRef.current = {};
      remoteStreamsRef.current = {};
      pendingCandidatesRef.current = {};
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      outgoingVideoRef.current = null;
      screenStreamRef.current?.getTracks().forEach(t => t.stop());screenStreamRef.current=null;
      screenAudioMixRef.current?.ctx.close().catch(() => { });screenAudioMixRef.current=null;
      socketRef.current?.disconnect();
    };
  }, [normalizedCode, userId, createPC, isHost, enabled]); // onKicked intentionally excluded to avoid reconnect loop

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

  const setOutgoingVideoTrack = useCallback(async track => {
    outgoingVideoRef.current = !cameraOffRef.current && track?.readyState === 'live' ? track : null;
    if (screenStreamRef.current) return;
    const raw = localStreamRef.current?.getVideoTracks().find(t => t.enabled && t.readyState === 'live');
    const outgoing = cameraOffRef.current ? null : outgoingVideoRef.current || (effectsRef.current ? null : raw) || null;
    await Promise.all(Object.entries(pcsRef.current).map(([id, pc]) => setPeerVideo(id, pc, outgoing).catch(() => {})));
  }, [setPeerVideo]);

  useEffect(() => {
    // Remove the raw sender as soon as effects turn on, before the canvas is ready.
    setOutgoingVideoTrack(videoEffects ? outgoingVideoRef.current : null);
  }, [videoEffects, setOutgoingVideoTrack]);

  const switchDevice = useCallback(async (kind, deviceId) => {
    if (kind === 'video' && cameraOffRef.current) {
      selectedDevicesRef.current = { ...selectedDevicesRef.current, video: deviceId };
      setSelectedDevices(selectedDevicesRef.current);
      return;
    }
    const generation = mediaGenerationRef.current;
    const cameraRequest = kind === 'video' ? ++cameraRequestRef.current : null;
    const capture = await navigator.mediaDevices.getUserMedia({ [kind]: kind === 'audio' ? audioConstraint(deviceId, noiseSuppressedRef.current) : deviceConstraint(deviceId) });
    if (generation !== mediaGenerationRef.current || !localStreamRef.current || (kind === 'video' && (cameraOffRef.current || cameraRequest !== cameraRequestRef.current))) { capture.getTracks().forEach(t => t.stop()); return; }
    const next = capture.getTracks()[0];
    const current = localStreamRef.current;
    const old = current.getTracks().filter(t => t.kind === kind);
    next.enabled = kind === 'audio' ? !micMutedRef.current && !hostMutedRef.current : true;
    if (kind === 'audio') {
      const mix = screenAudioMixRef.current;
      if (mix) {
        mix.micSource?.disconnect();
        mix.micSource = mix.ctx.createMediaStreamSource(new MediaStream([next]));
        mix.micSource.connect(mix.destination);
      }
      await Promise.all(Object.entries(pcsRef.current).map(async ([id, pc]) => {
        const tr = pc.getTransceivers().find(t => t.receiver.track.kind === 'audio');
        if (tr) { tr.direction = 'sendrecv'; await tr.sender.replaceTrack(mix?.track || next); }
        else pc.addTrack(next, current);
        if (!tr || tr.currentDirection !== 'sendrecv') await renegotiate(id, pc);
      }));
    }
    old.forEach(t => { current.removeTrack(t); t.stop(); });
    current.addTrack(next);
    selectedDevicesRef.current = { ...selectedDevicesRef.current, [kind]: deviceId };
    setSelectedDevices(selectedDevicesRef.current);
    setLocalStream(new MediaStream(current.getTracks()));
    if (kind === 'video') await setOutgoingVideoTrack(effectsRef.current ? outgoingVideoRef.current : null);
    setMediaError('');
  }, [renegotiate, setOutgoingVideoTrack]);

  const toggleMic = useCallback(async () => {
    if (hostMutedRef.current) return;
    const nextMuted = !micMutedRef.current;
    try {
      if (!nextMuted && !localStreamRef.current?.getAudioTracks().some(t => t.readyState === 'live')) {
        await switchDevice('audio', selectedDevicesRef.current.audio || 'default');
      }
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !nextMuted; });
      micMutedRef.current = nextMuted; setMicMuted(nextMuted);
      socketRef.current?.emit('microphone-state', { roomCode, muted: nextMuted });
    } catch { setMediaError('Could not enable microphone. Check browser permissions and retry.'); }
  }, [roomCode, switchDevice]);

  const toggleCamera = useCallback(async () => {
    const current = localStreamRef.current;
    if (!current) return;
    const request = ++cameraRequestRef.current;
    if (!cameraOffRef.current) {
      cameraOffRef.current = true;
      setCameraOff(true);
      current.getVideoTracks().forEach(t => { current.removeTrack(t); t.stop(); });
      setLocalStream(new MediaStream(current.getTracks()));
      socketRef.current?.emit('camera-toggled', { roomCode, isOff: true });
      await setOutgoingVideoTrack(null);
    } else {
      const generation = mediaGenerationRef.current;
      cameraOffRef.current = false;
      setCameraOff(false);
      try {
        const capture = await navigator.mediaDevices.getUserMedia({ video: deviceConstraint(selectedDevicesRef.current.video) });
        if (generation !== mediaGenerationRef.current || request !== cameraRequestRef.current || cameraOffRef.current) { capture.getTracks().forEach(t => t.stop()); return; }
        current.getVideoTracks().forEach(t => { current.removeTrack(t); t.stop(); });
        capture.getVideoTracks().forEach(t => current.addTrack(t));
        setCameraOff(false); setLocalStream(new MediaStream(current.getTracks()));
        await setOutgoingVideoTrack(null);
        if (generation !== mediaGenerationRef.current || request !== cameraRequestRef.current || cameraOffRef.current) return;
        socketRef.current?.emit('camera-toggled', { roomCode, isOff: false });
        setMediaError('');
      } catch {
        if (generation !== mediaGenerationRef.current || request !== cameraRequestRef.current) return;
        cameraOffRef.current = true;
        setCameraOff(true);
        setMediaError('Could not enable camera. Check browser permissions and retry.');
      }
    }
  }, [roomCode, setOutgoingVideoTrack]);

  // While muted, keep an enabled private clone of the mic so the room can warn "you're talking while muted".
  useEffect(() => {
    const track = localStream?.getAudioTracks()[0];
    if (!track || track.readyState !== 'live' || !micMuted || hostMuted) return undefined;
    const clone = track.clone(); clone.enabled = true;
    micMonitorRef.current = clone;
    setMicMonitorStream(new MediaStream([clone]));
    return () => { clone.stop(); if (micMonitorRef.current === clone) micMonitorRef.current = null; setMicMonitorStream(null); };
  }, [localStream, micMuted, hostMuted]);

  /**
   * Noise suppression uses the browser's own WebRTC audio processing. Browsers do not reliably change it on a
   * live track, so the microphone is captured again with the new setting through the normal device-switch path
   * (keeps mute state, peer senders and any screen-audio mix).
   */
  const toggleNoiseSuppression = useCallback(async () => {
    const next = !noiseSuppressedRef.current;
    noiseSuppressedRef.current = next;
    setNoiseSuppressed(next);
    if (!localStreamRef.current?.getAudioTracks().some(t => t.readyState === 'live')) return;
    try {
      // Chrome shares one audio source per device and ignores applyConstraints for processing: a new capture
      // keeps the old setting while any track on the microphone is still open, so release them all first.
      micMonitorRef.current?.stop(); micMonitorRef.current = null;
      localStreamRef.current.getAudioTracks().forEach(t => t.stop());
      await switchDevice('audio', selectedDevicesRef.current.audio || 'default');
    } catch {
      noiseSuppressedRef.current = !next;
      setNoiseSuppressed(!next);
      setMediaError('Could not change noise suppression. Check microphone permissions and retry.');
    }
  }, [switchDevice]);

  // ── Screen sharing ─────────────────────────────────────────────────────────

  const showScreenNotice = useCallback((msg) => {
    setScreenShareNotice(msg);
    setTimeout(() => setScreenShareNotice(''), 4000);
  }, []);

  /** Stop presenting. Refs only, so it is safe from the browser's own "Stop sharing" bar. */
  const stopScreenShare = useCallback(async () => {
    const screen = screenStreamRef.current;
    if (!screen) return;
    screenStreamRef.current = null;
    setScreenStream(null);
    screen.getTracks().forEach(t => { t.onended = null; t.stop(); });

    const mix = screenAudioMixRef.current;
    screenAudioMixRef.current = null;
    const micTrack = localStreamRef.current?.getAudioTracks()[0] || null;
    // Back to the camera — or null when the camera is off, which clears the ended screen frame.
    const camTrack = cameraOffRef.current ? null : outgoingVideoRef.current || (effectsRef.current ? null : localStreamRef.current?.getVideoTracks().find(t => t.enabled)) || null;

    await Promise.all(Object.entries(pcsRef.current).map(async ([id, pc]) => {
      try {
        if (mix && micTrack) {
          await pc.getTransceivers().find(t => t.receiver.track.kind === 'audio')?.sender.replaceTrack(micTrack);
        }
        await setPeerVideo(id, pc, camTrack);
      } catch (err) {
        console.warn('Could not restore outgoing tracks for', id, err);
      }
    }));

    mix?.ctx.close().catch(() => { });
    socketRef.current?.emit('screen-share-stop', { roomCode });
    setIsScreenSharing(false);
  }, [roomCode, setPeerVideo]);

  const startScreenShare = useCallback(async () => {
    if (screenStreamRef.current) return;
    if (screenSharerId) {
      showScreenNotice('Someone else is already sharing their screen');
      return;
    }

    let screen;
    try {
      screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    } catch {
      return; // picker cancelled or permission denied
    }
    const screenTrack = screen.getVideoTracks()[0];

    // One presenter at a time — the server decides.
    const reply = await new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket) { resolve({ ok: true }); return; }
      const timer = setTimeout(() => resolve({ ok: true }), 2500); // server without this event
      socket.emit('screen-share-start', { roomCode }, (res) => { clearTimeout(timer); resolve(res || { ok: true }); });
    });
    if (!reply.ok) {
      screen.getTracks().forEach(t => t.stop());
      showScreenNotice(reply.error || `${reply.by || 'Someone else'} is already sharing their screen`);
      return;
    }

    screenTrack.contentHint = 'detail';                 // favour sharp text over frame rate
    screenStreamRef.current = screen;
    setScreenStream(screen);
    screenTrack.onended = () => { stopScreenShare(); }; // browser "Stop sharing" bar

    // Screen/tab audio: mix it with the mic and send it through the existing audio line.
    const screenAudio = screen.getAudioTracks()[0];
    const mic = localStreamRef.current?.getAudioTracks()[0];
    let mixTrack = null;
    if (screenAudio && mic) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        ctx.resume().catch(() => { });
        const dest = ctx.createMediaStreamDestination();
        const micSource = ctx.createMediaStreamSource(new MediaStream([mic]));
        micSource.connect(dest);
        ctx.createMediaStreamSource(new MediaStream([screenAudio])).connect(dest);
        mixTrack = dest.stream.getAudioTracks()[0];
        screenAudioMixRef.current = { ctx, track: mixTrack, micSource, destination: dest };
      } catch (err) {
        console.warn('Screen audio mix failed, sharing video only:', err);
      }
    }

    await Promise.all(Object.entries(pcsRef.current).map(async ([id, pc]) => {
      try {
        await setPeerVideo(id, pc, screenTrack);
        if (mixTrack) {
          await pc.getTransceivers().find(t => t.receiver.track.kind === 'audio')?.sender.replaceTrack(mixTrack);
        }
      } catch (err) {
        console.warn('Could not send screen to', id, err);
      }
    }));
    setIsScreenSharing(true);
  }, [roomCode, screenSharerId, setPeerVideo, stopScreenShare, showScreenNotice]);

  const toggleScreenShare = useCallback(
    () => (screenStreamRef.current ? stopScreenShare() : startScreenShare()),
    [startScreenShare, stopScreenShare],
  );

  // ── Feature 1: Host control emitters ───────────────────────────────────────

  /** Host or co-host: mute a remote participant by socket ID. */
  const muteParticipant = useCallback((socketId) => {
    if (!canHost) return;
    socketRef.current?.emit('mute-participant', { roomCode, to: socketId });
  }, [roomCode, canHost]);

  /** Host or co-host: release a remote participant's host-controlled mute. */
  const unmuteParticipant = useCallback((socketId) => {
    if (!canHost) return;
    socketRef.current?.emit('unmute-participant', { roomCode, to: socketId });
  }, [roomCode, canHost]);

  /** Host or co-host: remove a remote participant from the room. */
  const kickParticipant = useCallback((socketId) => {
    if (!canHost) return;
    socketRef.current?.emit('kick-participant', { to: socketId });
  }, [canHost]);

  /** Host or co-host: lock or unlock the room. */
  const setRoomLocked = useCallback((locked) => {
    if (!canHost) return;
    socketRef.current?.emit('lock-room', { roomCode, locked });
  }, [roomCode, canHost]);

  /** Host only: designate a co-host. Replaces any existing co-host. */
  const makeCoHost = useCallback((socketId) => {
    if (!amHost) return;
    socketRef.current?.emit('make-co-host', { roomCode, socketId });
  }, [roomCode, amHost]);

  /** Host only: revoke the current co-host. */
  const removeCoHost = useCallback(() => {
    if (!amHost) return;
    socketRef.current?.emit('remove-co-host', { roomCode });
  }, [roomCode, amHost]);

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

  /** Raise the local user's hand. */
  const sendHandRaise = useCallback(() => {
    socketRef.current?.emit('raise-hand');
  }, []);

  /** Lower the local user's hand, or (host/co-host) someone else's by socket ID. */
  const sendHandLower = useCallback((socketId) => {
    socketRef.current?.emit('lower-hand', socketId ? { socketId } : {});
  }, []);

  // ── Feature 6: Notes emitter ────────────────────────────────────────────────

  /** Broadcast updated shared notes to all participants. */
  const updateNotes = useCallback((text) => {
    setSharedNotes(text);
    socketRef.current?.emit('update-notes', { roomCode, notes: text });
  }, [roomCode]);

  // ── Feature: Media Share emitter ────────────────────────────────────────────

  /** Share a video URL with everyone in the room. */
  const shareMedia = useCallback((url,kind='video') => {
    setSharedMediaKind(kind);setSharedMediaUrl(url);
    socketRef.current?.emit('share-media', { roomCode, url,kind });
  }, [roomCode]);

  // ── Feature 7: Poll emitters ────────────────────────────────────────────────

  /** Host: create a new poll. options is an array of option strings. */
  const createPoll = useCallback((question, options) => {
    const s = socketRef.current;
    console.log('[createPoll] socket:', s?.id, 'connected:', s?.connected, 'roomCode:', roomCode, 'q:', question, 'opts:', options);
    s?.emit('create-poll', { roomCode, question, options });
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
    if (!canHost) return;
    socketRef.current?.emit('admit-user', { toSocketId: socketId, roomCode: normalizedCode });
    setJoinRequests(prev => prev.filter(r => r.socketId !== socketId));
  }, [canHost, normalizedCode]);

  const denyUser = useCallback((socketId) => {
    if (!canHost) return;
    socketRef.current?.emit('deny-user', { toSocketId: socketId, roomCode: normalizedCode });
    setJoinRequests(prev => prev.filter(r => r.socketId !== socketId));
  }, [canHost, normalizedCode]);

  // ── Feature: File Sharing callbacks ─────────────────────────────────────────

  // Files go over HTTP (the server tells the room about them); bytes never travel through the meeting socket.
  const shareFile = useCallback(async (file) => {
    const form = new FormData();
    form.append('file', file, file.name);
    await apiClient.post(`/api/rooms/${encodeURIComponent(normalizedCode)}/files`, form);
  }, [normalizedCode]);

  const downloadFile = useCallback(async (file) => {
    const res = await apiClient.get(`/api/rooms/${encodeURIComponent(normalizedCode)}/files/${file.id}`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const link = Object.assign(document.createElement('a'), { href: url, download: file.name });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [normalizedCode]);

  /** Dismiss a poll popup notification before its 15s auto-timeout. */
  const dismissPollNotification = useCallback((id) => {
    setPollNotifications(prev => prev.filter(p => p.id !== id));
  }, []);

  /** Dismiss a file-share popup notification before its 8s auto-timeout. */
  const dismissFileNotification = useCallback((id) => {
    setFileNotifications(prev => prev.filter(f => f.id !== id));
  }, []);

  // ── Feature: Meeting Agenda emitters ────────────────────────────────────────

  /** Add a new topic to the agenda (host adds topics before/during the meeting). */
  const addAgendaItem = useCallback((title) => {
    socketRef.current?.emit('add-agenda-item', { roomCode, title });
  }, [roomCode]);

  /** Mark an agenda item done/not-done — presenter uses this during the meeting. */
  const toggleAgendaItem = useCallback((id) => {
    socketRef.current?.emit('toggle-agenda-item', { roomCode, id });
  }, [roomCode]);

  /** Reorder the agenda — pass the full array of item ids in the new order. */
  const reorderAgenda = useCallback((orderedIds) => {
    socketRef.current?.emit('reorder-agenda', { roomCode, orderedIds });
  }, [roomCode]);

  /** Remove an agenda item entirely. */
  const deleteAgendaItem = useCallback((id) => {
    socketRef.current?.emit('delete-agenda-item', { roomCode, id });
  }, [roomCode]);

  // ── Public API ──────────────────────────────────────────────────────────────

  return {
    // Core
    socket: socketRef.current,
    socketReady,
    peerConnections: pcsRef,
    localStream, peers, screenStream,
    micMuted, hostMuted, cameraOff, isScreenSharing, screenSharerId, screenShareNotice,
    spotlightId, setSpotlightId,
    toggleMic, toggleCamera, toggleScreenShare,
    toggleNoiseSuppression, noiseSuppressed, micMonitorStream,
    userName, connectionError, mediaError, devices, selectedDevices, switchDevice, setOutgoingVideoTrack,
    // Waiting Room / Admission
    admitted, denied, joinRequests, admitUser, denyUser, lockedOut, roomFull,
    // Feature 1: Host Controls
    muteParticipant, unmuteParticipant, kickParticipant, setRoomLocked, roomLocked,
    // Co-host
    amHost, canHost, isCoHost, coHost, makeCoHost, removeCoHost,
    // Feature 3: Reactions + Hand Queue
    reactions, handQueue, mySocketId: socketRef.current?.id,
    sendReaction, sendHandRaise, sendHandLower,
    // Feature 4: Network Quality
    networkQuality,
    // Feature 6: Collaborative Notes
    sharedNotes, updateNotes,
    // Feature: Media Share
    sharedMediaUrl, sharedMediaKind, shareMedia,
    // Feature 7: Polls
    polls, createPoll, votePoll, endPoll, pollNotifications, dismissPollNotification,
    // Feature: File Sharing
    sharedFiles, shareFile, downloadFile, fileNotifications, dismissFileNotification,
    // Feature: Meeting Agenda
    agendaItems, agendaReady, addAgendaItem, toggleAgendaItem, reorderAgenda, deleteAgendaItem,
    // Socket ref — exposed so panels can subscribe to room-scoped events
    socketRef,
    updateDisplayName: name => { userNameRef.current = name; },
  };
}
