import { useEffect, useRef, useState } from 'react';
import { normalizeRoomCode, isValidRoomCode } from '../utils/roomCode';
import { QrCode, Scan, Copy, Check, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getUserInitials } from '../utils/auth';
import { useUser } from '../context/UserContext';
import WorkspaceHeader from '../components/layout/WorkspaceHeader';
import ProfileAvatar from '../components/ui/ProfileAvatar';
import { useAvatarTone } from '../utils/avatarTone';
import AnimatedPage from '../components/layout/AnimatedPage';
import { staggerContainer, staggerChild, glowPulse } from '../utils/animationVariants';
import '../styles/landing.css';
import * as QRCode from 'qrcode';
import Modal from '../components/ui/Modal';
import apiClient from '../utils/apiClient';

const normalizeMeetingCode = (value) => {
  const jitsiMatch = value.replace(/\s+/g, '').match(/(?:https?:\/\/)?meet\.jit\.si\/([^/?#]+)/i);
  return jitsiMatch?.[1] ? jitsiMatch[1].toLowerCase() : normalizeRoomCode(value);
};

// Published legal pages. The consent line is hidden until both exist, so it never links to nothing.
const TERMS_URL = import.meta.env.VITE_TERMS_URL;
const PRIVACY_URL = import.meta.env.VITE_PRIVACY_URL;

function generateRoomCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = 'etherx-';
  for (let i = 0; i < 8; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function MicOnIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V21h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-3.07A7 7 0 0 1 5 11a1 1 0 1 1 2 0 5 5 0 0 0 10 0z"
      />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M15 11V8.41l2 2V11a5 5 0 0 1-7.73 4.18l1.46-1.46A3 3 0 0 0 15 11zM12 3a3 3 0 0 1 3 3v1.59l-6-6A3 3 0 0 1 12 3zM5.27 4L4 5.27 8.09 9.36V11a3.9 3.9 0 0 0 .04.54L6.31 9.72A5.9 5.9 0 0 0 6 11a6 6 0 0 0 6 6 5.8 5.8 0 0 0 2.43-.51L16 18.06V21h3a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h3v-2.07A8 8 0 0 1 4 11a7.9 7.9 0 0 1 .88-3.65L5.27 4zM20 20.73L6.54 7.27 5.13 5.86 3.27 4 2 5.27l1.86 1.86 1.41 1.41L18.73 22 20 20.73z"
      />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M14 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2l5 4V4l-5 4z"
      />
    </svg>
  );
}



export default function Landing() {
  const navigate = useNavigate();
  const { user } = useUser();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const displayName = user.name || 'Participant';
  const displayInitial = getUserInitials(displayName).charAt(0);
  const avatarTone = useAvatarTone(user.avatar, displayName);

  const [meetingCode, setMeetingCode] = useState('');
  const [micMuted, setMicMuted] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);

  // New QR features states
  const [scannerOpen, setScannerOpen] = useState(false);
  const [createdQrCode, setCreatedQrCode] = useState(null); // { code, url }
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [scanError, setScanError] = useState('');
  const [copied, setCopied] = useState(false);
  const [localIp, setLocalIp] = useState('localhost');
  const html5QrCodeRef = useRef(null);

  // Fetch local Wi-Fi IP address on mount
  useEffect(() => {
    apiClient.get('/api/auth/local-ip')
      .then((res) => {
        if (res.data.success && res.data.localIp) {
          setLocalIp(res.data.localIp);
        }
      })
      .catch((err) => console.warn('Could not resolve local IP:', err));
  }, []);

  // Generate QR code data URL locally when code is created
  useEffect(() => {
    if (createdQrCode) {
      try {
        const qrFunc = QRCode.toDataURL || (QRCode.default && QRCode.default.toDataURL);
        if (typeof qrFunc === 'function') {
          qrFunc(
            createdQrCode.url,
            {
              width: 250,
              margin: 1,
              color: {
                dark: '#eedca0', // Gold-bright text color
                light: '#141414', // Sleek dark surface background
              },
            },
            (err, url) => {
              if (err) {
                console.error('Local QR Code Generation Error:', err);
              } else {
                setQrDataUrl(url);
              }
            }
          );
        } else {
          console.error('toDataURL function not found on QRCode object:', QRCode);
        }
      } catch (err) {
        console.error('Error calling QRCode.toDataURL:', err);
      }
    } else {
      setQrDataUrl('');
    }
  }, [createdQrCode]);

  // QR Scanner initialization
  useEffect(() => {
    let scannerInstance = null;
    let cancelled = false;

    if (scannerOpen) {
      setScanError('');
      // Give DOM time to render div; the scanner library (large) loads only when the scanner opens.
      setTimeout(async () => {
        const el = document.getElementById('qr-reader-target');
        if (!el) return;
        let Html5Qrcode;
        try { ({ Html5Qrcode } = await import('html5-qrcode')); }
        catch { setScanError('Could not load the QR scanner. Check your connection and retry.'); return; }
        if (cancelled) return;

        scannerInstance = new Html5Qrcode('qr-reader-target');
        html5QrCodeRef.current = scannerInstance;

        scannerInstance.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            let code = decodedText.trim();
            if (code.includes('/room/')) {
              code = code.split('/room/').pop().split('?')[0];
            } else if (code.includes('code=')) {
              code = code.split('code=').pop().split('&')[0];
            }

            const normalized = normalizeMeetingCode(code);
            setMeetingCode(normalized);
            setScannerOpen(false);

            // Automatically navigate
            setTimeout(() => {
              navigate(`/room/${encodeURIComponent(normalized)}`);
            }, 300);
          },
          () => {
            // Keep scan logs quiet
          }
        ).catch((err) => {
          setScanError('Unable to access camera or verify permissions.');
          console.error(err);
        });
      }, 300);
    }

    return () => {
      cancelled = true;
      if (scannerInstance && scannerInstance.isScanning) {
        scannerInstance.stop().catch((e) => console.error('Stop scanner error:', e));
      }
    };
  }, [scannerOpen, navigate]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraOn]);

  const startCamera = async () => {
    if (!navigator.mediaDevices) {
      window.alert('Camera access requires HTTPS or localhost on mobile devices.');
      setCameraOn(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraOn(true);
    } catch (error) {
      setCameraOn(false);
      window.alert('Unable to access camera. Please check browser permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraOn(false);
  };

  const handleCameraToggle = () => {
    if (cameraOn) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  const handleJoin = () => {
    const code = normalizeMeetingCode(meetingCode);
    if (!code) { window.alert('Please enter a meeting code.'); return; }
    if (!isValidRoomCode(code)) { window.alert('Enter a valid meeting code or invite link.'); return; }
    navigate(`/room/${encodeURIComponent(code)}`);
  };

  const handleCreateMeeting = () => {
    const roomCode = generateRoomCode();
    sessionStorage.setItem('etherx_host_room', roomCode);
    sessionStorage.setItem('etherx_meet_start', String(Date.now()));
    navigate(`/room/${roomCode}`);
  };

  const handleCreateMeetingWithQR = () => {
    const roomCode = generateRoomCode();
    const activeHost = localIp !== 'localhost' ? localIp : window.location.hostname;

    const origin = window.location.origin
      .replace('localhost', activeHost)
      .replace('127.0.0.1', activeHost);

    const url = `${origin}/join?code=${roomCode}`;
    setCreatedQrCode({ code: roomCode, url });
  };

  const handleCopyLink = () => {
    if (!createdQrCode) return;
    navigator.clipboard.writeText(createdQrCode.url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
  };

  const handleJoinCreated = () => {
    if (!createdQrCode) return;
    sessionStorage.setItem('etherx_host_room', createdQrCode.code);
    sessionStorage.setItem('etherx_meet_start', String(Date.now()));
    navigate(`/room/${createdQrCode.code}`);
  };

  return (
    <AnimatedPage style={{ position: 'relative' }}>
      <div className="meet-landing">
        <WorkspaceHeader />

        <main className="meet-main">
          <div className="meet-content">
            <section className="meet-preview-column">
              <div className="meet-preview-box" style={cameraOn ? undefined : { background: avatarTone.tile }}>
                {cameraOn ? (
                  <video ref={videoRef} autoPlay muted playsInline className="meet-video" />
                ) : (
                  <ProfileAvatar className="meet-preview-avatar" style={{ background: avatarTone.circle }} src={user.avatar} name={displayName} initials={displayInitial} />
                )}

                <span className="meet-label meet-name-label">{displayName}</span>
                <span className="meet-label meet-camera-label">{cameraOn ? 'Camera is on' : 'Camera is off'}</span>
              </div>

              <div className="meet-controls">
                <button
                  type="button"
                  className={`meet-control-btn ${micMuted ? 'is-muted' : ''}`}
                  onClick={() => setMicMuted((value) => !value)}
                  aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
                >
                  {micMuted ? <MicOff /> : <Mic />}
                </button>

                <button
                  type="button"
                  className={`meet-control-btn ${cameraOn ? '' : 'is-muted'}`}
                  onClick={handleCameraToggle}
                  aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'}
                >
                  {cameraOn ? <Video /> : <VideoOff />}
                </button>


              </div>
            </section>

            <motion.section
              className="meet-join-column"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              <motion.h1 variants={staggerChild}>Ready to join?</motion.h1>
              <motion.p variants={staggerChild}>No one else can see you until you join this meeting.</motion.p>

              <motion.div variants={staggerChild} className="meet-join-row">
                <input
                  type="text"
                  value={meetingCode}
                  onChange={(event) => setMeetingCode(normalizeMeetingCode(event.target.value))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      handleJoin();
                    }
                  }}
                  placeholder="Enter a code or link"
                  aria-label="Meeting code"
                  data-cursor-hover
                />

                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  title="Scan QR Code to Join"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#d4af37',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 8px',
                    cursor: 'pointer',
                    marginRight: '4px',
                    transition: 'opacity 0.2s',
                    flexShrink: 0
                  }}
                >
                  <Scan size={20} />
                </button>

                <motion.button type="button" className="join-btn" onClick={handleJoin} {...glowPulse}>
                  Join
                </motion.button>
              </motion.div>

              <motion.div variants={staggerChild} className="meet-divider" aria-hidden="true">
                <span>or</span>
              </motion.div>

              <div className="new-meeting-group" style={{ display: 'flex', gap: '8px', width: '100%' }}>
                <motion.button
                  type="button"
                  className="new-meeting-btn"
                  onClick={handleCreateMeeting}
                  variants={staggerChild}
                  {...glowPulse}
                  style={{ flex: 1 }}
                >
                  New meeting
                </motion.button>

                <motion.button
                  type="button"
                  className="new-meeting-qr-btn"
                  onClick={handleCreateMeetingWithQR}
                  variants={staggerChild}
                  title="Create meeting and show QR Code"
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '12px',
                    border: '1.5px solid rgba(45, 42, 36, 0.70)',
                    color: '#d4af37',
                    background: 'rgba(0, 0, 0, 0.97)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 8px 40px rgba(0,0,0,0.80), 0 0 28px rgba(212, 175, 55, 0.16)',
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                >
                  <QrCode size={20} />
                </motion.button>
              </div>

              {TERMS_URL && PRIVACY_URL && (
                <motion.p variants={staggerChild} className="meet-privacy-note">
                  By continuing, you agree to our <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">Terms</a> and <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
                </motion.p>
              )}
            </motion.section>
          </div>
        </main>
      </div>

      {/* ── QR Scanner Modal ── */}
      <AnimatePresence>
        {scannerOpen && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(16px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              style={{
                width: '100%',
                maxWidth: '380px',
                background: '#0c0c0e',
                border: '1.5px solid rgba(212, 175, 55, 0.3)',
                borderRadius: '16px',
                padding: '32px 28px',
                boxShadow: '0 24px 64px rgba(0,0,0,0.9), 0 0 40px rgba(212,175,55,0.06)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '24px',
                position: 'relative'
              }}
            >
              <button
                onClick={() => setScannerOpen(false)}
                style={{
                  position: 'absolute',
                  top: '20px',
                  right: '20px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  color: 'rgba(255, 255, 255, 0.6)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.target.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.target.style.color = 'rgba(255, 255, 255, 0.6)';
                }}
              >
                ✕
              </button>

              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#d4af37', letterSpacing: '-0.02em' }}>
                Scan Meeting QR
              </h3>

              {scanError ? (
                <p style={{ color: '#ef4444', fontSize: '13px', textAlign: 'center', margin: 0 }}>{scanError}</p>
              ) : (
                <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '13px', textAlign: 'center', margin: 0, lineHeight: '1.5' }}>
                  Align the QR code within the scanning window.
                </p>
              )}

              <div
                id="qr-reader-target"
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  background: '#000',
                  border: '1.5px solid rgba(212, 175, 55, 0.15)',
                }}
              />

              <button
                onClick={() => setScannerOpen(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  padding: '10px 24px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.08)'}
                onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.04)'}
              >
                Cancel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── QR Generator Modal ── */}
      <AnimatePresence>
        {createdQrCode && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(16px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              style={{
                width: '100%',
                maxWidth: '380px',
                background: '#0c0c0e',
                border: '1.5px solid rgba(212, 175, 55, 0.3)',
                borderRadius: '16px',
                padding: '32px 28px',
                boxShadow: '0 24px 64px rgba(0,0,0,0.9), 0 0 40px rgba(212,175,55,0.06)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '24px',
                position: 'relative'
              }}
            >
              <button
                onClick={() => setCreatedQrCode(null)}
                style={{
                  position: 'absolute',
                  top: '20px',
                  right: '20px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  color: 'rgba(255, 255, 255, 0.6)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.target.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.target.style.color = 'rgba(255, 255, 255, 0.6)';
                }}
              >
                ✕
              </button>

              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#d4af37', letterSpacing: '-0.02em' }}>
                Meeting QR Code
              </h3>

              <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '13px', textAlign: 'center', margin: 0, lineHeight: '1.5' }}>
                Scan with your mobile device on the same Wi-Fi network to connect.
              </p>

              <img
                src={qrDataUrl || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(createdQrCode.url)}&color=eedca0&bgcolor=0c0c0e`}
                alt="Meeting QR Code"
                style={{
                  width: '200px',
                  height: '200px',
                  borderRadius: '12px',
                  border: '1.5px solid rgba(212, 175, 55, 0.15)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                  background: '#0c0c0e'
                }}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'rgba(212, 175, 55, 0.6)', letterSpacing: '0.08em', fontWeight: 600 }}>
                  Meeting Code
                </span>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff', letterSpacing: '0.02em' }}>
                  {createdQrCode.code}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: '9px', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '0.05em' }}>
                  Phone Connect Link
                </span>
                <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', wordBreak: 'break-all', textAlign: 'center', fontFamily: 'monospace' }}>
                  {createdQrCode.url}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                <button
                  onClick={handleCopyLink}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 600,
                    height: '42px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.08)'}
                  onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.04)'}
                >
                  {copied ? 'Copied' : 'Copy Link'}
                </button>

                <button
                  onClick={handleJoinCreated}
                  style={{
                    flex: 1,
                    background: 'linear-gradient(135deg, #d4af37 0%, #b8860b 100%)',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#0a0800',
                    fontSize: '13px',
                    fontWeight: 700,
                    height: '42px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(212,175,55,0.2)',
                    transition: 'opacity 0.2s',
                  }}
                >
                  Join Now
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AnimatedPage>
  );
}
