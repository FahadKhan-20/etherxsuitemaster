/**
 * AmbientSoundMixer — play background ambient sounds during a meeting.
 * Sounds are loaded from Web Audio API oscillators / noise generators
 * (no external files needed). Each channel has its own volume slider.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Play, Square, Waves } from 'lucide-react';

const SOUNDS = [
  { id: 'rain',      emoji: '🌧️', label: 'Rain',         desc: 'Soft rainfall'         },
  { id: 'cafe',      emoji: '☕', label: 'Coffee Shop',   desc: 'Ambient chatter'       },
  { id: 'forest',    emoji: '🌿', label: 'Forest',        desc: 'Birds & breeze'        },
  { id: 'ocean',     emoji: '🌊', label: 'Ocean Waves',   desc: 'Calm beach'            },
  { id: 'fireplace', emoji: '🔥', label: 'Fireplace',     desc: 'Crackling fire'        },
  { id: 'lofi',      emoji: '🎵', label: 'Lo-fi Beats',   desc: 'Chilled study music'   },
  { id: 'office',    emoji: '🏢', label: 'Office',        desc: 'Keyboard & AC hum'     },
  { id: 'thunder',   emoji: '⛈️', label: 'Thunderstorm',  desc: 'Heavy rain & thunder'  },
];

// ── Web Audio noise generators ─────────────────────────────────────────────
function createNoiseNode(ctx, type = 'white') {
  const bufSize = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
  for (let i = 0; i < bufSize; i++) {
    const white = Math.random() * 2 - 1;
    if (type === 'pink') {
      b0=.99886*b0+white*.0555179; b1=.99332*b1+white*.0750759;
      b2=.96900*b2+white*.1538520; b3=.86650*b3+white*.3104856;
      b4=.55000*b4+white*.5329522; b5=-.7616*b5-white*.0168980;
      data[i] = (b0+b1+b2+b3+b4+b5+b6+white*.5362) * 0.11; b6=white*.115926;
    } else if (type === 'brown') {
      data[i] = (data[i-1] || 0) + white * 0.02; data[i] /= 1.02;
    } else {
      data[i] = white * 0.5;
    }
  }
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  return src;
}

function buildSoundGraph(ctx, id) {
  const gain = ctx.createGain();
  let osc, noise, osc2;

  switch(id) {
    case 'rain': {
      noise = createNoiseNode(ctx, 'pink');
      const filter = ctx.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=700;
      // Add slight amplitude modulation
      osc = ctx.createOscillator(); osc.type='sine'; osc.frequency.value=0.8;
      const modGain = ctx.createGain(); modGain.gain.value=0.15;
      osc.connect(modGain); modGain.connect(gain.gain);
      noise.connect(filter); filter.connect(gain);
      osc.start(); noise.start();
      return { gain, nodes:[osc,noise] };
    }
    case 'cafe': {
      // Multiple overlapping filtered noise bursts simulate chatter
      noise = createNoiseNode(ctx, 'pink');
      const f1 = ctx.createBiquadFilter(); f1.type='bandpass'; f1.frequency.value=800; f1.Q.value=0.3;
      const f2 = ctx.createBiquadFilter(); f2.type='bandpass'; f2.frequency.value=1800; f2.Q.value=0.5;
      const g1=ctx.createGain(); g1.gain.value=0.6;
      const g2=ctx.createGain(); g2.gain.value=0.4;
      noise.connect(f1); f1.connect(g1); g1.connect(gain);
      noise.connect(f2); f2.connect(g2); g2.connect(gain);
      noise.start();
      return { gain, nodes:[noise] };
    }
    case 'forest': {
      noise = createNoiseNode(ctx, 'pink');
      const filter = ctx.createBiquadFilter(); filter.type='bandpass'; filter.frequency.value=1200; filter.Q.value=0.8;
      // bird chirp oscillators
      osc  = ctx.createOscillator(); osc.type='sine';  osc.frequency.setValueAtTime(2400,ctx.currentTime); osc.frequency.setValueAtTime(2800,ctx.currentTime+0.1); osc.frequency.setValueAtTime(2400,ctx.currentTime+0.2);
      osc2 = ctx.createOscillator(); osc2.type='sine'; osc2.frequency.setValueAtTime(3200,ctx.currentTime+1.5); osc2.frequency.setValueAtTime(3600,ctx.currentTime+1.6); osc2.frequency.setValueAtTime(3200,ctx.currentTime+1.7);
      const bg = ctx.createGain(); bg.gain.value=0.06;
      const bg2= ctx.createGain(); bg2.gain.value=0.04;
      noise.connect(filter); filter.connect(gain);
      osc.connect(bg);  bg.connect(gain);
      osc2.connect(bg2); bg2.connect(gain);
      osc.start(); osc2.start(); noise.start();
      return { gain, nodes:[osc,osc2,noise] };
    }
    case 'ocean': {
      noise = createNoiseNode(ctx, 'brown');
      // LFO for wave motion
      osc = ctx.createOscillator(); osc.type='sine'; osc.frequency.value=0.15;
      const lfo = ctx.createGain(); lfo.gain.value=0.4;
      osc.connect(lfo); lfo.connect(gain.gain);
      noise.connect(gain); osc.start(); noise.start();
      return { gain, nodes:[osc,noise] };
    }
    case 'fireplace': {
      noise = createNoiseNode(ctx, 'pink');
      const filter = ctx.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=400;
      // crackle: occasional high-freq spikes
      osc = ctx.createOscillator(); osc.type='sawtooth'; osc.frequency.value=120;
      const cg = ctx.createGain(); cg.gain.value=0.03;
      noise.connect(filter); filter.connect(gain);
      osc.connect(cg); cg.connect(gain);
      osc.start(); noise.start();
      return { gain, nodes:[osc,noise] };
    }
    case 'lofi': {
      // Simple lo-fi chord: C-Eb-G-Bb  (Cmin7) with gentle LFO
      const freqs=[261.63,311.13,392,466.16];
      const oscs = freqs.map(f => { const o=ctx.createOscillator(); o.type='triangle'; o.frequency.value=f; return o; });
      const og = ctx.createGain(); og.gain.value=0.12;
      oscs.forEach(o => { o.connect(og); o.start(); });
      og.connect(gain);
      return { gain, nodes: oscs };
    }
    case 'office': {
      // HVAC hum + keyboard clicks
      noise = createNoiseNode(ctx, 'pink');
      const filter = ctx.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=200;
      osc = ctx.createOscillator(); osc.type='sine'; osc.frequency.value=60;
      const hg = ctx.createGain(); hg.gain.value=0.04;
      noise.connect(filter); filter.connect(gain);
      osc.connect(hg); hg.connect(gain);
      osc.start(); noise.start();
      return { gain, nodes:[osc,noise] };
    }
    case 'thunder': {
      noise = createNoiseNode(ctx, 'brown');
      const filter = ctx.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=500;
      // rumble LFO
      osc = ctx.createOscillator(); osc.type='sine'; osc.frequency.value=0.05;
      const lfo = ctx.createGain(); lfo.gain.value=0.6;
      osc.connect(lfo); lfo.connect(gain.gain);
      noise.connect(filter); filter.connect(gain);
      osc.start(); noise.start();
      return { gain, nodes:[osc,noise] };
    }
    default: {
      noise = createNoiseNode(ctx,'white');
      noise.connect(gain); noise.start();
      return { gain, nodes:[noise] };
    }
  }
}

export default function AmbientSoundMixer() {
  const [active, setActive]   = useState({}); // id -> { gain, nodes, gainNode }
  const [volumes, setVolumes] = useState(() =>
    Object.fromEntries(SOUNDS.map(s => [s.id, 0.4]))
  );
  const [muted, setMuted]     = useState(false);
  const ctxRef = useRef(null);

  function getCtx() {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
    return ctxRef.current;
  }

  const toggle = useCallback((id) => {
    if (active[id]) {
      // Stop
      const { nodes, gainNode } = active[id];
      gainNode.gain.setTargetAtTime(0, ctxRef.current.currentTime, 0.3);
      setTimeout(() => { nodes.forEach(n => { try { n.stop(); } catch(_){} }); }, 500);
      setActive(prev => { const n={...prev}; delete n[id]; return n; });
    } else {
      // Start
      const ctx = getCtx();
      const { gain: gainNode, nodes } = buildSoundGraph(ctx, id);
      gainNode.gain.value = muted ? 0 : volumes[id];
      gainNode.connect(ctx.destination);
      setActive(prev => ({ ...prev, [id]: { nodes, gainNode } }));
    }
  }, [active, volumes, muted]);

  const setVol = useCallback((id, v) => {
    setVolumes(prev => ({ ...prev, [id]: v }));
    if (active[id] && !muted) {
      active[id].gainNode.gain.setTargetAtTime(v, ctxRef.current.currentTime, 0.05);
    }
  }, [active, muted]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    Object.values(active).forEach(({ gainNode }, idx) => {
      const id = Object.keys(active)[idx];
      gainNode.gain.setTargetAtTime(next ? 0 : volumes[id], ctxRef.current.currentTime, 0.1);
    });
  };

  // Cleanup
  useEffect(() => () => {
    Object.values(active).forEach(({ nodes }) => nodes.forEach(n => { try { n.stop(); } catch(_){} }));
    ctxRef.current?.close();
  }, []);

  const anyActive = Object.keys(active).length > 0;

  return (
    <div style={{ fontFamily:'Geist,Inter,sans-serif' }}>
      <style>{`
        .amb-card { padding:12px; background:var(--surface-2); border:1px solid var(--border); border-radius:12px; transition:border-color .15s,background .15s; cursor:pointer; }
        .amb-card:hover { border-color:var(--accent); }
        .amb-card.amb-on { background:var(--accent-soft); border-color:var(--accent); }
        .amb-slider { width:100%; height:3px; accent-color:var(--accent); cursor:pointer; }
      `}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <div style={{ fontSize:13,fontWeight:600,color:'var(--text)' }}>Ambient Sounds</div>
          <div style={{ fontSize:11,color:'var(--text-3)' }}>
            {anyActive ? `${Object.keys(active).length} track${Object.keys(active).length>1?'s':''} playing` : 'Click a sound to start'}
          </div>
        </div>
        {anyActive && (
          <button onClick={toggleMute} style={{ padding:'5px 10px', background: muted ? 'rgba(239,68,68,0.1)' : 'var(--surface-2)', border:`1px solid ${muted ? 'rgba(239,68,68,0.3)' : 'var(--border-strong)'}`, borderRadius:8, color: muted ? '#F87171' : 'var(--text-2)', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:11 }}>
            {muted ? <VolumeX size={13}/> : <Volume2 size={13}/>}
            {muted ? 'Unmute' : 'Mute all'}
          </button>
        )}
      </div>

      {/* Sound grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        {SOUNDS.map(s => {
          const on = !!active[s.id];
          return (
            <div key={s.id} className={`amb-card${on?' amb-on':''}`} onClick={() => toggle(s.id)}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: on ? 8 : 0 }}>
                <span style={{ fontSize:20 }}>{s.emoji}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color: on ? 'var(--accent)' : 'var(--text)' }}>{s.label}</div>
                  <div style={{ fontSize:10, color:'var(--text-3)' }}>{s.desc}</div>
                </div>
                {on && (
                  <div style={{ width:8,height:8,borderRadius:'50%',background:'var(--accent)',flexShrink:0,animation:'ping 1.5s ease infinite' }}/>
                )}
              </div>
              {on && (
                <div onClick={e => e.stopPropagation()}>
                  <input
                    type="range" min={0} max={1} step={0.01}
                    value={volumes[s.id]}
                    onChange={e => setVol(s.id, parseFloat(e.target.value))}
                    className="amb-slider"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {anyActive && (
        <button onClick={() => Object.keys(active).forEach(id => toggle(id))}
          style={{ marginTop:14, width:'100%', padding:'9px', background:'rgba(239,68,68,0.08)', color:'#F87171', border:'1px solid rgba(239,68,68,0.2)', borderRadius:10, fontWeight:500, fontSize:12.5, cursor:'pointer', fontFamily:'Geist,Inter,sans-serif' }}>
          <Square size={12} style={{ display:'inline', marginRight:6 }}/>
          Stop all sounds
        </button>
      )}
    </div>
  );
}
