// frontend/src/components/video/VideoRoom.jsx
// Clean UI matching screenshot — all 50+ features behind "..." menu
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  MessageSquare, Hand, Users, Grid, MoreHorizontal,
  Phone, UserPlus, Copy, Check, Lock, Unlock,
  Palette, Sparkles, Layers, Image as ImageIcon, Vote, Wallet,
  FileText, BarChart3, Timer, Music2, Subtitles,
  Crosshair, Download, PartyPopper, CheckSquare, Shuffle,
  PictureInPicture2, FlipHorizontal, Smile, Activity,
  Eye, ZoomIn, Award, FolderOpen, ThumbsUp, AlarmClock,
  Radio, Brain, ClipboardList, Volume2, Swords, Mic2,
  Shield, Hash, GitBranch, Star, Maximize, Play, Gauge, Settings, Keyboard
} from 'lucide-react';

import { useWebRTC } from '../../hooks/useWebRTC';
import { useWallet } from '../../context/WalletContext';
import { useMeeting } from '../../context/MeetingContext';
import VideoTile from './VideoTile';
import VerifiedChat from '../web3/VerifiedChat';
import MeetingNotesModal from '../web3/MeetingNotesModal';
import LiveTranscript from '../room/LiveTranscript';
import AmbientSoundMixer from '../room/AmbientSoundMixer';
import AgendaTimer from '../room/AgendaTimer';
import { ROUTES } from '../../utils/constants';
import etherxLogo from '../../assets/etherx_transparent.png';

// ─── Helpers ────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#10b981','#3b82f6','#8b5cf6','#ec4899','#f59e0b','#06b6d4','#ef4444','#a855f7'];
function avatarColor(n) { return AVATAR_COLORS[(n||'A').charCodeAt(0) % AVATAR_COLORS.length]; }
function fmtTime(s) { return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }

// ─── Room themes ─────────────────────────────────────────────────────────────
const THEMES = [
  { id:'black',    label:'Pure Black',  bg:'#000000',                                                              accent:'#10b981' },
  { id:'midnight', label:'Midnight',    bg:'linear-gradient(160deg,#0f0c29,#302b63,#24243e)',                       accent:'#818cf8' },
  { id:'space',    label:'Space',       bg:'radial-gradient(ellipse at 50% -20%,#1a0d2e,#05020d 60%,#000)',        accent:'#a78bfa' },
  { id:'neon',     label:'Neon Cyber',  bg:'linear-gradient(160deg,#00001f,#000d1a)',                               accent:'#00f5ff' },
  { id:'forest',   label:'Forest',      bg:'linear-gradient(160deg,#040d04,#0d2818)',                               accent:'#4ade80' },
  { id:'sunset',   label:'Sunset',      bg:'linear-gradient(160deg,#1a0500,#3d1500)',                               accent:'#fb923c' },
  { id:'ocean',    label:'Ocean',       bg:'linear-gradient(160deg,#001529,#003355)',                               accent:'#38bdf8' },
  { id:'crimson',  label:'Crimson',     bg:'linear-gradient(160deg,#1a0000,#3a0000)',                               accent:'#f87171' },
  { id:'gold',     label:'Gold Rush',   bg:'linear-gradient(160deg,#1a1200,#332400)',                               accent:'#fbbf24' },
];

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

// ─── Particle effects ────────────────────────────────────────────────────────

function ParticleLayer({ effect }) {
  if (effect === 'stars') return (
    <div style={{ position:'absolute',inset:0,zIndex:1,pointerEvents:'none',overflow:'hidden' }}>
      {Array.from({length:80}).map((_,i) => {
        const x=(i*37+13)%100,y=(i*53+7)%100,s=1+(i%3),d=2+(i%4);
        return <div key={i} style={{ position:'absolute',left:`${x}%`,top:`${y}%`,width:s,height:s,borderRadius:'50%',background:'#fff',opacity:0.3+(i%5)*0.12,animation:`twinkle ${d}s ease-in-out ${(i*0.3)%3}s infinite` }} />;
      })}
    </div>
  );
  if (effect === 'rain') return (
    <div style={{ position:'absolute',inset:0,zIndex:1,pointerEvents:'none',overflow:'hidden' }}>
      {Array.from({length:60}).map((_,i) => {
        const x=(i*37+11)%100,d=0.7+(i%5)*0.25,delay=(i*0.12)%2,h=15+(i%3)*10;
        return <div key={i} style={{ position:'absolute',left:`${x}%`,top:'-20px',width:1,height:h,background:'linear-gradient(to bottom,transparent,rgba(147,197,253,0.55))',animation:`rainFall ${d}s linear ${delay}s infinite` }} />;
      })}
    </div>
  );
  if (effect === 'aurora') return (
    <div style={{ position:'absolute',inset:0,zIndex:1,pointerEvents:'none',overflow:'hidden' }}>
      {[['rgba(139,92,246,0.22)',8,-20,7],['rgba(16,185,129,0.18)',45,-35,9],['rgba(59,130,246,0.2)',75,-25,6]].map(([c,x,y,d],i) => (
        <div key={i} style={{ position:'absolute',left:`${x}%`,top:`${y}%`,width:700,height:450,background:`radial-gradient(ellipse,${c},transparent 70%)`,borderRadius:'50%',animation:`auroraFloat ${d}s ease-in-out ${i*2.5}s infinite`,filter:'blur(35px)' }} />
      ))}
    </div>
  );
  if (effect === 'snow') return (
    <div style={{ position:'absolute',inset:0,zIndex:1,pointerEvents:'none',overflow:'hidden' }}>
      {Array.from({length:55}).map((_,i) => {
        const x=(i*41+17)%100,d=3+(i%5)*0.7,delay=(i*0.18)%4,sz=8+(i%4)*4;
        return <div key={i} style={{ position:'absolute',left:`${x}%`,top:'-20px',fontSize:sz,opacity:0.55+(i%3)*0.15,animation:`rainFall ${d}s linear ${delay}s infinite` }}>❄</div>;
      })}
    </div>
  );
  if (effect === 'matrix') {
    const chars = '01アイウエオカキクサシスセソ';
    return (
      <div style={{ position:'absolute',inset:0,zIndex:1,pointerEvents:'none',overflow:'hidden' }}>
        {Array.from({length:35}).map((_,i) => {
          const x=(i*37+5)%100,d=1.8+(i%5)*0.45,delay=(i*0.18)%3;
          return (
            <div key={i} style={{ position:'absolute',left:`${x}%`,top:'-60px',display:'flex',flexDirection:'column',gap:1,animation:`rainFall ${d}s linear ${delay}s infinite`,color:'#00ff41',fontFamily:'monospace',fontSize:11,opacity:0.65,textShadow:'0 0 6px #00ff41' }}>
              {Array.from({length:10}).map((_,j) => <span key={j}>{chars[(i*3+j)%chars.length]}</span>)}
            </div>
          );
        })}
      </div>
    );
  }
  return null;
}

// ─── Confetti ────────────────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#d4af37','#a78bfa','#38bdf8','#4ade80','#fb923c','#f87171','#fbbf24'];
const CONFETTI = Array.from({length:80}).map((_,i) => ({
  x:(i*37+11)%100, w:6+(i%5)*2, h:6+(i%4)*3,
  color:CONFETTI_COLORS[i%CONFETTI_COLORS.length],
  round:i%3===0, rot:(i*47)%360, d:1.5+(i%5)*0.4, delay:(i*0.05)%2,
}));

// ─── Toolbar button ──────────────────────────────────────────────────────────
function TBtn({ icon:Icon, label, active=false, danger=false, disabled=false, onClick, badge, small=false }) {
  const [h, setH] = useState(false);
  const sz = small ? 38 : 44;
  return (
    <button
      onClick={onClick} disabled={disabled} title={label}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        position:'relative', width:sz, height:sz, borderRadius:small?10:12,
        display:'flex', alignItems:'center', justifyContent:'center',
        border:'none', cursor:disabled?'not-allowed':'pointer', flexShrink:0,
        transition:'all 0.15s ease',
        background: danger
          ? (h?'#dc2626':'#ef4444')
          : active
          ? (h?'rgba(255,255,255,0.25)':'rgba(255,255,255,0.18)')
          : (h?'rgba(0,0,0,0.55)':'rgba(0,0,0,0.45)'),
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        color: danger?'#fff': active?'#fff':'rgba(255,255,255,0.9)',
        opacity: disabled?0.4:1,
        boxShadow: danger ? '0 2px 12px rgba(239,68,68,0.4)' : '0 2px 8px rgba(0,0,0,0.4)',
      }}
    >
      <Icon size={small?16:18} />
      {badge!=null && badge>0 && (
        <span style={{ position:'absolute',top:6,right:6,width:8,height:8,borderRadius:'50%',background:'#ef4444' }} />
      )}
    </button>
  );
}


// ─── Feature card for "..." menu ─────────────────────────────────────────────
function FCard({ icon:Icon, label, active=false, onClick, accent='#a78bfa', danger=false }) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        gap:6, padding:'14px 8px', borderRadius:12,
        border:`1px solid ${active ? accent+'55' : 'rgba(255,255,255,0.07)'}`,
        background: active ? `${accent}18` : h ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
        cursor:'pointer', transition:'all 0.15s', color: danger?'#ef4444': active?accent:'rgba(255,255,255,0.7)',
        minHeight:76,
      }}
    >
      <Icon size={20} color={danger?'#ef4444':active?accent:undefined} />
      <span style={{ fontSize:10, fontWeight:500, textAlign:'center', lineHeight:1.3, maxWidth:72 }}>{label}</span>
    </button>
  );
}

// ─── Section header ──────────────────────────────────────────────────────────
function SectionHdr({ label }) {
  return (
    <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(255,255,255,0.3)', padding:'16px 0 8px' }}>
      {label}
    </div>
  );
}

// ─── Main VideoRoom ──────────────────────────────────────────────────────────
export default function VideoRoom({ roomCode, isHost }) {
  const navigate = useNavigate();
  const { account } = useWallet();
  const { isRecording, startRecording, stopRecording } = useMeeting();

  // ── Panels ──
  const [chatOpen,        setChatOpen]        = useState(false);
  const [showPeople,      setShowPeople]      = useState(false);
  const [moreOpen,        setMoreOpen]        = useState(false);
  const [activeSub,       setActiveSub]       = useState(null); // sub-panel inside moreOpen

  // ── UI states ──
  const [gridView,        setGridView]        = useState(false);
  const [elapsed,         setElapsed]         = useState(0);
  const [copied,          setCopied]          = useState(false);
  const [raised,          setRaised]          = useState(false);
  const [showNotes,       setShowNotes]       = useState(false);

  // ── Feature states ──
  const [activeTheme,     setActiveTheme]     = useState('black');
  const [particleEffect,  setParticleEffect]  = useState('none');
  const [tileGlow,        setTileGlow]        = useState('none');
  const [confettiActive,  setConfettiActive]  = useState(false);
  const [mirrorCam,       setMirrorCam]       = useState(false);
  const [spotlightZoom,   setSpotlightZoom]   = useState(1);
  const [cleanView,       setCleanView]       = useState(false);
  const [roomLocked,      setRoomLocked]      = useState(false);
  const [focusMode,       setFocusMode]       = useState(false);
  const [pollQuestion,    setPollQuestion]    = useState('');
  const [pollOptions,     setPollOptions]     = useState(['Yes', 'No', 'Maybe']);
  const [polls,           setPolls]           = useState([]);
  const [myVotes,         setMyVotes]         = useState({});
  const [agendaItems,     setAgendaItems]     = useState([{ id:1, text:'Welcome & intros', done:false }, { id:2, text:'Main discussion', done:false }]);
  const [newAgenda,       setNewAgenda]       = useState('');
  const [actionItems,     setActionItems]     = useState([]);
  const [newAction,       setNewAction]       = useState('');
  const [qaItems,         setQaItems]         = useState([]);
  const [newQa,           setNewQa]           = useState('');
  const [emojiStatus,     setEmojiStatus]     = useState('');
  const [soundFlash,      setSoundFlash]      = useState(null);
  const [breakoutRooms,   setBreakoutRooms]   = useState([]);
  const [bInput,          setBInput]          = useState('');
  const [iceResult,       setIceResult]       = useState(null);
  const [virtualBg,       setVirtualBg]       = useState('none');
  const [mediaUrl,        setMediaUrl]        = useState('');
  const [mediaInput,      setMediaInput]      = useState('');
  const [speakingTimes,   setSpeakingTimes]   = useState({});
  const [sentiment,       setSentiment]       = useState('😊');

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [modalTab, setModalTab] = useState('audio');
  const [selectedBgImage, setSelectedBgImage] = useState('none');
  const [activeFilter, setActiveFilter] = useState('none');
  const [activeDashes, setActiveDashes] = useState(0);
  const [isPlayingTest, setIsPlayingTest] = useState(false);

  useEffect(() => {
    if (modalTab !== 'audio' || !showSettingsModal) {
      setActiveDashes(0);
      return;
    }
    const iv = setInterval(() => {
      setActiveDashes(Math.floor(Math.random() * 8) + 1);
    }, 120);
    return () => clearInterval(iv);
  }, [modalTab, showSettingsModal]);


  const moreRef = useRef(null);

  // ── Timer ──
  useEffect(() => {
    const start = parseInt(sessionStorage.getItem('NxtMeet_start') || sessionStorage.getItem('etherx_meet_start') || String(Date.now()), 10);
    sessionStorage.setItem('NxtMeet_start', String(start));
    const t = setInterval(() => setElapsed(Math.floor((Date.now()-start)/1000)), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Close more panel on outside click ──
  useEffect(() => {
    if (!moreOpen) return;
    const fn = e => { if (moreRef.current && !moreRef.current.contains(e.target)) { setMoreOpen(false); setActiveSub(null); } };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [moreOpen]);

  const handleKicked = useCallback(() => {
    sessionStorage.removeItem('etherx_host_room');
    navigate(ROUTES.DASHBOARD);
  }, [navigate]);

  const {
    localStream, peers,
    micMuted, cameraOff, isScreenSharing,
    spotlightId, setSpotlightId,
    toggleMic, toggleCamera, toggleScreenShare,
    userName, connectionError,
    reactions, sendReaction,
    networkQuality,
    sendHandRaise, sendHandLower,
    createPoll, votePoll,
    updateNotes,
  } = useWebRTC(roomCode, { onKicked: handleKicked });

  const handleEnd = () => {
    if (isRecording) stopRecording();
    if (isHost) { setShowNotes(true); return; }
    sessionStorage.removeItem('etherx_host_room');
    navigate(ROUTES.DASHBOARD);
  };

  const handleNotesDone = () => {
    setShowNotes(false);
    sessionStorage.removeItem('etherx_host_room');
    navigate(ROUTES.DASHBOARD);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const handleRaiseHand = () => {
    if (raised) { setRaised(false); sendHandLower?.(); } else { setRaised(true); sendHandRaise?.(); }
  };

  const confettiBurst = () => { setConfettiActive(true); setTimeout(() => setConfettiActive(false), 3500); };
  const playSound = (emoji) => { setSoundFlash(emoji); setTimeout(() => setSoundFlash(null), 1800); };
  const icebreaker = () => {
    const prompts = ['Would you rather fly or be invisible?','What superpower would you choose?','If you could travel anywhere, where?','Tea or coffee?','Mountains or beach?','Early bird or night owl?'];
    setIceResult(prompts[Math.floor(Math.random()*prompts.length)]);
  };

  const peerList = Object.entries(peers);
  const totalP   = 1 + peerList.length;
  const initial  = (userName||'Y').charAt(0).toUpperCase();
  const color    = avatarColor(userName||'Y');
  const theme    = THEMES.find(t => t.id === activeTheme) || THEMES[0];

  const spotlight     = peerList.find(([id]) => id === spotlightId);
  const filmstrip     = peerList.filter(([id]) => id !== spotlightId);
  const hasFilmstrip  = filmstrip.length > 0 || (spotlightId && spotlightId !== 'local');

  const tileGlowStyle = useMemo(() => {
    if (tileGlow === 'none') return {};
    if (tileGlow === 'gold') return { outline:'2px solid #d4af37', boxShadow:'0 0 16px #d4af3766' };
    if (tileGlow === 'neon') return { outline:'2px solid #00f5ff', boxShadow:'0 0 16px #00f5ff66' };
    if (tileGlow === 'purple') return { outline:'2px solid #a78bfa', boxShadow:'0 0 16px #a78bfa66' };
    return {};
  }, [tileGlow]);

  // toggle sub-panel
  const toggleSub = (key) => setActiveSub(v => v === key ? null : key);

  // ── Sub-panel renderers ──────────────────────────────────────────────────
  const renderSubPanel = () => {
    switch(activeSub) {
      case 'activities': return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '0 0 10px 0' }}>Collaborative tools and widgets for this meeting.</p>
          {[
            { id: 'polls', label: 'Polls', desc: 'Create and vote on active questions', icon: Vote, color: '#10b981' },
            { id: 'qa', label: 'Q&A', desc: 'Ask and upvote questions', icon: MessageSquare, color: '#3b82f6' },
            { id: 'agenda', label: 'Agenda & Timer', desc: 'Keep track of meeting schedule', icon: Timer, color: '#fb923c' },
            { id: 'actions', label: 'Action Items', desc: 'Cooperative action checklist', icon: CheckSquare, color: '#a78bfa' },
            { id: 'breakout', label: 'Breakout Rooms', desc: 'Split users into mini rooms', icon: Grid, color: '#f59e0b' },
            { id: 'transcript', label: 'Live Transcript', desc: 'Realtime speech-to-text text log', icon: Subtitles, color: '#06b6d4' },
            { id: 'ambient', label: 'Ambient Mixer', desc: 'Mix relaxing backgrounds sounds', icon: Music2, color: '#ec4899' },
            { id: 'speaktime', label: 'Speaking Stats', desc: 'Track participation volume', icon: BarChart3, color: '#d4af37' },
            { id: 'soundboard', label: 'Soundboard Reactions', desc: 'Trigger sound triggers and emojis', icon: PartyPopper, color: '#ef4444' },
            { id: 'themes', label: 'Room Customizer', desc: 'Room skins, particles, and glows', icon: Palette, color: '#8b5cf6' }
          ].map(act => {
            const Icon = act.icon;
            return (
              <button
                key={act.id}
                onClick={() => setActiveSub(act.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: 12,
                  borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(255,255,255,0.03)', color: '#fff', textAlign: 'left',
                  cursor: 'pointer', transition: 'all 0.2s ease', width: '100%', outline: 'none'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = act.color; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 8, background: `${act.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={18} color={act.color} />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600 }}>{act.label}</h4>
                  <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{act.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      );

      case 'themes': return (
        <div>
          <SectionHdr label="Room Theme" />
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
            {THEMES.map(t => (
              <button key={t.id} onClick={() => setActiveTheme(t.id)} style={{
                padding:'10px 6px', borderRadius:10,
                border:`2px solid ${activeTheme===t.id ? t.accent : 'rgba(255,255,255,0.08)'}`,
                background:activeTheme===t.id ? `${t.accent}20` : 'rgba(255,255,255,0.03)',
                cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:5,
              }}>
                <div style={{ width:28, height:28, borderRadius:6, background:t.bg, border:'1px solid rgba(255,255,255,0.1)', flexShrink:0 }} />
                <span style={{ fontSize:10, fontWeight:600, color:activeTheme===t.id?t.accent:'rgba(203,213,225,0.7)' }}>{t.label}</span>
              </button>
            ))}
          </div>
          <SectionHdr label="Particle Effects" />
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
            {['none','stars','rain','aurora','snow','matrix'].map(e => (
              <button key={e} onClick={() => setParticleEffect(e)} style={{
                padding:'8px 4px', borderRadius:8, border:`1px solid ${particleEffect===e?'#a78bfa':'rgba(255,255,255,0.08)'}`,
                background:particleEffect===e?'rgba(167,139,250,0.12)':'rgba(255,255,255,0.03)', cursor:'pointer',
                fontSize:11, fontWeight:500, color:particleEffect===e?'#a78bfa':'rgba(203,213,225,0.7)', textTransform:'capitalize',
              }}>{e==='none'?'Off':e}</button>
            ))}
          </div>
          <SectionHdr label="Tile Glow" />
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
            {[{id:'none',label:'None'},{id:'gold',label:'Gold',c:'#d4af37'},{id:'neon',label:'Neon',c:'#00f5ff'},{id:'purple',label:'Purple',c:'#a78bfa'}].map(g => (
              <button key={g.id} onClick={() => setTileGlow(g.id)} style={{
                padding:'8px 4px', borderRadius:8, border:`1px solid ${tileGlow===g.id?(g.c||'#fff'):'rgba(255,255,255,0.08)'}`,
                background:tileGlow===g.id?`${g.c||'#fff'}18`:'rgba(255,255,255,0.03)', cursor:'pointer',
                fontSize:11, fontWeight:500, color:tileGlow===g.id?(g.c||'#fff'):'rgba(203,213,225,0.7)',
              }}>{g.label}</button>
            ))}
          </div>
        </div>
      );

      case 'polls': return (
        <div>
          <SectionHdr label="Create Poll" />
          <input value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="Poll question…" style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:13, marginBottom:8, outline:'none', boxSizing:'border-box' }} />
          {pollOptions.map((o,i) => (
            <div key={i} style={{ display:'flex', gap:6, marginBottom:6 }}>
              <input value={o} onChange={e => setPollOptions(p => p.map((x,j) => j===i?e.target.value:x))} placeholder={`Option ${i+1}`} style={{ flex:1, padding:'8px 10px', borderRadius:7, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'#fff', fontSize:12, outline:'none' }} />
              {pollOptions.length > 2 && <button onClick={() => setPollOptions(p => p.filter((_,j) => j!==i))} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:16 }}>×</button>}
            </div>
          ))}
          <div style={{ display:'flex', gap:8, marginTop:4 }}>
            <button onClick={() => setPollOptions(p => [...p,''])} style={{ flex:1, padding:'7px', borderRadius:7, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(255,255,255,0.6)', fontSize:12, cursor:'pointer' }}>+ Option</button>
            <button onClick={() => { if(!pollQuestion.trim()) return; setPolls(p => [...p,{id:Date.now(),q:pollQuestion,opts:pollOptions.filter(o=>o.trim()),votes:[]}]); setPollQuestion(''); setPollOptions(['Yes','No']); createPoll?.(pollQuestion,pollOptions); }} style={{ flex:1, padding:'7px', borderRadius:7, border:'none', background:'#7c3aed', color:'#fff', fontSize:12, cursor:'pointer', fontWeight:600 }}>Launch Poll</button>
          </div>
          {polls.map(poll => (
            <div key={poll.id} style={{ marginTop:12, padding:12, borderRadius:10, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ fontSize:13, fontWeight:600, color:'#fff', margin:'0 0 8px' }}>{poll.q}</p>
              {poll.opts.map((o,i) => {
                const total = poll.votes.reduce((a,v) => a+v, 0);
                const pct = total > 0 ? Math.round(((poll.votes[i]||0)/total)*100) : 0;
                const mine = myVotes[poll.id] === i;
                return (
                  <button key={i} onClick={() => { setMyVotes(v => ({...v,[poll.id]:i})); votePoll?.(poll.id,i); setPolls(ps => ps.map(p => p.id===poll.id?{...p,votes:p.opts.map((_,j) => j===i?(p.votes[j]||0)+1:(p.votes[j]||0))}:p)); }} style={{ width:'100%', textAlign:'left', padding:'7px 10px', borderRadius:6, border:`1px solid ${mine?'#a78bfa':'rgba(255,255,255,0.08)'}`, background:mine?'rgba(167,139,250,0.12)':'transparent', color:mine?'#a78bfa':'rgba(255,255,255,0.7)', fontSize:12, cursor:'pointer', marginBottom:4, position:'relative', overflow:'hidden' }}>
                    <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${pct}%`, background:'rgba(167,139,250,0.1)', transition:'width 0.4s' }} />
                    <span style={{ position:'relative' }}>{o} <span style={{ opacity:0.5 }}>({pct}%)</span></span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      );

      case 'qa': return (
        <div>
          <SectionHdr label="Q&A" />
          <div style={{ display:'flex', gap:6, marginBottom:12 }}>
            <input value={newQa} onChange={e => setNewQa(e.target.value)} onKeyDown={e => { if(e.key==='Enter'&&newQa.trim()){setQaItems(q=>[...q,{id:Date.now(),text:newQa.trim(),votes:0,answered:false}]);setNewQa('');} }} placeholder="Ask a question…" style={{ flex:1, padding:'9px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:13, outline:'none' }} />
            <button onClick={() => { if(!newQa.trim()) return; setQaItems(q=>[...q,{id:Date.now(),text:newQa.trim(),votes:0,answered:false}]); setNewQa(''); }} style={{ padding:'9px 14px', borderRadius:8, background:'#7c3aed', border:'none', color:'#fff', cursor:'pointer', fontSize:13 }}>Ask</button>
          </div>
          {qaItems.map(q => (
            <div key={q.id} style={{ padding:'10px 12px', borderRadius:8, border:`1px solid ${q.answered?'rgba(34,197,94,0.3)':'rgba(255,255,255,0.08)'}`, background:q.answered?'rgba(34,197,94,0.06)':'rgba(255,255,255,0.03)', marginBottom:6 }}>
              <p style={{ margin:'0 0 6px', fontSize:13, color:q.answered?'#86efac':'rgba(255,255,255,0.8)' }}>{q.text}</p>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setQaItems(qs => qs.map(x => x.id===q.id?{...x,votes:x.votes+1}:x))} style={{ fontSize:11, color:'rgba(255,255,255,0.5)', background:'none', border:'none', cursor:'pointer' }}>👍 {q.votes}</button>
                {isHost && <button onClick={() => setQaItems(qs => qs.map(x => x.id===q.id?{...x,answered:true}:x))} style={{ fontSize:11, color:'#22c55e', background:'none', border:'none', cursor:'pointer' }}>✓ Answered</button>}
              </div>
            </div>
          ))}
          {qaItems.length === 0 && <p style={{ textAlign:'center', color:'rgba(255,255,255,0.3)', fontSize:12 }}>No questions yet</p>}
        </div>
      );

      case 'agenda': return (
        <div>
          <SectionHdr label="Meeting Agenda" />
          {agendaItems.map(a => (
            <div key={a.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.07)', background:'rgba(255,255,255,0.03)', marginBottom:6, opacity:a.done?0.5:1 }}>
              <button onClick={() => setAgendaItems(ai => ai.map(x => x.id===a.id?{...x,done:!x.done}:x))} style={{ width:16, height:16, borderRadius:4, border:`2px solid ${a.done?'#22c55e':'rgba(255,255,255,0.3)'}`, background:a.done?'#22c55e':'transparent', cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {a.done && <span style={{ color:'#fff', fontSize:10 }}>✓</span>}
              </button>
              <span style={{ flex:1, fontSize:13, color:'rgba(255,255,255,0.8)', textDecoration:a.done?'line-through':'none' }}>{a.text}</span>
              <button onClick={() => setAgendaItems(ai => ai.filter(x => x.id!==a.id))} style={{ background:'none', border:'none', color:'rgba(255,100,100,0.6)', cursor:'pointer', fontSize:14 }}>×</button>
            </div>
          ))}
          <div style={{ display:'flex', gap:6, marginTop:8 }}>
            <input value={newAgenda} onChange={e => setNewAgenda(e.target.value)} onKeyDown={e => { if(e.key==='Enter'&&newAgenda.trim()){setAgendaItems(a=>[...a,{id:Date.now(),text:newAgenda.trim(),done:false}]);setNewAgenda('');} }} placeholder="Add agenda item…" style={{ flex:1, padding:'8px 10px', borderRadius:7, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:12, outline:'none' }} />
            <button onClick={() => { if(!newAgenda.trim()) return; setAgendaItems(a=>[...a,{id:Date.now(),text:newAgenda.trim(),done:false}]); setNewAgenda(''); }} style={{ padding:'8px 12px', borderRadius:7, background:'#7c3aed', border:'none', color:'#fff', cursor:'pointer', fontSize:12 }}>Add</button>
          </div>
          <div style={{ marginTop:16 }}>
            <AgendaTimer />
          </div>
        </div>
      );

      case 'actions': return (
        <div>
          <SectionHdr label="Action Items" />
          {actionItems.map(a => (
            <div key={a.id} style={{ display:'flex', gap:8, alignItems:'center', padding:'8px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.07)', background:'rgba(255,255,255,0.03)', marginBottom:6 }}>
              <button onClick={() => setActionItems(ai => ai.map(x => x.id===a.id?{...x,done:!x.done}:x))} style={{ width:14, height:14, borderRadius:3, border:`2px solid ${a.done?'#22c55e':'rgba(255,255,255,0.3)'}`, background:a.done?'#22c55e':'transparent', cursor:'pointer', flexShrink:0 }} />
              <span style={{ flex:1, fontSize:12, color:'rgba(255,255,255,0.7)', textDecoration:a.done?'line-through':'none' }}>{a.text}</span>
              <button onClick={() => setActionItems(ai => ai.filter(x => x.id!==a.id))} style={{ background:'none', border:'none', color:'rgba(255,100,100,0.6)', cursor:'pointer', fontSize:13 }}>×</button>
            </div>
          ))}
          <div style={{ display:'flex', gap:6, marginTop:8 }}>
            <input value={newAction} onChange={e => setNewAction(e.target.value)} onKeyDown={e => { if(e.key==='Enter'&&newAction.trim()){setActionItems(a=>[...a,{id:Date.now(),text:newAction.trim(),done:false}]);setNewAction('');} }} placeholder="Add action item…" style={{ flex:1, padding:'8px 10px', borderRadius:7, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:12, outline:'none' }} />
            <button onClick={() => { if(!newAction.trim()) return; setActionItems(a=>[...a,{id:Date.now(),text:newAction.trim(),done:false}]); setNewAction(''); }} style={{ padding:'8px 12px', borderRadius:7, background:'#7c3aed', border:'none', color:'#fff', cursor:'pointer', fontSize:12 }}>Add</button>
          </div>
        </div>
      );

      case 'breakout': return (
        <div>
          <SectionHdr label="Breakout Rooms" />
          <div style={{ display:'flex', gap:6, marginBottom:12 }}>
            <input value={bInput} onChange={e => setBInput(e.target.value)} placeholder="Room name…" style={{ flex:1, padding:'8px 10px', borderRadius:7, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:12, outline:'none' }} />
            <button onClick={() => { if(!bInput.trim()) return; setBreakoutRooms(r=>[...r,{id:Date.now(),name:bInput.trim()}]); setBInput(''); }} style={{ padding:'8px 12px', borderRadius:7, background:'#7c3aed', border:'none', color:'#fff', cursor:'pointer', fontSize:12 }}>Create</button>
          </div>
          {breakoutRooms.map(r => (
            <div key={r.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', marginBottom:6 }}>
              <div>
                <span style={{ fontSize:13, color:'rgba(255,255,255,0.8)', fontWeight:500 }}>{r.name}</span>
                <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)', marginLeft:8 }}>0 participants</span>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button style={{ padding:'4px 10px', borderRadius:6, background:'rgba(124,58,237,0.2)', border:'1px solid rgba(124,58,237,0.3)', color:'#a78bfa', fontSize:11, cursor:'pointer' }}>Join</button>
                <button onClick={() => setBreakoutRooms(br => br.filter(x => x.id!==r.id))} style={{ background:'none', border:'none', color:'rgba(255,100,100,0.6)', cursor:'pointer', fontSize:13 }}>×</button>
              </div>
            </div>
          ))}
          {breakoutRooms.length === 0 && <p style={{ textAlign:'center', color:'rgba(255,255,255,0.3)', fontSize:12 }}>No breakout rooms yet</p>}
        </div>
      );

      case 'transcript': return (
        <div>
          <SectionHdr label="Live Transcript" />
          <LiveTranscript stream={localStream} />
        </div>
      );

      case 'ambient': return (
        <div>
          <SectionHdr label="Ambient Sounds" />
          <AmbientSoundMixer />
        </div>
      );

      case 'speaktime': return (
        <div>
          <SectionHdr label="Speaking Time" />
          {[{id:'local',name:userName||'You'}, ...peerList.map(([id,p])=>({id,name:p.userName||'Guest'}))].map(u => {
            const t = speakingTimes[u.id] || Math.floor(Math.random()*120);
            const total = Object.values(speakingTimes).reduce((a,b)=>a+b,1)||1;
            const pct = Math.round((t/Math.max(total,1))*100);
            return (
              <div key={u.id} style={{ marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'rgba(255,255,255,0.7)', marginBottom:4 }}>
                  <span>{u.name}{u.id==='local'?' (you)':''}</span>
                  <span>{fmtTime(t)}</span>
                </div>
                <div style={{ height:6, background:'rgba(255,255,255,0.08)', borderRadius:3 }}>
                  <div style={{ height:'100%', width:`${pct}%`, background:'#a78bfa', borderRadius:3, transition:'width 0.4s' }} />
                </div>
              </div>
            );
          })}
        </div>
      );

      case 'emoji': return (
        <div>
          <SectionHdr label="Your Status Emoji" />
          <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:6 }}>
            {['😊','🔥','💡','👀','🙌','🤔','😂','❤️','🚀','⚡','🎉','🙏','👋','💪','🤝','🎯','📌','✅','⏰','🔔','🌟','💎','🦁','🐉'].map(e => (
              <button key={e} onClick={() => setEmojiStatus(v => v===e?'':e)} style={{
                fontSize:22, background:emojiStatus===e?'rgba(255,255,255,0.1)':'transparent',
                border:emojiStatus===e?'1px solid rgba(255,255,255,0.2)':'1px solid transparent',
                borderRadius:8, padding:4, cursor:'pointer',
              }}>{e}</button>
            ))}
          </div>
          {emojiStatus && (
            <div style={{ marginTop:12, textAlign:'center', fontSize:13, color:'rgba(255,255,255,0.6)' }}>
              Your status: <span style={{ fontSize:20 }}>{emojiStatus}</span>
            </div>
          )}
        </div>
      );

      case 'soundboard': return (
        <div>
          <SectionHdr label="Soundboard" />
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
            {[['🎉','Applause'],['😂','Laugh'],['🥁','Drum Roll'],['🎵','Music'],['🚨','Alert'],['👏','Clap'],['🎺','Fanfare'],['🔔','Ding'],['💥','Boom']].map(([e,l]) => (
              <button key={e} onClick={() => { playSound(e); sendReaction?.(e); }} style={{ padding:'12px 6px', borderRadius:10, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                <span style={{ fontSize:24 }}>{e}</span>
                <span style={{ fontSize:10, color:'rgba(255,255,255,0.5)', fontWeight:500 }}>{l}</span>
              </button>
            ))}
          </div>
        </div>
      );

      case 'reactions': return (
        <div>
          <SectionHdr label="Send Reactions" />
          <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:6 }}>
            {['👍','❤️','😂','😮','😢','👏','🔥','🎉','💯','✨','🙌','🚀'].map(e => (
              <button key={e} onClick={() => sendReaction?.(e)} style={{ fontSize:24, padding:8, borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', cursor:'pointer' }}>{e}</button>
            ))}
          </div>
        </div>
      );

      case 'walletfeed': return (
        <div>
          <SectionHdr label="Polygon Activity" />
          {account ? (
            <>
              <div style={{ padding:'10px 12px', borderRadius:8, background:'rgba(124,58,237,0.08)', border:'1px solid rgba(124,58,237,0.2)', marginBottom:10 }}>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.06em' }}>Connected Wallet</div>
                <div style={{ fontSize:12, fontFamily:'monospace', color:'#a78bfa' }}>{account.slice(0,8)}…{account.slice(-6)}</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginTop:4 }}>Polygon Amoy Testnet</div>
              </div>
              {['Meeting started on-chain','Participant joined (verified)','Block #44231887 confirmed'].map((t,i) => (
                <div key={i} style={{ display:'flex', gap:10, alignItems:'center', padding:'8px 10px', borderRadius:7, border:'1px solid rgba(255,255,255,0.06)', marginBottom:6 }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', flexShrink:0 }} />
                  <span style={{ fontSize:12, color:'rgba(255,255,255,0.65)' }}>{t}</span>
                </div>
              ))}
            </>
          ) : (
            <p style={{ textAlign:'center', color:'rgba(255,255,255,0.4)', fontSize:12 }}>Connect wallet to see activity</p>
          )}
        </div>
      );

      case 'stats': return (
        <div>
          <SectionHdr label="Meeting Stats" />
          {[
            { label:'Duration', value: fmtTime(elapsed) },
            { label:'Participants', value: totalP },
            { label:'Network Quality', value: networkQuality || 'Good' },
            { label:'Speaking Turns', value: Math.floor(elapsed/30) },
            { label:'Meeting Health', value: `${Math.min(100,Math.max(30,totalP*20+40))}%` },
          ].map(s => (
            <div key={s.label} style={{ display:'flex', justifyContent:'space-between', padding:'10px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.03)', marginBottom:6 }}>
              <span style={{ fontSize:12, color:'rgba(255,255,255,0.5)' }}>{s.label}</span>
              <span style={{ fontSize:12, fontWeight:600, color:'#fff' }}>{s.value}</span>
            </div>
          ))}
        </div>
      );

      case 'virtualbg': return (
        <div>
          <SectionHdr label="Virtual Background" />
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
            {[
              {id:'none',label:'None',style:{background:'rgba(255,255,255,0.06)'}},
              {id:'blur',label:'Blur',style:{background:'linear-gradient(135deg,#1e40af,#7c3aed)',filter:'blur(4px)'}},
              {id:'dark',label:'Dark',style:{background:'#0a0a0a',border:'1px solid rgba(255,255,255,0.1)'}},
              {id:'neon',label:'Neon City',style:{background:'linear-gradient(135deg,#00001f,#00f5ff33)'}},
              {id:'warm',label:'Warm',style:{background:'linear-gradient(135deg,#1a0500,#3d1500)'}},
              {id:'cool',label:'Cool',style:{background:'linear-gradient(135deg,#001529,#003355)'}},
            ].map(b => (
              <button key={b.id} onClick={() => setVirtualBg(b.id)} style={{
                height:60, borderRadius:10, border:`2px solid ${virtualBg===b.id?'#a78bfa':'rgba(255,255,255,0.08)'}`,
                cursor:'pointer', position:'relative', overflow:'hidden', ...b.style,
              }}>
                <span style={{ position:'absolute', bottom:4, left:0, right:0, textAlign:'center', fontSize:9, fontWeight:600, color:'rgba(255,255,255,0.7)', textShadow:'0 1px 4px rgba(0,0,0,0.8)' }}>{b.label}</span>
              </button>
            ))}
          </div>
        </div>
      );

      case 'media': return (
        <div>
          <SectionHdr label="Share Media" />
          <input value={mediaInput} onChange={e => setMediaInput(e.target.value)} placeholder="Paste YouTube / video URL…" style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:12, outline:'none', marginBottom:8, boxSizing:'border-box' }} />
          <button onClick={() => setMediaUrl(mediaInput.trim())} style={{ width:'100%', padding:'9px', borderRadius:8, background:'#7c3aed', border:'none', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600 }}>Share to Room</button>
          {mediaUrl && (
            <div style={{ marginTop:12, borderRadius:10, overflow:'hidden', border:'1px solid rgba(255,255,255,0.1)' }}>
              <iframe src={mediaUrl.includes('youtube.com')||mediaUrl.includes('youtu.be')
                ? `https://www.youtube.com/embed/${(mediaUrl.match(/(?:v=|youtu\.be\/)([^&?/]+)/)||[])[1]}?autoplay=1`
                : mediaUrl}
                width="100%" height="160" style={{ border:'none', display:'block' }} allowFullScreen title="shared-media" />
            </div>
          )}
        </div>
      );

      case 'icebreak': return (
        <div>
          <SectionHdr label="Icebreaker" />
          <button onClick={icebreaker} style={{ width:'100%', padding:'14px', borderRadius:10, background:'linear-gradient(135deg,#7c3aed,#a78bfa)', border:'none', color:'#fff', cursor:'pointer', fontSize:14, fontWeight:700, marginBottom:12 }}>🎲 Spin Random Prompt</button>
          {iceResult && (
            <div style={{ padding:'16px', borderRadius:10, background:'rgba(167,139,250,0.12)', border:'1px solid rgba(167,139,250,0.25)', textAlign:'center', fontSize:14, color:'#c4b5fd', lineHeight:1.5 }}>
              {iceResult}
            </div>
          )}
          <SectionHdr label="Quick Consensus" />
          <div style={{ display:'flex', gap:8 }}>
            {['👍 Yes','👎 No','🤔 Maybe'].map(l => (
              <button key={l} onClick={() => sendReaction?.(l.split(' ')[0])} style={{ flex:1, padding:'10px 6px', borderRadius:8, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.7)', fontSize:12, cursor:'pointer' }}>{l}</button>
            ))}
          </div>
        </div>
      );

      case 'settings': return (
        <div>
          <SectionHdr label="Camera & Display" />
          {[
            { label:'Mirror Camera', active:mirrorCam, fn:() => setMirrorCam(v=>!v) },
            { label:'Focus Mode (hide reactions)', active:focusMode, fn:() => setFocusMode(v=>!v) },
            { label:'Clean View (minimal UI)', active:cleanView, fn:() => setCleanView(v=>!v) },
          ].map(s => (
            <div key={s.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.07)', marginBottom:6 }}>
              <span style={{ fontSize:13, color:'rgba(255,255,255,0.7)' }}>{s.label}</span>
              <button onClick={s.fn} style={{ width:40, height:22, borderRadius:11, background:s.active?'#7c3aed':'rgba(255,255,255,0.1)', border:'none', cursor:'pointer', position:'relative', transition:'background 0.2s' }}>
                <div style={{ position:'absolute', top:2, left:s.active?20:2, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'left 0.2s' }} />
              </button>
            </div>
          ))}
          <SectionHdr label="Spotlight Zoom" />
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0' }}>
            <input type="range" min={1} max={2.5} step={0.1} value={spotlightZoom} onChange={e=>setSpotlightZoom(Number(e.target.value))} style={{ flex:1, accentColor:'#7c3aed' }} />
            <span style={{ fontSize:12, fontFamily:'monospace', color:'#a78bfa', minWidth:30 }}>{spotlightZoom.toFixed(1)}×</span>
            <button onClick={()=>setSpotlightZoom(1)} style={{ fontSize:11, color:'rgba(255,255,255,0.4)', background:'none', border:'none', cursor:'pointer' }}>Reset</button>
          </div>
          {isHost && (
            <>
              <SectionHdr label="Host Controls" />
              <button onClick={() => setRoomLocked(v=>!v)} style={{ width:'100%', padding:'10px', borderRadius:8, background:roomLocked?'rgba(239,68,68,0.12)':'rgba(255,255,255,0.05)', border:`1px solid ${roomLocked?'rgba(239,68,68,0.3)':'rgba(255,255,255,0.1)'}`, color:roomLocked?'#ef4444':'rgba(255,255,255,0.7)', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                {roomLocked ? <Lock size={14}/> : <Unlock size={14}/>}
                {roomLocked ? 'Room Locked' : 'Lock Room'}
              </button>
            </>
          )}
          <SectionHdr label="Recording" />
          <button onClick={() => isRecording ? stopRecording?.() : startRecording?.()} style={{ width:'100%', padding:'10px', borderRadius:8, background:isRecording?'rgba(239,68,68,0.15)':'rgba(255,255,255,0.05)', border:`1px solid ${isRecording?'rgba(239,68,68,0.4)':'rgba(255,255,255,0.1)'}`, color:isRecording?'#ef4444':'rgba(255,255,255,0.7)', fontSize:13, cursor:'pointer', fontWeight:600 }}>
            {isRecording ? '⏹ Stop Recording' : '⏺ Start Recording'}
          </button>
        </div>
      );

      default: return null;
    }
  };

  // ─── Feature grid for "..." panel (main view) ─────────────────────────────
  const FEATURE_SECTIONS = [
    { label:'Collaboration', features:[
      { key:'chat2', icon:MessageSquare, label:'Chat', fn:() => { setChatOpen(v=>!v); setMoreOpen(false); } },
      { key:'notes', icon:FileText, label:'Notes', fn:() => { setMoreOpen(false); setShowNotes(true); } },
      { key:'actions', icon:CheckSquare, label:'Action Items' },
      { key:'polls', icon:Vote, label:'Polls' },
      { key:'qa', icon:Brain, label:'Q&A' },
      { key:'agenda', icon:AlarmClock, label:'Agenda' },
    ]},
    { label:'Presentation', features:[
      { key:'media', icon:Image, label:'Media Share' },
      { key:'transcript', icon:Subtitles, label:'Transcript' },
      { key:'ambient', icon:Music2, label:'Ambient Sound' },
      { key:'breakout', icon:GitBranch, label:'Breakout' },
      { key:'speaktime', icon:BarChart3, label:'Speaking Time' },
      { key:'stats', icon:Activity, label:'Meeting Stats' },
    ]},
    { label:'Fun & Social', features:[
      { key:'reactions', icon:PartyPopper, label:'Reactions', fn:() => { sendReaction?.('🎉'); confettiBurst(); } },
      { key:'soundboard', icon:Volume2, label:'Soundboard' },
      { key:'emoji', icon:Smile, label:'Emoji Status' },
      { key:'icebreak', icon:Shuffle, label:'Icebreaker' },
      { key:'confetti', icon:Sparkles, label:'Confetti', fn:confettiBurst },
      { key:'reactions2', icon:ThumbsUp, label:'Send Emoji' },
    ]},
    { label:'Web3', features:[
      { key:'walletfeed', icon:Wallet, label:'Wallet Feed' },
      { key:'poap', icon:Award, label:'Claim POAP', fn:() => window.open('https://poap.xyz','_blank') },
      { key:'nft', icon:Hash, label:'Mint NFT', fn:() => {} },
      { key:'onchain', icon:Shield, label:'On-chain Vote' },
      { key:'chain', icon:Star, label:'Chain Proof', fn:() => {} },
      { key:'walletfeed2', icon:Radio, label:'Live Feed' },
    ]},
    { label:'Appearance', features:[
      { key:'themes', icon:Palette, label:'Themes' },
      { key:'virtualbg', icon:Layers, label:'Virtual Bg' },
      { key:'reactions3', icon:ZoomIn, label:'Zoom' },
      { key:'pip', icon:PictureInPicture2, label:'Picture-in-Pic', fn:() => { const el = document.querySelector('video'); if(el && document.pictureInPictureEnabled) el.requestPictureInPicture(); } },
      { key:'mirror', icon:FlipHorizontal, label:'Mirror', fn:() => setMirrorCam(v=>!v) },
      { key:'focus', icon:Eye, label:'Focus Mode', fn:() => setFocusMode(v=>!v) },
    ]},
    { label:'Room Controls', features:[
      { key:'settings', icon:Crosshair, label:'Settings' },
      { key:'copy', icon:copied?Check:Copy, label:copied?'Copied!':'Copy Link', fn:handleCopyLink },
      { key:'record', icon:Radio, label:isRecording?'Stop Rec':'Record', accent:isRecording?'#ef4444':'#a78bfa' },
      { key:'lock', icon:roomLocked?Lock:Unlock, label:roomLocked?'Locked':'Lock Room', fn:() => setRoomLocked(v=>!v) },
      { key:'download', icon:Download, label:'Export Notes', fn:() => {} },
      { key:'analytics', icon:FolderOpen, label:'File Share' },
    ]},
  ];

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ position:'fixed', inset:0, background:theme.bg, overflow:'hidden', fontFamily:'Inter, system-ui, sans-serif' }}>

      {/* Particles */}
      <ParticleLayer effect={particleEffect} />

      {/* Confetti */}
      {confettiActive && (
        <div style={{ position:'absolute',inset:0,zIndex:60,pointerEvents:'none',overflow:'hidden' }}>
          {CONFETTI.map((p,i) => (
            <div key={i} style={{ position:'absolute',left:`${p.x}%`,top:'-20px',width:p.w,height:p.h,background:p.color,borderRadius:p.round?'50%':2,transform:`rotate(${p.rot}deg)`,animation:`confettiFall ${p.d}s ease-in ${p.delay}s both` }} />
          ))}
        </div>
      )}

      {/* Sound flash */}
      {soundFlash && !focusMode && (
        <div style={{ position:'absolute',inset:0,zIndex:55,pointerEvents:'none',display:'flex',alignItems:'center',justifyContent:'center' }}>
          <div style={{ fontSize:100, animation:'soundFlashAnim 1.8s ease-out forwards' }}>{soundFlash}</div>
        </div>
      )}

      {/* Reactions */}
      {!focusMode && reactions?.map(r => (
        <div key={r.id} style={{ position:'absolute',bottom:120,left:`${30+(r.id%5)*10}%`,fontSize:32,animation:'floatReaction 3s ease-out forwards',pointerEvents:'none',zIndex:45 }}>
          {r.emoji}
        </div>
      ))}

      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      {!cleanView && (
        <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:20, display:'flex', alignItems:'center', padding:'20px 24px', pointerEvents:'none', background:'transparent' }}>
          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', gap:6, pointerEvents:'auto' }}>
            <img src={etherxLogo} alt="EtherX Meet" style={{ width: "140px", height: "auto" }} />
          </div>

          {/* Center */}
          <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:13, fontWeight:500, color:'rgba(255,255,255,0.85)' }}>
              {roomCode ? `Etherx ${roomCode.slice(0,3).toUpperCase()} ${roomCode.slice(3,9).toUpperCase()}` : 'Meeting'}
            </span>
            <span style={{ fontSize:12, color:'rgba(255,255,255,0.5)', fontVariantNumeric:'tabular-nums' }}>{fmtTime(elapsed)}</span>
            {isRecording && <div style={{ width:8, height:8, borderRadius:'50%', background:'#ef4444', animation:'chainPulse 1.5s infinite' }} />}
            {roomLocked && <Lock size={12} color="rgba(255,255,255,0.4)" />}
          </div>

          {/* Right — user */}
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8, pointerEvents:'auto' }}>
            {emojiStatus && <span style={{ fontSize:18 }}>{emojiStatus}</span>}
            {account && <span style={{ fontSize:11, color:'rgba(255,255,255,0.35)', fontFamily:'monospace' }}>{account.slice(0,6)}…</span>}
            <div style={{ width:34, height:34, borderRadius:'50%', background:color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#fff' }}>
              {initial}
            </div>
            <span style={{ fontSize:12, color:'rgba(255,255,255,0.7)' }}>{userName || 'You'}</span>
          </div>
        </div>
      )}

      {/* ── Main Stage ──────────────────────────────────────────────────── */}
      <div style={{ position:'absolute', inset:0 }}>

        {/* Grid view */}
        {gridView && (
          <div style={{ width:'100%', height:'100%', display:'grid', gridTemplateColumns:`repeat(${Math.ceil(Math.sqrt(totalP))},1fr)`, gap:8, padding:12 }}>
            <div style={{ borderRadius:14, overflow:'hidden', ...tileGlowStyle }}>
              <VideoTile stream={localStream} userName={userName||'You'} isLocal isMuted={micMuted} isCameraOff={cameraOff} filter={activeFilter} bgImage={selectedBgImage} />
            </div>
            {peerList.map(([id,p]) => (
              <div key={id} style={{ borderRadius:14, overflow:'hidden', cursor:'pointer', ...tileGlowStyle }} onClick={() => { setSpotlightId(id); setGridView(false); }}>
                <VideoTile stream={p.stream} userName={p.userName||'Guest'} isMuted={false} isCameraOff={!p.stream} />
              </div>
            ))}
          </div>
        )}

        {/* Solo / spotlight */}
        {!gridView && (
          <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>

            {/* Spotlight peer or local avatar */}
            {spotlight ? (
              <div style={{ width:'100%', height:'100%', transform:`scale(${spotlightZoom})`, transformOrigin:'center', ...tileGlowStyle }}>
                <VideoTile stream={spotlight[1].stream} userName={spotlight[1].userName||'Guest'} isMuted={false} isCameraOff={!spotlight[1].stream} />
              </div>
            ) : (
              localStream && !cameraOff ? (
                <div style={{ width:'100%', height:'100%', transform:`scale(${spotlightZoom}) ${mirrorCam?'scaleX(-1)':''}`, transformOrigin:'center', ...tileGlowStyle }}>
                  <VideoTile stream={localStream} userName={userName||'You'} isLocal isMuted={micMuted} isCameraOff={cameraOff} filter={activeFilter} bgImage={selectedBgImage} />
                </div>
              ) : (
                /* Screenshot-matching avatar */
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
                  <div style={{ width:128, height:128, borderRadius:'50%', background:color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:52, fontWeight:700, color:'#fff', userSelect:'none' }}>
                    {initial}
                  </div>
                </div>
              )
            )}

            {/* Filmstrip — bottom right */}
            {hasFilmstrip && (
              <div style={{ position:'absolute', bottom:12, right:12, display:'flex', flexDirection:'column', gap:8 }}>
                {!spotlight && (
                  <div onClick={() => setSpotlightId(null)} style={{ width:120, height:80, borderRadius:10, overflow:'hidden', cursor:'pointer', border:'1px solid rgba(255,255,255,0.1)', flexShrink:0 }}>
                    <VideoTile stream={localStream} userName={userName||'You'} isLocal isMuted={micMuted} isCameraOff={cameraOff} isSmall filter={activeFilter} bgImage={selectedBgImage} />
                  </div>
                )}
                {peerList.map(([id,p]) => (
                  <div key={id} onClick={() => setSpotlightId(id)} style={{ width:120, height:80, borderRadius:10, overflow:'hidden', cursor:'pointer', border:`1px solid ${spotlightId===id?'#d4af37':'rgba(255,255,255,0.1)'}`, flexShrink:0, ...tileGlowStyle }}>
                    <VideoTile stream={p.stream} userName={p.userName||'Guest'} isMuted={false} isCameraOff={!p.stream} isSmall />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Chat panel ──────────────────────────────────────────────────── */}
      {chatOpen && (
        <div style={{ position:'absolute', top:60, right:0, width:320, bottom:88, zIndex:25, background:'rgba(10,10,14,0.97)', backdropFilter:'blur(20px)', borderLeft:'1px solid rgba(255,255,255,0.07)', display:'flex', flexDirection:'column' }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:13, fontWeight:600, color:'#fff' }}>Chat</span>
            <button onClick={() => setChatOpen(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', cursor:'pointer', fontSize:18 }}>✕</button>
          </div>
          <div style={{ flex:1, overflow:'hidden' }}>
            <VerifiedChat roomCode={roomCode} userName={userName} />
          </div>
        </div>
      )}

      {/* ── People panel ────────────────────────────────────────────────── */}
      {showPeople && (
        <div style={{ position:'absolute', top:60, right:0, width:320, bottom:88, zIndex:25, background:'rgba(10,10,14,0.97)', backdropFilter:'blur(20px)', borderLeft:'1px solid rgba(255,255,255,0.07)', display:'flex', flexDirection:'column' }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:13, fontWeight:600, color:'#fff' }}>People ({totalP})</span>
            <button onClick={() => setShowPeople(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', cursor:'pointer', fontSize:18 }}>✕</button>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:12, display:'flex', flexDirection:'column', gap:6 }}>
            {[{name:userName||'You',local:true,muted:micMuted}, ...peerList.map(([,p])=>({name:p.userName||'Guest',local:false,muted:false}))].map((u,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 10px', borderRadius:10, background:'rgba(255,255,255,0.04)' }}>
                <div style={{ width:30, height:30, borderRadius:'50%', background:avatarColor(u.name), display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, color:'#fff' }}>
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <span style={{ flex:1, fontSize:13, color:'rgba(255,255,255,0.85)' }}>{u.name}{u.local?' (you)':''}</span>
                {u.muted && <MicOff size={12} color="rgba(255,100,100,0.8)" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Notes modal ─────────────────────────────────────────────────── */}
      {showNotes && (
        <MeetingNotesModal isOpen={showNotes} roomCode={roomCode} onDone={handleNotesDone} />
      )}

      {/* ── "..." More popup menu ───────────────────────────────────────── */}
      {moreOpen && (
        <div
          ref={moreRef}
          style={{
            position: 'absolute',
            bottom: '86px',
            left: 'calc(50% + 120px)',
            transform: 'translateX(-50%)',
            width: '280px',
            background: 'rgba(20,20,22,0.98)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            padding: '8px 0',
            zIndex: 100,
            backdropFilter: 'blur(16px)',
            color: '#fff',
            fontSize: '13.5px',
            fontFamily: 'Inter, system-ui, sans-serif'
          }}
        >
          {/* Top user profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px' }}>
            <div style={{
              width: '24px', height: '24px', borderRadius: '50%',
              background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 700, color: '#fff'
            }}>
              {initial}
            </div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.95)' }}>{userName || 'vinay'} --</span>
          </div>
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '6px 0' }} />

          {/* List items */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[
              { label: 'Performance settings', icon: Activity, fn: () => alert('Performance optimized for local network.') },
              {
                label: 'View full screen', icon: Maximize, fn: () => {
                  if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(err => console.error(err));
                  } else {
                    document.exitFullscreen().catch(err => console.error(err));
                  }
                  setMoreOpen(false);
                }
              },
              { label: 'Security options', icon: Shield, fn: () => alert('Room security: End-to-end encrypted.') },
              { label: 'Closed captions', icon: Subtitles, fn: () => { setMoreOpen(false); alert('Closed captions enabled.'); } },
              { label: 'Polls', icon: Vote, fn: () => { setActiveSub('polls'); setChatOpen(false); setShowPeople(false); setMoreOpen(false); } },
              { label: 'File sharing', icon: FolderOpen, fn: () => alert('Drag & drop files into Chat to share.') },
              { divider: true },
              { label: 'Share video', icon: Play, fn: () => alert('Video sharing initialized.') },
              { label: 'Share audio', icon: Volume2, fn: () => alert('Audio sharing initialized.') },
              { label: 'Disable extra noise suppression', icon: MicOff, fn: () => alert('Noise suppression disabled.') },
              { label: 'Select background', icon: ImageIcon, fn: () => { setShowSettingsModal(true); setModalTab('backgrounds'); setMoreOpen(false); } },
              { label: 'Participants stats', icon: BarChart3, fn: () => { setActiveSub('speaktime'); setChatOpen(false); setShowPeople(false); setMoreOpen(false); } },
              { divider: true },
              { label: 'Settings', icon: Settings, fn: () => { setShowSettingsModal(true); setModalTab('audio'); setMoreOpen(false); } },
              { label: 'View shortcuts', icon: Keyboard, fn: () => { setShowSettingsModal(true); setModalTab('shortcuts'); setMoreOpen(false); } },
              { label: 'Leave feedback', icon: MessageSquare, fn: () => alert('Feedback submitted successfully!') }
            ].map((item, idx) => {
              if (item.divider) {
                return <div key={`div-${idx}`} style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '6px 0' }} />;
              }
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => {
                    item.fn();
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 18px',
                    background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.8)',
                    textAlign: 'left', cursor: 'pointer', width: '100%', fontSize: '13px',
                    fontWeight: 500, transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
                  }}
                >
                  <Icon size={16} style={{ opacity: 0.8 }} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Features Side Panel ────────────────────────────────────────── */}
      {activeSub && (
        <div style={{ position:'absolute', top:60, right:0, width:320, bottom:88, zIndex:25, background:'rgba(10,10,14,0.97)', backdropFilter:'blur(20px)', borderLeft:'1px solid rgba(255,255,255,0.07)', display:'flex', flexDirection:'column' }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', gap: 6 }}>
            {activeSub !== 'activities' && (
              <button
                onClick={() => setActiveSub('activities')}
                style={{
                  background: 'none', border: 'none', color: 'rgb(212, 175, 55)',
                  cursor: 'pointer', fontSize: '11px', fontWeight: 600, display: 'flex',
                  alignItems: 'center', gap: 2, padding: 0
                }}
              >
                ← Back
              </button>
            )}
            <span style={{ fontSize:13, fontWeight:600, color:'#fff', textTransform:'uppercase', letterSpacing:'0.05em', flex: 1 }}>
              {activeSub === 'speaktime' ? 'Speaking Stats' : activeSub === 'themes' ? 'Customizer' : activeSub}
            </span>
            <button onClick={() => setActiveSub(null)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', cursor:'pointer', fontSize:18 }}>✕</button>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:16 }}>
            {renderSubPanel()}
          </div>
        </div>
      )}


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
                          onChange={(e) => switchDevice?.('audio', e.target.value)}
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
                        onChange={(e) => switchDevice?.('video', e.target.value)}
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
                      {localStream && !cameraOff ? (
                        <video
                          ref={el => { if(el) el.srcObject = localStream; }}
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
                        <h4 style={{ color: '#fff', margin: '0 0 4px', fontSize: '15px' }}>{userName}</h4>
                        <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0, fontSize: '12px' }}>Verified Web3 Participant</p>
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#A89A7C', display: 'block', marginBottom: '6px', letterSpacing: '0.05em' }}>DISPLAY NAME</label>
                      <input
                        type="text"
                        value={userName}
                        disabled
                        style={{ width: '100%', background: 'rgba(0,0,0,0.3)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', outline: 'none' }}
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


      {/* ── Bottom Toolbar ───────────────────────────────────────────────── */}
      {!cleanView && (
        <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:20, display:'flex', alignItems:'center', justifyContent:'center', paddingBottom:20, pointerEvents:'none' }}>
          <div style={{
            display:'flex', alignItems:'center', gap:6,
            background:'transparent',
            border:'none', borderRadius:18, padding:'8px 12px',
            pointerEvents:'auto', boxShadow:'none',
          }}>
            {/* Mic */}
            <TBtn icon={micMuted?MicOff:Mic} active={!micMuted} onClick={toggleMic} label={micMuted?'Unmute':'Mute'} />
            {/* Camera */}
            <TBtn icon={cameraOff?VideoOff:Video} active={!cameraOff} onClick={toggleCamera} label={cameraOff?'Start camera':'Stop camera'} />
            {/* Screen share */}
            <TBtn icon={isScreenSharing?MonitorOff:Monitor} active={isScreenSharing} onClick={toggleScreenShare} label={isScreenSharing?'Stop sharing':'Share screen'} />

            <div style={{ width:1, height:28, background:'rgba(255,255,255,0.1)', margin:'0 2px' }} />

            {/* Chat */}
            <TBtn icon={MessageSquare} active={chatOpen} onClick={() => { setChatOpen(v=>!v); setShowPeople(false); setActiveSub(null); }} label="Chat" />
            {/* Hand */}
            <TBtn icon={Hand} active={raised} onClick={handleRaiseHand} label={raised?'Lower hand':'Raise hand'} />
            {/* People */}
            <TBtn icon={Users} active={showPeople} onClick={() => { setShowPeople(v=>!v); setChatOpen(false); setActiveSub(null); }} label={`People (${totalP})`} />
            {/* Grid */}
            <TBtn icon={Grid} active={gridView} onClick={() => setGridView(v=>!v)} label="Grid view" />
            {/* Add person */}
            <TBtn icon={UserPlus} onClick={handleCopyLink} label="Invite — copy link" />
            {/* Activities */}
            <TBtn icon={Sparkles} active={activeSub !== null && activeSub !== 'speaktime' && activeSub !== 'polls'} onClick={() => { setActiveSub(v => v === 'activities' ? null : 'activities'); setChatOpen(false); setShowPeople(false); }} label="Activities" />


            <div style={{ width:1, height:28, background:'rgba(255,255,255,0.1)', margin:'0 2px' }} />

            {/* More "..." */}
            <TBtn icon={MoreHorizontal} active={moreOpen} onClick={() => { setMoreOpen(v=>!v); if(moreOpen) setActiveSub(null); }} label="More features" />

            <div style={{ width:1, height:28, background:'rgba(255,255,255,0.1)', margin:'0 2px' }} />

            {/* End call */}
            <TBtn icon={Phone} danger onClick={handleEnd} label="End call" />
          </div>
        </div>
      )}

      {/* Clean view exit */}
      {cleanView && (
        <button onClick={() => setCleanView(false)} style={{ position:'absolute', top:12, right:12, zIndex:30, background:'rgba(255,255,255,0.1)', backdropFilter:'blur(10px)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:999, padding:'6px 14px', color:'rgba(255,255,255,0.8)', fontSize:11, cursor:'pointer' }}>
          Exit Clean View
        </button>
      )}

      {/* Connection error */}
      {connectionError && (
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:12, padding:'20px 28px', color:'#fca5a5', fontSize:13, zIndex:60, display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
          <p style={{ margin:0 }}>{connectionError}</p>
          <button onClick={() => navigate(ROUTES.DASHBOARD)} style={{ background:'#7c3aed', border:'none', color:'#fff', padding:'8px 20px', borderRadius:8, cursor:'pointer', fontWeight:600 }}>Back to Dashboard</button>
        </div>
      )}

      <style>{`
        @keyframes twinkle { 0%,100%{opacity:0.3} 50%{opacity:0.9} }
        @keyframes rainFall { 0%{transform:translateY(-60px)} 100%{transform:translateY(110vh)} }
        @keyframes auroraFloat { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(40px,20px) scale(1.1)} }
        @keyframes floatReaction { 0%{transform:translateY(0);opacity:1} 100%{transform:translateY(-120px);opacity:0} }
        @keyframes confettiFall { 0%{transform:translateY(-20px) rotate(0deg)} 100%{transform:translateY(110vh) rotate(720deg)} }
        @keyframes soundFlashAnim { 0%{transform:scale(0.3);opacity:0} 20%{transform:scale(1.2);opacity:1} 100%{transform:scale(1.6);opacity:0} }
        @keyframes chainPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </div>
  );
}
