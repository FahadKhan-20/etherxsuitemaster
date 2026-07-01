/**
 * AgendaTimer — structured meeting agenda with per-item countdown timers.
 * Host can add agenda items, set durations, and run them in sequence.
 * All participants see the current item + time remaining.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Play, Pause, SkipForward, Trash2, CheckCircle2, Clock, AlarmClock } from 'lucide-react';

function pad(n) { return String(n).padStart(2,'0'); }
function fmtTime(s) { return `${pad(Math.floor(s/60))}:${pad(s%60)}`; }

const PRESETS = [
  { label:'2m',  mins:2  },
  { label:'5m',  mins:5  },
  { label:'10m', mins:10 },
  { label:'15m', mins:15 },
  { label:'30m', mins:30 },
];

export default function AgendaTimer({ isHost = false }) {
  const [items,   setItems]   = useState([
    { id:1, title:'Introductions',    mins:5,  done:false },
    { id:2, title:'Status updates',   mins:10, done:false },
    { id:3, title:'Discussion',       mins:15, done:false },
    { id:4, title:'Action items',     mins:5,  done:false },
  ]);
  const [currentIdx, setCurrentIdx] = useState(null);
  const [remaining,  setRemaining]  = useState(0);
  const [running,    setRunning]    = useState(false);
  const [newTitle,   setNewTitle]   = useState('');
  const [newMins,    setNewMins]    = useState(5);
  const [overtime,   setOvertime]   = useState(false);
  const intervalRef = useRef(null);

  // ── Timer tick ────────────────────────────────────────────────────────────
  useEffect(() => {
    clearInterval(intervalRef.current);
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 0) { setOvertime(true); return prev - 1; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running]);

  // ── Start item ────────────────────────────────────────────────────────────
  const startItem = useCallback((idx) => {
    setCurrentIdx(idx);
    setRemaining(items[idx].mins * 60);
    setRunning(true);
    setOvertime(false);
  }, [items]);

  // ── Skip to next ──────────────────────────────────────────────────────────
  const skipNext = () => {
    if (currentIdx === null) { startItem(0); return; }
    // Mark current done
    setItems(prev => prev.map((it,i) => i===currentIdx ? {...it, done:true} : it));
    const next = currentIdx + 1;
    if (next < items.length) startItem(next);
    else { setRunning(false); setCurrentIdx(null); }
  };

  const togglePause = () => setRunning(r => !r);

  const stop = () => { setRunning(false); clearInterval(intervalRef.current); };

  const addItem = () => {
    if (!newTitle.trim()) return;
    setItems(prev => [...prev, { id: Date.now(), title: newTitle.trim(), mins: newMins, done:false }]);
    setNewTitle(''); setNewMins(5);
  };

  const removeItem = (id) => setItems(prev => prev.filter(it => it.id !== id));

  const totalMins = items.reduce((a, it) => a + it.mins, 0);
  const completedMins = items.filter(it=>it.done).reduce((a,it)=>a+it.mins,0);
  const progressPct = totalMins > 0 ? (completedMins / totalMins) * 100 : 0;

  const isOvertime = overtime && remaining < 0;
  const displayTime = isOvertime ? `-${fmtTime(Math.abs(remaining))}` : fmtTime(Math.max(0, remaining));
  const timerColor = isOvertime ? '#F87171' : remaining < 60 ? '#FBBF24' : '#34D399';

  return (
    <div style={{ fontFamily:'Geist,Inter,sans-serif' }}>
      <style>{`
        .agenda-item { padding:10px 12px; background:var(--surface-2); border:1px solid var(--border); border-radius:10px; display:flex; align-items:center; gap:10px; margin-bottom:6px; transition:border-color .15s; }
        .agenda-item.active { border-color:var(--accent); background:var(--accent-soft); }
        .agenda-item.done { opacity:.5; }
        .ag-input { width:100%; padding:8px 12px; background:var(--surface-2); border:1px solid var(--border-strong); border-radius:9px; color:var(--text); font-family:Geist,Inter,sans-serif; font-size:13px; outline:none; }
        .ag-input:focus { border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-ring); }
        .ag-preset-btn { padding:4px 10px; border-radius:6px; border:1px solid var(--border-strong); background:var(--surface-2); color:var(--text-2); font-size:11px; cursor:pointer; transition:background .12s; }
        .ag-preset-btn:hover,.ag-preset-btn.sel { background:var(--accent); color:#fff; border-color:var(--accent); }
      `}</style>

      {/* Overall progress */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
          <span style={{ fontSize:12,fontWeight:600,color:'var(--text)' }}>Meeting progress</span>
          <span style={{ fontSize:11,color:'var(--text-3)' }}>{completedMins}/{totalMins} min</span>
        </div>
        <div style={{ height:6, background:'var(--surface-3)', borderRadius:3, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${progressPct}%`, background:'var(--accent)', borderRadius:3, transition:'width .5s' }}/>
        </div>
      </div>

      {/* Active timer display */}
      {currentIdx !== null && (
        <div style={{ padding:16, background:'var(--surface-2)', border:`2px solid ${timerColor}44`, borderRadius:14, marginBottom:14, textAlign:'center' }}>
          <div style={{ fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--text-3)',marginBottom:4 }}>
            {isOvertime ? '⏰ OVERTIME' : 'NOW DISCUSSING'}
          </div>
          <div style={{ fontSize:14,fontWeight:600,color:'var(--text)',marginBottom:8 }}>
            {items[currentIdx]?.title}
          </div>
          <div style={{ fontSize:42,fontWeight:800,fontFamily:'Geist Mono,monospace',letterSpacing:'-0.03em',color:timerColor,lineHeight:1 }}>
            {displayTime}
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:12 }}>
            <button onClick={togglePause} style={{ padding:'8px 16px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:9, fontWeight:600, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontFamily:'Geist,Inter,sans-serif' }}>
              {running ? <Pause size={14}/> : <Play size={14}/>}
              {running ? 'Pause' : 'Resume'}
            </button>
            <button onClick={skipNext} style={{ padding:'8px 14px', background:'var(--surface-3)', color:'var(--text-2)', border:'1px solid var(--border-strong)', borderRadius:9, fontWeight:500, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontFamily:'Geist,Inter,sans-serif' }}>
              <SkipForward size={14}/> Next
            </button>
          </div>
        </div>
      )}

      {/* Agenda list */}
      <div style={{ marginBottom:14 }}>
        {items.map((it, idx) => (
          <div key={it.id} className={`agenda-item${idx===currentIdx?' active':''}${it.done?' done':''}`}>
            {it.done
              ? <CheckCircle2 size={16} style={{ color:'#34D399', flexShrink:0 }}/>
              : <Clock size={16} style={{ color:'var(--text-3)', flexShrink:0 }}/>
            }
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13,fontWeight:500,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{it.title}</div>
              <div style={{ fontSize:11,color:'var(--text-3)' }}>{it.mins} min</div>
            </div>
            {isHost && currentIdx === null && !it.done && (
              <button onClick={() => startItem(idx)} style={{ padding:'4px 10px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:7, fontSize:11, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                Start
              </button>
            )}
            {isHost && (
              <button onClick={() => removeItem(it.id)} style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', padding:'2px', display:'grid', placeItems:'center' }}>
                <Trash2 size={13}/>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add item (host only) */}
      {isHost && (
        <div style={{ padding:14, background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:12 }}>
          <div style={{ fontSize:12,fontWeight:600,color:'var(--text)',marginBottom:10 }}>Add agenda item</div>
          <input
            className="ag-input"
            placeholder="Item title…"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()}
            style={{ marginBottom:8 }}
          />
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
            {PRESETS.map(p => (
              <button key={p.mins} className={`ag-preset-btn${newMins===p.mins?' sel':''}`}
                onClick={() => setNewMins(p.mins)}>{p.label}</button>
            ))}
          </div>
          <button onClick={addItem} disabled={!newTitle.trim()}
            style={{ width:'100%', padding:'9px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:9, fontWeight:600, fontSize:13, cursor: newTitle.trim() ? 'pointer' : 'not-allowed', opacity: newTitle.trim() ? 1 : 0.5, display:'flex', alignItems:'center', justifyContent:'center', gap:7, fontFamily:'Geist,Inter,sans-serif' }}>
            <Plus size={14}/> Add item
          </button>
        </div>
      )}

      {/* Start meeting button if not started */}
      {isHost && currentIdx === null && items.some(it=>!it.done) && (
        <button onClick={() => startItem(items.findIndex(it=>!it.done))}
          style={{ marginTop:10, width:'100%', padding:'11px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:10, fontWeight:700, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontFamily:'Geist,Inter,sans-serif', boxShadow:'0 4px 20px var(--accent-ring)' }}>
          <AlarmClock size={16}/> Start agenda
        </button>
      )}
    </div>
  );
}
