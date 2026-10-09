import { useEffect, useRef } from 'react';
import { MicOff, ShieldCheck } from 'lucide-react';
import { useStreamLevel } from '../../hooks/useStreamLevel';
import VideoCanvasProcessor from './VideoCanvasProcessor';

export default function VideoTile({ stream, userName = 'Guest', isLocal = false, isMuted = false,
  isCameraOff = false, isSmall = false, onClick, hasWallet = false, filter = 'none',
  bgImage = 'none', fit = 'cover', isHandRaised = false, handPosition, badge, children, hidden = false }) {
  const videoRef = useRef(null);
  const hasVideo = !!stream?.getVideoTracks().some(track => track.readyState !== 'ended');
  const hasEffects = filter !== 'none' || bgImage !== 'none';
  const showVideo = hasVideo && !isCameraOff && !hidden;
  const initials = userName.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?';
  const level = useStreamLevel(stream, !isMuted && fit !== 'contain');
  const speaking = !isMuted && level > .2;

  useEffect(() => {
    if (!videoRef.current || !showVideo || hasEffects) return;
    videoRef.current.srcObject = stream;
    videoRef.current.play().catch(() => {});
  }, [stream, showVideo, hasEffects]);

  return (
    <div className={`exmeet-tile${isSmall ? ' exmeet-tile-small' : ''}`} data-local={isLocal} data-speaking={speaking || undefined}
      onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `Spotlight ${userName}` : undefined}
      onKeyDown={onClick ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick(); } } : undefined}
      style={!showVideo && bgImage !== 'none' ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
      {showVideo ? hasEffects ? <VideoCanvasProcessor stream={stream} activeFilter={filter} selectedBgImage={bgImage} mirror={isLocal}/>
        : <video ref={videoRef} autoPlay playsInline muted disablePictureInPicture disableRemotePlayback
          style={{ objectFit: fit, transform: isLocal && fit !== 'contain' ? 'scaleX(-1)' : undefined }}/>
        : <div className="exmeet-tile-empty"><div className="exmeet-avatar">{initials}</div>
          {hidden && <p className="exmeet-muted">Self view hidden</p>}{children}</div>}
      {isHandRaised && <span className="exmeet-hand-badge" aria-label={`${userName} raised their hand${handPosition ? `, position ${handPosition}` : ''}`}>Hand {handPosition || 'raised'}</span>}
      {hasWallet && <span className="exmeet-verified"><ShieldCheck size={13}/> Verified</span>}
      <div className="exmeet-tile-name">{isMuted && <MicOff size={14} className="exmeet-danger"/>}
        <span>{userName}{isLocal ? ' (you)' : ''}</span>
        {!isMuted && <span className="exmeet-voice-meter" aria-label={speaking ? `${userName} is speaking` : `${userName} microphone on`}>
          {[.55, 1, .7].map((scale, index) => <i key={index} style={{height: Math.max(3, Math.round(12 * scale * (.2 + level * .8)))}}/>)}</span>}
        {badge && <span className="exmeet-role">{badge}</span>}
      </div>
    </div>
  );
}
