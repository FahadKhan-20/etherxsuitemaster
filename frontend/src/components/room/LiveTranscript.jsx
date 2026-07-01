/**
 * LiveTranscript — real-time speech-to-text using the Web Speech API.
 * Displays a rolling transcript with speaker labels, timestamps,
 * copy-to-clipboard and download-as-txt controls.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Mic, MicOff, Download, Copy, Check, Trash2,
  ChevronDown, AlertCircle, Subtitles,
} from 'lucide-react';

// ── Colour palette for speakers (up to 8) ───────────────────────────────────
const SPEAKER_COLOURS = [
  '#A78BFA','#34D399','#FB923C','#F472B6',
  '#38BDF8','#FACC15','#F87171','#4ADE80',
];

function useSpeakerColour() {
  const map = useRef({});
  let idx = useRef(0);
  return (name) => {
    if (!map.current[name]) {
      map.current[name] = SPEAKER_COLOURS[idx.current % SPEAKER_COLOURS.length];
      idx.current++;
    }
    return map.current[name];
  };
}

function fmt(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function LiveTranscript({ speakerName = 'You', onClose }) {
  const [lines,      setLines]      = useState([]);
  const [interim,    setInterim]    = useState('');
  const [running,    setRunning]    = useState(false);
  const [error,      setError]      = useState('');
  const [copied,     setCopied]     = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  const recogRef   = useRef(null);
  const startMs    = useRef(Date.now());
  const bottomRef  = useRef(null);
  const colour     = useSpeakerColour();

  const supported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // ── Auto-scroll to bottom ─────────────────────────────────────────────────
  useEffect(() => {
    if (autoScroll && bottomRef.current)
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [lines, interim, autoScroll]);

  // ── Start recognition ─────────────────────────────────────────────────────
  const start = useCallback(() => {
    if (!supported) { setError('Speech recognition not supported in this browser.'); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';

    r.onstart  = () => { setRunning(true); setError(''); startMs.current = Date.now(); };
    r.onerror  = (e) => {
      if (e.error === 'not-allowed') setError('Microphone permission denied.');
      else if (e.error !== 'no-speech') setError(`Error: ${e.error}`);
    };
    r.onend    = () => {
      setRunning(false); setInterim('');
      // Auto-restart if user didn't stop manually
      if (recogRef.current) r.start();
    };
    r.onresult = (e) => {
      let fin = ''; let inter = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) fin += t;
        else inter += t;
      }
      setInterim(inter);
      if (fin.trim()) {
        setLines(prev => [...prev, {
          id:      Date.now(),
          speaker: speakerName,
          text:    fin.trim(),
          ts:      Date.now() - startMs.current,
        }]);
        setInterim('');
      }
    };

    recogRef.current = r;
    r.start();
  }, [supported, speakerName]);

  // ── Stop recognition ──────────────────────────────────────────────────────
  const stop = useCallback(() => {
    if (recogRef.current) {
      recogRef.current.onend = null;   // prevent auto-restart
      recogRef.current.stop();
      recogRef.current = null;
    }
    setRunning(false); setInterim('');
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stop(), [stop]);

  // ── Copy all to clipboard ─────────────────────────────────────────────────
  const copyAll = () => {
    const text = lines.map(l => `[${fmt(l.ts)}] ${l.speaker}: ${l.text}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Download .txt ─────────────────────────────────────────────────────────
  const download = () => {
    const text = lines.map(l => `[${fmt(l.ts)}] ${l.speaker}: ${l.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `transcript-${new Date().toISOString().slice(0,10)}.txt`; a.click();
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', fontFamily:'Geist,Inter,sans-serif' }}>
      <style>{`
        .lt-line { display:flex; gap:10px; padding:6px 0; border-bottom:1px solid var(--border); animation:ltfade .25s ease; }
        @keyframes ltfade { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:none} }
        .lt-bubble { font-size:13px; line-height:1.55; color:var(--text); flex:1; }
        .lt-interim { font-size:13px; line-height:1.55; color:var(--text-3); font-style:italic; padding:6px 0; }
        .lt-ts { font-size:10px; font-family:'Geist Mono',monospace; color:var(--text-3); white-space:nowrap; padding-top:2px; }
        .lt-speaker { font-size:11px; font-weight:700; white-space:nowrap; }
        .lt-scroll { flex:1; overflow-y:auto; padding:4px 2px; scroll-behavior:smooth; }
        .lt-scroll::-webkit-scrollbar { width:4px; }
        .lt-scroll::-webkit-scrollbar-thumb { background:var(--border-strong); border-radius:2px; }
      `}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
        <div style={{ width:28,height:28,borderRadius:8,background:'var(--accent-soft)',display:'grid',placeItems:'center',color:'var(--accent)' }}>
          <Subtitles size={14}/>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13,fontWeight:600,color:'var(--text)' }}>Live Transcript</div>
          <div style={{ fontSize:11,color:'var(--text-3)' }}>
            {running ? `🔴 Recording · ${lines.length} lines` : 'Press Start to begin'}
          </div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {lines.length > 0 && <>
            <button onClick={copyAll} title="Copy all" style={{ padding:'5px 8px', background:'var(--surface-2)', border:'1px solid var(--border-strong)', borderRadius:7, color: copied ? '#34D399' : 'var(--text-2)', cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontSize:11 }}>
              {copied ? <Check size={12}/> : <Copy size={12}/>}
            </button>
            <button onClick={download} title="Download .txt" style={{ padding:'5px 8px', background:'var(--surface-2)', border:'1px solid var(--border-strong)', borderRadius:7, color:'var(--text-2)', cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontSize:11 }}>
              <Download size={12}/>
            </button>
            <button onClick={() => setLines([])} title="Clear" style={{ padding:'5px 8px', background:'var(--surface-2)', border:'1px solid var(--border-strong)', borderRadius:7, color:'var(--text-2)', cursor:'pointer', fontSize:11 }}>
              <Trash2 size={12}/>
            </button>
          </>}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding:'9px 12px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:9, fontSize:12, color:'#F87171', marginBottom:10, display:'flex', alignItems:'center', gap:8 }}>
          <AlertCircle size={13}/> {error}
        </div>
      )}

      {!supported && !error && (
        <div style={{ padding:'9px 12px', background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.2)', borderRadius:9, fontSize:12, color:'#FCD34D', marginBottom:10 }}>
          ⚠️ Live transcript requires Chrome or Edge browser.
        </div>
      )}

      {/* Transcript scroll area */}
      <div className="lt-scroll" onScroll={e => {
        const el = e.currentTarget;
        setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
      }}>
        {lines.length === 0 && !interim && (
          <div style={{ textAlign:'center', padding:'30px 0', color:'var(--text-3)', fontSize:13 }}>
            <Subtitles size={32} style={{ margin:'0 auto 10px', display:'block', opacity:.3 }}/>
            Transcript will appear here as you speak.
          </div>
        )}
        {lines.map(l => (
          <div key={l.id} className="lt-line">
            <div className="lt-ts">{fmt(l.ts)}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:2, flex:1 }}>
              <div className="lt-speaker" style={{ color: colour(l.speaker) }}>{l.speaker}</div>
              <div className="lt-bubble">{l.text}</div>
            </div>
          </div>
        ))}
        {interim && (
          <div className="lt-interim">
            <span style={{ color: colour(speakerName), fontWeight:700, fontSize:11 }}>{speakerName}: </span>
            {interim}
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && (
        <button onClick={() => { setAutoScroll(true); bottomRef.current?.scrollIntoView({behavior:'smooth'}); }}
          style={{ margin:'6px auto 0', display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--accent)', background:'var(--accent-soft)', border:'none', borderRadius:999, padding:'4px 12px', cursor:'pointer' }}>
          <ChevronDown size={13}/> Scroll to latest
        </button>
      )}

      {/* Controls */}
      <div style={{ marginTop:12, display:'flex', gap:8 }}>
        {!running ? (
          <button onClick={start} disabled={!supported} style={{ flex:1, padding:'10px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:10, fontWeight:600, fontSize:13, cursor: supported ? 'pointer' : 'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', gap:8, opacity: supported ? 1 : 0.5, fontFamily:'Geist,Inter,sans-serif' }}>
            <Mic size={15}/> Start transcribing
          </button>
        ) : (
          <button onClick={stop} style={{ flex:1, padding:'10px', background:'rgba(239,68,68,0.12)', color:'#F87171', border:'1px solid rgba(239,68,68,0.25)', borderRadius:10, fontWeight:600, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontFamily:'Geist,Inter,sans-serif' }}>
            <MicOff size={15}/> Stop
          </button>
        )}
      </div>
    </div>
  );
}
