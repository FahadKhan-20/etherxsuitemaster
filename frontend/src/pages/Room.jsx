// frontend/src/pages/Room.jsx
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { normalizeRoomCode } from '../utils/roomCode';
import { useState, useEffect, useRef } from 'react';
import { useUser } from '../context/UserContext';
import { useMediaDevices } from '../hooks/useMediaDevices';
import VideoRoom from '../components/room/ReferenceVideoRoom';
import VideoCanvasProcessor from '../components/video/VideoCanvasProcessor';
import etherxLogo from '../assets/etherx_transparent.png';
import { ROUTES } from '../utils/constants';
import apiClient from '../utils/apiClient';
import { clearAuthSession, getAuthToken } from '../utils/auth';
import MeetingSettings from '../components/room/MeetingSettings';
import { useMeetingPreferences } from '../hooks/useMeetingPreferences';
import { copyMeetingText } from '../utils/meetingClipboard';
import '../styles/meeting.css';
import {
  Mic, MicOff, Video, VideoOff, UserPlus, Image as ImageIcon, Settings, PhoneOff, ChevronDown, Sparkles, Check,
  Volume2, Bell, User, Keyboard, X, Plus
} from 'lucide-react';

// Formatter for room code: e.g. "etherx-pi9gce9w" -> "Etherx Pi 9 Gce 9 W"
function formatLobbyCode(code) {
  if (!code) return 'Meeting';
  const clean = code.replace(/^etherx-/i, '');
  const parts = clean.match(/[a-zA-Z]+|[0-9]+/g) || [];
  const formattedParts = parts.map(part => {
    if (/^[a-zA-Z]+$/.test(part)) {
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }
    return part;
  });
  return `Etherx ${formattedParts.join(' ')}`;
}

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
  const [time, setTime] = useState(new Date());

  const activeFilter = preferences.filter;
  const [activeParticipants, setActiveParticipants] = useState([]);

  // New settings modal states
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [modalTab, setModalTab] = useState('backgrounds'); // 'audio' | 'video' | 'backgrounds' | 'notifications' | 'profile' | 'shortcuts' | 'general'
  const selectedBgImage = preferences.background;

  // Initialize media devices for pre-join preview
  const {
    stream,
    videoRef,
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

  // Clock timer
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

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

  const initial = (displayName.trim()[0] || "?").toUpperCase();
  const timeStr = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }).toLowerCase();
  
  const weekday = time.toLocaleDateString([], { weekday: 'long' }).toUpperCase();
  const day = time.getDate();
  const month = time.toLocaleDateString([], { month: 'long' }).toUpperCase();
  const dateStr = `${weekday}, ${day} ${month}`;

  return (
    <div className="room-lobby-grid meeting-legacy-lobby" data-meeting-theme={preferences.theme}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .room-lobby-grid {
          display: grid;
          grid-template-columns: 440px 1fr;
          min-height: 100vh;
          min-height: 100dvh;
          background: #000000;
          position: relative;
          overflow: hidden;
        }
        .room-lobby-left {
          position: relative;
          z-index: 2;
          padding: 24px 28px 24px 28px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          border-right: 1px solid rgba(212,175,55,0.22);
          background: linear-gradient(160deg, rgba(212,175,55,0.04) 0%, #000 30%, #000 100%);
          box-shadow: inset -1px 0 40px rgba(0,0,0,0.6), 4px 0 24px rgba(0,0,0,0.4);
          width: 100%;
        }
        .room-lobby-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          justify-content: flex-start;
          width: 100%;
        }
        .room-lobby-center {
          margin: 40px 0 auto 0;
          padding: 10px 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          width: 100%;
        }
        .room-lobby-right {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #000000;
        }
        .glow-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(212,175,55,0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(212,175,55,0.045) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse 60% 60% at 0% 50%, black, transparent);
          pointer-events: none;
        }
        .join-btn {
          transition: all 0.25s cubic-bezier(.4,0,.2,1);
          box-shadow: 0 0 0 0 rgba(212,175,55,0.0);
        }
        .join-btn:hover {
          box-shadow: 0 8px 28px -6px rgba(212,175,55,0.45);
          transform: translateY(-1px);
        }
        .join-btn:active { transform: translateY(0px) scale(0.99); }
        .field:focus-within {
          border-color: rgb(212, 175, 55) !important;
          box-shadow: 0 0 0 3px rgba(212,175,55,0.12);
        }
        .ctrl-btn {
          transition: all 0.2s ease;
        }
        .ctrl-btn:hover { transform: translateY(-2px); }
        ::placeholder { color: #6b6256; }

        @media (max-width: 900px) {
          .room-lobby-grid {
            display: flex;
            flex-direction: column;
            height: auto;
            min-height: 100dvh;
            overflow-y: auto;
            background: #000000;
          }
          .room-lobby-left {
            border-right: none;
            padding: 20px 16px 20px 16px;
            align-items: center;
            min-height: 100dvh;
            justify-content: space-between;
            box-shadow: none;
            background: #000000;
          }
          .room-lobby-brand {
            justify-content: center;
            margin-bottom: 8px;
          }
          .room-lobby-center {
            margin: 8px 0 12px 0;
            padding: 0;
          }
          .room-lobby-right {
            display: none;
          }
          .ctrl-btn {
            width: 42px !important;
            height: 42px !important;
          }
        }
      `}</style>

      <div className="glow-grid" />

      {/* LEFT — control panel */}
      <div className="room-lobby-left">
        {/* Top: brand */}
        <div className="room-lobby-brand">
          <img src={etherxLogo} alt="EtherX Meet" style={{ width: "165px", height: "auto" }} />
        </div>

        {/* Center — info + form */}
        <div className="room-lobby-center">
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: "#A89A7C", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4, fontWeight: 500 }}>
              {dateStr}
            </div>
            <div style={{ fontSize: "clamp(32px, 8vw, 44px)", fontWeight: 700, color: "#F4EFE2", letterSpacing: "-0.01em" }}>
              {timeStr}
            </div>
          </div>

          <h1
            style={{
              fontSize: "clamp(24px, 6vw, 32px)",
              fontWeight: 700,
              margin: "0 0 6px",
              color: "rgb(212, 175, 55)",
              letterSpacing: "-0.02em"
            }}
          >
            Ready to join?
          </h1>
          <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#7CD992", flexShrink: 0 }} />
              <p style={{ color: "#A89A7C", fontSize: 14, margin: 0 }}>
                {code ? code.toLowerCase() : 'etherx-meeting'} &middot; encrypted &middot; live
              </p>
            </div>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 12.5, margin: 0, fontWeight: 500 }}>
              {activeParticipants.length > 0 ? (
                activeParticipants.length === 1 
                  ? `${activeParticipants[0].userName} is in this room`
                  : activeParticipants.length === 2 
                  ? `${activeParticipants[0].userName} and ${activeParticipants[1].userName} are in this room`
                  : `${activeParticipants[0].userName}, ${activeParticipants[1].userName} and ${activeParticipants.length - 2} others are in this room`
              ) : (
                "No one else is here"
              )}
            </p>
          </div>

          {/* Agenda — host only, before joining */}
          {isHost && (
            <div style={{ width: '100%', maxWidth: '340px', marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: '#A89A7C', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>MEETING AGENDA</div>
              <div style={{ background: 'rgba(212,175,55,.04)', border: '1px solid rgba(212,175,55,.18)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 260 }}>
                {/* topic list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {agendaTopics.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'rgba(168,152,120,.45)', fontSize: 12, padding: '12px 0' }}>Add topics for your meeting</div>
                  )}
                  {agendaTopics.map((t, i) => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 8px', borderRadius: 7, background: 'rgba(212,175,55,.06)', border: '1px solid rgba(212,175,55,.1)' }}>
                      <span style={{ width: 18, height: 18, borderRadius: 5, border: '1.5px solid rgba(212,175,55,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#a89878', flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ flex: 1, fontSize: 12.5, color: '#f0e6d3' }}>{t.title}</span>
                      <button onClick={() => handleAgendaChange(agendaTopics.filter(x => x.id !== t.id))} style={{ background: 'none', border: 'none', color: 'rgba(168,152,120,.5)', cursor: 'pointer', fontSize: 13, padding: '0 2px', lineHeight: 1 }}>✕</button>
                    </div>
                  ))}
                </div>
                {/* add input */}
                <div style={{ display: 'flex', gap: 6, padding: '8px 10px', borderTop: '1px solid rgba(212,175,55,.1)' }}>
                  <input
                    id="agenda-input"
                    placeholder="Add a topic…"
                    onKeyDown={e => { if (e.key === 'Enter' && e.target.value.trim()) { handleAgendaChange([...agendaTopics, { id: Date.now(), title: e.target.value.trim(), completed: false }]); e.target.value = ''; } }}
                    style={{ flex: 1, padding: '7px 9px', borderRadius: 7, border: '1px solid rgba(212,175,55,.15)', background: 'rgba(212,175,55,.06)', color: '#f0e6d3', fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
                  />
                  <button
                    onClick={() => { const inp = document.getElementById('agenda-input'); if (inp?.value.trim()) { handleAgendaChange([...agendaTopics, { id: Date.now(), title: inp.value.trim(), completed: false }]); inp.value = ''; } }}
                    style={{ padding: '7px 12px', borderRadius: 7, border: 'none', background: '#b8860b', color: '#050505', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                  >Add</button>
                </div>
              </div>
            </div>
          )}

          {/* Name field */}
          <label htmlFor="meeting-display-name" style={{ fontSize: 11, color: "#A89A7C", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, display: "block", fontWeight: 600, width: "100%", maxWidth: "340px", textAlign: "left" }}>
            YOUR NAME
          </label>

          <div
            className="field"
            style={{
              border: "1px solid rgba(212,175,55,0.25)",
              borderRadius: 12,
              padding: "12px 16px",
              background: "rgba(255,255,255,0.025)",
              marginBottom: 16,
              transition: "all 0.2s ease",
              width: "100%",
              maxWidth: "340px",
            }}
          >
            <input
              id="meeting-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your name"
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#F4EFE2",
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Join button */}
          <button
            className="join-btn"
            onClick={handleJoin}
            disabled={!displayName.trim() || isJoining}
            style={{
              width: "100%",
              maxWidth: "340px",
              background: "rgb(212, 175, 55)",
              color: "#1A1404",
              border: "none",
              borderRadius: 12,
              padding: "14px 20px",
              fontSize: 15,
              fontWeight: 700,
              cursor: displayName.trim() && !isJoining ? "pointer" : "not-allowed",
              opacity: displayName.trim() && !isJoining ? 1 : 0.6,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontFamily: "inherit",
              minHeight: 48,
            }}
          >
            <span>{isJoining ? 'Verifying host…' : 'Join meeting'}</span>
            <ChevronDown size={18} strokeWidth={2.5} />
          </button>
          {joinError && (
            <div style={{ width: '100%', maxWidth: 340, margin: '10px auto 0', textAlign: 'center' }}>
              <p role="alert" style={{ margin: 0, color: '#fca5a5', fontSize: 13 }}>{joinError}</p>
              {reauthRequired && (
                <button
                  onClick={() => {
                    clearAuthSession();
                    navigate(ROUTES.LOGIN, { state: { from: location }, replace: true });
                  }}
                  style={{ marginTop: 10, border: '1px solid rgba(212,175,55,.35)', borderRadius: 8, background: 'rgba(212,175,55,.12)', color: '#e5c76b', padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Sign in again
                </button>
              )}
            </div>
          )}
        </div>

        {mediaError && <p className="lobby-media-warning" role="status">{mediaError}<button type="button" onClick={requestPermission}>Retry devices</button></p>}

        {/* Bottom: device controls */}
        <div style={{ width: "100%", paddingBottom: "12px" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, justifyContent: "center", flexWrap: "nowrap", width: "100%", maxWidth: "340px", margin: "0 auto 12px" }}>
            <CtrlButton active={isAudioEnabled} onClick={toggleAudio} on={Mic} off={MicOff} label="Mic" />
            <CtrlButton active={isVideoEnabled} onClick={toggleVideo} on={Video} off={VideoOff} label="Camera" />
            
            {/* Invite button */}
            <button
              className="ctrl-btn"
              onClick={handleCopyLink}
              title={copied ? "Link Copied!" : "Copy Invite Link"}
              style={{
                width: 44, height: 44, borderRadius: 12, cursor: "pointer",
                border: copied ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.08)",
                background: copied ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.04)",
                color: copied ? "#10b981" : "#C9BC9C",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}
            >
              {copied ? <Check size={18} /> : <UserPlus size={18} />}
            </button>

            {/* Visual Effects */}
            <button
              className="ctrl-btn"
              onClick={() => { setShowSettingsModal(true); setModalTab('backgrounds'); }}
              title="Visual Effects"
              style={{
                width: 44, height: 44, borderRadius: 12, cursor: "pointer",
                border: (showSettingsModal && modalTab === 'backgrounds') ? "1px solid rgba(212,175,55,0.3)" : "1px solid rgba(255,255,255,0.08)",
                background: (showSettingsModal && modalTab === 'backgrounds') ? "rgba(212,175,55,0.1)" : "rgba(255,255,255,0.04)",
                color: (showSettingsModal && modalTab === 'backgrounds') ? "rgb(212, 175, 55)" : "#C9BC9C",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}
            >
              <ImageIcon size={18} />
            </button>

            {/* Settings */}
            <button
              className="ctrl-btn"
              onClick={() => { setShowSettingsModal(true); setModalTab('video'); }}
              title="Device Settings"
              style={{
                width: 44, height: 44, borderRadius: 12, cursor: "pointer",
                border: (showSettingsModal && modalTab !== 'backgrounds') ? "1px solid rgba(212,175,55,0.3)" : "1px solid rgba(255,255,255,0.08)",
                background: (showSettingsModal && modalTab !== 'backgrounds') ? "rgba(212,175,55,0.1)" : "rgba(255,255,255,0.04)",
                color: (showSettingsModal && modalTab !== 'backgrounds') ? "rgb(212, 175, 55)" : "#C9BC9C",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}
            >
              <Settings size={18} />
            </button>
            
            {/* Cancel Button */}
            <button
              onClick={() => navigate(ROUTES.DASHBOARD)}
              title="Return to dashboard"
              aria-label="Return to dashboard"
              className="ctrl-btn"
              style={{
                width: 44, height: 44, borderRadius: 12, border: "none", cursor: "pointer",
                background: "#C9483D", color: "#FCEAE8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}
            >
              <PhoneOff size={18} />
            </button>
          </div>
          <p style={{ fontSize: 11.5, color: "#8a8070", margin: 0, display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
            <Sparkles size={12} /> Other participants may be recording this call
          </p>
        </div>
      </div>

      {/* RIGHT — ambient preview panel */}
      <div className="room-lobby-right">
        <div
          style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(circle at 50% 50%, rgba(212,175,55,0.06), transparent 60%)",
            zIndex: 0
          }}
        />

        {stream && isVideoEnabled ? (
          <VideoCanvasProcessor
            stream={stream}
            activeFilter={activeFilter}
            selectedBgImage={selectedBgImage}
            mirror={true}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: selectedBgImage === 'none' ? '#000' : `url(${selectedBgImage}) center/cover`,
            position: 'absolute', inset: 0, zIndex: 1, transition: 'background 0.3s'
          }}>
            <div style={{ textAlign: "center", position: "relative", zIndex: 2 }}>
              <div
                style={{
                  width: 132, height: 132, borderRadius: "50%",
                  background: "linear-gradient(135deg, #6F5115, rgb(212, 175, 55))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 52, fontWeight: 700, color: "#FAF7EE",
                  margin: "0 auto 20px",
                  boxShadow: "0 0 60px rgba(212,175,55,0.18)",
                  border: "1px solid rgba(212,175,55,0.35)",
                }}
              >
                {initial}
              </div>
              <p style={{ color: "#A89A7C", fontSize: 14.5, margin: 0 }}>
                {displayName || "Guest"}'s camera is off
              </p>
            </div>
          </div>
        )}

        {/* Media Error overlay */}
        {mediaError && (
          <div style={{
            position: 'absolute',
            bottom: '28px',
            background: 'rgba(218,72,61,0.85)',
            color: '#fff',
            padding: '10px 18px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 500,
            maxWidth: '80%',
            textAlign: 'center',
            zIndex: 3
          }}>
            {mediaError}
          </div>
        )}

        {/* corner label */}
        <div
          style={{
            position: "absolute", top: 28, right: 28,
            border: "1px solid rgba(212,175,55,0.25)", borderRadius: 999,
            padding: "7px 14px", fontSize: 12.5, color: "#C9BC9C",
            background: "rgba(20,18,14,0.5)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", gap: 7,
            zIndex: 3
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "rgb(212, 175, 55)" }} />
          Preview
        </div>
      </div>

      {showSettingsModal && <MeetingSettings
        initialTab={modalTab} preferences={preferences} onSave={savePreferences}
        onClose={() => setShowSettingsModal(false)} stream={stream}
        audioEnabled={isAudioEnabled} videoEnabled={isVideoEnabled}
        devices={devices} selectedDevices={selectedDevices} switchDevice={switchDevice}
        name={displayName} onNameChange={setDisplayName}
      />}

    </div>
  );
}

function CtrlButton({ active, onClick, on: OnIcon, off: OffIcon, label }) {

  return (
    <button
      className="ctrl-btn"
      title={`${label}: ${active ? "on" : "off"}`}
      aria-label={`${active ? "Turn off" : "Turn on"} ${label}`}
      aria-pressed={active}
      onClick={onClick}
      style={{
        width: 46, height: 46, borderRadius: 12, cursor: "pointer",
        border: active ? "1px solid rgba(212,175,55,0.3)" : "1px solid rgba(255,255,255,0.08)",
        background: active ? "rgba(212,175,55,0.1)" : "rgba(255,255,255,0.04)",
        color: active ? "rgb(212, 175, 55)" : "#8a8275",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {active ? <OnIcon size={18} /> : <OffIcon size={18} />}
    </button>
  );
}

function IconOnly({ icon: Icon }) {
  return (
    <button
      className="ctrl-btn"
      style={{
        width: 46, height: 46, borderRadius: 12, cursor: "pointer",
        border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)",
        color: "#C9BC9C", display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <Icon size={18} />
    </button>
  );
}
