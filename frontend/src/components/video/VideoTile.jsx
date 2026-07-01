import { useEffect, useRef } from 'react';

const AVATAR_COLORS = [
  '#ec4899', '#8b5cf6', '#3b82f6', '#10b981',
  '#f59e0b', '#A78BFA', '#7C3AED', '#a855f7',
];

function avatarColor(name) {
  const code = (name || 'A').charCodeAt(0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

export default function VideoTile({
  stream,
  userName,
  isLocal = false,
  isMuted = false,
  isCameraOff = false,
  isSpotlight = false,
  isSmall = false,
  onClick,
  hasWallet = false,
  filter = 'none',
  bgImage = 'none',
}) {
  const videoRef = useRef(null);
  const initial  = (userName || 'A').charAt(0).toUpperCase();
  const color    = avatarColor(initial);
  const hasVideo = stream && stream.getVideoTracks().length > 0;

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  if (isSmall) {
    return (
      <div
        onClick={onClick}
        style={{
          position: 'relative', width: '100%', height: '100%',
          borderRadius: 10, overflow: 'hidden',
          background: '#111', cursor: onClick ? 'pointer' : 'default',
          border: hasWallet ? '2px solid #7C3AED' : '1px solid rgba(255,255,255,0.08)',
          boxShadow: hasWallet ? '0 0 12px rgba(124,58,237,0.3)' : 'none',
        }}
      >
        {hasWallet && (
          <div style={{
            position:'absolute', top:4, right:4, zIndex:10,
            background:'rgba(124,58,237,0.85)',
            borderRadius:999, padding:'2px 6px',
            fontSize:9, fontWeight:700, color:'#fff', letterSpacing:'0.05em',
            pointerEvents:'none',
          }}>✦ Verified</div>
        )}
        {hasVideo && !isCameraOff ? (
          <video ref={videoRef} autoPlay playsInline muted={isLocal}
            disablePictureInPicture disableRemotePlayback
            style={{ width: '100%', height: '100%', objectFit: 'cover', outline: 'none', filter }} />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: bgImage === 'none' ? '#0a0a0a' : `url(${bgImage}) center/cover`,
            transition: 'background 0.3s'
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: `linear-gradient(135deg, ${color}, ${color}cc)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 600, color: '#fff',
            }}>{initial}</div>
          </div>
        )}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '12px 6px 5px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
        }}>
          <span style={{ fontSize: 10, color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
            {isLocal ? `${userName} (you)` : userName}
          </span>
        </div>
        {isMuted && (
          <div style={{
            position: 'absolute', top: 6, right: 6,
            width: 18, height: 18, borderRadius: '50%', background: '#E04F5F',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg viewBox="0 0 24 24" width={10} height={10}>
              <line x1="3" y1="3" x2="21" y2="21" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
        )}
      </div>
    );
  }

  // Spotlight / solo view — floating avatar
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
      background: bgImage === 'none' ? 'transparent' : `url(${bgImage}) center/cover`,
      transition: 'background 0.3s'
    }}>

      {hasVideo && !isCameraOff ? (
        <video ref={videoRef} autoPlay playsInline muted={isLocal}
          disablePictureInPicture disableRemotePlayback
          style={{ width: '100%', height: '100%', objectFit: 'cover', outline: 'none', filter }} />
      ) : (
        <div className="float-avatar" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          {/* Pulse ring */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="pulse-ring" style={{
              position: 'absolute',
              width: 222, height: 222,
              borderRadius: '50%',
              border: '1px solid rgba(167,139,250,0.30)',
            }} />
            {/* Avatar circle */}
            <div style={{
              width: 192, height: 192, borderRadius: '50%',
              background: 'linear-gradient(135deg, #A78BFA, #6D28D9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 72, fontWeight: 600, color: '#fff',
              fontFamily: 'Geist, Inter, sans-serif',
              boxShadow: '0 0 60px rgba(124,58,237,0.4)',
              position: 'relative',
              userSelect: 'none',
            }}>
              {initial}
              <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.35), transparent 55%)' }} />
            </div>
          </div>
          {/* Name below avatar */}
          <div style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 999,
            padding: '5px 16px',
            fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.8)',
            fontFamily: 'Inter, sans-serif',
          }}>
            {isLocal ? `${userName} (you)` : userName}
            {isMuted && <span style={{ color: '#E04F5F', marginLeft: 6 }}>· muted</span>}
          </div>
        </div>
      )}
    </div>
  );
}
