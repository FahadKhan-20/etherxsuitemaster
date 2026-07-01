/**
 * MeetingAnalytics — in-meeting analytics dashboard.
 * Shows: talk-time bar chart, engagement score, most-used words, meeting health.
 * Entirely client-side — data accumulates from the VideoRoom's socket events.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, TrendingUp, MessageCircle, Clock, Activity, Award } from 'lucide-react';

const ACCENT_COLORS = ['#A78BFA','#34D399','#FB923C','#F472B6','#38BDF8','#FACC15'];

function StatCard({ icon, label, value, sub, color = 'var(--accent)' }) {
  return (
    <div style={{ padding:14, background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
        <div style={{ width:28,height:28,borderRadius:8,background:`${color}18`,display:'grid',placeItems:'center',color }}>{icon}</div>
        <span style={{ fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.05em' }}>{label}</span>
      </div>
      <div style={{ fontSize:28,fontWeight:700,letterSpacing:'-0.02em',color:'var(--text)',lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11,color:'var(--text-3)',marginTop:4 }}>{sub}</div>}
    </div>
  );
}

function TalkBar({ name, seconds, total, color }) {
  const pct = total > 0 ? (seconds / total) * 100 : 0;
  const mm = String(Math.floor(seconds/60)).padStart(2,'0');
  const ss = String(seconds%60).padStart(2,'0');
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontSize:12,fontWeight:500,color:'var(--text)' }}>{name}</span>
        <span style={{ fontSize:11,fontFamily:'Geist Mono,monospace',color:'var(--text-3)' }}>{mm}:{ss} · {pct.toFixed(0)}%</span>
      </div>
      <div style={{ height:8, background:'var(--surface-3)', borderRadius:4, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:4, transition:'width .5s ease' }}/>
      </div>
    </div>
  );
}

// Simple word frequency counter (filters common stop-words)
const STOP_WORDS = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','is','it','be','are','was','we','i','you','that','this','with','he','she','they','do','did','have','has','from','not','what','so','can','will','if','as','me','my','our','your','its','by','which','who','how','all','more','just','about','up','been','were','when','no','would','their','there','then','out','had','him','her']);

function wordCloud(lines) {
  const freq = {};
  lines.forEach(l => {
    l.text?.toLowerCase().replace(/[^a-z\s]/g,'').split(/\s+/).forEach(w => {
      if (w.length > 2 && !STOP_WORDS.has(w)) freq[w] = (freq[w]||0)+1;
    });
  });
  return Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,20);
}

export default function MeetingAnalytics({ participants = [], chatLines = [], transcriptLines = [], elapsedSeconds = 0, speakingTimes = {} }) {
  const [tab, setTab] = useState('overview'); // 'overview' | 'talk' | 'words'

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalTalk = useMemo(() => Object.values(speakingTimes).reduce((a,b)=>a+b,0), [speakingTimes]);
  const topSpeaker = useMemo(() => {
    const e = Object.entries(speakingTimes);
    if (!e.length) return null;
    return e.sort((a,b)=>b[1]-a[1])[0];
  }, [speakingTimes]);
  const words = useMemo(() => wordCloud([...chatLines, ...transcriptLines]), [chatLines, transcriptLines]);

  const engagementScore = useMemo(() => {
    let score = 50;
    if (chatLines.length > 5)  score += 10;
    if (chatLines.length > 20) score += 15;
    if (transcriptLines.length > 10) score += 10;
    if (Object.keys(speakingTimes).length > 2) score += 15;
    const maxPct = totalTalk > 0 ? (topSpeaker ? speakingTimes[topSpeaker[0]] / totalTalk : 0) : 0;
    if (maxPct > 0.7) score -= 20; // one person dominating
    return Math.min(100, Math.max(0, score));
  }, [chatLines, transcriptLines, speakingTimes, totalTalk, topSpeaker]);

  const healthColor = engagementScore >= 75 ? '#34D399' : engagementScore >= 50 ? '#FBBF24' : '#F87171';
  const healthLabel = engagementScore >= 75 ? 'Excellent' : engagementScore >= 50 ? 'Good' : 'Low';

  const mm = String(Math.floor(elapsedSeconds/60)).padStart(2,'0');
  const ss = String(elapsedSeconds%60).padStart(2,'0');

  const sortedSpeakers = Object.entries(speakingTimes).sort((a,b)=>b[1]-a[1]);

  return (
    <div style={{ fontFamily:'Geist,Inter,sans-serif' }}>
      <style>{`
        .ana-tab { padding:6px 14px; border-radius:7px; border:none; font-size:12px; font-weight:600; cursor:pointer; font-family:Geist,Inter,sans-serif; transition:background .15s; }
        .ana-tab.on  { background:var(--accent); color:#fff; }
        .ana-tab.off { background:var(--surface-2); color:var(--text-2); }
        .ana-tab.off:hover { color:var(--text); }
        .word-chip { display:inline-block; padding:3px 10px; border-radius:999px; background:var(--surface-2); border:1px solid var(--border); color:var(--text-2); font-size:11px; margin:3px; cursor:default; transition:transform .15s; }
        .word-chip:hover { transform:scale(1.05); }
      `}</style>

      {/* Tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:16 }}>
        {[['overview','Overview'],['talk','Talk Time'],['words','Word Cloud']].map(([k,l]) => (
          <button key={k} className={`ana-tab ${tab===k?'on':'off'}`} onClick={()=>setTab(k)}>{l}</button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <StatCard icon={<Clock size={14}/>} label="Duration" value={`${mm}:${ss}`} sub="HH:MM:SS"/>
            <StatCard icon={<MessageCircle size={14}/>} label="Messages" value={chatLines.length} sub={`${transcriptLines.length} transcribed`} color="#38BDF8"/>
            <StatCard icon={<Activity size={14}/>} label="Engagement" value={`${engagementScore}%`} sub={healthLabel} color={healthColor}/>
            <StatCard icon={<Award size={14}/>} label="Speakers" value={Object.keys(speakingTimes).length || participants.length} sub="active voices" color="#FB923C"/>
          </div>

          {/* Engagement gauge */}
          <div style={{ padding:14, background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
              <span style={{ fontSize:12,fontWeight:600,color:'var(--text)' }}>Meeting Health</span>
              <span style={{ fontSize:12,fontWeight:700,color:healthColor }}>{healthLabel}</span>
            </div>
            <div style={{ height:10, background:'var(--surface-3)', borderRadius:5, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${engagementScore}%`, background:`linear-gradient(90deg,${healthColor}88,${healthColor})`, borderRadius:5, transition:'width 1s ease' }}/>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:10, color:'var(--text-3)' }}>
              <span>Low</span><span>Good</span><span>Excellent</span>
            </div>
          </div>

          {topSpeaker && (
            <div style={{ padding:12, background:'var(--accent-soft)', border:'1px solid var(--accent-ring)', borderRadius:12, fontSize:12, color:'var(--text-2)' }}>
              🏆 <strong style={{color:'var(--text)'}}>{topSpeaker[0]}</strong> is the top speaker with {Math.round(speakingTimes[topSpeaker[0]]/60)} min of talk time.
            </div>
          )}
        </div>
      )}

      {/* ── TALK TIME ── */}
      {tab === 'talk' && (
        <div>
          {sortedSpeakers.length === 0 ? (
            <div style={{ textAlign:'center', padding:'30px 0', color:'var(--text-3)', fontSize:13 }}>
              <BarChart3 size={32} style={{ margin:'0 auto 10px', display:'block', opacity:.3 }}/>
              No speaking data yet. Talk time is tracked automatically.
            </div>
          ) : (
            <>
              <div style={{ marginBottom:16 }}>
                {sortedSpeakers.map(([name, secs], i) => (
                  <TalkBar key={name} name={name} seconds={secs} total={totalTalk} color={ACCENT_COLORS[i%ACCENT_COLORS.length]}/>
                ))}
              </div>
              <div style={{ fontSize:11, color:'var(--text-3)', textAlign:'center' }}>
                Total talk time: {Math.floor(totalTalk/60)}m {totalTalk%60}s
              </div>
            </>
          )}
        </div>
      )}

      {/* ── WORD CLOUD ── */}
      {tab === 'words' && (
        <div>
          {words.length === 0 ? (
            <div style={{ textAlign:'center', padding:'30px 0', color:'var(--text-3)', fontSize:13 }}>
              <TrendingUp size={32} style={{ margin:'0 auto 10px', display:'block', opacity:.3 }}/>
              Start chatting or transcribing to build your word cloud.
            </div>
          ) : (
            <div style={{ lineHeight:2 }}>
              {words.map(([word, count], i) => (
                <span key={word} className="word-chip"
                  style={{
                    fontSize: 11 + Math.min(count, 8),
                    color: ACCENT_COLORS[i % ACCENT_COLORS.length],
                    borderColor: `${ACCENT_COLORS[i%ACCENT_COLORS.length]}44`,
                    background: `${ACCENT_COLORS[i%ACCENT_COLORS.length]}12`,
                  }}
                  title={`"${word}" used ${count} times`}
                >
                  {word}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
