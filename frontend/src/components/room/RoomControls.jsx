import { Mic, MicOff, Video, VideoOff, ChevronUp, MonitorUp, MessageCircle, Hand, Users, Smile } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

function Control({ title, onClick, active, danger, disabled, children, className = '', badge, unread }) {
  return <button type="button" title={title} aria-label={title} aria-pressed={active}
    disabled={disabled} onClick={onClick} className={`exmeet-control ${className}`}
    data-active={active || undefined} data-danger={danger || undefined}>
    {children}{badge != null && <span className="exmeet-control-count">{badge}</span>}
    {unread && <span className="exmeet-unread-dot" aria-label="Unread messages"/>}
  </button>;
}

export default function RoomControls({ micMuted, hostMuted, cameraOff, toggleMic, toggleCamera, onSettings,
  isScreenSharing, toggleScreenShare, canHost, chatOpen, chatUnread, toggleChat, raised, handPosition, toggleHand,
  peopleOpen, togglePeople, total, onLeave, sendReaction, children }) {
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const reactionsRef = useRef(null);
  useEffect(() => {
    if (!reactionsOpen) return;
    const close = event => { if (!reactionsRef.current?.contains(event.target)) setReactionsOpen(false); };
    const key = event => { if (event.key === 'Escape') setReactionsOpen(false); };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', key); };
  }, [reactionsOpen]);
  return <footer className="exmeet-footer"><div className="toolbar-wrap exmeet-toolbar" role="toolbar" aria-label="Meeting controls">
    <div className="exmeet-device-control" data-danger={micMuted || hostMuted || undefined}>
      <Control title={hostMuted ? 'Microphone muted by host' : micMuted ? 'Unmute microphone' : 'Mute microphone'}
        onClick={toggleMic} disabled={hostMuted} active={!micMuted && !hostMuted}>{micMuted || hostMuted ? <MicOff/> : <Mic/>}</Control>
      <button className="exmeet-device-chevron" title="Audio settings" aria-label="Audio settings" onClick={() => onSettings('audio')}><ChevronUp size={12}/></button>
    </div>
    <div className="exmeet-device-control" data-danger={cameraOff || undefined}>
      <Control title={cameraOff ? 'Start camera' : 'Stop camera'} onClick={toggleCamera} active={!cameraOff}>{cameraOff ? <VideoOff/> : <Video/>}</Control>
      <button className="exmeet-device-chevron" title="Video settings" aria-label="Video settings" onClick={() => onSettings('video')}><ChevronUp size={12}/></button>
    </div>
    <span className="exmeet-toolbar-divider exmeet-extra-control"/>
    {canHost && <><Control className="exmeet-extra-control" title={isScreenSharing ? 'Stop sharing screen' : 'Share screen'} onClick={toggleScreenShare} active={isScreenSharing}><MonitorUp/></Control>
      <span className="exmeet-toolbar-divider exmeet-extra-control"/></>}
    <div className="exmeet-reactions exmeet-extra-control" ref={reactionsRef}>
      <Control title="Reactions" onClick={() => setReactionsOpen(value => !value)} active={reactionsOpen}><Smile/></Control>
      {reactionsOpen && <div className="exmeet-reaction-menu" aria-label="Send reaction">{['👍', '❤️', '👏', '🎉', '😂', '🙌'].map(emoji =>
        <button key={emoji} title={`Send ${emoji} reaction`} aria-label={`Send ${emoji} reaction`} onClick={() => { sendReaction(emoji); setReactionsOpen(false); }}>{emoji}</button>)}</div>}
    </div>
    <Control title="Chat" onClick={toggleChat} active={chatOpen} unread={chatUnread}><MessageCircle/></Control>
    <Control title={raised ? 'Lower hand' : 'Raise hand'} onClick={toggleHand} active={raised} badge={raised ? handPosition : undefined}><Hand/></Control>
    <Control className="exmeet-people-control" title="Participants" onClick={togglePeople} active={peopleOpen} badge={total}><Users/></Control>
    {children}
    <span className="exmeet-toolbar-divider"/>
    <button type="button" className="exmeet-leave" title="Leave call" aria-label="Leave call" onClick={onLeave}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 15.5c5-4.7 13-4.7 18 0l-2.2 2.3-3.3-1.4v-2.6c-2.3-.8-4.7-.8-7 0v2.6l-3.3 1.4z"/></svg><span>Leave</span>
    </button>
  </div></footer>;
}
