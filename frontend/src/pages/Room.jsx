// frontend/src/pages/Room.jsx
import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useUser } from '../context/UserContext';
import { useMediaDevices } from '../hooks/useMediaDevices';
import VideoRoom from '../components/video/VideoRoom';
import etherxLogo from '../assets/etherx_transparent.png';
import { ROUTES } from '../utils/constants';
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

const BG_OPTIONS = [
  { id: 'none', type: 'filter', label: 'None' },
  { id: 'half-blur', type: 'filter', label: 'Half Blur' },
  { id: 'blur', type: 'filter', label: 'Blur' },
  { id: 'beach', type: 'image', label: 'Beach', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=350&q=80' },
  { id: 'room', type: 'image', label: 'Office', url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=350&q=80' },
  { id: 'corridor', type: 'image', label: 'Lobby', url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=350&q=80' },
  { id: 'wall', type: 'image', label: 'Studio', url: 'https://images.unsplash.com/photo-1585314062340-f1a5a7c9328d?auto=format&fit=crop&w=350&q=80' },
  { id: 'mountains', type: 'image', label: 'Valley', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=350&q=80' },
  { id: 'forest', type: 'image', label: 'Forest', url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=350&q=80' },
  { id: 'sunset', type: 'image', label: 'Sunset', url: 'https://images.unsplash.com/photo-1472214222541-d510753a4707?auto=format&fit=crop&w=350&q=80' }
];

const playTestSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    console.error(e);
  }
};

export default function Room() {


  const { code } = useParams();
  const navigate = useNavigate();
  const { user, updateUser } = useUser();

  const [hasJoined, setHasJoined] = useState(false);
  const [displayName, setDisplayName] = useState(user?.name || 'vinay');
  const [copied, setCopied] = useState(false);
  const [time, setTime] = useState(new Date());

  const [showSettings, setShowSettings] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const [activeFilter, setActiveFilter] = useState('none');
  const [activeParticipants, setActiveParticipants] = useState([]);

  // New settings modal states
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [modalTab, setModalTab] = useState('backgrounds'); // 'audio' | 'video' | 'backgrounds' | 'notifications' | 'profile' | 'shortcuts' | 'general'
  const [selectedBgImage, setSelectedBgImage] = useState('none'); // URL or 'none'

  // Initialize media devices for pre-join preview
  const {
    stream,
    videoRef,
    isVideoEnabled,
    isAudioEnabled,
    requestPermission,
    stopStream,
    toggleVideo,
    toggleAudio,
    error: mediaError,
    devices,
    switchDevice,
    selectedDevices,
  } = useMediaDevices();

  const [activeDashes, setActiveDashes] = useState(0);
  const [isPlayingTest, setIsPlayingTest] = useState(false);

  useEffect(() => {
    if (modalTab !== 'audio' || !isAudioEnabled) {
      setActiveDashes(0);
      return;
    }
    const iv = setInterval(() => {
      // Simulate speaking activity with fluctuating dashes between 1 and 8
      setActiveDashes(Math.floor(Math.random() * 8) + 1);
    }, 120);
    return () => clearInterval(iv);
  }, [modalTab, isAudioEnabled]);


  const isHost = sessionStorage.getItem('etherx_host_room') === code;

  // Query active participants list
  useEffect(() => {
    if (hasJoined || !code) return;
    const fetchParticipants = async () => {
      try {
        const res = await fetch(`/api/rooms/${code.toLowerCase()}/participants`);
        const data = await res.json();
        if (data.success) {
          setActiveParticipants(data.participants || []);
        }
      } catch (err) {
        console.error('Error fetching participants:', err);
      }
    };
    fetchParticipants();
    const interval = setInterval(fetchParticipants, 3000);
    return () => clearInterval(interval);
  }, [hasJoined, code]);

  // Request mic/cam access when Lobby mounts
  useEffect(() => {
    if (!hasJoined) {
      requestPermission();
    }
    return () => {
      stopStream();
    };
  }, [hasJoined]);

  // Sync display name if user context updates
  useEffect(() => {
    if (user?.name && displayName === 'vinay') {
      setDisplayName(user.name);
    }
  }, [user]);


  // Clock timer
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleJoin = () => {
    if (!displayName.trim()) return;
    
    // Save chosen display name
    updateUser({ name: displayName.trim() });
    
    // Release Lobby camera/mic so VideoRoom can claim them
    stopStream();

    // Set join state
    setHasJoined(true);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };


  // Render the WebRTC Meeting Room once joined
  if (hasJoined) {
    return <VideoRoom roomCode={code} isHost={isHost} />;
  }

  const initial = (displayName.trim()[0] || "?").toUpperCase();
  const timeStr = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }).toLowerCase();
  
  const weekday = time.toLocaleDateString([], { weekday: 'long' }).toUpperCase();
  const day = time.getDate();
  const month = time.toLocaleDateString([], { month: 'long' }).toUpperCase();
  const dateStr = `${weekday}, ${day} ${month}`;

  return (
    <div
      style={{
        fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif",
        background: "#090B0B",
        minHeight: "100vh",
        color: "#EDE7D9",
        display: "grid",
        gridTemplateColumns: "440px 1fr",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
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
      `}</style>

      <div className="glow-grid" />

      {/* LEFT — control panel */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          padding: "20px 24px 44px 24px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          borderRight: "1px solid rgba(212,175,55,0.22)",
          background: "linear-gradient(160deg, rgba(212,175,55,0.04) 0%, #000 30%, #000 100%)",
          boxShadow: "inset -1px 0 40px rgba(0,0,0,0.6), 4px 0 24px rgba(0,0,0,0.4)",
        }}
      >
        {/* Top: brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src={etherxLogo} alt="EtherX Meet" style={{ width: "140px", height: "auto" }} />
        </div>

        {/* Center — info + form */}
        <div style={{ margin: "80px 0 auto 0", padding: "20px 0", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", width: "100%" }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, color: "#A89A7C", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, fontWeight: 500 }}>
              {dateStr}
            </div>
            <div style={{ fontSize: 44, fontWeight: 700, color: "#F4EFE2", letterSpacing: "-0.01em" }}>
              {timeStr}
            </div>
          </div>

          <h1
            style={{
              fontSize: 32,
              fontWeight: 700,
              margin: "0 0 6px",
              color: "rgb(212, 175, 55)",
              letterSpacing: "-0.02em"
            }}
          >
            Ready to join?
          </h1>
          <div style={{ marginBottom: 36, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#7CD992" }} />
              <p style={{ color: "#A89A7C", fontSize: 14.5, margin: 0 }}>
                {code ? code.toLowerCase() : 'etherx-meeting'} &middot; encrypted &middot; live
              </p>
            </div>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, margin: 0, fontWeight: 500 }}>
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

          {/* Name field */}
          <label style={{ fontSize: 11, color: "#A89A7C", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8, display: "block", fontWeight: 500, width: "100%", maxWidth: "320px", textAlign: "left" }}>
            YOUR NAME
          </label>

          <div
            className="field"
            style={{
              border: "1px solid rgba(212,175,55,0.25)",
              borderRadius: 12,
              padding: "14px 16px",
              background: "rgba(255,255,255,0.025)",
              marginBottom: 22,
              transition: "all 0.2s ease",
              width: "100%",
              maxWidth: "320px",
            }}
          >
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your name"
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#F4EFE2",
                fontSize: 16,
                fontWeight: 600,
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Join button */}
          <button
            className="join-btn"
            onClick={handleJoin}
            disabled={!displayName.trim()}
            style={{
              width: "100%",
              maxWidth: "320px",
              background: "rgb(212, 175, 55)",
              color: "#1A1404",
              border: "none",
              borderRadius: 12,
              padding: "15px 20px",
              fontSize: 15.5,
              fontWeight: 700,
              cursor: displayName.trim() ? "pointer" : "not-allowed",
              opacity: displayName.trim() ? 1 : 0.6,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontFamily: "inherit",
            }}
          >
            <span>Join meeting</span>
            <ChevronDown size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Floating settings / effects overlays */}
        <div style={{ position: 'relative', width: "100%", maxWidth: "320px", margin: "0 auto" }}>
          {showEffects && (
            <div style={{
              position: 'absolute', bottom: '18px', left: 0, right: 0,
              background: 'rgba(15,15,20,0.96)', border: '1px solid rgba(212,175,55,0.22)',
              borderRadius: '12px', padding: '16px', zIndex: 10, backdropFilter: 'blur(12px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '11px', color: 'rgb(212, 175, 55)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Visual Effects</span>
                <button onClick={() => setShowEffects(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '14px' }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {[
                  { id: 'none', label: 'None' },
                  { id: 'blur', label: 'Blur' },
                  { id: 'warm', label: 'Warm Tint' },
                  { id: 'cool', label: 'Cool Tint' },
                  { id: 'mono', label: 'B&W Mono' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => { setActiveFilter(f.id); setShowEffects(false); }}
                    style={{
                      padding: '8px 4px', borderRadius: '8px',
                      background: activeFilter === f.id ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${activeFilter === f.id ? 'rgb(212, 175, 55)' : 'rgba(255,255,255,0.08)'}`,
                      color: activeFilter === f.id ? 'rgb(212, 175, 55)' : 'rgba(255,255,255,0.7)',
                      fontSize: '12px', cursor: 'pointer', textAlign: 'center', fontWeight: 500
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showSettings && (
            <div style={{
              position: 'absolute', bottom: '18px', left: 0, right: 0,
              background: 'rgba(15,15,20,0.96)', border: '1px solid rgba(212,175,55,0.22)',
              borderRadius: '12px', padding: '16px', zIndex: 10, backdropFilter: 'blur(12px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '11px', color: 'rgb(212, 175, 55)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Device Settings</span>
                <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '14px' }}>✕</button>
              </div>
              
              {/* Camera */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '10px', color: '#A89A7C', display: 'block', marginBottom: '4px', letterSpacing: '0.05em' }}>CAMERA</label>
                <select
                  value={selectedDevices?.video || ''}
                  onChange={(e) => switchDevice('video', e.target.value)}
                  style={{
                    width: '100%', background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px', padding: '8px', fontSize: '12px', outline: 'none'
                  }}
                >
                  {devices?.cameras?.map(c => (
                    <option key={c.deviceId} value={c.deviceId} style={{ background: '#111' }}>{c.label || `Camera ${c.deviceId.slice(0, 5)}`}</option>
                  ))}
                </select>
              </div>

              {/* Mic */}
              <div>
                <label style={{ fontSize: '10px', color: '#A89A7C', display: 'block', marginBottom: '4px', letterSpacing: '0.05em' }}>MICROPHONE</label>
                <select
                  value={selectedDevices?.audio || ''}
                  onChange={(e) => switchDevice('audio', e.target.value)}
                  style={{
                    width: '100%', background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px', padding: '8px', fontSize: '12px', outline: 'none'
                  }}
                >
                  {devices?.microphones?.map(m => (
                    <option key={m.deviceId} value={m.deviceId} style={{ background: '#111' }}>{m.label || `Mic ${m.deviceId.slice(0, 5)}`}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Bottom: device controls */}
        <div style={{ paddingBottom: "24px" }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 18, justifyContent: "center" }}>
            <CtrlButton active={isAudioEnabled} onClick={toggleAudio} on={Mic} off={MicOff} label="Mic" />
            <CtrlButton active={isVideoEnabled} onClick={toggleVideo} on={Video} off={VideoOff} label="Camera" />
            
            {/* Invite button */}
            <button
              className="ctrl-btn"
              onClick={handleCopyLink}
              title={copied ? "Link Copied!" : "Copy Invite Link"}
              style={{
                width: 46, height: 46, borderRadius: 12, cursor: "pointer",
                border: copied ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.08)",
                background: copied ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.04)",
                color: copied ? "#10b981" : "#C9BC9C",
                display: "flex", alignItems: "center", justifyContent: "center",
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
                width: 46, height: 46, borderRadius: 12, cursor: "pointer",
                border: (showSettingsModal && modalTab === 'backgrounds') ? "1px solid rgba(212,175,55,0.3)" : "1px solid rgba(255,255,255,0.08)",
                background: (showSettingsModal && modalTab === 'backgrounds') ? "rgba(212,175,55,0.1)" : "rgba(255,255,255,0.04)",
                color: (showSettingsModal && modalTab === 'backgrounds') ? "rgb(212, 175, 55)" : "#C9BC9C",
                display: "flex", alignItems: "center", justifyContent: "center",
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
                width: 46, height: 46, borderRadius: 12, cursor: "pointer",
                border: (showSettingsModal && modalTab !== 'backgrounds') ? "1px solid rgba(212,175,55,0.3)" : "1px solid rgba(255,255,255,0.08)",
                background: (showSettingsModal && modalTab !== 'backgrounds') ? "rgba(212,175,55,0.1)" : "rgba(255,255,255,0.04)",
                color: (showSettingsModal && modalTab !== 'backgrounds') ? "rgb(212, 175, 55)" : "#C9BC9C",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Settings size={18} />
            </button>
            
            {/* Cancel Button */}
            <button
              onClick={() => navigate(ROUTES.DASHBOARD)}
              className="ctrl-btn"
              style={{
                width: 46, height: 46, borderRadius: 12, border: "none", cursor: "pointer",
                background: "#C9483D", color: "#FCEAE8", display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <PhoneOff size={18} />
            </button>
          </div>
          <p style={{ fontSize: 12, color: "#5E5648", margin: 0, display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
            <Sparkles size={12} /> Other participants may be recording this call
          </p>
        </div>
      </div>

      {/* RIGHT — ambient preview panel */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", background: "#000" }}>
        <div
          style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(circle at 50% 50%, rgba(212,175,55,0.06), transparent 60%)",
            zIndex: 0
          }}
        />

        {stream && isVideoEnabled ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: "scaleX(-1)", // Mirror local video
              zIndex: 1,
              filter: activeFilter === 'blur' ? 'blur(8px)' :
                      activeFilter === 'half-blur' ? 'blur(4px)' :
                      activeFilter === 'warm' ? 'sepia(0.35) saturate(1.25)' :
                      activeFilter === 'cool' ? 'hue-rotate(185deg) saturate(1.2)' :
                      activeFilter === 'mono' ? 'grayscale(1)' : 'none'
            }}
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

      {/* ── Settings Modal Overlay ── */}
      {showSettingsModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            width: '740px', height: '500px', background: '#121214',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px',
            display: 'grid', gridTemplateColumns: '220px 1fr', overflow: 'hidden',
            boxShadow: '0 24px 64px rgba(0,0,0,0.8)'
          }}>
            {/* Left menu */}
            <div style={{
              borderRight: '1px solid rgba(255,255,255,0.06)', padding: '24px 16px',
              display: 'flex', flexDirection: 'column', gap: '8px', background: '#121214'
            }}>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '0 0 20px 8px', letterSpacing: '-0.01em' }}>Settings</h2>
              
              {[
                { id: 'audio', label: 'Audio', icon: Volume2 },
                { id: 'video', label: 'Video', icon: Video },
                { id: 'backgrounds', label: 'Virtual backgrounds', icon: ImageIcon },
                { id: 'notifications', label: 'Notifications', icon: Bell },
                { id: 'profile', label: 'Profile', icon: User },
                { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
                { id: 'general', label: 'General', icon: Settings }
              ].map(tab => {
                const Icon = tab.icon;
                const active = modalTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setModalTab(tab.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px',
                      borderRadius: '8px', border: 'none', cursor: 'pointer', textAlign: 'left',
                      background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                      color: active ? '#fff' : 'rgba(255,255,255,0.6)',
                      fontWeight: active ? 600 : 500, fontSize: '13.5px', transition: 'all 0.2s'
                    }}
                  >
                    <Icon size={18} color={active ? 'rgb(212, 175, 55)' : undefined} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Right content panel */}
            <div style={{ padding: '28px 36px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#16161a', position: 'relative' }}>
              {/* Header X */}
              <button 
                onClick={() => setShowSettingsModal(false)}
                style={{ position: 'absolute', top: '24px', right: '28px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>

              {/* Body content based on modalTab */}
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', margin: '16px 0' }}>
                {modalTab === 'audio' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Microphone selector */}
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 500, color: '#fff', display: 'block', marginBottom: '8px' }}>Microphone</label>
                      <div style={{ position: 'relative' }}>
                        <select
                          value={selectedDevices?.audio || ''}
                          onChange={(e) => switchDevice('audio', e.target.value)}
                          style={{
                            width: '100%', background: 'rgba(0,0,0,0.3)', color: '#fff',
                            border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
                            padding: '12px 14px', fontSize: '13.5px', outline: 'none',
                            appearance: 'none', WebkitAppearance: 'none',
                            backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23ffffff\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")',
                            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', backgroundSize: '16px'
                          }}
                        >
                          {devices?.microphones?.map(m => (
                            <option key={m.deviceId} value={m.deviceId} style={{ background: '#121214' }}>{m.label || `Microphone Array (${m.deviceId.slice(0, 5)})`}</option>
                          ))}
                        </select>
                      </div>

                      {/* Volume indicator level bar */}
                      <div style={{ display: 'flex', gap: '4px', marginTop: '10px' }}>
                        {Array.from({ length: 12 }).map((_, i) => (
                          <div
                            key={i}
                            style={{
                              width: '20px', height: '4px', borderRadius: '1px',
                              background: i < activeDashes ? '#fff' : 'rgba(255,255,255,0.15)',
                              transition: 'background 0.1s ease'
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Audio Output selector */}
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 500, color: '#fff', display: 'block', marginBottom: '8px' }}>Audio output</label>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                          <select
                            style={{
                              width: '100%', background: 'rgba(0,0,0,0.3)', color: '#fff',
                              border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
                              padding: '12px 14px', fontSize: '13.5px', outline: 'none',
                              appearance: 'none', WebkitAppearance: 'none',
                              backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23ffffff\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")',
                              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', backgroundSize: '16px'
                            }}
                          >
                            <option style={{ background: '#121214' }}>Default - Speaker (2- Realtek(R) Audio)</option>
                            <option style={{ background: '#121214' }}>Headphones (Stereo)</option>
                          </select>
                        </div>
                        <button
                          onClick={() => {
                            setIsPlayingTest(true);
                            playTestSound();
                            setTimeout(() => setIsPlayingTest(false), 800);
                          }}
                          style={{
                            background: '#fff', border: 'none', color: '#000',
                            padding: '12px 24px', borderRadius: '8px', fontSize: '13.5px',
                            fontWeight: 600, cursor: 'pointer', display: 'inline-flex',
                            alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.opacity = '0.9'}
                          onMouseLeave={(e) => e.target.style.opacity = '1'}
                        >
                          {isPlayingTest ? 'Playing...' : 'Test'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}


                {modalTab === 'video' && (
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '20px' }}>Video Settings</h3>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ fontSize: '11px', color: '#A89A7C', display: 'block', marginBottom: '6px', letterSpacing: '0.05em' }}>CAMERA</label>
                      <select
                        value={selectedDevices?.video || ''}
                        onChange={(e) => switchDevice('video', e.target.value)}
                        style={{ width: '100%', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', outline: 'none' }}
                      >
                        {devices?.cameras?.map(c => (
                          <option key={c.deviceId} value={c.deviceId} style={{ background: '#121214' }}>{c.label || `Camera ${c.deviceId.slice(0, 5)}`}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {modalTab === 'backgrounds' && (
                  <div>
                    {/* Video Preview inside Settings */}
                    <div style={{
                      position: 'relative', width: '280px', height: '158px', background: '#000', borderRadius: '10px',
                      overflow: 'hidden', margin: '0 auto 20px', border: '1px solid rgba(255,255,255,0.08)'
                    }}>
                      {stream && isVideoEnabled ? (
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          style={{
                            width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)',
                            filter: activeFilter === 'blur' ? 'blur(8px)' :
                                    activeFilter === 'half-blur' ? 'blur(4px)' :
                                    activeFilter === 'warm' ? 'sepia(0.35) saturate(1.25)' :
                                    activeFilter === 'cool' ? 'hue-rotate(185deg) saturate(1.2)' :
                                    activeFilter === 'mono' ? 'grayscale(1)' : 'none'
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: selectedBgImage === 'none' ? '#121214' : `url(${selectedBgImage}) center/cover`
                        }}>
                          <div style={{
                            width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #6F5115, rgb(212, 175, 55))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 700, color: '#fff'
                          }}>{initial}</div>
                        </div>
                      )}
                    </div>

                    {/* Add background link */}
                    <button style={{ background: 'none', border: 'none', color: '#1a73e8', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, padding: '0', marginBottom: '16px' }}>
                      <Plus size={16} />
                      <span>Add background</span>
                    </button>

                    {/* Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                      {BG_OPTIONS.map(opt => {
                        const isSelected = (opt.type === 'filter' && activeFilter === opt.id && selectedBgImage === 'none') || 
                                           (opt.type === 'image' && selectedBgImage === opt.url);
                        return (
                          <button
                            key={opt.id}
                            onClick={() => {
                              if (opt.type === 'filter') {
                                setActiveFilter(opt.id === 'half-blur' ? 'half-blur' : opt.id === 'blur' ? 'blur' : 'none');
                                setSelectedBgImage('none');
                              } else {
                                setActiveFilter('none');
                                setSelectedBgImage(opt.url);
                              }
                            }}
                            style={{
                              aspectRatio: '16/10', borderRadius: '6px', overflow: 'hidden', cursor: 'pointer',
                              border: `2px solid ${isSelected ? 'rgb(212, 175, 55)' : 'rgba(255,255,255,0.08)'}`,
                              background: opt.type === 'image' ? `url(${opt.url}) center/cover` : '#202124',
                              position: 'relative', padding: 0
                            }}
                            title={opt.label}
                          >
                            {opt.type === 'filter' && (
                              <div style={{
                                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '9px', color: 'rgba(255,255,255,0.7)', fontWeight: 600, background: opt.id === 'blur' ? 'rgba(0,0,0,0.4)' : 'transparent',
                                backdropFilter: opt.id === 'blur' ? 'blur(4px)' : opt.id === 'half-blur' ? 'blur(2px)' : 'none'
                              }}>
                                {opt.label}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {modalTab === 'notifications' && (
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '20px' }}>Notifications Settings</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {['Play sound on join/leave', 'Show visual alert banners', 'Desktop push notifications'].map((label, idx) => (
                        <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'rgba(255,255,255,0.7)', fontSize: '13.5px', cursor: 'pointer' }}>
                          <input type="checkbox" defaultChecked style={{ width: '16px', height: '16px', accentColor: 'rgb(212, 175, 55)' }} />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {modalTab === 'profile' && (
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '20px' }}>Your Profile</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                      <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #6F5115, rgb(212, 175, 55))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 700, color: '#fff' }}>{initial}</div>
                      <div>
                        <h4 style={{ color: '#fff', margin: '0 0 4px', fontSize: '15px' }}>{displayName}</h4>
                        <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0, fontSize: '12px' }}>Verified Web3 Participant</p>
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#A89A7C', display: 'block', marginBottom: '6px', letterSpacing: '0.05em' }}>DISPLAY NAME</label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        style={{ width: '100%', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', outline: 'none' }}
                      />
                    </div>
                  </div>
                )}

                {modalTab === 'shortcuts' && (
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '16px' }}>Keyboard Shortcuts</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {[
                        { key: 'M', desc: 'Mute / unmute microphone' },
                        { key: 'V', desc: 'Turn camera on / off' },
                        { key: 'Space', desc: 'Push to talk (temporary unmute)' },
                        { key: '⌘ + E', desc: 'End or leave meeting' },
                        { key: '⌘ + K', desc: 'Open Web3 Wallet console' }
                      ].map((s, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>{s.desc}</span>
                          <kbd style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', color: 'rgb(212, 175, 55)', fontFamily: 'monospace' }}>{s.key}</kbd>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {modalTab === 'general' && (
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '20px' }}>General Settings</h3>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ fontSize: '11px', color: '#A89A7C', display: 'block', marginBottom: '6px', letterSpacing: '0.05em' }}>LANGUAGE</label>
                      <select
                        style={{ width: '100%', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', outline: 'none' }}
                      >
                        <option style={{ background: '#121214' }}>English (United States)</option>
                        <option style={{ background: '#121214' }}>Spanish (Español)</option>
                        <option style={{ background: '#121214' }}>French (Français)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#A89A7C', display: 'block', marginBottom: '6px', letterSpacing: '0.05em' }}>THEME MODE</label>
                      <select
                        style={{ width: '100%', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', outline: 'none' }}
                      >
                        <option style={{ background: '#121214' }}>Dark Theme (Default)</option>
                        <option style={{ background: '#121214' }}>Light Theme</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
                <button 
                  onClick={() => setShowSettingsModal(false)}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '13.5px', fontWeight: 600 }}
                  onMouseEnter={(e) => e.target.style.color = '#fff'}
                  onMouseLeave={(e) => e.target.style.color = 'rgba(255,255,255,0.7)'}
                >
                  Cancel
                </button>
                <button 
                  onClick={() => setShowSettingsModal(false)}
                  style={{ background: '#1a73e8', border: 'none', color: '#fff', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '13.5px', fontWeight: 600 }}
                  onMouseEnter={(e) => e.target.style.background = '#155cb0'}
                  onMouseLeave={(e) => e.target.style.background = '#1a73e8'}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CtrlButton({ active, onClick, on: OnIcon, off: OffIcon }) {

  return (
    <button
      className="ctrl-btn"
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
