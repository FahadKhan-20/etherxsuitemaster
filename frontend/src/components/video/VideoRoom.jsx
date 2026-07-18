// frontend/src/components/video/VideoRoom.jsx
// UI exactly matches EtherX Meet.dc.html
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Plus } from 'lucide-react';

import { useWebRTC } from '../../hooks/useWebRTC';
import { useMediaDevices } from '../../hooks/useMediaDevices';
import { useWallet } from '../../context/WalletContext';
import { useMeeting } from '../../context/MeetingContext';
import VideoTile from './VideoTile';
import VerifiedChat from '../web3/VerifiedChat';
import MeetingNotesModal from '../web3/MeetingNotesModal';
import LiveTranscript from '../room/LiveTranscript';
import { ROUTES } from '../../utils/constants';
import etherxLogo from '../../assets/etherx_transparent.png';

const AVATAR_COLORS = ['#d4af37','#b8860b','#e5c76b','#d4af37','#b8860b','#e5c76b','#d4af37','#b8860b'];
function avatarColor(n) { return AVATAR_COLORS[(n||'A').charCodeAt(0) % AVATAR_COLORS.length]; }
function fmtTime(s) { return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); }
function fmtTitle(code) { if (!code) return 'EtherX Meet'; return code.replace(/-/g,' ').replace(/\b\w/g, l => l.toUpperCase()); }

const BG_OPTIONS = [
  { id:'none', type:'filter', label:'None' },
  { id:'half-blur', type:'filter', label:'Half Blur' },
  { id:'blur', type:'filter', label:'Blur' },
  { id:'beach', type:'image', label:'Beach', url:'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=350&q=80' },
  { id:'room', type:'image', label:'Office', url:'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=350&q=80' },
  { id:'mountains', type:'image', label:'Valley', url:'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=350&q=80' },
  { id:'forest', type:'image', label:'Forest', url:'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=350&q=80' },
];

const playTestSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(); osc.stop(ctx.currentTime + 0.35);
  } catch(e) { console.error(e); }
};

const CONFETTI_COLORS = ['#d4af37','#e5c76b','#b8860b','#d4af37','#e5c76b','#b8860b','#d4af37'];
const CONFETTI = Array.from({length:80}).map((_,i) => ({
  x:(i*37+11)%100, w:6+(i%5)*2, h:6+(i%4)*3,
  color:CONFETTI_COLORS[i%CONFETTI_COLORS.length],
  round:i%3===0, rot:(i*47)%360, d:1.5+(i%5)*0.4, delay:(i*0.05)%2,
}));

export default function VideoRoom({ roomCode, isHost }) {
  const navigate = useNavigate();
  const { account } = useWallet();
  const { isRecording, stopRecording } = useMeeting();

  const [chatOpen, setChatOpen] = useState(false);
  const [panelTab, setPanelTab] = useState('chat');
  const [showPeople, setShowPeople] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [modalTab, setModalTab] = useState('audio');
  const [gridView, setGridView] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [raised, setRaised] = useState(false);
  const [handToastDismissed, setHandToastDismissed] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeFilter, setActiveFilter] = useState('none');
  const [selectedBgImage, setSelectedBgImage] = useState('none');
  const [isPlayingTest, setIsPlayingTest] = useState(false);
  const [activeDashes, setActiveDashes] = useState(0);
  const [polls, setPolls] = useState([]);
  const [myVotes, setMyVotes] = useState({});
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['Yes','No','Maybe']);
  const [showPollForm, setShowPollForm] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const toolbarTimerRef = useRef(null);

  // Auto-hide bottom toolbar after 3 s of no mouse movement
  const resetToolbarTimer = useCallback(() => {
    setToolbarVisible(true);
    if (toolbarTimerRef.current) clearTimeout(toolbarTimerRef.current);
    toolbarTimerRef.current = setTimeout(() => setToolbarVisible(false), 3000);
  }, []);

  useEffect(() => {
    resetToolbarTimer();
    return () => { if (toolbarTimerRef.current) clearTimeout(toolbarTimerRef.current); };
  }, [resetToolbarTimer]);

  const moreRef = useRef(null);
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    const start = parseInt(sessionStorage.getItem('NxtMeet_start') || sessionStorage.getItem('etherx_meet_start') || String(Date.now()), 10);
    sessionStorage.setItem('NxtMeet_start', String(start));
    const t = setInterval(() => setElapsed(Math.floor((Date.now()-start)/1000)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!moreOpen) return;
    const fn = e => { if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [moreOpen]);

  useEffect(() => {
    if (modalTab !== 'audio' || !showSettingsModal) { setActiveDashes(0); return; }
    const iv = setInterval(() => setActiveDashes(Math.floor(Math.random()*8)+1), 120);
    return () => clearInterval(iv);
  }, [modalTab, showSettingsModal]);

  const handleKicked = useCallback(() => {
    sessionStorage.removeItem('etherx_host_room');
    navigate(ROUTES.DASHBOARD);
  }, [navigate]);

  const {
    localStream, peers, micMuted, cameraOff, isScreenSharing,
    spotlightId, setSpotlightId, toggleMic, toggleCamera, toggleScreenShare,
    userName, connectionError, reactions,
    sendHandRaise, sendHandLower, createPoll, votePoll, updateNotes,
    admitted, denied, joinRequests, admitUser, denyUser,
    sharedFiles, shareFile,
  } = useWebRTC(roomCode, { onKicked: handleKicked, isHost });

  const { devices, switchDevice, selectedDevices } = useMediaDevices();

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
  const handleCopyLink = () => { navigator.clipboard.writeText(window.location.href).then(() => { setCopied(true); setTimeout(()=>setCopied(false),2000); }); };
  const handleCopyCode = () => { navigator.clipboard.writeText(roomCode||'').then(() => { setCodeCopied(true); setTimeout(()=>setCodeCopied(false),2000); }); };
  const handleRaiseHand = () => { if (raised) { setRaised(false); sendHandLower?.(); } else { setRaised(true); setHandToastDismissed(false); sendHandRaise?.(); } };

  const peerList = Object.entries(peers);
  const totalP = 1 + peerList.length;
  const initial = (userName||'Y').charAt(0).toUpperCase();
  const userColor = avatarColor(userName||'Y');
  const spotlight = peerList.find(([id]) => id === spotlightId);

  if (!admitted) {
    return (
      <div style={{ position:'fixed',inset:0,background:"radial-gradient(1200px 700px at 12% -10%,rgba(212,175,55,.12),transparent 60%),radial-gradient(900px 600px at 105% 15%,rgba(212,175,55,.08),transparent 55%),#0a0a0a",display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:"'Sora',sans-serif",color:'#f0e6d3',padding:20 }}>
        <style>{`@keyframes wait-ping{0%,100%{transform:scale(1);opacity:1;}70%,100%{transform:scale(2.5);opacity:0;}}`}</style>
        <div style={{ maxWidth:480,width:'100%',background:'rgba(212,175,55,.04)',backdropFilter:'blur(20px)',border:'1px solid rgba(212,175,55,.12)',borderRadius:24,padding:'40px 32px',textAlign:'center',boxShadow:'0 20px 40px rgba(0,0,0,.5)' }}>
          <img src={etherxLogo} alt="EtherX" style={{ width:140,marginBottom:30 }} />
          {denied ? (
            <>
              <div style={{ width:64,height:64,borderRadius:32,background:'rgba(239,68,68,.1)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 24px',border:'1px solid rgba(239,68,68,.2)' }}><span style={{ fontSize:32 }}>🛑</span></div>
              <h2 style={{ fontSize:22,fontWeight:600,marginBottom:12,color:'#fca5a5' }}>Entry Denied</h2>
              <p style={{ fontSize:14,color:'#a89878',lineHeight:1.5,marginBottom:28 }}>The host has denied your request to join this meeting room.</p>
              <button onClick={() => navigate(ROUTES.DASHBOARD)} style={{ width:'100%',padding:14,borderRadius:12,background:'linear-gradient(135deg,#b8860b,#e5c76b)',color:'#050505',border:'none',fontWeight:600,fontSize:14,cursor:'pointer',fontFamily:"'Sora',sans-serif" }}>Return to Dashboard</button>
            </>
          ) : (
            <>
              {localStream && (<div style={{ position:'relative',width:'100%',aspectRatio:'16/9',borderRadius:16,overflow:'hidden',background:'#0a0a0a',marginBottom:24,border:'1px solid rgba(212,175,55,.15)' }}><video ref={el => { if(el) el.srcObject=localStream; }} autoPlay playsInline muted style={{ width:'100%',height:'100%',objectFit:'cover' }} /><div style={{ position:'absolute',bottom:12,left:12,fontSize:11,background:'rgba(0,0,0,.6)',padding:'4px 8px',borderRadius:6,color:'rgba(255,255,255,.8)' }}>Self View Preview</div></div>)}
              <div style={{ display:'inline-flex',alignItems:'center',gap:8,padding:'8px 16px',borderRadius:99,background:'rgba(212,175,55,.1)',border:'1px solid rgba(212,175,55,.2)',color:'#e5c76b',fontSize:12,fontWeight:500,marginBottom:20 }}>
                <span style={{ display:'inline-block',width:6,height:6,borderRadius:'50%',background:'#e5c76b',animation:'wait-ping 1.5s infinite' }} /> Waiting Room Active
              </div>
              <h2 style={{ fontSize:20,fontWeight:600,marginBottom:12 }}>Waiting to be Admitted...</h2>
              <p style={{ fontSize:14,color:'#a89878',lineHeight:1.6,marginBottom:10 }}>Hi, <strong>{userName}</strong>. The host will let you in shortly.</p>
              <p style={{ fontSize:12,color:'#a89878',fontStyle:'italic' }}>Please keep this tab open and make sure your camera and microphone are ready.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div onMouseMove={resetToolbarTimer} onMouseEnter={resetToolbarTimer} style={{ position:'fixed',inset:0,background:"radial-gradient(1200px 700px at 12% -10%,rgba(212,175,55,.10),transparent 60%),radial-gradient(900px 600px at 105% 15%,rgba(212,175,55,.07),transparent 55%),#0a0a0a",fontFamily:"'Sora',sans-serif",color:'#f0e6d3',display:'flex',flexDirection:'column',overflow:'hidden' }}>
      <style>{`
        :root {
          --gold:       #d4af37;
          --gold-soft:  #e5c76b;
          --gold-deep:  #b8860b;
          --text:       #f0e6d3;
          --text-muted: #a89878;
          --text-soft:  #c9bda2;
        }
        @keyframes speak{0%,100%{box-shadow:0 0 0 0 rgba(212,175,55,.5);}50%{box-shadow:0 0 0 10px rgba(212,175,55,0);}}
        @keyframes floatReaction{0%{transform:translateY(0);opacity:1}100%{transform:translateY(-120px);opacity:0}}
        @keyframes confettiFall{0%{transform:translateY(-20px) rotate(0deg)}100%{transform:translateY(110vh) rotate(720deg)}}
        @keyframes chainPulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes slideDown{0%{transform:translate(-50%,-20px);opacity:0}100%{transform:translate(-50%,0);opacity:1}}
        @keyframes fadeIn{0%{opacity:0;transform:scale(.97)}100%{opacity:1;transform:scale(1)}}
        @keyframes wait-ping{0%,100%{transform:scale(1);opacity:1;}70%,100%{transform:scale(2.5);opacity:0;}}
        .toolbar-wrap{transition:transform .4s cubic-bezier(.4,0,.2,1),opacity .4s ease;}
        .toolbar-wrap.hidden{transform:translateY(110%);opacity:0;pointer-events:none;}
        @keyframes goldShimmer{0%{background-position:0% center}100%{background-position:200% center}}
        ::selection{background:rgba(212,175,55,.28);color:#fff8e8;}
        ::-webkit-scrollbar{width:8px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:#2d2a24;border-radius:5px;border:2px solid #0a0a0a;}
        ::-webkit-scrollbar-thumb:hover{background:rgba(212,175,55,.35);}
      `}</style>

      {isHost && joinRequests.length > 0 && (
        <div style={{ position:'fixed',bottom:90,right:24,zIndex:200,display:'flex',flexDirection:'column',gap:10,maxWidth:360,width:'100%' }}>
          {joinRequests.map(req => (
            <div key={req.socketId} style={{ background:'rgba(5,5,5,.9)',backdropFilter:'blur(20px)',border:'1px solid rgba(212,175,55,.15)',borderRadius:16,padding:'16px 20px',display:'flex',flexDirection:'column',gap:12 }}>
              <div><h4 style={{ margin:'0 0 4px',fontSize:14,fontWeight:600 }}>Join Request</h4><p style={{ margin:0,fontSize:12,color:'#a89878' }}><strong>{req.userName}</strong> wants to join.</p></div>
              <div style={{ display:'flex',gap:8 }}>
                <button onClick={() => admitUser(req.socketId)} style={{ flex:1,padding:'8px 12px',borderRadius:8,background:'#22c55e',color:'#fff',border:'none',fontSize:12,fontWeight:600,cursor:'pointer' }}>Admit</button>
                <button onClick={() => denyUser(req.socketId)} style={{ flex:1,padding:'8px 12px',borderRadius:8,background:'#ef4444',color:'#fff',border:'none',fontSize:12,fontWeight:600,cursor:'pointer' }}>Deny</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {reactions?.map(r => (<div key={r.id} style={{ position:'fixed',bottom:120,left:`${30+(r.id%5)*10}%`,fontSize:32,animation:'floatReaction 3s ease-out forwards',pointerEvents:'none',zIndex:45 }}>{r.emoji}</div>))}

      {confettiActive && (<div style={{ position:'fixed',inset:0,zIndex:60,pointerEvents:'none',overflow:'hidden' }}>{CONFETTI.map((p,i) => (<div key={i} style={{ position:'absolute',left:`${p.x}%`,top:'-20px',width:p.w,height:p.h,background:p.color,borderRadius:p.round?'50%':2,transform:`rotate(${p.rot}deg)`,animation:`confettiFall ${p.d}s ease-in ${p.delay}s both` }} />))}</div>)}

      {inviteOpen && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300 }}>
          <div style={{ width:380,background:'#0a0a0a',border:'1px solid rgba(212,175,55,.15)',borderRadius:16,padding:22,boxShadow:'0 30px 70px -20px rgba(0,0,0,.7)',animation:'fadeIn .18s ease-out' }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18 }}>
              <span style={{ fontSize:17,fontWeight:700 }}>Invite more people</span>
              <button onClick={() => setInviteOpen(false)} style={{ background:'none',border:'none',color:'#a89878',cursor:'pointer',fontSize:18 }}>✕</button>
            </div>
            <div style={{ fontSize:12.5,color:'#a89878',marginBottom:8 }}>Share the meeting link to invite others</div>
            <button onClick={handleCopyLink} style={{ display:'flex',alignItems:'center',gap:8,width:'100%',padding:'11px 14px',borderRadius:10,border:'none',background:'#d4af37',color:'#0a0a0a',fontSize:13,fontWeight:600,cursor:'pointer',marginBottom:18,fontFamily:"'Sora',sans-serif" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.8"/></svg>
              {copied ? 'Link Copied!' : 'Copy meeting link'}
            </button>
            <div style={{ fontSize:12.5,color:'#a89878',marginBottom:10 }}>Share meeting invitation</div>
            <div style={{ display:'flex',gap:10,marginBottom:18 }}>
              {['Copy','Email','G','O','Y'].map((l,i) => (<button key={i} onClick={i===0?handleCopyLink:undefined} title={l} style={{ width:38,height:38,borderRadius:'50%',background:'rgba(212,175,55,.12)',border:'none',color:'#f0e6d3',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:i>1?700:400,fontSize:i>1?15:13 }}>{i===0?<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.8"/></svg>:l}</button>))}
            </div>
            <div style={{ borderTop:'1px solid rgba(212,175,55,.15)',paddingTop:16,display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10 }}>
              <div>
                <div style={{ fontSize:12.5 }}><strong>Room Code:</strong> {roomCode}</div>
                <div style={{ fontSize:12.5,marginTop:4,fontFamily:"'IBM Plex Mono',monospace",color:'#a89878' }}>{roomCode}</div>
              </div>
              <button onClick={handleCopyCode} style={{ background:'none',border:'none',color:'#a89878',cursor:'pointer',flexShrink:0 }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.8"/></svg></button>
            </div>
          </div>
        </div>
      )}

      {raised && !handToastDismissed && (
        <div style={{ position:'absolute',bottom:96,left:28,display:'flex',alignItems:'center',gap:12,background:'#0a0a0a',border:'1px solid rgba(212,175,55,.15)',borderRadius:12,padding:'12px 14px',boxShadow:'0 20px 50px -20px rgba(0,0,0,.6)',zIndex:50 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color:'#e5c76b',flexShrink:0 }}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7"/><path d="M12 8v.01M12 11v5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
          <span style={{ fontSize:13 }}>You are the next in line to speak</span>
          <button onClick={() => setHandToastDismissed(true)} style={{ background:'none',border:'none',color:'#a89878',cursor:'pointer',fontSize:14,marginLeft:6 }}>✕</button>
        </div>
      )}

      {showNotes && <MeetingNotesModal isOpen={showNotes} roomCode={roomCode} onDone={handleNotesDone} />}

      {showSettingsModal && (
        <div style={{ position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,.65)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center' }}>
          <div style={{ width:740,height:500,background:'#050505',border:'1px solid rgba(212,175,55,.12)',borderRadius:16,display:'grid',gridTemplateColumns:'220px 1fr',overflow:'hidden',boxShadow:'0 24px 64px rgba(0,0,0,.8)' }}>
            <div style={{ borderRight:'1px solid rgba(212,175,55,.07)',padding:'24px 16px',display:'flex',flexDirection:'column',gap:8,background:'#050505' }}>
              <h2 style={{ fontSize:20,fontWeight:600,color:'#f0e6d3',margin:'0 0 20px 8px' }}>Settings</h2>
              {[{id:'audio',label:'Audio'},{id:'video',label:'Video'},{id:'backgrounds',label:'Virtual backgrounds'},{id:'shortcuts',label:'Shortcuts'},{id:'general',label:'General'}].map(tab => (
                <button key={tab.id} onClick={() => setModalTab(tab.id)} style={{ display:'flex',alignItems:'center',padding:'10px 16px',borderRadius:8,border:'none',cursor:'pointer',textAlign:'left',background:modalTab===tab.id?'rgba(212,175,55,.12)':'transparent',color:modalTab===tab.id?'#f0e6d3':'#a89878',fontWeight:modalTab===tab.id?600:500,fontSize:13.5,fontFamily:"'Sora',sans-serif",transition:'all .2s' }}>{tab.label}</button>
              ))}
            </div>
            <div style={{ padding:'28px 36px',display:'flex',flexDirection:'column',background:'#050505',position:'relative' }}>
              <button onClick={() => setShowSettingsModal(false)} style={{ position:'absolute',top:24,right:28,background:'none',border:'none',color:'#a89878',cursor:'pointer' }}><X size={20}/></button>
              <div style={{ flex:1,overflowY:'auto',margin:'40px 0 16px' }}>
                {modalTab==='audio' && (
                  <div style={{ display:'flex',flexDirection:'column',gap:20 }}>
                    <div>
                      <label style={{ fontSize:13,fontWeight:500,color:'#f0e6d3',display:'block',marginBottom:8 }}>Microphone</label>
                      <select value={selectedDevices?.audio||''} onChange={e => switchDevice?.('audio',e.target.value)} style={{ width:'100%',background:'rgba(0,0,0,.5)',color:'#f0e6d3',border:'1px solid rgba(212,175,55,.12)',borderRadius:8,padding:'12px 14px',fontSize:13.5,outline:'none',appearance:'none',fontFamily:"'Sora',sans-serif" }}>
                        {devices?.microphones?.map(m => <option key={m.deviceId} value={m.deviceId} style={{ background:'#0a0a0a' }}>{m.label||'Microphone'}</option>)}
                      </select>
                      <div style={{ display:'flex',gap:4,marginTop:10 }}>{Array.from({length:12}).map((_,i) => <div key={i} style={{ width:20,height:4,borderRadius:1,background:i<activeDashes?'#d4af37':'rgba(212,175,55,.2)',transition:'background .1s' }} />)}</div>
                    </div>
                    <div>
                      <label style={{ fontSize:13,fontWeight:500,color:'#f0e6d3',display:'block',marginBottom:8 }}>Audio output</label>
                      <div style={{ display:'flex',gap:12,alignItems:'center' }}>
                        <select style={{ flex:1,background:'rgba(0,0,0,.5)',color:'#f0e6d3',border:'1px solid rgba(212,175,55,.12)',borderRadius:8,padding:'12px 14px',fontSize:13.5,outline:'none',fontFamily:"'Sora',sans-serif" }}><option style={{ background:'#0a0a0a' }}>Default Speaker</option></select>
                        <button onClick={() => { setIsPlayingTest(true); playTestSound(); setTimeout(()=>setIsPlayingTest(false),800); }} style={{ background:'#d4af37',border:'none',color:'#050505',padding:'12px 24px',borderRadius:8,fontSize:13.5,fontWeight:600,cursor:'pointer',fontFamily:"'Sora',sans-serif" }}>{isPlayingTest?'Playing…':'Test'}</button>
                      </div>
                    </div>
                  </div>
                )}
                {modalTab==='video' && (
                  <div>
                    <label style={{ fontSize:13,fontWeight:500,color:'#f0e6d3',display:'block',marginBottom:8 }}>Camera</label>
                    <select value={selectedDevices?.video||''} onChange={e => switchDevice?.('video',e.target.value)} style={{ width:'100%',background:'rgba(0,0,0,.5)',color:'#f0e6d3',border:'1px solid rgba(212,175,55,.12)',borderRadius:8,padding:'10px 12px',fontSize:13,outline:'none',fontFamily:"'Sora',sans-serif" }}>
                      {devices?.cameras?.map(c => <option key={c.deviceId} value={c.deviceId} style={{ background:'#0a0a0a' }}>{c.label||'Camera'}</option>)}
                    </select>
                  </div>
                )}
                {modalTab==='backgrounds' && (
                  <div>
                    <div style={{ position:'relative',width:280,height:158,background:'#0a0a0a',borderRadius:10,overflow:'hidden',margin:'0 auto 20px',border:'1px solid rgba(212,175,55,.12)' }}>
                      {localStream&&!cameraOff?<video ref={el=>{if(el)el.srcObject=localStream;}} autoPlay playsInline muted style={{ width:'100%',height:'100%',objectFit:'cover',transform:'scaleX(-1)',filter:activeFilter==='blur'?'blur(8px)':activeFilter==='half-blur'?'blur(4px)':'none' }} />:<div style={{ width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:'#050505' }}><div style={{ width:64,height:64,borderRadius:'50%',background:`linear-gradient(160deg,${userColor},${userColor}88)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,fontWeight:700,color:'#f0e6d3' }}>{initial}</div></div>}
                    </div>
                    <button style={{ background:'none',border:'none',color:'#b8860b',display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,fontWeight:600,padding:0,marginBottom:16 }}><Plus size={16}/><span>Add background</span></button>
                    <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10 }}>
                      {BG_OPTIONS.map(opt => {
                        const isSel = (opt.type==='filter'&&activeFilter===opt.id&&selectedBgImage==='none')||(opt.type==='image'&&selectedBgImage===opt.url);
                        return (<button key={opt.id} onClick={() => { if(opt.type==='filter'){setActiveFilter(opt.id);setSelectedBgImage('none');}else{setActiveFilter('none');setSelectedBgImage(opt.url);} }} style={{ aspectRatio:'16/10',borderRadius:6,overflow:'hidden',cursor:'pointer',border:`2px solid ${isSel?'#d4af37':'rgba(212,175,55,.12)'}`,background:opt.type==='image'?`url(${opt.url}) center/cover`:'#0a0a0a',position:'relative',padding:0 }} title={opt.label}>{opt.type==='filter'&&<div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'#c9bda2',fontWeight:600 }}>{opt.label}</div>}</button>);
                      })}
                    </div>
                  </div>
                )}
                {modalTab==='shortcuts' && (
                  <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                    {[{key:'M',desc:'Mute / unmute microphone'},{key:'V',desc:'Turn camera on / off'},{key:'Space',desc:'Push to talk'},{key:'⌘ E',desc:'End or leave meeting'}].map((s,idx) => (
                      <div key={idx} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid rgba(212,175,55,.05)' }}>
                        <span style={{ color:'#c9bda2',fontSize:13 }}>{s.desc}</span>
                        <kbd style={{ background:'rgba(212,175,55,.07)',border:'1px solid rgba(212,175,55,.15)',borderRadius:4,padding:'3px 8px',fontSize:11,color:'#d4af37',fontFamily:'monospace' }}>{s.key}</kbd>
                      </div>
                    ))}
                  </div>
                )}
                {modalTab==='general' && (
                  <div>
                    <label style={{ fontSize:13,fontWeight:500,color:'#f0e6d3',display:'block',marginBottom:8 }}>Language</label>
                    <select style={{ width:'100%',background:'rgba(0,0,0,.5)',color:'#f0e6d3',border:'1px solid rgba(212,175,55,.12)',borderRadius:8,padding:'10px 12px',fontSize:13,outline:'none',fontFamily:"'Sora',sans-serif" }}><option style={{ background:'#0a0a0a' }}>English (United States)</option></select>
                  </div>
                )}
              </div>
              <div style={{ display:'flex',justifyContent:'flex-end',gap:12,borderTop:'1px solid rgba(212,175,55,.07)',paddingTop:20 }}>
                <button onClick={() => setShowSettingsModal(false)} style={{ background:'none',border:'none',color:'#c9bda2',padding:'10px 20px',borderRadius:8,cursor:'pointer',fontSize:13.5,fontWeight:600,fontFamily:"'Sora',sans-serif" }}>Cancel</button>
                <button onClick={() => setShowSettingsModal(false)} style={{ background:'#b8860b',border:'none',color:'#0a0a0a',padding:'10px 24px',borderRadius:8,cursor:'pointer',fontSize:13.5,fontWeight:600,fontFamily:"'Sora',sans-serif" }}>OK</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOP BAR — floats over video, zero height cost */}
      <div style={{ position:'absolute',top:0,left:0,right:0,zIndex:100,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 28px',background:'linear-gradient(180deg,rgba(10,10,10,.75) 0%,transparent 100%)',backdropFilter:'blur(0px)' }}>
        <div style={{ display:'flex',alignItems:'center',flexShrink:0,zIndex:1 }}>
          <img src={etherxLogo} alt="EtherX Meet" style={{ height:140,width:'auto',objectFit:'contain' }}/>
        </div>
        <div style={{ position:'absolute',left:'50%',top:'50%',transform:'translate(-50%,-50%)',display:'flex',alignItems:'center',gap:10,background:'rgba(212,175,55,.05)',padding:'7px 14px',borderRadius:20,whiteSpace:'nowrap' }}>
          <span style={{ fontSize:12.5,fontWeight:600 }}>{fmtTitle(roomCode)}</span>
          <span style={{ width:1,height:12,background:'rgba(212,175,55,.18)' }}/>
          <span style={{ fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:'#a89878' }}>{roomCode}</span>
          <button onClick={handleCopyCode} title="Copy room code" style={{ background:'none',border:'none',color:codeCopied?'#d4af37':'rgba(255,255,255,.4)',cursor:'pointer',display:'flex',padding:1 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.8"/></svg>
          </button>
          <span style={{ width:1,height:12,background:'rgba(212,175,55,.18)' }}/>
          <span style={{ display:'flex',alignItems:'center',gap:5,fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:'#a89878' }}>
            <span style={{ width:5,height:5,borderRadius:'50%',background:'#ef4444',animation:isRecording?'chainPulse 1.5s infinite':undefined,display:'inline-block' }}/>
            {fmtTime(elapsed)}
          </span>
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:8,background:'rgba(212,175,55,.05)',padding:'6px 14px 6px 6px',borderRadius:22,position:'relative',zIndex:1,flexShrink:0 }}>
          <div style={{ position:'relative',width:28,height:28,flexShrink:0 }}>
            <div style={{ width:28,height:28,borderRadius:'50%',background:`linear-gradient(160deg,${userColor},${userColor}88)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700 }}>{initial}</div>
            {raised && (<div style={{ position:'absolute',top:-4,right:-5,width:14,height:14,borderRadius:'50%',background:'#d4af37',border:'2px solid #0a0a0a',display:'flex',alignItems:'center',justifyContent:'center' }}>
              <svg width="7" height="7" viewBox="0 0 24 24" fill="none" style={{ color:'#050505' }}><path d="M8 12V5.5a1.5 1.5 0 013 0V11m0-.5v-2a1.5 1.5 0 013 0V11m0-1.5a1.5 1.5 0 013 0V12m-9 0V9.5a1.5 1.5 0 00-3 0V14c0 3.5 2.5 6.5 6.5 6.5S17 17.5 17 14v-2" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>)}
          </div>
          {micMuted && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color:'#f87171',flexShrink:0 }}><path d="M12 15a3 3 0 003-3V6a3 3 0 00-5.6-1.5M9 9v3a3 3 0 004.24 2.74" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M19 11a7 7 0 01-9.8 6.4M5 5l14 14M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>}
          <span style={{ fontSize:12,fontWeight:600,color:'#c9bda2' }}>{userName||'You'}</span>
          {account && <span style={{ fontSize:11,color:'#a89878',fontFamily:"'IBM Plex Mono',monospace" }}>{account.slice(0,6)}…</span>}
        </div>
      </div>

      {/* MAIN BODY — fills full screen, header overlays on top */}
      <div style={{ position:'absolute',inset:0,display:'flex',gap:0 }}>

        {/* LEFT CHAT PANEL */}
        {chatOpen && (
          <div style={{ width:320,flexShrink:0,background:'#050505',border:'none',borderRight:'1px solid rgba(212,175,55,.12)',display:'flex',flexDirection:'column',overflow:'hidden',animation:'fadeIn .18s ease-out',position:'relative',zIndex:150 }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 18px 10px' }}>
              <span style={{ fontSize:15,fontWeight:700 }}>{panelTab==='chat'?'Chat':panelTab==='polls'?'Polls':panelTab==='cc'?'Captions':'Files'}</span>
              <button onClick={() => setChatOpen(false)} style={{ background:'none',border:'none',color:'#a89878',cursor:'pointer',fontSize:16 }}>✕</button>
            </div>
            <div style={{ display:'flex',alignItems:'center',gap:4,padding:'0 14px 12px',borderBottom:'1px solid rgba(212,175,55,.12)' }}>
              {[
                { id:'chat', node:<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 5h16v11H8l-4 4V5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>, title:'Chat' },
                { id:'polls', node:<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M6 20V10M12 20V4M18 20v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>, title:'Polls' },
                { id:'cc', node:<span style={{ fontSize:10,fontWeight:700,letterSpacing:'.02em' }}>CC</span>, title:'Captions' },
                { id:'files', node:<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>, title:'Files' },
              ].map(t => (
                <button key={t.id} onClick={() => setPanelTab(t.id)} title={t.title} style={{ width:38,height:34,borderRadius:9,border:'none',background:panelTab===t.id?'rgba(212,175,55,.22)':'transparent',color:panelTab===t.id?'#e5c76b':'rgba(255,255,255,.55)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',transition:'all .15s' }}>{t.node}</button>
              ))}
            </div>

            {panelTab==='chat' && (
              <div style={{ flex:1,minHeight:0,display:'flex',flexDirection:'column' }}>
                <VerifiedChat roomCode={roomCode} userName={userName} embedded={true}/>
              </div>
            )}

            {panelTab==='polls' && (
              <div style={{ flex:1,minHeight:0,overflowY:'auto',padding:'14px 16px',display:'flex',flexDirection:'column',gap:10 }}>
                {polls.length===0 && !showPollForm ? (
                  <div style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,padding:24 }}>
                    <svg width="46" height="46" viewBox="0 0 24 24" fill="none" style={{ color:'rgba(212,175,55,.25)' }}><path d="M6 20V10M12 20V4M18 20v-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                    <div style={{ textAlign:'center',color:'#a89878',fontSize:12.5 }}>No polls yet.<br/>Ask the room a question.</div>
                    <button onClick={() => setShowPollForm(true)} style={{ width:'100%',padding:12,borderRadius:12,border:'none',background:'linear-gradient(135deg,#d4af37,#b8860b)',color:'#050505',fontWeight:700,fontSize:13.5,cursor:'pointer',fontFamily:"'Sora',sans-serif" }}>Create a poll</button>
                  </div>
                ) : (
                  <>
                    {polls.map(poll => (
                      <div key={poll.id} style={{ padding:12,borderRadius:10,background:'rgba(212,175,55,.05)',border:'1px solid rgba(212,175,55,.12)' }}>
                        <p style={{ fontSize:13,fontWeight:600,color:'#f0e6d3',margin:'0 0 8px' }}>{poll.q}</p>
                        {poll.opts.map((o,i) => {
                          const total=poll.votes.reduce((a,v)=>a+v,0);
                          const pct=total>0?Math.round(((poll.votes[i]||0)/total)*100):0;
                          const mine=myVotes[poll.id]===i;
                          return (<button key={i} onClick={() => { setMyVotes(v=>({...v,[poll.id]:i})); votePoll?.(poll.id,i); setPolls(ps=>ps.map(p=>p.id===poll.id?{...p,votes:p.opts.map((_,j)=>j===i?(p.votes[j]||0)+1:(p.votes[j]||0))}:p)); }} style={{ width:'100%',textAlign:'left',padding:'7px 10px',borderRadius:6,border:`1px solid ${mine?'#e5c76b':'rgba(212,175,55,.12)'}`,background:mine?'rgba(212,175,55,.12)':'transparent',color:mine?'#e5c76b':'rgba(255,255,255,.7)',fontSize:12,cursor:'pointer',marginBottom:4,position:'relative',overflow:'hidden',fontFamily:"'Sora',sans-serif" }}>
                            <div style={{ position:'absolute',left:0,top:0,bottom:0,width:`${pct}%`,background:'rgba(212,175,55,.1)',transition:'width .4s' }}/>
                            <span style={{ position:'relative' }}>{o} <span style={{ opacity:.5 }}>({pct}%)</span></span>
                          </button>);
                        })}
                      </div>
                    ))}
                    {showPollForm && (
                      <div style={{ marginTop:8,display:'flex',flexDirection:'column',gap:8 }}>
                        <input value={pollQuestion} onChange={e=>setPollQuestion(e.target.value)} placeholder="Poll question…" style={{ width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid rgba(212,175,55,.15)',background:'rgba(212,175,55,.06)',color:'#f0e6d3',fontSize:13,outline:'none',boxSizing:'border-box',fontFamily:"'Sora',sans-serif" }}/>
                        {pollOptions.map((opt,i) => (<div key={i} style={{ display:'flex',gap:6 }}><input value={opt} onChange={e=>{const a=[...pollOptions];a[i]=e.target.value;setPollOptions(a);}} placeholder={`Option ${i+1}`} style={{ flex:1,padding:'7px 10px',borderRadius:6,border:'1px solid rgba(212,175,55,.15)',background:'rgba(212,175,55,.06)',color:'#f0e6d3',fontSize:12,outline:'none',fontFamily:"'Sora',sans-serif" }}/><button onClick={()=>setPollOptions(o=>o.filter((_,j)=>j!==i))} style={{ background:'none',border:'none',color:'#a89878',cursor:'pointer',fontSize:14 }}>✕</button></div>))}
                        <button onClick={()=>setPollOptions(o=>[...o,''])} style={{ background:'none',border:'1px dashed rgba(212,175,55,.2)',borderRadius:6,color:'#a89878',fontSize:12,cursor:'pointer',padding:'6px',fontFamily:"'Sora',sans-serif" }}>+ Add option</button>
                        <div style={{ display:'flex',gap:8 }}>
                          <button onClick={()=>setShowPollForm(false)} style={{ flex:1,padding:9,borderRadius:8,border:'1px solid rgba(212,175,55,.2)',background:'transparent',color:'#a89878',fontSize:13,cursor:'pointer',fontFamily:"'Sora',sans-serif" }}>Cancel</button>
                          <button onClick={() => { if(!pollQuestion.trim()) return; setPolls(p=>[...p,{id:Date.now(),q:pollQuestion,opts:pollOptions.filter(o=>o.trim()),votes:[]}]); setPollQuestion(''); setPollOptions(['Yes','No']); setShowPollForm(false); createPoll?.(pollQuestion,pollOptions); }} style={{ flex:1,padding:9,borderRadius:8,border:'none',background:'#d4af37',color:'#0a0a0a',fontSize:13,cursor:'pointer',fontWeight:600,fontFamily:"'Sora',sans-serif" }}>Launch Poll</button>
                        </div>
                      </div>
                    )}
                    {!showPollForm && <button onClick={()=>setShowPollForm(true)} style={{ padding:10,borderRadius:10,border:'1px solid rgba(212,175,55,.18)',background:'transparent',color:'#a89878',fontSize:13,cursor:'pointer',fontFamily:"'Sora',sans-serif" }}>+ Create another poll</button>}
                  </>
                )}
              </div>
            )}

            {panelTab==='cc' && (
              <div style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,gap:14 }}>
                <div style={{ width:52,height:40,border:'2px solid rgba(212,175,55,.25)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,letterSpacing:'.05em',color:'#a89878' }}>CC</div>
                <div style={{ textAlign:'center',color:'#a89878',fontSize:12.5 }}>{captionsOn?'Captions are on.':'Captions are off.'}<br/>{captionsOn?'Click below to disable.':'Turn them on for this call.'}</div>
                {captionsOn && <LiveTranscript stream={localStream}/>}
                <button onClick={() => setCaptionsOn(v=>!v)} style={{ width:'100%',padding:12,borderRadius:12,border:'1px solid rgba(212,175,55,.2)',background:captionsOn?'rgba(212,175,55,.25)':'rgba(212,175,55,.07)',color:'#f0e6d3',fontWeight:600,fontSize:13.5,cursor:'pointer',fontFamily:"'Sora',sans-serif" }}>{captionsOn?'Turn off captions':'Turn on captions'}</button>
              </div>
            )}

            {panelTab==='files' && (
              <div style={{ flex:1,display:'flex',flexDirection:'column',overflow:'hidden' }}>
                {/* Drop zone / upload button */}
                <div
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor='#d4af37'; e.currentTarget.style.background='rgba(212,175,55,.12)'; }}
                  onDragLeave={(e) => { e.currentTarget.style.borderColor='rgba(212,175,55,.2)'; e.currentTarget.style.background='rgba(212,175,55,.04)'; }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor='rgba(212,175,55,.2)';
                    e.currentTarget.style.background='rgba(212,175,55,.04)';
                    const files = Array.from(e.dataTransfer.files);
                    files.forEach(file => {
                      if (file.size > 10 * 1024 * 1024) { showToast('File too large — max 10 MB'); return; }
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        shareFile({ name: file.name, size: file.size, type: file.type, url: ev.target.result });
                      };
                      reader.readAsDataURL(file);
                    });
                  }}
                  style={{ margin:'12px 12px 8px',borderRadius:12,border:'2px dashed rgba(212,175,55,.2)',background:'rgba(212,175,55,.04)',padding:'18px 12px',textAlign:'center',cursor:'pointer',transition:'all .2s',flexShrink:0 }}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type='file'; input.multiple=true;
                    input.onchange = () => {
                      Array.from(input.files).forEach(file => {
                        if (file.size > 10 * 1024 * 1024) { showToast('File too large — max 10 MB'); return; }
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          shareFile({ name: file.name, size: file.size, type: file.type, url: ev.target.result });
                        };
                        reader.readAsDataURL(file);
                      });
                    };
                    input.click();
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ color:'rgba(212,175,55,.5)',margin:'0 auto 8px',display:'block' }}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                  <p style={{ margin:0,fontSize:12.5,color:'#a89878',fontWeight:500 }}>Click or drag files here</p>
                  <p style={{ margin:'4px 0 0',fontSize:11,color:'rgba(168,152,120,.6)' }}>Max 10 MB per file</p>
                </div>
                {/* File list */}
                <div style={{ flex:1,overflowY:'auto',padding:'0 12px 12px',display:'flex',flexDirection:'column',gap:8 }}>
                  {(sharedFiles||[]).length === 0 ? (
                    <div style={{ textAlign:'center',color:'rgba(168,152,120,.5)',fontSize:12,marginTop:20 }}>No files shared yet</div>
                  ) : (
                    [...(sharedFiles||[])].reverse().map(file => {
                      const ext = file.name.split('.').pop().toLowerCase();
                      const isImg = ['png','jpg','jpeg','gif','webp','svg','bmp'].includes(ext);
                      const fmtSize = file.size > 1024*1024 ? `${(file.size/1024/1024).toFixed(1)} MB` : `${Math.round(file.size/1024)} KB`;
                      return (
                        <div key={file.id} style={{ background:'rgba(212,175,55,.06)',border:'1px solid rgba(212,175,55,.14)',borderRadius:10,overflow:'hidden' }}>
                          {isImg && <img src={file.url} alt={file.name} style={{ width:'100%',maxHeight:120,objectFit:'cover',display:'block' }} />}
                          <div style={{ padding:'10px 12px',display:'flex',alignItems:'center',gap:10 }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color:'#d4af37',flexShrink:0 }}><path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                            <div style={{ flex:1,minWidth:0 }}>
                              <p style={{ margin:0,fontSize:12.5,fontWeight:600,color:'#f0e6d3',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{file.name}</p>
                              <p style={{ margin:'2px 0 0',fontSize:11,color:'#a89878' }}>{fmtSize} · {file.sharedBy}</p>
                            </div>
                            <a href={file.url} download={file.name} style={{ display:'flex',padding:'6px 10px',borderRadius:8,background:'rgba(212,175,55,.12)',border:'1px solid rgba(212,175,55,.2)',color:'#d4af37',textDecoration:'none',fontSize:11.5,fontWeight:600,flexShrink:0,alignItems:'center',gap:4 }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                              Save
                            </a>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PARTICIPANTS RIGHT PANEL */}
        {showPeople && (
          <div style={{ width:290,flexShrink:0,background:'#050505',borderLeft:'1px solid rgba(212,175,55,.12)',display:'flex',flexDirection:'column',overflow:'hidden',animation:'fadeIn .18s ease-out',position:'relative',zIndex:150 }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 18px 12px' }}>
              <span style={{ fontSize:14,fontWeight:700 }}>Participants ({totalP})</span>
              <button onClick={() => setShowPeople(false)} style={{ background:'none',border:'none',color:'#a89878',cursor:'pointer',fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:'0 14px 12px',display:'flex',flexDirection:'column',gap:8 }}>
              <button onClick={() => { setInviteOpen(true); setShowPeople(false); }} style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:8,width:'100%',padding:11,borderRadius:10,border:'none',background:'#d4af37',color:'#0a0a0a',fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:"'Sora',sans-serif" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M18 8v6M15 11h6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/></svg>
                Invite someone
              </button>
              <input placeholder="Search participants" style={{ width:'100%',padding:'9px 12px',borderRadius:9,border:'1px solid rgba(212,175,55,.15)',background:'rgba(212,175,55,.05)',color:'#f0e6d3',fontSize:12.5,outline:'none',fontFamily:"'Sora',sans-serif",boxSizing:'border-box' }}/>
            </div>
            <div style={{ flex:1,minHeight:0,overflowY:'auto',padding:'0 14px 14px',display:'flex',flexDirection:'column',gap:2 }}>
              {[{name:userName||'You',local:true,muted:micMuted,camOff:cameraOff},...peerList.map(([,p])=>({name:p.userName||'Guest',local:false,muted:false,camOff:!p.stream||!!p.videoOff}))].map((u,i) => (
                <div key={i} style={{ display:'flex',alignItems:'center',gap:10,padding:'8px 6px',borderRadius:10 }}>
                  <div style={{ width:32,height:32,borderRadius:'50%',background:`linear-gradient(160deg,${avatarColor(u.name)},${avatarColor(u.name)}88)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,flexShrink:0 }}>{(u.name[0]||'?').toUpperCase()}</div>
                  <span style={{ fontSize:13,flex:1,color:'#f0e6d3' }}>{u.name}{u.local?' (you)':''}</span>
                  {u.camOff && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color:'#a89878' }}><path d="M3 7.5A1.5 1.5 0 014.5 6h9A1.5 1.5 0 0115 7.5v9M13.5 17H4.5A1.5 1.5 0 013 15.5v-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M17 10l4-2.2v8.4L17 14M2 2l20 20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>}
                  {u.muted && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color:'#f87171' }}><path d="M12 15a3 3 0 003-3V6a3 3 0 00-5.6-1.5M9 9v3a3 3 0 004.24 2.74" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M19 11a7 7 0 01-9.8 6.4M5 5l14 14M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MAIN VIDEO AREA */}
        <div style={{ flex:1,position:'relative',borderRadius:0,overflow:'hidden',background:'#050505',display:'flex',alignItems:'center',justifyContent:'center' }}>
          <div style={{ position:'absolute',inset:0,opacity:.5,background:'radial-gradient(600px 400px at 50% 40%,rgba(212,175,55,.10),transparent 70%)',pointerEvents:'none' }}/>


          {gridView && (
            <div style={{ position:'relative',width:'100%',height:'100%',display:'grid',gridTemplateColumns:`repeat(${Math.ceil(Math.sqrt(totalP))},1fr)`,gridAutoRows:'1fr',gap:1,background:'rgba(212,175,55,.12)' }}>
              <div style={{ position:'relative',display:'flex',alignItems:'center',justifyContent:'center',background:'#050505' }}>
                {localStream&&!cameraOff?<VideoTile stream={localStream} userName={userName||'You'} isLocal isMuted={micMuted} isCameraOff={cameraOff}/>:<div style={{ width:120,height:120,borderRadius:'50%',background:`linear-gradient(160deg,${userColor},${userColor}88)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:44,fontWeight:700 }}>{initial}</div>}
                <div style={{ position:'absolute',bottom:14,left:14,display:'flex',alignItems:'center',gap:6,background:'rgba(0,0,0,.5)',padding:'5px 10px',borderRadius:16,fontSize:12 }}>
                  {micMuted&&<svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ color:'#f87171' }}><path d="M12 15a3 3 0 003-3V6a3 3 0 00-5.6-1.5M9 9v3a3 3 0 004.24 2.74" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M19 11a7 7 0 01-9.8 6.4M5 5l14 14M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>}
                  {userName||'You'}
                </div>
              </div>
              {peerList.map(([id,p]) => (
                <div key={id} style={{ position:'relative',display:'flex',alignItems:'center',justifyContent:'center',background:'#050505' }} onClick={() => { setSpotlightId(id); setGridView(false); }}>
                  {p.stream&&!p.videoOff?<VideoTile stream={p.stream} userName={p.userName||'Guest'} isMuted={false} isCameraOff={false}/>:<div style={{ width:120,height:120,borderRadius:'50%',background:`linear-gradient(160deg,${avatarColor(p.userName||'G')},${avatarColor(p.userName||'G')}88)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:44,fontWeight:700 }}>{(p.userName||'G')[0].toUpperCase()}</div>}
                  <div style={{ position:'absolute',bottom:14,left:14,display:'flex',alignItems:'center',gap:6,background:'rgba(0,0,0,.5)',padding:'5px 10px',borderRadius:16,fontSize:12 }}>{p.userName||'Guest'}</div>
                </div>
              ))}
            </div>
          )}

          {!gridView && (
            <div style={{ position:'relative',width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center' }}>
              {spotlight ? (
                <div style={{ width:'100%',height:'100%' }}><VideoTile stream={spotlight[1].stream} userName={spotlight[1].userName||'Guest'} isMuted={false} isCameraOff={!spotlight[1].stream||!!spotlight[1].videoOff}/></div>
              ) : localStream && !cameraOff ? (
                <div style={{ width:'100%',height:'100%' }}><VideoTile stream={localStream} userName={userName||'You'} isLocal isMuted={micMuted} isCameraOff={cameraOff}/></div>
              ) : (
                <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:18 }}>
                  <div style={{ width:168,height:168,borderRadius:'50%',background:`linear-gradient(160deg,${userColor},${userColor}88)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:60,fontWeight:700,animation:'speak 2.2s infinite' }}>{initial}</div>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:16,fontWeight:600 }}>{userName||'You'}</div>
                    <div style={{ fontSize:12,color:'#a89878',marginTop:4 }}>{peerList.length===0?'Waiting for others to join…':'Camera is off'}</div>
                  </div>
                </div>
              )}
              {peerList.length > 0 && (
                <div style={{ position:'absolute',bottom:12,right:12,display:'flex',flexDirection:'column',gap:8 }}>
                  {peerList.map(([id,p]) => (
                    <div key={id} onClick={() => setSpotlightId(spotlightId===id?null:id)} style={{ width:120,height:80,borderRadius:10,overflow:'hidden',cursor:'pointer',border:`1px solid ${spotlightId===id?'#d4af37':'rgba(212,175,55,.15)'}`,flexShrink:0 }}>
                      <VideoTile stream={p.stream} userName={p.userName||'Guest'} isMuted={false} isCameraOff={!p.stream||!!p.videoOff} isSmall/>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ position:'absolute',top:18,left:18 }}>
            <div style={{ display:'flex',alignItems:'center',gap:6,background:'rgba(0,0,0,.4)',backdropFilter:'blur(6px)',padding:'6px 12px',borderRadius:18,fontSize:12 }}>
              {micMuted && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color:'#f87171' }}><path d="M12 15a3 3 0 003-3V6a3 3 0 00-5.6-1.5M9 9v3a3 3 0 004.24 2.74" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M19 11a7 7 0 01-9.8 6.4M5 5l14 14M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>}
              {userName||'You'}
            </div>
          </div>

          {/* BOTTOM TOOLBAR */}
          <div className={`toolbar-wrap${toolbarVisible ? '' : ' hidden'}`} style={{ position:'absolute',bottom:32,left:0,right:0,display:'flex',justifyContent:'center' }}>
            <div style={{ display:'flex',alignItems:'center',gap:10,backdropFilter:'blur(16px)',padding:'14px 16px',borderRadius:1,boxShadow:'0 24px 60px -20px rgba(0,0,0,.65)',background:'linear-gradient(180deg,rgba(0,0,7,.8),rgba(0,0,0,.95))' }}>

              <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:4 }}>
                <button style={{ background:'none',border:'none',color:'#a89878',cursor:'pointer',padding:0,display:'flex' }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M6 14l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                <button onClick={toggleMic} title={micMuted?'Unmute':'Mute'} style={{ width:52,height:52,borderRadius:16,border:'none',background:micMuted?'rgba(239,68,68,.18)':'rgba(212,175,55,.15)',color:micMuted?'#f87171':'#f0e6d3',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',transition:'background .15s' }}>
                  {micMuted ? <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M12 15a3 3 0 003-3V6a3 3 0 00-5.6-1.5M9 9v3a3 3 0 004.24 2.74" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M19 11a7 7 0 01-9.8 6.4M5 5l14 14M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> : <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3z" stroke="currentColor" strokeWidth="1.8"/><path d="M19 11a7 7 0 01-14 0M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>}
                </button>
              </div>

              <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:4 }}>
                <button style={{ background:'none',border:'none',color:'#a89878',cursor:'pointer',padding:0,display:'flex' }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M6 14l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                <button onClick={toggleCamera} title={cameraOff?'Start camera':'Stop camera'} style={{ width:52,height:52,borderRadius:16,border:'none',background:cameraOff?'rgba(239,68,68,.18)':'rgba(212,175,55,.15)',color:cameraOff?'#f87171':'#f0e6d3',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',transition:'background .15s' }}>
                  {cameraOff ? <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M3 7.5A1.5 1.5 0 014.5 6h9A1.5 1.5 0 0115 7.5v9M13.5 17H4.5A1.5 1.5 0 013 15.5v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M17 10l4-2.2v8.4L17 14M2 2l20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> : <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M3 7.5A1.5 1.5 0 014.5 6h9A1.5 1.5 0 0115 7.5v9a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 013 16.5v-9z" stroke="currentColor" strokeWidth="1.8"/><path d="M17 10l4-2.2v8.4L17 14" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>}
                </button>
              </div>

              <button onClick={toggleScreenShare} title={isScreenSharing?'Stop sharing':'Share screen'} style={{ width:52,height:52,borderRadius:16,border:'none',background:isScreenSharing?'rgba(212,175,55,.25)':'transparent',color:isScreenSharing?'#e5c76b':'#a89878',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>
                {isScreenSharing ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.7"/><path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M2 2l20 20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.7"/><path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M12 8v5m0-5l-2.5 2.5M12 8l2.5 2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </button>

              <button onClick={() => { setChatOpen(v=>!v); if(!chatOpen) setPanelTab('chat'); }} title="Chat" style={{ width:52,height:52,borderRadius:16,border:'none',background:chatOpen?'rgba(212,175,55,.15)':'transparent',color:chatOpen?'#f0e6d3':'#a89878',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 5h16v11H8l-4 4V5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>
              </button>

              <button onClick={handleRaiseHand} title={raised?'Lower hand':'Raise hand'} style={{ width:52,height:52,borderRadius:16,border:'none',background:raised?'rgba(212,175,55,.22)':'transparent',color:raised?'#e8c789':'#a89878',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',position:'relative' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M8 12V5.5a1.5 1.5 0 013 0V11m0-.5v-2a1.5 1.5 0 013 0V11m0-1.5a1.5 1.5 0 013 0V12m-9 0V9.5a1.5 1.5 0 00-3 0V14c0 3.5 2.5 6.5 6.5 6.5S17 17.5 17 14v-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {raised && <span style={{ position:'absolute',top:6,right:6,minWidth:15,height:15,padding:'0 3px',borderRadius:8,background:'#d4af37',color:'#050505',fontSize:9.5,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center' }}>1</span>}
              </button>

              <button onClick={() => setShowPeople(v=>!v)} title="Participants" style={{ width:52,height:52,borderRadius:16,border:'none',background:showPeople?'rgba(212,175,55,.15)':'transparent',color:showPeople?'#f0e6d3':'#a89878',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',position:'relative' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M16 11c1.657 0 3-1.79 3-4s-1.343-4-3-4M8 11c1.657 0 3-1.79 3-4S9.657 3 8 3 5 4.79 5 7s1.343 4 3 4z" stroke="currentColor" strokeWidth="1.6"/><path d="M2 20c0-3 2.5-5 6-5s6 2 6 5M13 15c3 0 5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                <span style={{ position:'absolute',top:6,right:6,minWidth:15,height:15,padding:'0 3px',borderRadius:8,background:'#d4af37',color:'#0a0a0a',fontSize:9.5,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center' }}>{totalP}</span>
              </button>

              <button onClick={() => setGridView(v=>!v)} title="Grid view" style={{ width:52,height:52,borderRadius:16,border:'none',background:gridView?'rgba(212,175,55,.15)':'transparent',color:gridView?'#f0e6d3':'#a89878',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.7"/><rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.7"/><rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.7"/><rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.7"/></svg>
              </button>

              <button onClick={() => setInviteOpen(true)} title="Invite people" style={{ width:52,height:52,borderRadius:16,border:'none',background:'transparent',color:'#c9bda2',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><path d="M18 8v6M15 11h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
              </button>

              <div style={{ position:'relative' }} ref={moreRef}>
                <button onClick={() => setMoreOpen(v=>!v)} title="More" style={{ width:52,height:52,borderRadius:16,border:'none',background:moreOpen?'rgba(212,175,55,.15)':'transparent',color:'#c9bda2',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/></svg>
                </button>
                {moreOpen && (
                  <div style={{ position:'absolute',bottom:64,left:'50%',transform:'translateX(-50%)',width:250,background:'#0a0a0a',border:'1px solid rgba(212,175,55,.12)',borderRadius:14,boxShadow:'0 20px 50px -20px rgba(0,0,0,.7)',padding:8,display:'flex',flexDirection:'column',zIndex:200,animation:'fadeIn .15s ease-out' }}>
                    <div style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 10px',borderBottom:'1px solid rgba(212,175,55,.12)',marginBottom:6 }}>
                      <div style={{ width:26,height:26,borderRadius:'50%',background:`linear-gradient(160deg,${userColor},${userColor}88)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700 }}>{initial}</div>
                      <span style={{ fontSize:13,fontWeight:600 }}>{userName||'You'}</span>
                    </div>
                    {[
                      { icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M13 2v7h7" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>, label:'Performance settings', divider:false, action:() => { setMoreOpen(false); showToast('Performance optimized.'); } },
                      { icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3m8 0h3a2 2 0 002-2v-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>, label:'View full screen', divider:false, action:() => { if(!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{}); else document.exitFullscreen().catch(()=>{}); setMoreOpen(false); } },
                      { icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>, label:'Security options', divider:false, action:() => { setMoreOpen(false); showToast('Room: end-to-end encrypted.'); } },
                      { icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>, label:'Closed captions', divider:false, action:() => { setPanelTab('cc'); setChatOpen(true); setMoreOpen(false); } },
                      { icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 20V10M12 20V4M18 20v-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>, label:'Polls', divider:false, action:() => { setPanelTab('polls'); setChatOpen(true); setMoreOpen(false); } },
                      { icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>, label:'File sharing', divider:true, action:() => { setPanelTab('files'); setChatOpen(true); setMoreOpen(false); } },
                      { icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>, label:'Share video', divider:false, action:() => { setMoreOpen(false); showToast('Video sharing initialized.'); } },
                      { icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.6"/><circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="1.6"/></svg>, label:'Share audio', divider:false, action:() => { setMoreOpen(false); showToast('Audio sharing initialized.'); } },
                      { icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2a3 3 0 013 3v7a3 3 0 01-6 0V5a3 3 0 013-3z" stroke="currentColor" strokeWidth="1.5"/><path d="M19 10a7 7 0 01-14 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>, label:'Noise suppression', divider:false, action:() => { setMoreOpen(false); showToast('Noise suppression toggled.'); } },
                      { icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="9" cy="10" r="3" stroke="currentColor" strokeWidth="1.4"/></svg>, label:'Select background', divider:false, action:() => { setShowSettingsModal(true); setModalTab('backgrounds'); setMoreOpen(false); } },
                      { icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M16 11c1.657 0 3-1.79 3-4s-1.343-4-3-4M8 11c1.657 0 3-1.79 3-4S9.657 3 8 3 5 4.79 5 7s1.343 4 3 4z" stroke="currentColor" strokeWidth="1.5"/><path d="M2 20c0-3 2.5-5 6-5s6 2 6 5M13 15c3 0 5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>, label:'Participant stats', divider:true, action:() => { setShowPeople(true); setMoreOpen(false); } },
                      { icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="1.5"/></svg>, label:'Settings', divider:false, action:() => { setShowSettingsModal(true); setModalTab('audio'); setMoreOpen(false); } },
                      { icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="8" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="14" y="3" width="8" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="2" y="10" width="8" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="14" y="10" width="8" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="8" y="17" width="8" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg>, label:'View shortcuts', divider:false, action:() => { setShowSettingsModal(true); setModalTab('shortcuts'); setMoreOpen(false); } },
                      { icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>, label:'Leave feedback', divider:false, action:() => { setMoreOpen(false); showToast('Thank you for your feedback!'); } },
                    ].map((item,idx) => (
                      <div key={idx}>
                        <button onClick={item.action} style={{ display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:9,border:'none',background:'none',color:'#f0e6d3',fontSize:12.5,cursor:'pointer',textAlign:'left',width:'100%',fontFamily:"'Sora',sans-serif",transition:'background .15s' }}
                          onMouseEnter={e => e.currentTarget.style.background='rgba(212,175,55,.08)'}
                          onMouseLeave={e => e.currentTarget.style.background='none'}
                        >
                          <span style={{ color:'#a89878',flexShrink:0,display:'flex' }}>{item.icon}</span>
                          {item.label}
                        </button>
                        {item.divider && <div style={{ height:1,background:'rgba(212,175,55,.12)',margin:'4px 4px' }}/>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ width:1,height:30,background:'rgba(212,175,55,.15)',margin:'0 6px' }}/>

              <button onClick={handleEnd} title="Leave call" style={{ padding:'0 24px',height:50,borderRadius:15,border:'none',background:'linear-gradient(135deg,#ef4444,#b91c1c)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',gap:8,fontWeight:600,fontSize:14,marginLeft:2,fontFamily:"'Sora',sans-serif" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 12c3-4 6-6 9-6s6 2 9 6c-1 1.3-2 2.4-3.1 3.3a1 1 0 01-1.3-.1l-1.7-1.7a1 1 0 00-1-.25 8 8 0 01-3.8 0 1 1 0 00-1 .25l-1.7 1.7a1 1 0 01-1.3.1C5 14.4 4 13.3 3 12z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>
                Leave
              </button>
            </div>
          </div>
        </div>
      </div>

      {connectionError && (
        <div style={{ position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'rgba(239,68,68,.15)',border:'1px solid rgba(239,68,68,.3)',borderRadius:12,padding:'20px 28px',color:'#fca5a5',fontSize:13,zIndex:60,display:'flex',flexDirection:'column',alignItems:'center',gap:12 }}>
          <p style={{ margin:0 }}>{connectionError}</p>
          <button onClick={() => navigate(ROUTES.DASHBOARD)} style={{ background:'#b8860b',border:'none',color:'#f0e6d3',padding:'8px 20px',borderRadius:8,cursor:'pointer',fontWeight:600,fontFamily:"'Sora',sans-serif" }}>Back to Dashboard</button>
        </div>
      )}

      {toast && (
        <div style={{ position:'fixed',top:24,left:'50%',transform:'translateX(-50%)',zIndex:1100,background:'rgba(5,5,5,.85)',backdropFilter:'blur(20px)',border:'1px solid rgba(212,175,55,.15)',borderRadius:12,padding:'12px 24px',color:'#f0e6d3',fontSize:13,fontWeight:500,boxShadow:'0 8px 32px rgba(0,0,0,.5)',display:'flex',alignItems:'center',gap:10,animation:'slideDown .3s ease-out forwards',fontFamily:"'Sora',sans-serif" }}>
          <span style={{ fontSize:16 }}>ℹ️</span><span>{toast}</span>
        </div>
      )}
    </div>
  );
}
