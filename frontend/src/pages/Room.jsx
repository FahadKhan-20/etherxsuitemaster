// frontend/src/pages/Room.jsx
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { normalizeRoomCode } from '../utils/roomCode';
import { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { useMediaDevices } from '../hooks/useMediaDevices';
import VideoRoom from '../components/room/ReferenceVideoRoom';
import VideoCanvasProcessor from '../components/video/VideoCanvasProcessor';
import etherxLogo from '../assets/etherx_logo_header.png';
import { ROUTES } from '../utils/constants';
import apiClient from '../utils/apiClient';
import { clearAuthSession, getAuthToken } from '../utils/auth';
import MeetingSettings from '../components/room/MeetingSettings';
import { useMeetingPreferences } from '../hooks/useMeetingPreferences';
import { copyMeetingText } from '../utils/meetingClipboard';
import '../styles/meeting.css';
import '../styles/prejoin.css';
import { Mic, MicOff, Video, VideoOff, Image as ImageIcon, Settings, Check,
  ArrowLeft, ArrowRight, ChevronDown, FlipHorizontal2, Link2, LockKeyhole, X, Plus } from 'lucide-react';

export default function Room() {


  const { code: routeCode } = useParams();
  const code = normalizeRoomCode(routeCode);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, updateUser } = useUser();

  const [hasJoined, setHasJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [reauthRequired, setReauthRequired] = useState(false);
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [preferences, savePreferences] = useMeetingPreferences();
  const [joinedMedia, setJoinedMedia] = useState(null);
  const [copied, setCopied] = useState(false);

  const activeFilter = preferences.filter;
  const [activeParticipants, setActiveParticipants] = useState([]);

  // New settings modal states
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [modalTab, setModalTab] = useState('backgrounds'); // 'audio' | 'video' | 'backgrounds' | 'notifications' | 'profile' | 'shortcuts' | 'general'
  const selectedBgImage = preferences.background;

  // Initialize media devices for pre-join preview
  const {
    stream,
    isVideoEnabled,
    isAudioEnabled,
    requestPermission,
    stopStream,
    releaseStream,
    toggleVideo,
    toggleAudio,
    error: mediaError,
    devices,
    switchDevice,
    selectedDevices,
  } = useMediaDevices({ initialDevices: preferences.devices });

  const isHost = sessionStorage.getItem('etherx_host_room') === code;

  const [agendaTopics, setAgendaTopics] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(`etherx_agenda:${code}`) || '[]'); } catch { return []; }
  });
  const handleAgendaChange = (topics) => {
    setAgendaTopics(topics);
    sessionStorage.setItem(`etherx_agenda:${code}`, JSON.stringify(topics));
  };

  // Query active participants list
  useEffect(() => {
    if (hasJoined || !code) return;
    let isCancelled = false;
    const fetchParticipants = async () => {
      try {
        const cleanCode = encodeURIComponent(code.trim().toLowerCase());
        const { data } = await apiClient.get(`/api/rooms/${cleanCode}/participants`);
        if (!isCancelled && data?.success) {
          setActiveParticipants(data.participants || []);
        }
      } catch {
        // Silently catch to avoid crashing or flooding console with SyntaxError on network hiccups/SPA fallback
      }
    };
    fetchParticipants();
    const interval = setInterval(fetchParticipants, 3000);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [hasJoined, code]);

  // Request mic/cam access when Lobby mounts
  useEffect(() => {
    if (!hasJoined) {
      requestPermission();
    }
    return () => {
      stopStream();
    };
  }, [hasJoined, requestPermission, stopStream]);

  const handleJoin = async () => {
    if (!displayName.trim() || isJoining) return;
    setIsJoining(true);
    setJoinError('');

    if (isHost && getAuthToken()) {
      try {
        await apiClient.post('/api/rooms', { roomCode: code, hostName: displayName.trim() });
      } catch (error) {
        if (error.response?.status === 401) {
          setReauthRequired(true);
          setJoinError('Your saved sign-in session was rejected by this backend. Sign in again to verify host access.');
        } else {
          console.error('Failed to register meeting host:', error);
          setJoinError(error.response?.data?.message || 'Could not verify host access. Please try again.');
        }
        setIsJoining(false);
        return;
      }
    }
    
    // Save chosen display name
    updateUser({ name: displayName.trim() });
    
    // Hand off these exact tracks and disabled states; no capture reset on join.
    setJoinedMedia({ userName: displayName.trim(), stream: releaseStream(), audioEnabled: isAudioEnabled, videoEnabled: isVideoEnabled, devices: selectedDevices });

    // Set join state
    setHasJoined(true);
  };

  const handleCopyLink = async () => {
    try { await copyMeetingText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setJoinError('Could not copy the link. Copy it from your browser address bar.'); }
  };

  // Render the WebRTC Meeting Room once joined
  if (hasJoined) {
    return <VideoRoom roomCode={code} isHost={isHost} initialMedia={joinedMedia} preferences={preferences} savePreferences={savePreferences} />;
  }

  const initial = (displayName.trim()[0] || '?').toUpperCase();
  const mirror = preferences.reference?.mirror ?? false;
  const toggleMirror = () => savePreferences({ ...preferences, reference: { ...preferences.reference, mirror: !mirror } });
  const peopleText = activeParticipants.length
    ? `${activeParticipants.length} ${activeParticipants.length === 1 ? 'person is' : 'people are'} already here`
    : 'Be the first to join';
  const addTopic = () => {
    const input = document.getElementById('agenda-input');
    if (!input?.value.trim()) return;
    handleAgendaChange([...agendaTopics, { id: crypto.randomUUID(), title: input.value.trim(), completed: false }]);
    input.value = '';
  };

  return (
    <div className="meeting-prejoin" data-meeting-theme={preferences.theme}>
      <header className="prejoin-header">
        <a href={ROUTES.HOME} aria-label="EtherX Meet home"><img src={etherxLogo} alt="EtherX Meet" /></a>
        <div className="prejoin-header-meta"><button type="button" onClick={() => navigate(ROUTES.HOME)}><ArrowLeft size={16} /> Back to home</button></div>
      </header>

      <main className="prejoin-main">
        <section className="prejoin-camera" aria-label="Camera preview and controls">
          <div className="prejoin-preview" data-mirrored={mirror}>
            {stream && isVideoEnabled ? (
              <VideoCanvasProcessor stream={stream} activeFilter={activeFilter} selectedBgImage={selectedBgImage} mirror={mirror} style={{ objectFit: 'contain' }} />
            ) : (
              <div className="prejoin-camera-off">
                <div className="prejoin-avatar">{initial}</div>
                <h2>Your camera is off</h2>
                <p>You can turn it on whenever you’re ready.</p>
              </div>
            )}
            <span className="prejoin-preview-badge"><span /> Only you can see this</span>
            <span className="prejoin-preview-name">{displayName.trim() || 'You'}{mirror ? ' · Mirrored' : ''}</span>
          </div>
        </section>

        <section className="prejoin-join" aria-labelledby="prejoin-title">
          <h1 id="prejoin-title">Join meeting</h1>
          <div className="prejoin-room-info"><span className="prejoin-room-code" title={code}>{code || 'etherx-meeting'}</span><span className="prejoin-people" role="status"><span />{peopleText}</span></div>

          <label className="prejoin-label" htmlFor="meeting-display-name">Your name</label>
          <input className="prejoin-name" id="meeting-display-name" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Enter your name" autoComplete="name" maxLength={80} onKeyDown={e => { if (e.key === 'Enter') handleJoin(); }} />
          <button type="button" className="prejoin-join-button" onClick={handleJoin} disabled={!displayName.trim() || isJoining}><span>{isJoining ? 'Joining…' : 'Join meeting'}</span><ArrowRight size={20} /></button>
          <p className="prejoin-privacy"><LockKeyhole size={15} /> Your camera and mic stay private until you join.</p>
          <div className="prejoin-device-controls">
            <DeviceButton active={isAudioEnabled} onClick={toggleAudio} on={Mic} off={MicOff} label="Microphone" />
            <DeviceButton active={isVideoEnabled} onClick={toggleVideo} on={Video} off={VideoOff} label="Camera" />
            <button type="button" className="prejoin-device" onClick={toggleMirror} aria-label="Mirror my video" aria-pressed={mirror} title="Mirror your preview; other people see your normal camera view"><FlipHorizontal2 size={19} /><span>Mirror {mirror ? 'on' : 'off'}</span></button>
            <div className="prejoin-control-divider" />
            <button type="button" className="prejoin-tool" aria-label="Visual Effects" title="Visual Effects" onClick={() => { setShowSettingsModal(true); setModalTab('backgrounds'); }}><ImageIcon size={19} /></button>
            <button type="button" className="prejoin-tool" aria-label="Device Settings" title="Device Settings" onClick={() => { setShowSettingsModal(true); setModalTab('video'); }}><Settings size={19} /></button>
          </div>
          {mediaError && <div className="prejoin-media-error" role="status"><span>{mediaError}</span><button type="button" onClick={requestPermission}>Retry devices</button></div>}
          <p className="prejoin-preview-help">Check your camera and sound before you join.</p>

          {joinError && <div className="prejoin-join-error"><p role="alert">{joinError}</p>{reauthRequired && <button type="button" onClick={() => { clearAuthSession(); navigate(ROUTES.LOGIN, { state: { from: location }, replace: true }); }}>Sign in again</button>}</div>}

          {isHost && <details className="prejoin-agenda"><summary><span>Meeting agenda <span className="prejoin-optional">{agendaTopics.length ? `(${agendaTopics.length})` : 'Optional'}</span></span><ChevronDown size={17} /></summary><div className="prejoin-agenda-content"><p>Add a few topics to keep everyone on track.</p><ol>{agendaTopics.map(topic => <li key={topic.id}><span>{topic.title}</span><button type="button" aria-label={`Remove topic: ${topic.title}`} onClick={() => handleAgendaChange(agendaTopics.filter(item => item.id !== topic.id))}><X size={16} /></button></li>)}</ol><div className="prejoin-agenda-input"><input id="agenda-input" aria-label="Agenda topic" placeholder="Add a topic…" maxLength={200} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTopic(); } }} /><button type="button" onClick={addTopic}><Plus size={16} />Add</button></div></div></details>}
          <button type="button" className="prejoin-copy" onClick={handleCopyLink}>{copied ? <Check size={17} /> : <Link2 size={17} />}<span aria-live="polite">{copied ? 'Meeting link copied' : 'Copy meeting link'}</span></button>
        </section>
      </main>
      {showSettingsModal && <MeetingSettings initialTab={modalTab} preferences={preferences} onSave={savePreferences} onClose={() => setShowSettingsModal(false)} stream={stream} audioEnabled={isAudioEnabled} videoEnabled={isVideoEnabled} devices={devices} selectedDevices={selectedDevices} switchDevice={switchDevice} name={displayName} onNameChange={setDisplayName} />}
    </div>
  );
}

function DeviceButton({ active, onClick, on: OnIcon, off: OffIcon, label }) {
  return <button type="button" className="prejoin-device" data-off={!active} title={`${label}: ${active ? 'on' : 'off'}`} aria-label={`${active ? 'Turn off' : 'Turn on'} ${label}`} aria-pressed={active} onClick={onClick}>{active ? <OnIcon size={19} /> : <OffIcon size={19} />}<span>{label === 'Microphone' ? (active ? 'Mic on' : 'Mic off') : (active ? 'Camera on' : 'Camera off')}</span></button>;
}
