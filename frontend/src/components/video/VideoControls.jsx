import { useState, useRef, useEffect } from 'react';
import {
  Monitor, Mic, MicOff, Video, VideoOff,
  MessageSquare, Hand, Users, LayoutGrid,
  UserPlus, MoreHorizontal, Maximize, Minimize,
  Settings, Copy, Flag, FileText, BarChart2,
  List, SmilePlus, Film, PenLine, Timer, HelpCircle,
  Sparkles, Layers, FolderOpen, Image, Vote, Wallet,
  Crosshair, Download, Palette, PartyPopper,
  CheckSquare, BarChart3, Award, Shuffle, ThumbsUp, PictureInPicture2,
  FlipHorizontal, Smile, Music2, Activity, Eye, EyeOff, ZoomIn,
  PhoneOff,
} from 'lucide-react';

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  glass:      'rgba(255,255,255,0.78)',
  glassBlur:  'blur(20px)',
  glassBdr:   '1px solid rgba(255,255,255,0.65)',
  popup:      'rgba(255,255,255,0.97)',
  text:       '#0b1c30',
  textMuted:  '#424754',
  textFaint:  '#727785',
  primary:    '#7C3AED',
  primBg:     'rgba(124,58,237,0.08)',
  primBdr:    'rgba(124,58,237,0.2)',
  error:      '#ba1a1a',
  errBg:      'rgba(186,26,26,0.08)',
  errBdr:     'rgba(186,26,26,0.18)',
  surface:    '#eff4ff',
  outline:    'rgba(194,198,214,0.55)',
};

// ── CC icon ──────────────────────────────────────────────────────────────────
function CCIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <text x="5" y="16" fontSize="8" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Inter,sans-serif">CC</text>
    </svg>
  );
}

// ── Light glass icon button ───────────────────────────────────────────────────
function CtrlBtn({ onClick, label, active, muted, badge, children }) {
  const bg  = muted  ? C.errBg  : active ? C.primBg  : C.surface;
  const bdr = muted  ? C.errBdr : active ? C.primBdr : C.outline;
  const col = muted  ? C.error  : active ? C.primary : C.textMuted;
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        width: 48, height: 48, borderRadius: 12,
        border: `1px solid ${bdr}`, background: bg, color: col,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', position: 'relative', flexShrink: 0,
        transition: 'background 0.15s, color 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = muted ? 'rgba(186,26,26,0.14)' : active ? 'rgba(124,58,237,0.14)' : '#fff';
        e.currentTarget.style.color = muted ? C.error : C.primary;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = bg;
        e.currentTarget.style.color = col;
      }}
    >
      {children}
      {badge != null && (
        <span style={{
          position: 'absolute', top: -4, right: -4,
          width: 18, height: 18, borderRadius: '50%',
          background: C.primary, color: '#fff',
          fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Geist, Inter, sans-serif', border: '2px solid #FAFAF9',
        }}>
          {badge}
        </span>
      )}
    </button>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 28, background: C.outline, flexShrink: 0, margin: '0 2px' }} />;
}

// ── Features popup (light) ─────────────────────────────────────────────────
function FeaturesMenu({ onClose,
  aiSummaryOpen, onToggleAISummary,
  breakoutOpen, onToggleBreakout,
  fileShareOpen, onToggleFileShare,
  virtualBgOpen, onToggleVirtualBg,
  onchainVoteOpen, onToggleOnchainVote,
  walletFeedOpen, onToggleWalletFeed,
  focusMode, onToggleFocusMode,
  onExportTranscript,
  themeOpen, onToggleTheme,
  onConfettiBurst,
  actionItemsOpen, onToggleActionItems,
  speakingTimeOpen, onToggleSpeakingTime,
  poapOpen, onTogglePoap,
  icebreakOpen, onToggleIcebreak,
  consensusActive, onToggleConsensus,
  onPiP,
  mirrorCamera, onToggleMirror,
  emojiStatusOpen, onToggleEmojiStatus,
  soundboardOpen, onToggleSoundboard,
  statsOpen, onToggleStats,
  cleanView, onToggleCleanView,
  onZoomSpotlight, spotlightZoom,
}) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  const isFullscreen = !!document.fullscreenElement;
  const toggleFullscreen = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); onClose(); };
  const copyLink = () => { navigator.clipboard.writeText(window.location.href); onClose(); };
  const act = (fn) => { fn(); onClose(); };

  const features = [
    { Icon: Sparkles,          label: 'AI Summary',    active: aiSummaryOpen,    fn: onToggleAISummary },
    { Icon: Layers,            label: 'Breakout',      active: breakoutOpen,     fn: onToggleBreakout },
    { Icon: FolderOpen,        label: 'Share Files',   active: fileShareOpen,    fn: onToggleFileShare },
    { Icon: Image,             label: 'Virtual BG',    active: virtualBgOpen,    fn: onToggleVirtualBg },
    { Icon: Vote,              label: 'On-Chain Vote', active: onchainVoteOpen,  fn: onToggleOnchainVote },
    { Icon: Wallet,            label: 'Wallet Feed',   active: walletFeedOpen,   fn: onToggleWalletFeed },
    { Icon: Crosshair,         label: 'Focus Mode',    active: focusMode,        fn: onToggleFocusMode },
    { Icon: Download,          label: 'Export',        active: false,            fn: onExportTranscript },
    { Icon: Palette,           label: 'Themes & FX',   active: themeOpen,        fn: onToggleTheme },
    { Icon: PartyPopper,       label: 'Confetti',      active: false,            fn: onConfettiBurst },
    { Icon: CheckSquare,       label: 'Action Items',  active: actionItemsOpen,  fn: onToggleActionItems },
    { Icon: BarChart3,         label: 'Speaking Time', active: speakingTimeOpen, fn: onToggleSpeakingTime },
    { Icon: Award,             label: 'POAP Badge',    active: poapOpen,         fn: onTogglePoap },
    { Icon: Shuffle,           label: 'Icebreaker',    active: icebreakOpen,     fn: onToggleIcebreak },
    { Icon: ThumbsUp,          label: 'Consensus',     active: consensusActive,  fn: onToggleConsensus },
    { Icon: PictureInPicture2, label: 'Picture-in-Pic',active: false,            fn: onPiP },
    { Icon: FlipHorizontal,    label: 'Mirror',        active: mirrorCamera,     fn: onToggleMirror },
    { Icon: Smile,             label: 'Emoji Status',  active: emojiStatusOpen,  fn: onToggleEmojiStatus },
    { Icon: Music2,            label: 'Soundboard',    active: soundboardOpen,   fn: onToggleSoundboard },
    { Icon: Activity,          label: 'Stats',         active: statsOpen,        fn: onToggleStats },
    { Icon: cleanView ? EyeOff : Eye, label: cleanView ? 'Exit Clean' : 'Clean View', active: cleanView, fn: onToggleCleanView },
    { Icon: ZoomIn,            label: spotlightZoom !== 1 ? 'Reset Zoom' : 'Zoom In', active: spotlightZoom !== 1, fn: onZoomSpotlight },
  ];

  const quickActions = [
    { Icon: isFullscreen ? Minimize : Maximize, label: isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen', fn: toggleFullscreen },
    { Icon: Copy,     label: 'Copy meeting link', fn: copyLink },
    { Icon: Settings, label: 'Settings',          fn: onClose },
    { Icon: Flag,     label: 'Report a problem',  fn: onClose },
  ];

  return (
    <div ref={ref} style={{
      position: 'absolute', bottom: 64, right: 0,
      width: 360, maxHeight: '75vh',
      background: C.popup, backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      border: `1px solid ${C.outline}`, borderRadius: 16,
      boxShadow: '0 20px 60px rgba(11,28,48,0.14)',
      zIndex: 100, display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ padding: '13px 16px 11px', borderBottom: `1px solid ${C.outline}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>Features</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textFaint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}>✕</button>
      </div>
      <div style={{ overflowY: 'auto', padding: '10px 10px 6px', flexShrink: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
          {features.map(({ Icon, label, active, fn }) => (
            <button
              key={label}
              onClick={() => act(fn)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                padding: '10px 4px 8px',
                background: active ? C.primBg : C.surface,
                border: `1px solid ${active ? C.primBdr : C.outline}`,
                borderRadius: 10, color: active ? C.primary : C.textMuted,
                cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'Geist, Inter, sans-serif',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = active ? 'rgba(124,58,237,0.14)' : '#f0e9ff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = active ? C.primBg : C.surface; }}
            >
              <Icon size={17} />
              <span style={{ fontSize: 9, fontWeight: 500, textAlign: 'center', lineHeight: 1.25, color: 'inherit' }}>{label}</span>
            </button>
          ))}
        </div>
      </div>
      <div style={{ height: 1, background: C.outline, margin: '6px 0 2px', flexShrink: 0 }} />
      <div style={{ padding: '2px 0 8px', flexShrink: 0 }}>
        {quickActions.map(({ Icon, label, fn }) => (
          <button key={label} onClick={fn} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 16px', background: 'none', border: 'none',
            color: C.textMuted, fontSize: 13, fontFamily: 'Geist, Inter, sans-serif',
            cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = C.surface; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Emoji reaction picker ─────────────────────────────────────────────────────
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '👏', '🔥'];

function EmojiPicker({ onSelect, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  return (
    <div ref={ref} style={{
      position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)',
      background: C.popup, backdropFilter: 'blur(20px)',
      border: `1px solid ${C.outline}`, borderRadius: 14,
      padding: '10px 12px', display: 'flex', gap: 6,
      boxShadow: '0 8px 32px rgba(11,28,48,0.12)', zIndex: 100,
    }}>
      {REACTION_EMOJIS.map(emoji => (
        <button key={emoji} onClick={() => { onSelect(emoji); onClose(); }} style={{
          background: 'none', border: 'none', fontSize: 24,
          cursor: 'pointer', lineHeight: 1, padding: 5, borderRadius: 8,
          transition: 'transform 0.1s, background 0.1s',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.3)'; e.currentTarget.style.background = C.surface; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'none'; }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

// ── Bookmark picker ────────────────────────────────────────────────────────────
function BookmarkPicker({ labels, onSelect, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  return (
    <div ref={ref} style={{
      position: 'absolute', bottom: 60, left: 0,
      background: C.popup, backdropFilter: 'blur(20px)',
      border: `1px solid ${C.outline}`, borderRadius: 12,
      padding: '6px 0', minWidth: 150,
      boxShadow: '0 8px 32px rgba(11,28,48,0.12)', zIndex: 100,
    }}>
      {labels.map(label => (
        <button key={label} onClick={() => { onSelect(label); onClose(); }} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px', background: 'none', border: 'none',
          color: C.textMuted, fontSize: 13, fontFamily: 'Geist, Inter, sans-serif',
          cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = C.surface; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ── VideoControls ─────────────────────────────────────────────────────────────
export default function VideoControls({
  micMuted, cameraOff, isScreenSharing,
  onToggleMic, onToggleCamera, onToggleScreenShare,
  onToggleChat, chatOpen,
  onEnd, onRecord, isRecording,
  participantCount,
  handRaised, onRaiseHand,
  participantsOpen, onToggleParticipants,
  gridView, onToggleGrid,
  onInvite,
  captionsActive, onToggleCaptions,
  onSendReaction,
  isRecordingActive, showBookmarkPicker, onToggleBookmarkPicker, bookmarkLabels, onAddBookmark,
  notesOpen, onToggleNotes,
  pollsOpen, onTogglePolls,
  agendaOpen, onToggleAgenda,
  mediaOpen, onToggleMedia,
  whiteboardOpen, onToggleWhiteboard,
  timerVisible, onToggleTimer,
  qaOpen, onToggleQA,
  aiSummaryOpen, onToggleAISummary,
  breakoutOpen, onToggleBreakout,
  fileShareOpen, onToggleFileShare,
  virtualBgOpen, onToggleVirtualBg,
  onchainVoteOpen, onToggleOnchainVote,
  walletFeedOpen, onToggleWalletFeed,
  focusMode, onToggleFocusMode,
  onExportTranscript,
  themeOpen, onToggleTheme,
  onConfettiBurst,
  actionItemsOpen, onToggleActionItems,
  speakingTimeOpen, onToggleSpeakingTime,
  poapOpen, onTogglePoap,
  icebreakOpen, onToggleIcebreak,
  consensusActive, onToggleConsensus,
  onPiP,
  controlsVisible,
  mirrorCamera, onToggleMirror,
  emojiStatusOpen, onToggleEmojiStatus,
  soundboardOpen, onToggleSoundboard,
  statsOpen, onToggleStats,
  cleanView, onToggleCleanView,
  onZoomSpotlight, spotlightZoom,
}) {
  const [moreOpen,  setMoreOpen]  = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      height: 96, zIndex: 50,
      opacity: controlsVisible === false ? 0 : 1,
      pointerEvents: controlsVisible === false ? 'none' : 'auto',
      transition: 'opacity 0.4s',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      paddingBottom: 16,
    }}>

      {/* ── Bottom-left: record indicator ────────────────────────────────────── */}
      <div style={{ position: 'absolute', left: 32, bottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={onRecord}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 14px', borderRadius: 999,
              background: C.glass, backdropFilter: C.glassBlur,
              border: isRecording ? '1px solid rgba(186,26,26,0.3)' : `1px solid ${C.outline}`,
              color: isRecording ? C.error : C.textMuted,
              fontSize: 12, fontWeight: 600, fontFamily: 'Geist, Inter, sans-serif',
              cursor: 'pointer', boxShadow: '0 4px 16px rgba(11,28,48,0.08)',
              transition: 'all 0.15s',
            }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: '50%', background: C.error, flexShrink: 0,
              animation: isRecording ? 'recPulse 1.2s ease-in-out infinite' : 'none',
            }} />
            {isRecording ? 'Recording…' : 'Record'}
          </button>
          {isRecordingActive && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={onToggleBookmarkPicker}
                style={{
                  padding: '7px 12px', borderRadius: 999,
                  background: showBookmarkPicker ? C.primBg : C.glass,
                  backdropFilter: C.glassBlur,
                  border: `1px solid ${showBookmarkPicker ? C.primBdr : C.outline}`,
                  color: showBookmarkPicker ? C.primary : C.textMuted,
                  fontSize: 12, fontWeight: 500, fontFamily: 'Geist, Inter, sans-serif',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                Bookmark
              </button>
              {showBookmarkPicker && (
                <BookmarkPicker labels={bookmarkLabels} onSelect={onAddBookmark} onClose={onToggleBookmarkPicker} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom-right: grid + fullscreen ──────────────────────────────────── */}
      <div style={{ position: 'absolute', right: 32, bottom: 24 }}>
        <div style={{
          display: 'flex', gap: 2, padding: 4, borderRadius: 12,
          background: C.glass, backdropFilter: C.glassBlur,
          border: `1px solid ${C.outline}`,
          boxShadow: '0 4px 16px rgba(11,28,48,0.08)',
        }}>
          <button
            onClick={onToggleGrid}
            title="Grid view"
            style={{
              width: 36, height: 36, borderRadius: 8, border: 'none',
              background: gridView ? C.primBg : 'none',
              color: gridView ? C.primary : C.textMuted,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = C.surface; e.currentTarget.style.color = C.primary; }}
            onMouseLeave={e => { e.currentTarget.style.background = gridView ? C.primBg : 'none'; e.currentTarget.style.color = gridView ? C.primary : C.textMuted; }}
          >
            <LayoutGrid size={17} />
          </button>
          <button
            onClick={() => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); }}
            title="Fullscreen"
            style={{
              width: 36, height: 36, borderRadius: 8, border: 'none',
              background: 'none', color: C.textMuted,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = C.surface; e.currentTarget.style.color = C.primary; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.textMuted; }}
          >
            <Maximize size={17} />
          </button>
        </div>
      </div>

      {/* ── Main floating glass control bar ──────────────────────────────────── */}
      <div className="toolbar-scroll" style={{ overflowX: 'auto', scrollbarWidth: 'none', maxWidth: 'calc(100vw - 300px)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: C.glass,
          backdropFilter: C.glassBlur,
          WebkitBackdropFilter: C.glassBlur,
          border: C.glassBdr,
          borderRadius: 20, padding: '10px 14px',
          boxShadow: '0 8px 32px rgba(11,28,48,0.1), inset 0 1px 0 rgba(255,255,255,0.8)',
          width: 'max-content',
        }}>

          {/* AV Group */}
          <CtrlBtn onClick={onToggleMic} label={micMuted ? 'Unmute' : 'Mute'} muted={micMuted}>
            {micMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </CtrlBtn>
          <CtrlBtn onClick={onToggleCamera} label={cameraOff ? 'Start video' : 'Stop video'} muted={cameraOff}>
            {cameraOff ? <VideoOff size={20} /> : <Video size={20} />}
          </CtrlBtn>
          <CtrlBtn onClick={onToggleScreenShare} label="Share screen" active={isScreenSharing}>
            <Monitor size={20} />
          </CtrlBtn>

          <Divider />

          {/* Collaboration group */}
          <CtrlBtn onClick={onToggleChat} label="Chat" active={chatOpen}>
            <MessageSquare size={20} />
          </CtrlBtn>
          <CtrlBtn onClick={onToggleCaptions} label={captionsActive ? 'Disable captions' : 'Enable captions'} active={captionsActive}>
            <CCIcon size={20} />
          </CtrlBtn>
          <CtrlBtn onClick={onToggleNotes} label="Shared notes" active={notesOpen}>
            <FileText size={20} />
          </CtrlBtn>
          <CtrlBtn onClick={onTogglePolls} label="Polls" active={pollsOpen}>
            <BarChart2 size={20} />
          </CtrlBtn>
          <CtrlBtn onClick={onToggleAgenda} label="Agenda" active={agendaOpen}>
            <List size={20} />
          </CtrlBtn>
          <CtrlBtn onClick={onToggleMedia} label="Share image / video" active={mediaOpen}>
            <Film size={20} />
          </CtrlBtn>
          <CtrlBtn onClick={onToggleWhiteboard} label="Whiteboard" active={whiteboardOpen}>
            <PenLine size={20} />
          </CtrlBtn>
          <CtrlBtn onClick={onToggleTimer} label="Meeting timer" active={timerVisible}>
            <Timer size={20} />
          </CtrlBtn>
          <CtrlBtn onClick={onToggleQA} label="Q&A" active={qaOpen}>
            <HelpCircle size={20} />
          </CtrlBtn>
          <CtrlBtn onClick={onRaiseHand} label={handRaised ? 'Lower hand' : 'Raise hand'} active={handRaised}>
            <Hand size={20} />
          </CtrlBtn>
          <CtrlBtn onClick={onToggleParticipants} label="Participants" active={participantsOpen} badge={participantCount}>
            <Users size={20} />
          </CtrlBtn>
          <CtrlBtn onClick={onInvite} label="Invite people">
            <UserPlus size={20} />
          </CtrlBtn>
          <div style={{ position: 'relative' }}>
            <CtrlBtn onClick={() => setEmojiOpen(o => !o)} label="Send reaction" active={emojiOpen}>
              <SmilePlus size={20} />
            </CtrlBtn>
            {emojiOpen && <EmojiPicker onSelect={onSendReaction} onClose={() => setEmojiOpen(false)} />}
          </div>
          <div style={{ position: 'relative' }}>
            <CtrlBtn onClick={() => setMoreOpen(o => !o)} label="Features & More" active={moreOpen}>
              <MoreHorizontal size={20} />
            </CtrlBtn>
            {moreOpen && (
              <FeaturesMenu
                onClose={() => setMoreOpen(false)}
                aiSummaryOpen={aiSummaryOpen}       onToggleAISummary={onToggleAISummary}
                breakoutOpen={breakoutOpen}         onToggleBreakout={onToggleBreakout}
                fileShareOpen={fileShareOpen}       onToggleFileShare={onToggleFileShare}
                virtualBgOpen={virtualBgOpen}       onToggleVirtualBg={onToggleVirtualBg}
                onchainVoteOpen={onchainVoteOpen}   onToggleOnchainVote={onToggleOnchainVote}
                walletFeedOpen={walletFeedOpen}     onToggleWalletFeed={onToggleWalletFeed}
                focusMode={focusMode}               onToggleFocusMode={onToggleFocusMode}
                onExportTranscript={onExportTranscript}
                themeOpen={themeOpen}               onToggleTheme={onToggleTheme}
                onConfettiBurst={onConfettiBurst}
                actionItemsOpen={actionItemsOpen}   onToggleActionItems={onToggleActionItems}
                speakingTimeOpen={speakingTimeOpen} onToggleSpeakingTime={onToggleSpeakingTime}
                poapOpen={poapOpen}                 onTogglePoap={onTogglePoap}
                icebreakOpen={icebreakOpen}         onToggleIcebreak={onToggleIcebreak}
                consensusActive={consensusActive}   onToggleConsensus={onToggleConsensus}
                onPiP={onPiP}
                mirrorCamera={mirrorCamera}         onToggleMirror={onToggleMirror}
                emojiStatusOpen={emojiStatusOpen}   onToggleEmojiStatus={onToggleEmojiStatus}
                soundboardOpen={soundboardOpen}     onToggleSoundboard={onToggleSoundboard}
                statsOpen={statsOpen}               onToggleStats={onToggleStats}
                cleanView={cleanView}               onToggleCleanView={onToggleCleanView}
                onZoomSpotlight={onZoomSpotlight}   spotlightZoom={spotlightZoom}
              />
            )}
          </div>

          <Divider />

          {/* End Meeting */}
          <button
            onClick={onEnd}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', borderRadius: 12,
              background: '#ba1a1a', border: 'none',
              color: '#fff', fontWeight: 600, fontSize: 13,
              fontFamily: 'Geist, Inter, sans-serif', cursor: 'pointer', flexShrink: 0,
              boxShadow: '0 4px 16px rgba(186,26,26,0.3)',
              transition: 'filter 0.15s, transform 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.1)'; e.currentTarget.style.transform = 'scale(0.98)'; }}
            onMouseLeave={e => { e.currentTarget.style.filter = 'brightness(1)'; e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <PhoneOff size={16} />
            End Meeting
          </button>
        </div>
      </div>
    </div>
  );
}
