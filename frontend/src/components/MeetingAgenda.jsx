import { useState } from 'react';

export default function MeetingAgenda({ isHost = false, meetingStarted = true, topics, onTopicsChange }) {
  const [newTopic, setNewTopic] = useState('');

  const canAdd = isHost;
  const canComplete = meetingStarted;
  const done = topics.filter(t => t.completed).length;

  const addTopic = () => {
    if (!newTopic.trim()) return;
    onTopicsChange([...topics, { id: Date.now(), title: newTopic.trim(), completed: false }]);
    setNewTopic('');
  };

  const toggle = (id) => {
    if (!canComplete) return;
    onTopicsChange(topics.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const remove = (id) => {
    if (!canAdd) return;
    onTopicsChange(topics.filter(t => t.id !== id));
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Progress bar — only during meeting */}
      {meetingStarted && (
        <div style={{ padding: '10px 16px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#a89878', marginBottom: 6 }}>
            <span>Progress</span>
            <span>{done}/{topics.length} done</span>
          </div>
          <div style={{ height: 3, borderRadius: 2, background: 'rgba(212,175,55,.15)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${topics.length ? (done / topics.length) * 100 : 0}%`, background: 'linear-gradient(90deg,#b8860b,#e5c76b)', borderRadius: 2, transition: 'width .3s' }} />
          </div>
        </div>
      )}

      {/* Topic list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {topics.length === 0 && (
          <div style={{ textAlign: 'center', color: 'rgba(168,152,120,.5)', fontSize: 12, marginTop: 24 }}>
            {canAdd ? 'Add topics below to build your agenda' : 'No topics yet'}
          </div>
        )}
        {topics.map((t, i) => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 9, background: t.completed ? 'rgba(34,197,94,.07)' : 'rgba(212,175,55,.05)', border: `1px solid ${t.completed ? 'rgba(34,197,94,.2)' : 'rgba(212,175,55,.1)'}`, transition: 'all .2s' }}>
            <button
              onClick={() => toggle(t.id)}
              disabled={!canComplete}
              style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${t.completed ? '#22c55e' : 'rgba(212,175,55,.3)'}`, background: t.completed ? 'rgba(34,197,94,.15)' : 'transparent', color: t.completed ? '#22c55e' : '#a89878', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canComplete ? 'pointer' : 'default', flexShrink: 0, fontSize: 11, fontWeight: 700, transition: 'all .2s' }}
            >
              {t.completed ? '✓' : i + 1}
            </button>
            <span style={{ flex: 1, fontSize: 13, color: t.completed ? '#a89878' : '#f0e6d3', textDecoration: t.completed ? 'line-through' : 'none', transition: 'all .2s' }}>
              {t.title}
            </span>
            {canAdd && (
              <button onClick={() => remove(t.id)} style={{ background: 'none', border: 'none', color: 'rgba(168,152,120,.5)', cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>✕</button>
            )}
          </div>
        ))}
      </div>

      {/* Add topic — host only, before meeting */}
      {canAdd && (
        <div style={{ padding: '8px 12px 12px', borderTop: '1px solid rgba(212,175,55,.1)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={newTopic}
              onChange={e => setNewTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTopic()}
              placeholder="Add a topic…"
              style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(212,175,55,.15)', background: 'rgba(212,175,55,.06)', color: '#f0e6d3', fontSize: 12.5, outline: 'none', fontFamily: "'Sora',sans-serif" }}
            />
            <button
              onClick={addTopic}
              disabled={!newTopic.trim()}
              style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: newTopic.trim() ? '#b8860b' : 'rgba(212,175,55,.1)', color: newTopic.trim() ? '#050505' : '#a89878', fontWeight: 700, fontSize: 12.5, cursor: newTopic.trim() ? 'pointer' : 'default', fontFamily: "'Sora',sans-serif", transition: 'all .2s' }}
            >
              Add
            </button>
          </div>
        </div>
      )}


    </div>
  );
}
