import { useEffect, useRef, useState } from 'react';
import { normalizeRoomCode, isValidRoomCode } from '../utils/roomCode';
import { QrCode, Scan, Mic, MicOff, Video, VideoOff, Plus, Keyboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getUserInitials } from '../utils/auth';
import { useUser } from '../context/UserContext';
import WorkspaceHeader from '../components/layout/WorkspaceHeader';
import ProfileAvatar from '../components/ui/ProfileAvatar';
import { useAvatarTone } from '../utils/avatarTone';
import AnimatedPage from '../components/layout/AnimatedPage';
import { staggerContainer, staggerChild } from '../utils/animationVariants';
import '../styles/landing.css';
import * as QRCode from 'qrcode';
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

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useUser();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const displayName = user.name || 'Participant';
  const displayInitial = getUserInitials(displayName).charAt(0);
  const firstName = displayName.split(' ')[0];
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
            <section className="meet-preview-column" aria-label="Camera preview">
              <div className={`meet-preview-box ${cameraOn ? 'is-live' : ''}`}>
                {cameraOn ? (
                  <video ref={videoRef} autoPlay muted playsInline className="meet-video" />
                ) : (
                  <div className="meet-preview-idle">
                    <ProfileAvatar className="meet-preview-avatar" style={{ background: avatarTone.circle }} src={user.avatar} name={displayName} initials={displayInitial} />
                    <span className="meet-preview-hint">Camera is off</span>
                  </div>
                )}

                <span className="meet-label meet-name-label">{displayName}</span>

                <div className="meet-controls">
                  <button
                    type="button"
                    className={`meet-control-btn ${micMuted ? 'is-muted' : ''}`}
                    onClick={() => setMicMuted((value) => !value)}
                    aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
                    title={micMuted ? 'Unmute microphone' : 'Mute microphone'}
                  >
                    {micMuted ? <MicOff /> : <Mic />}
                  </button>

                  <button
                    type="button"
                    className={`meet-control-btn ${cameraOn ? '' : 'is-muted'}`}
                    onClick={handleCameraToggle}
                    aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'}
                    title={cameraOn ? 'Turn camera off' : 'Turn camera on'}
                  >
                    {cameraOn ? <Video /> : <VideoOff />}
                  </button>
                </div>
              </div>
            </section>

            <motion.section
              className="meet-join-column"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              <motion.span variants={staggerChild} className="meet-eyebrow">Welcome back, {firstName}</motion.span>
              <motion.h1 variants={staggerChild}>Ready to join?</motion.h1>
              <motion.p variants={staggerChild}>No one else can see you until you join this meeting.</motion.p>

              <motion.div variants={staggerChild} className="meet-join-row">
                <Keyboard className="meet-join-icon" size={18} aria-hidden="true" />
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
                  className="meet-scan-btn"
                  onClick={() => setScannerOpen(true)}
                  title="Scan QR code to join"
                  aria-label="Scan QR code to join"
                >
                  <Scan size={18} />
                </button>

                <button type="button" className="join-btn" onClick={handleJoin} disabled={!meetingCode}>
                  Join
                </button>
              </motion.div>

              <motion.div variants={staggerChild} className="meet-divider" aria-hidden="true">
                <span>or</span>
              </motion.div>

              <motion.div variants={staggerChild} className="new-meeting-group">
                <button type="button" className="new-meeting-btn" onClick={handleCreateMeeting}>
                  <Plus size={18} aria-hidden="true" />
                  New meeting
                </button>

                <button
                  type="button"
                  className="new-meeting-qr-btn"
                  onClick={handleCreateMeetingWithQR}
                  title="Create meeting and show QR code"
                  aria-label="Create meeting and show QR code"
                >
                  <QrCode size={20} />
                </button>
              </motion.div>

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
            background: 'color-mix(in srgb, var(--c-000000) 85%, transparent)',
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
                background: 'var(--c-0c0c0e)',
                border: '1.5px solid rgba(212, 175, 55, 0.3)',
                borderRadius: '16px',
                padding: '32px 28px',
                boxShadow: '0 24px 64px color-mix(in srgb, var(--s-000000) 90%, transparent), 0 0 40px rgba(212,175,55,0.06)',
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
                  background: 'color-mix(in srgb, var(--c-ffffff) 5%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--c-ffffff) 10%, transparent)',
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  color: 'color-mix(in srgb, var(--t-ffffff) 60%, transparent)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'color-mix(in srgb, var(--c-ffffff) 10%, transparent)';
                  e.target.style.color = 'var(--t-ffffff)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'color-mix(in srgb, var(--c-ffffff) 5%, transparent)';
                  e.target.style.color = 'color-mix(in srgb, var(--t-ffffff) 60%, transparent)';
                }}
              >
                ✕
              </button>

              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--t-d4af37)', letterSpacing: '-0.02em' }}>
                Scan Meeting QR
              </h3>

              {scanError ? (
                <p style={{ color: 'var(--t-ef4444)', fontSize: '13px', textAlign: 'center', margin: 0 }}>{scanError}</p>
              ) : (
                <p style={{ color: 'color-mix(in srgb, var(--t-ffffff) 50%, transparent)', fontSize: '13px', textAlign: 'center', margin: 0, lineHeight: '1.5' }}>
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
                  background: 'var(--c-000000)',
                  border: '1.5px solid rgba(212, 175, 55, 0.15)',
                }}
              />

              <button
                onClick={() => setScannerOpen(false)}
                style={{
                  background: 'color-mix(in srgb, var(--c-ffffff) 4%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--c-ffffff) 8%, transparent)',
                  borderRadius: '10px',
                  color: 'var(--t-ffffff)',
                  fontSize: '13px',
                  fontWeight: 600,
                  padding: '10px 24px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => e.target.style.background = 'color-mix(in srgb, var(--c-ffffff) 8%, transparent)'}
                onMouseLeave={(e) => e.target.style.background = 'color-mix(in srgb, var(--c-ffffff) 4%, transparent)'}
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
            background: 'color-mix(in srgb, var(--c-000000) 85%, transparent)',
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
                background: 'var(--c-0c0c0e)',
                border: '1.5px solid rgba(212, 175, 55, 0.3)',
                borderRadius: '16px',
                padding: '32px 28px',
                boxShadow: '0 24px 64px color-mix(in srgb, var(--s-000000) 90%, transparent), 0 0 40px rgba(212,175,55,0.06)',
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
                  background: 'color-mix(in srgb, var(--c-ffffff) 5%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--c-ffffff) 10%, transparent)',
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  color: 'color-mix(in srgb, var(--t-ffffff) 60%, transparent)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'color-mix(in srgb, var(--c-ffffff) 10%, transparent)';
                  e.target.style.color = 'var(--t-ffffff)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'color-mix(in srgb, var(--c-ffffff) 5%, transparent)';
                  e.target.style.color = 'color-mix(in srgb, var(--t-ffffff) 60%, transparent)';
                }}
              >
                ✕
              </button>

              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--t-d4af37)', letterSpacing: '-0.02em' }}>
                Meeting QR Code
              </h3>

              <p style={{ color: 'color-mix(in srgb, var(--t-ffffff) 50%, transparent)', fontSize: '13px', textAlign: 'center', margin: 0, lineHeight: '1.5' }}>
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
                  boxShadow: '0 8px 32px color-mix(in srgb, var(--s-000000) 60%, transparent)',
                  background: 'var(--c-0c0c0e)'
                }}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'color-mix(in srgb, var(--t-d4af37) 60%, transparent)', letterSpacing: '0.08em', fontWeight: 600 }}>
                  Meeting Code
                </span>
                <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--t-ffffff)', letterSpacing: '0.02em' }}>
                  {createdQrCode.code}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', alignItems: 'center', background: 'color-mix(in srgb, var(--c-ffffff) 2%, transparent)', padding: '10px', borderRadius: '10px', border: '1px solid color-mix(in srgb, var(--c-ffffff) 4%, transparent)' }}>
                <span style={{ fontSize: '9px', textTransform: 'uppercase', color: 'color-mix(in srgb, var(--t-ffffff) 40%, transparent)', letterSpacing: '0.05em' }}>
                  Phone Connect Link
                </span>
                <span style={{ fontSize: '11px', color: 'color-mix(in srgb, var(--t-ffffff) 60%, transparent)', wordBreak: 'break-all', textAlign: 'center', fontFamily: 'monospace' }}>
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
                    background: 'color-mix(in srgb, var(--c-ffffff) 4%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--c-ffffff) 8%, transparent)',
                    borderRadius: '10px',
                    color: 'var(--t-ffffff)',
                    fontSize: '13px',
                    fontWeight: 600,
                    height: '42px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'color-mix(in srgb, var(--c-ffffff) 8%, transparent)'}
                  onMouseLeave={(e) => e.target.style.background = 'color-mix(in srgb, var(--c-ffffff) 4%, transparent)'}
                >
                  {copied ? 'Copied' : 'Copy Link'}
                </button>

                <button
                  onClick={handleJoinCreated}
                  style={{
                    flex: 1,
                    background: 'linear-gradient(135deg, var(--c-d4af37) 0%, var(--c-b8860b) 100%)',
                    border: 'none',
                    borderRadius: '10px',
                    color: 'var(--t-0a0800)',
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
