// frontend/src/components/video/VideoRoom.jsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, Lock, MonitorUp, Circle, LayoutGrid, UserPlus, Smile, Presentation, Info, Gauge, Maximize, Captions, ChartNoAxesColumn, File, Music, MicOff, Image, Settings, Keyboard, Shield, MessageSquare } from 'lucide-react';
import RoomStage from '../room/RoomStage';
import RoomControls from '../room/RoomControls';
import RoomMoreMenu from '../room/RoomMoreMenu';
import ShareMediaDialog from '../room/ShareMediaDialog';
import '../../styles/meeting-room.css';
import MeetingSettings from '../room/MeetingSettings';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { playSpeakerTest, setAudioOutput } from '../../utils/meetingMedia';
import { copyMeetingText } from '../../utils/meetingClipboard';
import '../../styles/meeting.css';
import MeetingAgenda from '../MeetingAgenda';

import { useWebRTC } from '../../hooks/useWebRTC';
import { useWallet } from '../../context/WalletContext';
import { useMeetingRecording } from '../../hooks/useMeetingRecording';
import VideoCanvasProcessor from './VideoCanvasProcessor';
import VerifiedChat from '../web3/VerifiedChat';
import MeetingNotesModal from '../web3/MeetingNotesModal';
import CaptionsOverlay from '../room/CaptionsOverlay';
import Whiteboard from '../features/Whiteboard';
import { ROUTES } from '../../utils/constants';
import apiClient from '../../utils/apiClient';
import { getStoredUser } from '../../utils/auth';
import etherxLogo from '../../assets/etherx_transparent.png';

const AVATAR_COLORS = ['#2a2519', '#30291c', '#332b19', '#29261d'];
function avatarColor(n) { return AVATAR_COLORS[(n || 'A').charCodeAt(0) % AVATAR_COLORS.length]; }
function fmtTime(s) { return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
function fmtTitle(code) { if (!code) return 'EtherX Meet'; return code.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); }

const VIDEO_EXTS = ['mp4', 'webm', 'ogv', 'mov', 'm4v'];
const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'];
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'];

/** Classify a shared URL/filename into how it should render: youtube embed, native video/audio/image, or a plain link fallback. */
function classifyMedia(input) {
  if (!input) return { type: 'link' };
  const ytMatch = input.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/);
  if (ytMatch) return { type: 'youtube', id: ytMatch[1] };
  const ext = input.split('?')[0].split('.').pop().toLowerCase();
  if (VIDEO_EXTS.includes(ext)) return { type: 'video' };
  if (AUDIO_EXTS.includes(ext)) return { type: 'audio' };
  if (IMAGE_EXTS.includes(ext)) return { type: 'image' };
  return { type: 'link' };
}

const CONFETTI_COLORS = ['var(--meeting-gold)', '#e5c76b', '#b8860b', 'var(--meeting-gold)', '#e5c76b', '#b8860b', 'var(--meeting-gold)'];
const CONFETTI = Array.from({ length: 80 }).map((_, i) => ({
  x: (i * 37 + 11) % 100, w: 6 + (i % 5) * 2, h: 6 + (i % 4) * 3,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  round: i % 3 === 0, rot: (i * 47) % 360, d: 1.5 + (i % 5) * 0.4, delay: (i * 0.05) % 2,
}));

// Plays one remote participant's audio, independent of their video tile. Tiles
// only mount a <video> while the camera is on, so without this a teammate with
// their camera off (or joined audio-only) would be completely silent.
function RemoteAudio({ stream, outputDevice, onError }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
      ref.current.play().catch(() => { });
    }
  }, [stream]);
  useEffect(() => { setAudioOutput(ref.current, outputDevice).catch(() => onError('Could not use selected speaker. Check device access in your browser.')); }, [outputDevice, onError]);
  return <audio ref={ref} autoPlay />;
}

export default function VideoRoom({ roomCode, isHost, initialMedia, preferences, savePreferences }) {
  const navigate = useNavigate();
  const { account } = useWallet();
  const [chatOpen, setChatOpen] = useState(false);
  const [panelTab, setPanelTab] = useState('chat');
  const [chatUnread, setChatUnread] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [participantQuery,setParticipantQuery]=useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const inviteRef = useRef(null);
  useDialogFocus(inviteRef, ()=>setInviteOpen(false), inviteOpen);
  const [showNotes, setShowNotes] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [modalTab, setModalTab] = useState('audio');
  const [gridView, setGridView] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [handToastDismissed, setHandToastDismissed] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [captionsDemand, setCaptionsDemand] = useState(false); // someone in the room has captions on
  const [toast, setToast] = useState(null);
  const activeFilter = preferences.filter;
  const selectedBgImage = preferences.background;
  const [myVotes, setMyVotes] = useState({});
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollView, setPollView] = useState('list'); // 'list' | 'create' | 'results'
  const [viewingPollId, setViewingPollId] = useState(null);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const toastTimerRef = useRef(null);
  const showToast = useCallback(msg => { setToast(msg); clearTimeout(toastTimerRef.current); toastTimerRef.current = setTimeout(() => setToast(null), 4000); }, []);
  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  useEffect(() => {
    const start = Date.now(); // stopwatch starts at 00:00 every time you enter a meeting
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);


  const handleKicked = useCallback(() => {
    sessionStorage.removeItem('etherx_host_room');
    navigate(ROUTES.DASHBOARD);
  }, [navigate]);

  const {
    socket, socketReady,
    localStream, peers, screenStream, micMuted, hostMuted, cameraOff, isScreenSharing,
    spotlightId, setSpotlightId, toggleMic, toggleCamera, toggleScreenShare,
    muteParticipant, unmuteParticipant,
    screenSharerId, screenShareNotice,
    toggleNoiseSuppression, noiseSuppressed,
    setRoomLocked, roomLocked,
    sharedMediaUrl, shareMedia,
    userName, connectionError, mediaError, devices, selectedDevices, switchDevice, setOutgoingVideoTrack, reactions,
    handQueue, mySocketId, sendReaction, sendHandRaise, sendHandLower, polls, createPoll, votePoll, endPoll, updateNotes,
    pollNotifications, dismissPollNotification,
    admitted, denied, joinRequests, admitUser, denyUser, lockedOut,
    amHost, canHost, isCoHost, coHost, makeCoHost, removeCoHost, networkQuality,
    sharedFiles, shareFile, fileNotifications, dismissFileNotification,
    kickParticipant, agendaItems, agendaReady, addAgendaItem, toggleAgendaItem, deleteAgendaItem,
  } = useWebRTC(roomCode, { onKicked: handleKicked, isHost, initialMedia, videoEffects: activeFilter !== 'none' || selectedBgImage !== 'none' });
  useEffect(() => {
    const readingChat = chatOpen && panelTab === 'chat';
    if (readingChat) setChatUnread(false);
    const receive = message => {
      if (message.roomCode === roomCode && !readingChat && String(message.senderId) !== String(getStoredUser()?.id)) setChatUnread(true);
    };
    socket?.on('chat:message-created', receive);
    return () => socket?.off('chat:message-created', receive);
  }, [socket, roomCode, chatOpen, panelTab]);
  const receiveProcessedStream = useCallback(output => { setOutgoingVideoTrack(output?.getVideoTracks()[0] || null); }, [setOutgoingVideoTrack]);

  const {
    recordingState,
    recordingError,
    isRecording,
    startRecording,
    stopRecording,
  } = useMeetingRecording({
    roomCode,
    isHost: canHost,
    localStream,
    screenStream,
    peers,
    userName,
    socket,
    socketReady,
    onError: showToast,
  });

  const [selfViewHidden, setSelfViewHidden] = useState(false);
  const [mediaStageMinimized, setMediaStageMinimized] = useState(false);
  const [sharingMediaKind, setSharingMediaKind] = useState(null);
  const agendaSeedRef = useRef(false);
  const agendaTopics = agendaItems.map(item => ({ ...item, completed: item.done }));
  useEffect(() => {
    if (!canHost || !agendaReady || agendaSeedRef.current) return;
    agendaSeedRef.current = true;
    if (agendaItems.length) return;
    try { JSON.parse(sessionStorage.getItem(`etherx_agenda:${roomCode}`) || '[]').forEach(topic => addAgendaItem(topic.title)); } catch { /* Invalid saved agenda. */ }
  }, [canHost, agendaReady, agendaItems, addAgendaItem, roomCode]);
  const handleAgendaChange = (topics) => {
    topics.forEach(topic => {
      const current = agendaTopics.find(item => item.id === topic.id);
      if (!current) addAgendaItem(topic.title);
      else if (current.completed !== topic.completed) toggleAgendaItem(topic.id);
    });
    agendaTopics.filter(item => !topics.some(topic => topic.id === item.id)).forEach(item => deleteAgendaItem(item.id));
  };

  useEffect(() => {
    if (sharedMediaUrl) setMediaStageMinimized(false);
  }, [sharedMediaUrl]);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const feedbackRef = useRef(null);
  useDialogFocus(feedbackRef, () => setFeedbackOpen(false), feedbackOpen);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);


  const handleEnd = () => {
    if (isRecording) stopRecording();
    if (canHost) { setShowNotes(true); return; }
    sessionStorage.removeItem('etherx_host_room');
    navigate(ROUTES.DASHBOARD);
  };
  const handleNotesDone = () => {
    setShowNotes(false);
    sessionStorage.removeItem('etherx_host_room');
    navigate(ROUTES.DASHBOARD);
  };
  const handleCopyLink = async () => { try { await copyMeetingText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { showToast('Could not copy link. Copy it from the address bar.'); } };
  const handleCopyCode = async () => { try { await copyMeetingText(roomCode || ''); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); } catch { showToast('Could not copy room code.'); } };
  // Raised hands come from the server's ordered queue, so every participant sees the same order.
  const handPos = (socketId) => handQueue.findIndex(h => h.socketId === socketId) + 1; // 0 = not raised
  const myHandPos = mySocketId ? handPos(mySocketId) : 0;
  const raised = myHandPos > 0;
  const handleRaiseHand = () => { if (raised) { sendHandLower?.(); } else { setHandToastDismissed(false); sendHandRaise?.(); } };
  const handleFeedbackSubmit = async () => {
    if (!feedbackText.trim() || feedbackSubmitting) return;
    setFeedbackSubmitting(true);
    try {
      await apiClient.post('/api/feedback', { text: feedbackText.trim(), roomCode });
      setFeedbackOpen(false);
      setFeedbackText('');
      showToast('Thank you for your feedback!');
    } catch {
      showToast('Failed to send feedback — please try again.');
    }
    setFeedbackSubmitting(false);
  };

  const talkingRef = useRef(false);
  useEffect(() => {
    const editable = event => event.target.closest?.('input,textarea,select,[contenteditable="true"],[role="dialog"]');
    const down = event => {
      if (editable(event) || document.querySelector('[role="dialog"]') || showSettingsModal || feedbackOpen || showNotes || event.repeat) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'e') { event.preventDefault(); handleEnd(); return; }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.toLowerCase() === 'm') { event.preventDefault(); toggleMic(); }
      if (event.key.toLowerCase() === 'v') { event.preventDefault(); toggleCamera(); }
      if (event.code === 'Space' && micMuted && !hostMuted && event.target === document.body) { event.preventDefault(); talkingRef.current = true; toggleMic(); }
    };
    const up = event => { if (event.code === 'Space' && talkingRef.current) { event.preventDefault(); talkingRef.current = false; toggleMic(); } };
    const blur = () => { if (talkingRef.current) { talkingRef.current = false; toggleMic(); } };
    document.addEventListener('keydown', down); document.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { document.removeEventListener('keydown', down); document.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [toggleMic, toggleCamera, micMuted, hostMuted, showSettingsModal, feedbackOpen, showNotes, canHost, isRecording]);

  const peerList = Object.entries(peers);

  const previousPeersRef = useRef(new Map());
  useEffect(() => {
    const next = new Map(peerList.map(([id, peer]) => [id, peer.userName]));
    const changes = [];
    next.forEach((name, id) => { if (!previousPeersRef.current.has(id)) changes.push(`${name || 'Someone'} joined the meeting`); });
    previousPeersRef.current.forEach((name, id) => { if (!next.has(id)) changes.push(`${name || 'Someone'} left the meeting`); });
    previousPeersRef.current = next;
    changes.forEach(message => {
      if (preferences.notifications.banners) showToast(message);
      if (preferences.notifications.sound) playSpeakerTest(preferences.outputDevice).catch(() => {});
      if (preferences.notifications.desktop && document.hidden && window.Notification?.permission === 'granted') new Notification('EtherX Meet', { body: message });
    });
  }, [peers, preferences.notifications.banners, preferences.notifications.sound, preferences.notifications.desktop, preferences.outputDevice, showToast]);

  // Let the person know when they gain host authority they didn't start the meeting with.
  const wasPrivilegedRef = useRef(isHost);
  useEffect(() => {
    if (!isHost && canHost && !wasPrivilegedRef.current) {
      showToast(isCoHost ? "You're now a co-host." : 'You are now the host.');
    }
    wasPrivilegedRef.current = canHost;
  }, [canHost, isCoHost, isHost]);

  // Only the ORIGINAL host (or someone promoted to host via transfer) can name/replace a
  // co-host — a co-host themselves cannot name a further co-host.
  const canManageCoHost = canHost && !isCoHost;

  // When someone else starts presenting, put their screen on the main stage
  useEffect(() => {
    if (screenSharerId) { setSpotlightId(screenSharerId); setGridView(false); }
  }, [screenSharerId, setSpotlightId]);

  // ── Live captions (room-wide) ──────────────────────────────────────────────
  // The server tells everyone when captions are switched on/off in the room. While they are on,
  // CaptionsOverlay transcribes this user's own mic (unless muted) so everyone's speech is captioned.
  useEffect(() => {
    if (!socket) return undefined;
    const onDemand = (d) => setCaptionsDemand(!!(d && d.active));
    const onOffline = () => setCaptionsDemand(false); // the server re-announces it when we rejoin
    socket.on('captions-demand', onDemand);
    socket.on('disconnect', onOffline);
    return () => { socket.off('captions-demand', onDemand); socket.off('disconnect', onOffline); };
  }, [socket]);

  const prevCaptionsDemandRef = useRef(false);
  useEffect(() => {
    if (captionsDemand && !prevCaptionsDemandRef.current && !captionsOn) {
      showToast('Live captions were turned on for this meeting — your speech is captioned while your mic is on.');
    }
    prevCaptionsDemandRef.current = captionsDemand;
  }, [captionsDemand]);

  // Tell everyone when someone else raises their hand.
  const prevHandIdsRef = useRef(new Set());
  useEffect(() => {
    const ids = new Set(handQueue.map(h => h.socketId));
    handQueue
      .filter(h => !prevHandIdsRef.current.has(h.socketId) && h.socketId !== mySocketId)
      .forEach(h => showToast(`✋ ${h.userName || 'Someone'} raised their hand`));
    prevHandIdsRef.current = ids;
  }, [handQueue, mySocketId]);
  const totalP = 1 + peerList.length;
  const initial = (userName || 'Y').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const settingsModal = showSettingsModal && <MeetingSettings initialTab={modalTab} preferences={preferences} onSave={savePreferences}
    onClose={() => setShowSettingsModal(false)} stream={localStream} audioEnabled={!micMuted && !hostMuted} videoEnabled={!cameraOff}
    devices={devices} selectedDevices={selectedDevices} switchDevice={switchDevice} name={userName}/>;
  const retryConnection = () => socket?.connect();
  if (!admitted) {
    return (
      <div className="exmeet-waiting" data-meeting-theme={preferences.theme} style={{ position: 'fixed', inset: 0, background: "radial-gradient(1200px 700px at 12% -10%,rgba(212,175,55,.12),transparent 60%),radial-gradient(900px 600px at 105% 15%,rgba(212,175,55,.08),transparent 55%),var(--meeting-bg)", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'Instrument Sans',sans-serif", color: 'var(--meeting-text)', padding: 20 }}>
        <style>{`@keyframes wait-ping{0%,100%{transform:scale(1);opacity:1;}70%,100%{transform:scale(2.5);opacity:0;}}`}</style>
        <div style={{ maxWidth: 480, width: '100%', background: 'rgba(212,175,55,.04)', backdropFilter: 'blur(20px)', border: '1px solid rgba(212,175,55,.12)', borderRadius: 24, padding: '40px 32px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,.5)' }}>
          <img src={etherxLogo} alt="EtherX" style={{ width: 140, marginBottom: 30 }} />
          {denied || lockedOut ? (
            <>
              <div style={{ width: 64, height: 64, borderRadius: 32, background: 'rgba(239,68,68,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', border: '1px solid rgba(239,68,68,.2)' }}><span style={{ fontSize: 32 }}>🛑</span></div>
              <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 12, color: '#fca5a5' }}>{lockedOut ? 'Room Locked' : 'Entry Denied'}</h2>
              <p style={{ fontSize: 14, color: 'var(--meeting-muted)', lineHeight: 1.5, marginBottom: 28 }}>{lockedOut ? 'The host has locked this meeting. No new participants can join right now.' : 'The host has denied your request to join this meeting room.'}</p>
              <button onClick={() => navigate(ROUTES.DASHBOARD)} style={{ width: '100%', padding: 14, borderRadius: 12, background: 'linear-gradient(135deg,#b8860b,#e5c76b)', color: '#1a1608', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: "'Instrument Sans',sans-serif" }}>Return to Dashboard</button>
            </>
          ) : (
            <>
              {localStream && (<div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: 16, overflow: 'hidden', background: 'var(--meeting-bg)', marginBottom: 24, border: '1px solid rgba(212,175,55,.15)' }}><video ref={el => { if (el) el.srcObject = localStream; }} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} /><div style={{ position: 'absolute', bottom: 12, left: 12, fontSize: 11, background: 'rgba(0,0,0,.6)', padding: '4px 8px', borderRadius: 6, color: 'rgba(255,255,255,.8)' }}>Self View Preview</div></div>)}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 99, background: 'rgba(212,175,55,.1)', border: '1px solid rgba(212,175,55,.2)', color: '#e5c76b', fontSize: 12, fontWeight: 500, marginBottom: 20 }}>
                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#e5c76b', animation: 'wait-ping 1.5s infinite' }} /> Waiting Room Active
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>{connectionError ? 'Connection needs attention' : socketReady ? 'Waiting to be admitted…' : 'Connecting…'}</h2>
              <p style={{ fontSize: 14, color: 'var(--meeting-muted)', lineHeight: 1.6, marginBottom: 10 }}>Hi, <strong>{userName}</strong>. The host will let you in shortly.</p>
              <p style={{ fontSize: 12, color: 'var(--meeting-muted)', fontStyle: 'italic' }}>{connectionError || 'You can join with your camera and microphone off.'}</p>
              {mediaError && <p role="status" style={{fontSize:12,color:'#fca5a5'}}>{mediaError}</p>}
              {connectionError && <button onClick={retryConnection}>Try again</button>}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="exmeet-room" data-meeting-theme={preferences.theme} data-panel-open={chatOpen || showPeople}>
      {hostMuted && (
        <div style={{ position: 'fixed', top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 260, padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(239,68,68,.35)', background: 'rgba(70,15,20,.92)', color: '#fecaca', fontSize: 12, fontWeight: 600, boxShadow: '0 12px 30px rgba(0,0,0,.35)' }}>
          The host muted your microphone.
        </div>
      )}


      {canHost && joinRequests.length > 0 && (
        <div style={{ position: 'fixed', bottom: 90, right: 24, zIndex: 200, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360, width: '100%' }}>
          {joinRequests.map(req => (
            <div key={req.socketId} style={{ background: 'rgba(5,5,5,.9)', backdropFilter: 'blur(20px)', border: '1px solid rgba(212,175,55,.15)', borderRadius: 16, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600 }}>Join Request</h4><p style={{ margin: 0, fontSize: 12, color: 'var(--meeting-muted)' }}><strong>{req.userName}</strong> wants to join.</p></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => admitUser(req.socketId)} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: '#22c55e', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Admit</button>
                <button onClick={() => denyUser(req.socketId)} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: '#ef4444', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Deny</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {reactions?.map(r => (<div key={r.id} style={{ position: 'fixed', bottom: 120, left: `${30 + (r.id % 5) * 10}%`, fontSize: 32, animation: 'exmeet-floatReaction 3s ease-out forwards', pointerEvents: 'none', zIndex: 45 }}>{r.emoji}</div>))}

      {/* Shared media keeps the meeting controls available. */}
      {sharedMediaUrl && !mediaStageMinimized && (() => {
        const media = classifyMedia(sharedMediaUrl);
        return (
          <div className="exmeet-shared-media">
            {/* Slim top bar */}
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(212,175,55,.12)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span style={{ fontSize: 11, background: 'rgba(212,175,55,.15)', border: '1px solid rgba(212,175,55,.3)', color: '#e5c76b', borderRadius: 6, padding: '2px 8px', fontWeight: 600, flexShrink: 0 }}>LIVE</span>
                <span style={{ fontSize: 12, color: 'var(--meeting-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sharedMediaUrl}</span>
              </div>
              {canHost && <button className="meeting-secondary" style={{ minHeight: 32, padding: '5px 12px', marginLeft: 'auto' }} onClick={() => shareMedia(null)}>Stop shared media</button>}
              <button
                onClick={() => setMediaStageMinimized(true)}
                title="Minimize"
                style={{ flexShrink: 0, marginLeft: 12, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', color: 'var(--meeting-text)', cursor: 'pointer', fontSize: 13, borderRadius: 8, padding: '5px 12px', fontFamily: "'Instrument Sans',sans-serif", display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="2" rx="1" fill="currentColor" /></svg>
                Minimize
              </button>
            </div>

            {/* Main media area — takes all remaining height */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#000' }}>
              {media.type === 'youtube' && (
                <iframe
                  src={`https://www.youtube.com/embed/${media.id}?autoplay=1`}
                  title="Shared video"
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
              {media.type === 'video' && (
                <video src={sharedMediaUrl} controls autoPlay style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              )}
              {media.type === 'audio' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 40 }}>
                  <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'rgba(212,175,55,.1)', border: '2px solid rgba(212,175,55,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>🎵</div>
                  <audio src={sharedMediaUrl} controls autoPlay style={{ width: 'min(480px,90vw)' }} />
                </div>
              )}
              {media.type === 'image' && (
                <img src={sharedMediaUrl} alt="Shared" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              )}
              {media.type === 'link' && (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ fontSize: 48, marginBottom: 20 }}>🔗</div>
                  <p style={{ color: 'var(--meeting-muted)', fontSize: 14, margin: '0 0 16px' }}>This link can't be embedded — open it directly:</p>
                  <a href={sharedMediaUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--meeting-gold)', fontSize: 14, textDecoration: 'underline', wordBreak: 'break-all' }}>{sharedMediaUrl}</a>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Minimized pill — click to bring the shared media stage back */}
      {sharedMediaUrl && mediaStageMinimized && (
        <button onClick={() => setMediaStageMinimized(false)} style={{ position: 'fixed', top: 90, right: 24, zIndex: 210, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(5,5,5,.95)', border: '1px solid rgba(212,175,55,.25)', borderRadius: 999, padding: '8px 14px', boxShadow: '0 20px 50px -20px rgba(0,0,0,.7)', cursor: 'pointer', color: 'var(--meeting-gold)', fontSize: 12, fontFamily: "'Instrument Sans',sans-serif" }}>
          ▶ Shared media
        </button>
      )}

      {/* Screen-share status: presenter banner (with stop button), viewer label, "already sharing" notice */}
      {screenShareNotice && <div className="exmeet-toast" role="status">{screenShareNotice}</div>}

      {/* Poll popups — shown to every participant except the creator the moment a poll is launched (see useWebRTC's pollNotifications). */}
      {pollNotifications?.length > 0 && (
        <div className="exmeet-poll-notifications">
          {pollNotifications.map(poll => (
            <div key={poll.id} style={{ pointerEvents: 'auto', width: 300, background: 'rgba(5,5,5,.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(212,175,55,.35)', borderRadius: 14, padding: '12px 14px', boxShadow: '0 20px 50px -20px rgba(0,0,0,.7)', animation: 'exmeet-fadeIn .2s ease-out', fontFamily: "'Instrument Sans',sans-serif" }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#e5c76b', fontWeight: 700 }}>📊 {poll.createdBy} started a poll</span>
                <button onClick={() => dismissPollNotification(poll.id)} style={{ background: 'none', border: 'none', color: 'var(--meeting-muted)', cursor: 'pointer', fontSize: 14, padding: 2, lineHeight: 1 }}>✕</button>
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--meeting-text)', margin: '8px 0 10px' }}>{poll.question}</p>
              <button onClick={() => { setShowPeople(false); setPanelTab('polls'); setChatOpen(true); dismissPollNotification(poll.id); }} style={{ width: '100%', padding: 9, borderRadius: 8, border: 'none', background: 'var(--meeting-gold)', color: '#1a1608', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Instrument Sans',sans-serif" }}>Vote now</button>
            </div>
          ))}
        </div>
      )}

      {/* File-share popups— auto-dismissing after 8s (see useWebRTC's fileNotifications), shown to everyone the moment a file is shared so nobody has to open the Files panel to notice it. */}
      {fileNotifications?.length > 0 && (
        <div style={{ position: 'fixed', top: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 250, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', pointerEvents: 'none' }}>
          {fileNotifications.map(file => {
            const media = classifyMedia(file.name);
            const fmtSize = file.size > 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${Math.round(file.size / 1024)} KB`;
            return (
              <div key={file.id} style={{ pointerEvents: 'auto', width: 280, background: 'rgba(5,5,5,.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(212,175,55,.25)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 20px 50px -20px rgba(0,0,0,.7)', animation: 'exmeet-fadeIn .2s ease-out' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px 0' }}>
                  <span style={{ fontSize: 11, color: 'var(--meeting-muted)', fontWeight: 600 }}>{file.sharedBy} shared a file</span>
                  <button onClick={() => dismissFileNotification(file.id)} style={{ background: 'none', border: 'none', color: 'var(--meeting-muted)', cursor: 'pointer', fontSize: 14, padding: 2, lineHeight: 1 }}>✕</button>
                </div>
                {media.type === 'image' && (
                  <img
                    src={file.url}
                    alt={file.name}
                    onClick={() => { setPreviewImageUrl(file.url); dismissFileNotification(file.id); }}
                    style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block', marginTop: 8, cursor: 'pointer' }}
                  />
                )}
                {media.type === 'video' && (
                  <video src={file.url} controls style={{ width: '100%', maxHeight: 200, display: 'block', marginTop: 8 }} />
                )}
                {media.type === 'audio' && (
                  <audio src={file.url} controls style={{ width: '100%', display: 'block', margin: '8px 0 0', padding: '0 10px', boxSizing: 'border-box' }} />
                )}
                <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--meeting-gold)', flexShrink: 0 }}><path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--meeting-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 10.5, color: 'var(--meeting-muted)' }}>{fmtSize}</p>
                  </div>
                  <a href={file.url} download={file.name} style={{ display: 'flex', padding: '5px 9px', borderRadius: 7, background: 'rgba(212,175,55,.12)', border: '1px solid rgba(212,175,55,.2)', color: 'var(--meeting-gold)', textDecoration: 'none', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                    Save
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confettiActive && (<div style={{ position: 'fixed', inset: 0, zIndex: 60, pointerEvents: 'none', overflow: 'hidden' }}>{CONFETTI.map((p, i) => (<div key={i} style={{ position: 'absolute', left: `${p.x}%`, top: '-20px', width: p.w, height: p.h, background: p.color, borderRadius: p.round ? '50%' : 2, transform: `rotate(${p.rot}deg)`, animation: `exmeet-confettiFall ${p.d}s ease-in ${p.delay}s both` }} />))}</div>)}

      {inviteOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
          <div ref={inviteRef} role="dialog" aria-modal="true" aria-label="Invite more people" style={{ width: 380, background: 'var(--meeting-bg)', border: '1px solid rgba(212,175,55,.15)', borderRadius: 16, padding: 22, boxShadow: '0 30px 70px -20px rgba(0,0,0,.7)', animation: 'exmeet-fadeIn .18s ease-out' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <span style={{ fontSize: 17, fontWeight: 700 }}>Invite more people</span>
              <button aria-label="Close invitation" onClick={() => setInviteOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--meeting-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--meeting-muted)', marginBottom: 8 }}>Share the meeting link to invite others</div>
            <button onClick={handleCopyLink} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '11px 14px', borderRadius: 10, border: 'none', background: 'var(--meeting-gold)', color: '#1a1608', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 18, fontFamily: "'Instrument Sans',sans-serif" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" /><path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.8" /></svg>
              {copied ? 'Link Copied!' : 'Copy meeting link'}
            </button>
            <div style={{ fontSize: 12.5, color: 'var(--meeting-muted)', marginBottom: 10 }}>Share meeting invitation</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
              {['Copy'].map((l, i) => (<button key={i} onClick={i === 0 ? handleCopyLink : undefined} title={l} style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(212,175,55,.12)', border: 'none', color: 'var(--meeting-text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: i > 1 ? 700 : 400, fontSize: i > 1 ? 15 : 13 }}>{i === 0 ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" /><path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.8" /></svg> : l}</button>))}
            </div>
            <div style={{ borderTop: '1px solid rgba(212,175,55,.15)', paddingTop: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12.5 }}><strong>Room Code:</strong> {roomCode}</div>
                <div style={{ fontSize: 12.5, marginTop: 4, fontFamily: "'JetBrains Mono',monospace", color: 'var(--meeting-muted)' }}>{roomCode}</div>
              </div>
              <button onClick={handleCopyCode} title="Copy room code" style={{ background: 'none', border: 'none', color: codeCopied ? 'var(--meeting-gold)' : 'var(--meeting-muted)', cursor: 'pointer', flexShrink: 0 }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" /><path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.8" /></svg></button>
            </div>
          </div>
        </div>
      )}

      {raised && !handToastDismissed && (
        <div style={{ position: 'absolute', bottom: 96, left: 28, display: 'flex', alignItems: 'center', gap: 12, background: 'var(--meeting-bg)', border: '1px solid rgba(212,175,55,.15)', borderRadius: 12, padding: '12px 14px', boxShadow: '0 20px 50px -20px rgba(0,0,0,.6)', zIndex: 50 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: '#e5c76b', flexShrink: 0 }}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" /><path d="M12 8v.01M12 11v5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
          <span style={{ fontSize: 13 }}>{myHandPos === 1 ? 'You are next in line to speak' : `You are #${myHandPos} in line to speak`}</span>
          <button onClick={() => setHandToastDismissed(true)} aria-label="Dismiss hand notification" style={{ background: 'none', border: 'none', color: 'var(--meeting-muted)', cursor: 'pointer', fontSize: 14, marginLeft: 6 }}>✕</button>
        </div>
      )}

      {showNotes && <MeetingNotesModal isOpen={showNotes} roomCode={roomCode} onDone={handleNotesDone} onClose={()=>setShowNotes(false)}/>}

      {whiteboardOpen && (
        <Whiteboard
          isOpen={whiteboardOpen}
          onClose={() => setWhiteboardOpen(false)}
          socket={socket}
          socketReady={socketReady}
          roomCode={roomCode}
          isHost={canHost}
        />
      )}

      {feedbackOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400 }}>
          <div className="exmeet-dialog" ref={feedbackRef} role="dialog" aria-modal="true" aria-label="Leave feedback" style={{ width: 380, background: 'var(--meeting-bg)', border: '1px solid rgba(212,175,55,.15)', borderRadius: 16, padding: 22, boxShadow: '0 30px 70px -20px rgba(0,0,0,.7)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Leave feedback</span>
              <button aria-label="Close feedback" onClick={() => setFeedbackOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--meeting-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <textarea
              value={feedbackText}
              onChange={e => setFeedbackText(e.target.value)}
              placeholder="What's working, what isn't — tell us."
              rows={5}
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,.5)', color: 'var(--meeting-text)', border: '1px solid rgba(212,175,55,.15)', borderRadius: 10, padding: 12, fontSize: 13, outline: 'none', fontFamily: "'Instrument Sans',sans-serif", resize: 'vertical', marginBottom: 14 }}
            />
            <button
              onClick={handleFeedbackSubmit}
              disabled={!feedbackText.trim() || feedbackSubmitting}
              style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: 'var(--meeting-gold)', color: '#1a1608', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: "'Instrument Sans',sans-serif", opacity: (!feedbackText.trim() || feedbackSubmitting) ? 0.5 : 1 }}
            >
              {feedbackSubmitting ? 'Sending…' : 'Send feedback'}
            </button>
          </div>
        </div>
      )}

      {previewImageUrl && (
        <div
          onClick={() => setPreviewImageUrl(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', padding: 32 }}
        >
          <button
            onClick={() => setPreviewImageUrl(null)}
            style={{ position: 'absolute', top: 20, right: 24, background: 'none', border: 'none', color: 'var(--meeting-text)', cursor: 'pointer', fontSize: 22 }}
          >✕</button>
          <img src={previewImageUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} onClick={e => e.stopPropagation()} />
        </div>
      )}

      {settingsModal}
      {sharingMediaKind && <ShareMediaDialog kind={sharingMediaKind} onClose={() => setSharingMediaKind(null)} onShare={shareMedia}/>}

      <header className="exmeet-header">
        <div className="exmeet-brand"><span>ETHERX</span><span>Meet</span></div>
        <div className="exmeet-header-center">
          <div className="exmeet-room-pill">
            <span className="exmeet-room-title">{fmtTitle(roomCode)}</span><span className="exmeet-pill-divider exmeet-room-title"/>
            <button onClick={handleCopyCode} title="Copy room code" aria-label="Copy room code"><span>{codeCopied ? 'Copied!' : roomCode}</span>{codeCopied ? <Check size={13}/> : <Copy size={13}/>}</button>
            <span className="exmeet-pill-divider"/><span className="exmeet-clock">{fmtTime(elapsed)}</span>
          </div>
          {isRecording && <span className="exmeet-recording"><i/> Recording</span>}
          {roomLocked && <span className="exmeet-lock" title="Room is locked"><Lock size={12}/><span>Locked</span></span>}
        </div>
        <div className="exmeet-header-right">
          <div className="exmeet-network" title={!socketReady ? 'Connecting to meeting' : `${networkQuality} connection`} data-quality={socketReady ? networkQuality : 'offline'}>
            <div className="exmeet-network-bars">{[5, 8, 11, 14].map((height, index) => <i key={height} style={{ height }} data-lit={socketReady && index < (networkQuality === 'good' ? 4 : networkQuality === 'fair' ? 3 : 1)}/>)}</div>
            <span>{!socketReady ? 'Connecting…' : networkQuality === 'good' ? 'Good' : networkQuality === 'fair' ? 'Fair' : 'Poor'}</span>
          </div>
          <button className="exmeet-profile" title="Profile settings" onClick={() => { setModalTab('profile'); setShowSettingsModal(true); }}><span className="exmeet-profile-avatar">{initial}</span><span>{userName || 'You'}</span></button>
        </div>
      </header>

      {!cameraOff && localStream && (activeFilter !== 'none' || selectedBgImage !== 'none') && <div style={{position:'fixed',left:-100,top:-100,width:2,height:2,overflow:'hidden'}} aria-hidden="true"><VideoCanvasProcessor stream={localStream} activeFilter={activeFilter} selectedBgImage={selectedBgImage} mirror={false} onOutputStream={receiveProcessedStream}/></div>}
      {mediaError && <div role="status" style={{position:'absolute',top:90,left:'50%',transform:'translateX(-50%)',zIndex:200,maxWidth:'90%',padding:12,background:'#241518',border:'1px solid #693c44',borderRadius:10,fontSize:12}}>{mediaError}</div>}
      {/* Stage and shared tools stay between header and controls. */}
      <div className="exmeet-body">

        {/* Shared tools panel sits to the right of the stage. */}
        {chatOpen && (
          <div className="room-side-panel exmeet-side-panel" style={{ width: 320, flexShrink: 0, background: 'var(--meeting-panel)', border: 'none', borderRight: '1px solid rgba(212,175,55,.12)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'exmeet-fadeIn .18s ease-out', position: 'relative', zIndex: 150 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 10px' }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{panelTab === 'chat' ? 'Chat' : panelTab === 'polls' ? 'Polls' : panelTab === 'agenda' ? 'Agenda' : 'Files'}</span>
              <button aria-label="Close meeting panel" onClick={() => setChatOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--meeting-muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 14px 12px', borderBottom: '1px solid rgba(212,175,55,.12)' }}>
              {[
                { id: 'chat', node: <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 5h16v11H8l-4 4V5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>, title: 'Chat' },
                { id: 'polls', node: <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M6 20V10M12 20V4M18 20v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>, title: 'Polls' },
                { id: 'files', node: <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>, title: 'Files' },
                { id: 'agenda', node: <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" /><path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>, title: 'Agenda' },
              ].map(t => (
                <button key={t.id} onClick={() => setPanelTab(t.id)} title={t.title} aria-label={t.title} aria-pressed={panelTab === t.id} style={{ width: 38, height: 34, borderRadius: 9, border: 'none', background: panelTab === t.id ? 'rgba(212,175,55,.22)' : 'transparent', color: panelTab === t.id ? '#e5c76b' : 'rgba(255,255,255,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all .15s' }}>{t.node}</button>
              ))}
            </div>

            {panelTab === 'chat' && (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <VerifiedChat roomCode={roomCode} userName={userName} embedded={true} socket={socket}/>
              </div>
            )}

            {panelTab === 'polls' && (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* ── CREATE POLL VIEW ── */}
                {pollView === 'create' && (
                  <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <button onClick={() => { setPollView('list'); setPollQuestion(''); setPollOptions(['', '']); }} style={{ background: 'none', border: 'none', color: 'var(--meeting-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}>←</button>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--meeting-text)' }}>New poll</span>
                    </div>

                    <div>
                      <label style={{ fontSize: 11, color: 'var(--meeting-muted)', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Question</label>
                      <textarea
                        value={pollQuestion}
                        onChange={e => setPollQuestion(e.target.value)}
                        placeholder="Ask the room a question…"
                        rows={3}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(212,175,55,.2)', background: 'rgba(212,175,55,.06)', color: 'var(--meeting-text)', fontSize: 13, outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: "'Instrument Sans',sans-serif" }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 11, color: 'var(--meeting-muted)', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Options</label>
                      {pollOptions.map((opt, i) => (
                        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                          <input
                            value={opt}
                            onChange={e => { const a = [...pollOptions]; a[i] = e.target.value; setPollOptions(a); }}
                            placeholder={`Option ${i + 1}`}
                            style={{ flex: 1, padding: '8px 10px', borderRadius: 7, border: '1px solid rgba(212,175,55,.18)', background: 'rgba(212,175,55,.06)', color: 'var(--meeting-text)', fontSize: 12.5, outline: 'none', fontFamily: "'Instrument Sans',sans-serif" }}
                          />
                          {pollOptions.length > 2 && (
                            <button onClick={() => setPollOptions(o => o.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--meeting-muted)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>✕</button>
                          )}
                        </div>
                      ))}
                      {pollOptions.length < 6 && (
                        <button onClick={() => setPollOptions(o => [...o, ''])} style={{ width: '100%', padding: '7px', borderRadius: 7, border: '1px dashed rgba(212,175,55,.2)', background: 'none', color: 'var(--meeting-muted)', fontSize: 12, cursor: 'pointer', fontFamily: "'Instrument Sans',sans-serif" }}>+ Add option</button>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button
                        onClick={() => { setPollView('list'); setPollQuestion(''); setPollOptions(['', '']); }}
                        style={{ flex: 1, padding: 10, borderRadius: 9, border: '1px solid rgba(212,175,55,.2)', background: 'transparent', color: 'var(--meeting-muted)', fontSize: 13, cursor: 'pointer', fontFamily: "'Instrument Sans',sans-serif" }}
                      >Cancel</button>
                      <button
                        onClick={() => {
                          const q = pollQuestion.trim();
                          const opts = pollOptions.map(o => o.trim()).filter(Boolean);
                          if (!q || opts.length < 2) return;
                          createPoll?.(q, opts);
                          setPollQuestion('');
                          setPollOptions(['', '']);
                          setPollView('list');
                        }}
                        disabled={!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}
                        style={{ flex: 1, padding: 10, borderRadius: 9, border: 'none', background: 'var(--meeting-gold)', color: '#1a1608', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Instrument Sans',sans-serif", opacity: (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) ? 0.5 : 1 }}
                      >Launch poll</button>
                    </div>
                  </div>
                )}

                {/* ── RESULTS VIEW ── */}
                {pollView === 'results' && (() => {
                  const poll = polls.find(p => p.id === viewingPollId);
                  if (!poll) return null;
                  const total = poll.options.reduce((a, o) => a + o.voters.length, 0);
                  return (
                    <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <button onClick={() => setPollView('list')} style={{ background: 'none', border: 'none', color: 'var(--meeting-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}>←</button>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--meeting-text)' }}>Poll results</span>
                        {!poll.active && <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: 'var(--meeting-muted)', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 99, padding: '2px 8px' }}>CLOSED</span>}
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--meeting-text)', margin: 0 }}>{poll.question}</p>
                      <p style={{ fontSize: 11, color: 'var(--meeting-muted)', margin: 0 }}>{total} vote{total !== 1 ? 's' : ''}</p>
                      {poll.options.map((o, i) => {
                        const pct = total > 0 ? Math.round((o.voters.length / total) * 100) : 0;
                        const isWinner = poll.options.every(x => o.voters.length >= x.voters.length);
                        return (
                          <div key={i} style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${isWinner && total > 0 ? 'rgba(212,175,55,.35)' : 'rgba(212,175,55,.1)'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 10px', background: isWinner && total > 0 ? 'rgba(212,175,55,.1)' : 'rgba(255,255,255,.03)', position: 'relative' }}>
                              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: isWinner && total > 0 ? 'rgba(212,175,55,.15)' : 'rgba(255,255,255,.04)', transition: 'width .5s ease' }} />
                              <span style={{ position: 'relative', fontSize: 12.5, color: isWinner && total > 0 ? '#e5c76b' : 'var(--meeting-muted)', fontWeight: isWinner && total > 0 ? 600 : 400 }}>{o.text}</span>
                              <span style={{ position: 'relative', fontSize: 12, fontWeight: 700, color: isWinner && total > 0 ? '#e5c76b' : 'var(--meeting-muted)' }}>{pct}%</span>
                            </div>
                          </div>
                        );
                      })}
                      {canHost && poll.active && (
                        <button
                          onClick={() => { endPoll?.(poll.id); }}
                          style={{ marginTop: 4, padding: '9px', borderRadius: 9, border: '1px solid rgba(239,68,68,.3)', background: 'rgba(239,68,68,.08)', color: '#f87171', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Instrument Sans',sans-serif" }}
                        >End poll</button>
                      )}
                    </div>
                  );
                })()}

                {/* ── POLL LIST VIEW ── */}
                {pollView === 'list' && (
                  <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {polls.length === 0 ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '32px 16px', textAlign: 'center' }}>
                        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" style={{ color: 'rgba(212,175,55,.2)' }}><path d="M6 20V10M12 20V4M18 20v-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--meeting-muted)', lineHeight: 1.5 }}>No polls yet.<br />Ask the room a question.</p>
                        {canHost && (
                          <button onClick={() => setPollView('create')} style={{ width: '100%', padding: 11, borderRadius: 10, border: 'none', background: 'var(--meeting-gold)', color: '#1a1608', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Instrument Sans',sans-serif" }}>Create a poll</button>
                        )}
                      </div>
                    ) : (
                      <>
                        {polls.map(poll => {
                          const total = poll.options.reduce((a, o) => a + o.voters.length, 0);
                          return (
                            <div key={poll.id} style={{ borderRadius: 12, border: `1px solid ${poll.active ? 'rgba(212,175,55,.2)' : 'rgba(255,255,255,.08)'}`, background: poll.active ? 'rgba(212,175,55,.04)' : 'rgba(255,255,255,.02)', overflow: 'hidden' }}>
                              {/* Poll header */}
                              <div style={{ padding: '10px 12px 8px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ margin: '0 0 2px', fontSize: 12.5, fontWeight: 600, color: 'var(--meeting-text)', lineHeight: 1.4 }}>{poll.question}</p>

                                </div>
                                <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 99, border: `1px solid ${poll.active ? 'rgba(34,197,94,.3)' : 'rgba(255,255,255,.1)'}`, color: poll.active ? '#4ade80' : 'var(--meeting-muted)', background: poll.active ? 'rgba(34,197,94,.08)' : 'rgba(255,255,255,.04)' }}>
                                  {poll.active ? 'OPEN' : 'CLOSED'}
                                </span>
                              </div>

                              {/* Voting options — shown when poll is open */}
                              {poll.active && (
                                <div style={{ padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                                  {poll.options.map((o, i) => {
                                    const isSelected = myVotes[poll.id] === i;
                                    return (
                                      <button
                                        key={i}
                                        className="poll-option-btn"
                                        onClick={() => { setMyVotes(v => ({ ...v, [poll.id]: i })); votePoll?.(poll.id, i); }}
                                        style={{ width: '100%', textAlign: 'left', padding: '8px 11px', borderRadius: 7, border: `1px solid ${isSelected ? 'rgba(212,175,55,.5)' : 'rgba(212,175,55,.18)'}`, background: isSelected ? 'rgba(212,175,55,.18)' : 'rgba(212,175,55,.05)', color: isSelected ? '#e5c76b' : '#e0d4b0', fontSize: 12.5, cursor: 'pointer', fontFamily: "'Instrument Sans',sans-serif", fontWeight: isSelected ? 600 : 400, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                      >
                                        <span>{o.text}{isSelected ? ' ✓' : ''}</span>
                                        {o.voters.length > 0 && <span style={{ fontSize: 11, color: isSelected ? '#e5c76b' : 'var(--meeting-muted)', fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>{o.voters.length} vote{o.voters.length !== 1 ? 's' : ''}</span>}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Results bar — shown only when poll is closed */}
                              {!poll.active && (
                                <div style={{ padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                                  {poll.options.map((o, i) => {
                                    const pct = total > 0 ? Math.round((o.voters.length / total) * 100) : 0;
                                    const mine = myVotes[poll.id] === i;
                                    return (
                                      <div key={i} style={{ borderRadius: 6, overflow: 'hidden', border: `1px solid ${mine ? 'rgba(212,175,55,.3)' : 'rgba(255,255,255,.07)'}` }}>
                                        <div style={{ position: 'relative', padding: '6px 10px', background: mine ? 'rgba(212,175,55,.08)' : 'transparent' }}>
                                          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: mine ? 'rgba(212,175,55,.18)' : 'rgba(255,255,255,.05)', transition: 'width .5s ease' }} />
                                          <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: 12, color: mine ? '#e5c76b' : 'var(--meeting-muted)', fontWeight: mine ? 600 : 400 }}>{o.text}{mine ? ' ✓' : ''}</span>
                                            <span style={{ fontSize: 11, color: mine ? '#e5c76b' : 'var(--meeting-muted)', fontWeight: 600 }}>{pct}%</span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Footer actions */}
                              <div style={{ padding: '0 12px 10px', display: 'flex', gap: 6 }}>
                                <button
                                  onClick={() => { setViewingPollId(poll.id); setPollView('results'); }}
                                  style={{ flex: 1, padding: '6px', borderRadius: 7, border: '1px solid rgba(212,175,55,.18)', background: 'transparent', color: 'var(--meeting-muted)', fontSize: 11.5, cursor: 'pointer', fontFamily: "'Instrument Sans',sans-serif" }}
                                >View results</button>
                                {canHost && poll.active && (
                                  <button
                                    onClick={() => endPoll?.(poll.id)}
                                    style={{ flex: 1, padding: '6px', borderRadius: 7, border: '1px solid rgba(239,68,68,.25)', background: 'rgba(239,68,68,.06)', color: '#f87171', fontSize: 11.5, cursor: 'pointer', fontFamily: "'Instrument Sans',sans-serif" }}
                                  >End poll</button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {canHost && (
                          <button onClick={() => setPollView('create')} style={{ padding: '10px', borderRadius: 10, border: '1px solid rgba(212,175,55,.2)', background: 'transparent', color: 'var(--meeting-muted)', fontSize: 13, cursor: 'pointer', fontFamily: "'Instrument Sans',sans-serif" }}>+ Create another poll</button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {panelTab === 'agenda' && (
              <MeetingAgenda isHost={canHost} meetingStarted={true} topics={agendaTopics} onTopicsChange={handleAgendaChange} />
            )}

            {panelTab === 'files' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Drop zone / upload button */}
                {canHost && <div
                  data-file-upload role="button" tabIndex={0} aria-label="Upload files"
                  onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--meeting-gold)'; e.currentTarget.style.background = 'rgba(212,175,55,.12)'; }}
                  onDragLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(212,175,55,.2)'; e.currentTarget.style.background = 'rgba(212,175,55,.04)'; }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = 'rgba(212,175,55,.2)';
                    e.currentTarget.style.background = 'rgba(212,175,55,.04)';
                    const files = Array.from(e.dataTransfer.files);
                    files.forEach(file => {
                      if (file.size > 10 * 1024 * 1024) { showToast('File too large — max 10 MB'); return; }
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        shareFile({ name: file.name, size: file.size, type: file.type, url: ev.target.result });
                      };
                      reader.readAsDataURL(file);
                    });
                  }}
                  style={{ margin: '12px 12px 8px', borderRadius: 12, border: '2px dashed rgba(212,175,55,.2)', background: 'rgba(212,175,55,.04)', padding: '18px 12px', textAlign: 'center', cursor: 'pointer', transition: 'all .2s', flexShrink: 0 }}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file'; input.multiple = true;
                    input.onchange = () => {
                      Array.from(input.files).forEach(file => {
                        if (file.size > 10 * 1024 * 1024) { showToast('File too large — max 10 MB'); return; }
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          shareFile({ name: file.name, size: file.size, type: file.type, url: ev.target.result });
                        };
                        reader.readAsDataURL(file);
                      });
                    };
                    input.click();
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ color: 'rgba(212,175,55,.5)', margin: '0 auto 8px', display: 'block' }}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                  <p style={{ margin: 0, fontSize: 12.5, color: 'var(--meeting-muted)', fontWeight: 500 }}>Click or drag files here</p>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(168,152,120,.6)' }}>Max 10 MB per file</p>
                </div>}
                {/* File list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(sharedFiles || []).length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'rgba(168,152,120,.5)', fontSize: 12, marginTop: 20 }}>No files shared yet</div>
                  ) : (
                    [...(sharedFiles || [])].reverse().map(file => {
                      const ext = file.name.split('.').pop().toLowerCase();
                      const media = classifyMedia(file.name);
                      const isPdf = ext === 'pdf';
                      const fmtSize = file.size > 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${Math.round(file.size / 1024)} KB`;
                      return (
                        <div key={file.id} style={{ background: 'rgba(212,175,55,.06)', border: '1px solid rgba(212,175,55,.14)', borderRadius: 10, overflow: 'hidden' }}>
                          {media.type === 'image' && (
                            <img
                              src={file.url}
                              alt={file.name}
                              onClick={() => setPreviewImageUrl(file.url)}
                              title="Click to view full size"
                              style={{ width: '100%', maxHeight: 120, objectFit: 'cover', display: 'block', cursor: 'pointer' }}
                            />
                          )}
                          {media.type === 'video' && (
                            <video src={file.url} controls style={{ width: '100%', maxHeight: 160, display: 'block' }} />
                          )}
                          {media.type === 'audio' && (
                            <audio src={file.url} controls style={{ width: '100%', display: 'block', padding: '8px 10px 0', boxSizing: 'border-box' }} />
                          )}
                          <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--meeting-gold)', flexShrink: 0 }}><path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--meeting-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</p>
                              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--meeting-muted)' }}>{fmtSize} · {file.sharedBy}</p>
                            </div>
                            {isPdf && (
                              <a href={file.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', padding: '6px 10px', borderRadius: 8, background: 'rgba(212,175,55,.12)', border: '1px solid rgba(212,175,55,.2)', color: 'var(--meeting-gold)', textDecoration: 'none', fontSize: 11.5, fontWeight: 600, flexShrink: 0, alignItems: 'center', gap: 4 }}>
                                Open
                              </a>
                            )}
                            <a href={file.url} download={file.name} style={{ display: 'flex', padding: '6px 10px', borderRadius: 8, background: 'rgba(212,175,55,.12)', border: '1px solid rgba(212,175,55,.2)', color: 'var(--meeting-gold)', textDecoration: 'none', fontSize: 11.5, fontWeight: 600, flexShrink: 0, alignItems: 'center', gap: 4 }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                              Save
                            </a>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PARTICIPANTS RIGHT PANEL */}
        {showPeople && (
          <div className="room-side-panel exmeet-side-panel" style={{ width: 290, flexShrink: 0, background: 'var(--meeting-panel)', borderLeft: '1px solid rgba(212,175,55,.12)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'exmeet-fadeIn .18s ease-out', position: 'relative', zIndex: 150 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 18px 12px' }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>Participants ({totalP})</span>
              <button aria-label="Close participants" onClick={() => setShowPeople(false)} style={{ background: 'none', border: 'none', color: 'var(--meeting-muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {<button onClick={() => { setInviteOpen(true); setShowPeople(false); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 11, borderRadius: 10, border: 'none', background: 'var(--meeting-gold)', color: '#1a1608', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Instrument Sans',sans-serif" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M18 8v6M15 11h6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>
                Invite someone
              </button>}
              <input aria-label="Search participants" value={participantQuery} onChange={e=>setParticipantQuery(e.target.value)} placeholder="Search participants" style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid rgba(212,175,55,.15)', background: 'rgba(212,175,55,.05)', color: 'var(--meeting-text)', fontSize: 12.5, outline: 'none', fontFamily: "'Instrument Sans',sans-serif", boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[{ name: userName || 'You', local: true, muted: micMuted, camOff: cameraOff, socketId: null }, ...peerList.map(([id, p]) => ({ id, socketId: id, name: p.userName || 'Guest', local: false, muted: !!p.isMuted, mutedByHost: !!p.mutedByHost, camOff: !p.stream || !!p.videoOff }))].filter(u=>u.name.toLowerCase().includes(participantQuery.trim().toLowerCase())).map((u, i) => (
                <div data-room-participant key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px', borderRadius: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(160deg,${avatarColor(u.name)},${avatarColor(u.name)}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{(u.name[0] || '?').toUpperCase()}</div>
                  <span style={{ fontSize: 13, flex: 1, color: 'var(--meeting-text)' }}>{u.name}{u.local ? ' (you)' : ''}</span>
                  {coHost?.socketId === u.socketId && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--meeting-gold)', background: 'rgba(212,175,55,.12)', border: '1px solid rgba(212,175,55,.3)', borderRadius: 999, padding: '2px 7px' }}>Co-host</span>}
                  {canManageCoHost && !u.local && (
                    coHost?.socketId === u.socketId ? (
                      <button onClick={() => removeCoHost()} title="Remove co-host" style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--meeting-muted)', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer' }}>Remove co-host</button>
                    ) : (
                      <button onClick={() => makeCoHost(u.socketId)} title="Make co-host" style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--meeting-gold)', background: 'rgba(212,175,55,.08)', border: '1px solid rgba(212,175,55,.25)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer' }}>Make co-host</button>
                    )
                  )}
                  {u.camOff && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--meeting-muted)' }}><path d="M3 7.5A1.5 1.5 0 014.5 6h9A1.5 1.5 0 0115 7.5v9M13.5 17H4.5A1.5 1.5 0 013 15.5v-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /><path d="M17 10l4-2.2v8.4L17 14M2 2l20 20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>}
                  {u.muted && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: '#f87171' }}><path d="M12 15a3 3 0 003-3V6a3 3 0 00-5.6-1.5M9 9v3a3 3 0 004.24 2.74" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M19 11a7 7 0 01-9.8 6.4M5 5l14 14M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>}
                  {canHost && !u.local && <button onClick={() => u.mutedByHost ? unmuteParticipant(u.id) : muteParticipant(u.id)} title={u.mutedByHost ? `Allow ${u.name} to speak` : `Mute ${u.name}`} style={{ border: '1px solid rgba(212,175,55,.25)', borderRadius: 7, background: u.mutedByHost ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)', color: u.mutedByHost ? '#86efac' : '#fca5a5', padding: '4px 7px', fontSize: 10, cursor: 'pointer', fontFamily: "'Instrument Sans',sans-serif" }}>{u.mutedByHost ? 'Unmute' : 'Mute'}</button>}
                  {canHost && !u.local && (
                    <button
                      onClick={() => kickParticipant(u.socketId)}
                      title="Remove participant"
                      style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#f87171', cursor: 'pointer', padding: '3px 8px', fontSize: 11, fontWeight: 600, flexShrink: 0, fontFamily: "'Instrument Sans',sans-serif", transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.25)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.12)'}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MAIN VIDEO AREA */}
        <main className="exmeet-stage" aria-label="Meeting stage">
          <RoomStage roomCode={roomCode} localStream={localStream} peers={peers} userName={userName} micMuted={micMuted}
            cameraOff={cameraOff} selfViewHidden={selfViewHidden} filter={activeFilter} background={selectedBgImage}
            gridView={gridView} spotlightId={spotlightId} setSpotlightId={id => { setSpotlightId(id); setGridView(false); }} screenStream={screenStream}
            isScreenSharing={isScreenSharing} onStopScreen={toggleScreenShare} screenSharerId={screenSharerId}
            handQueue={handQueue} mySocketId={mySocketId} canHost={canHost} isCoHost={isCoHost} coHost={coHost}
            account={account} copied={copied} onCopyLink={handleCopyLink}/>
          {(captionsOn || captionsDemand) && <CaptionsOverlay socket={socket} roomCode={roomCode} show={captionsOn}
            transcribe={captionsDemand && !micMuted && !hostMuted} bottom={20} language={preferences.captionLanguage}/>}
        </main>
      </div>
      <RoomControls micMuted={micMuted} hostMuted={hostMuted} cameraOff={cameraOff} toggleMic={toggleMic} toggleCamera={toggleCamera}
        onSettings={tab => { setModalTab(tab); setShowSettingsModal(true); }} canHost={canHost}
        isScreenSharing={isScreenSharing} toggleScreenShare={toggleScreenShare}
        chatOpen={chatOpen && panelTab === 'chat'} chatUnread={chatUnread} toggleChat={() => { setShowPeople(false); setChatUnread(false); if (chatOpen && panelTab === 'chat') setChatOpen(false); else { setPanelTab('chat'); setChatOpen(true); } }}
        raised={raised} handPosition={myHandPos} toggleHand={handleRaiseHand}
        peopleOpen={showPeople} togglePeople={() => { setChatOpen(false); setShowPeople(v => !v); }} total={totalP}
        onLeave={handleEnd} sendReaction={sendReaction}>
        <RoomMoreMenu groups={[
          { label: 'Meeting controls', items: [
            ...(canHost ? [
              { icon: <MonitorUp/>, label: isScreenSharing ? 'Stop sharing screen' : 'Share screen', action: toggleScreenShare, active: isScreenSharing, compactOnly: true },
              { icon: <Circle/>, label: isRecording ? 'Stop recording' : 'Start recording', action: () => { if (isRecording) stopRecording(); else startRecording(); }, disabled: recordingState === 'stopping' },
            ] : []),
            { icon: <LayoutGrid/>, label: gridView ? 'Speaker view' : 'Grid view', action: () => setGridView(v => !v), active: gridView },
            { icon: <UserPlus/>, label: 'Invite people', action: () => setInviteOpen(true) },
            { icon: <Captions/>, label: 'Closed captions', action: () => setCaptionsOn(v => !v), active: captionsOn },
            { icon: <Smile/>, label: 'Send applause', action: () => sendReaction('👏'), compactOnly: true },
          ] },
          { label: 'Meeting tools', items: [
            { icon: <Presentation/>, label: 'Whiteboard', action: () => setWhiteboardOpen(true) },
            { icon: <File/>, label: 'Meeting Agenda', action: () => { setShowPeople(false); setPanelTab('agenda'); setChatOpen(true); } },
            { icon: <ChartNoAxesColumn/>, label: 'Polls', action: () => { setShowPeople(false); setPanelTab('polls'); setChatOpen(true); setPollView('list'); } },
            { icon: <File/>, label: 'File sharing', action: () => { setShowPeople(false); setPanelTab('files'); setChatOpen(true); } },
          ] },
          { label: 'Media & view', items: [
            ...(canHost ? [
              { icon: <MonitorUp/>, label: 'Share video', action: () => setSharingMediaKind('video') },
              { icon: <Music/>, label: 'Share audio', action: () => setSharingMediaKind('audio') },
            ] : []),
            { icon: <MicOff/>, label: 'Noise suppression', action: () => { toggleNoiseSuppression(); showToast(noiseSuppressed ? 'Noise suppression off.' : 'Noise suppression on.'); }, active: noiseSuppressed },
            { icon: <Image/>, label: 'Select background', action: () => { setShowSettingsModal(true); setModalTab('backgrounds'); } },
            { icon: <Gauge/>, label: 'Performance settings', action: () => { setSelfViewHidden(v => { const next = !v; showToast(next ? 'Self-view hidden — reduces local rendering load.' : 'Self-view restored.'); return next; }); }, active: selfViewHidden },
            { icon: <Maximize/>, label: 'View full screen', action: () => { if (!document.fullscreenEnabled) showToast('Full screen is unavailable in this browser.'); else if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => showToast('Could not enter full screen.')); else document.exitFullscreen().catch(() => {}); } },
          ] },
          { label: 'Preferences', items: [
            { icon: <Settings/>, label: 'Settings', action: () => { setShowSettingsModal(true); setModalTab('audio'); } },
            { icon: <Keyboard/>, label: 'View shortcuts', action: () => { setShowSettingsModal(true); setModalTab('shortcuts'); } },
            ...(canHost ? [{ icon: <Shield/>, label: 'Security options', action: () => { const next = !roomLocked; setRoomLocked(next); showToast(next ? 'Room locked — no new participants can join.' : 'Room unlocked.'); }, active: roomLocked }] : []),
            { icon: <MessageSquare/>, label: 'Leave feedback', action: () => setFeedbackOpen(true) },
          ] },
        ]}/>

      </RoomControls>

      {connectionError && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 12, padding: '20px 28px', color: '#fca5a5', fontSize: 13, zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <p style={{ margin: 0 }}>{connectionError}</p>
          <button onClick={() => navigate(ROUTES.DASHBOARD)} style={{ background: '#b8860b', border: 'none', color: 'var(--meeting-text)', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontFamily: "'Instrument Sans',sans-serif" }}>Back to Dashboard</button>
        </div>
      )}

      {recordingError && (
        <div style={{ position: 'fixed', top: 62, left: '50%', transform: 'translateX(-50%)', zIndex: 105, background: 'rgba(70,15,20,.94)', border: '1px solid rgba(239,68,68,.35)', borderRadius: 10, padding: '9px 14px', color: '#fecaca', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,.35)' }}>
          {recordingError}
        </div>
      )}
      {/* One audio element per remote peer — the only place remote voice is played. */}
      {peerList.map(([id, p]) => (p.stream ? <RemoteAudio key={id} stream={p.stream} outputDevice={preferences.outputDevice} onError={showToast}/> : null))}

      {toast && (
        <div className="exmeet-toast" role="status" aria-live="polite">
          <Info size={18}/><span>{toast}</span>
        </div>
      )}
    </div>
  );
}
