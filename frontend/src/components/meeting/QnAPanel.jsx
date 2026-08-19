// frontend/src/components/meeting/QnAPanel.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import apiClient from '../../utils/apiClient';

const GOLD = '#d4af37';
const GOLD_SOFT = '#e5c76b';

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function QuestionCard({ q, isHost, onUpvote, onMarkAnswered, optimisticVoting }) {
  const isAnswered = String(q.status || '').toUpperCase() === 'ANSWERED';

  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 12,
        border: isAnswered
          ? '1px solid rgba(34,197,94,.22)'
          : '1px solid rgba(212,175,55,.14)',
        background: isAnswered
          ? 'rgba(34,197,94,.05)'
          : 'rgba(212,175,55,.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        animation: 'qnaFadeIn .25s ease-out',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: `linear-gradient(135deg,${GOLD},#b8860b)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 700,
              color: '#0a0a0a',
              flexShrink: 0,
            }}
          >
            {(q.userName?.[0] || '?').toUpperCase()}
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: '#c9bda2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {q.userName}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {isAnswered ? (
            <span style={{ fontSize: 10, fontWeight: 600, color: '#22c55e', background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 6, padding: '2px 7px', letterSpacing: '.03em' }}>
              ANSWERED
            </span>
          ) : (
            <span style={{ fontSize: 10, fontWeight: 600, color: '#a89878', background: 'rgba(212,175,55,.08)', border: '1px solid rgba(212,175,55,.15)', borderRadius: 6, padding: '2px 7px', letterSpacing: '.03em' }}>
              OPEN
            </span>
          )}
          <span style={{ fontSize: 10.5, color: '#5a5040' }}>{fmtTime(q.createdAt)}</span>
        </div>
      </div>

      {/* Question text */}
      <p style={{ margin: 0, fontSize: 13, color: '#f0e6d3', lineHeight: 1.55 }}>{q.text}</p>

      {/* Footer row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {/* Upvote button */}
        <button
          onClick={() => onUpvote(q._id)}
          disabled={optimisticVoting === q._id}
          title={q.hasUpvoted ? 'Remove upvote' : 'Upvote this question'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            borderRadius: 8,
            border: q.hasUpvoted
              ? `1px solid ${GOLD}`
              : '1px solid rgba(212,175,55,.2)',
            background: q.hasUpvoted ? 'rgba(212,175,55,.18)' : 'transparent',
            color: q.hasUpvoted ? GOLD_SOFT : '#a89878',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all .15s',
            fontFamily: "'Sora',sans-serif",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill={q.hasUpvoted ? GOLD : 'none'}>
            <path d="M12 4l8 16H4L12 4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
          {q.upvotes}
        </button>

        {/* Host controls */}
        {isHost && !isAnswered && (
          <button
            onClick={() => onMarkAnswered(q._id)}
            style={{
              padding: '4px 10px',
              borderRadius: 8,
              border: '1px solid rgba(34,197,94,.3)',
              background: 'rgba(34,197,94,.1)',
              color: '#22c55e',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'Sora',sans-serif",
            }}
          >
            Mark as answered
          </button>
        )}
      </div>
    </div>
  );
}

export default function QnAPanel({ roomCode, userName, isHost, socket }) {
  const [questions, setQuestions] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [optimisticVoting, setOptimisticVoting] = useState(null);
  const listEndRef = useRef(null);

  // Fetch questions
  const fetchQuestions = useCallback(async () => {
    if (!roomCode) return;
    try {
      const { data } = await apiClient.get(`/api/qna/${roomCode.toLowerCase()}/questions`);
      if (data.success) {
        setQuestions(data.data);
      }
    } catch (err) {
      console.error('QnA fetch error:', err);
      setError('Failed to load questions.');
    } finally {
      setLoading(false);
    }
  }, [roomCode]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // Real-time socket events
  useEffect(() => {
    if (!socket?.current) return;
    const s = socket.current;

    const onCreated = (q) => {
      setQuestions((prev) => {
        // Avoid duplicates (own question already added optimistically via HTTP response)
        if (prev.find((x) => String(x._id) === String(q._id))) return prev;
        return [q, ...prev].sort((a, b) => b.upvotes - a.upvotes || new Date(b.createdAt) - new Date(a.createdAt));
      });
    };

    const onUpvoted = (q) => {
      setQuestions((prev) =>
        [...prev.map((x) => (String(x._id) === String(q._id) ? { ...x, upvotes: q.upvotes, hasUpvoted: q.hasUpvoted, status: q.status } : x))]
          .sort((a, b) => b.upvotes - a.upvotes || new Date(b.createdAt) - new Date(a.createdAt))
      );
    };

    const onAnswered = (q) => {
      setQuestions((prev) =>
        prev.map((x) => (
          String(x._id) === String(q._id)
            ? {
                ...x,
                status: 'ANSWERED',
                answeredBy: q.answeredBy,
                answeredByUserId: q.answeredByUserId,
                answeredAt: q.answeredAt,
              }
            : x
        ))
      );
    };

    s.on('qna:question-created', onCreated);
    s.on('qna:question-upvoted', onUpvoted);
    s.on('qna:question-answered', onAnswered);

    return () => {
      s.off('qna:question-created', onCreated);
      s.off('qna:question-upvoted', onUpvoted);
      s.off('qna:question-answered', onAnswered);
    };
  }, [socket?.current]);

  const handleSubmit = async () => {
    const text = draft.trim();
    if (!text || text.length < 3) {
      setError('Question must be at least 3 characters.');
      return;
    }
    if (text.length > 500) {
      setError('Question must not exceed 500 characters.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const { data } = await apiClient.post(`/api/qna/${roomCode.toLowerCase()}/questions`, { text });
      if (data.success) {
        setQuestions((prev) => {
          if (prev.find((x) => String(x._id) === String(data.data._id))) return prev;
          return [data.data, ...prev].sort((a, b) => b.upvotes - a.upvotes || new Date(b.createdAt) - new Date(a.createdAt));
        });
        setDraft('');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to submit question.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpvote = async (questionId) => {
    setOptimisticVoting(questionId);
    try {
      await apiClient.post(`/api/qna/questions/${questionId}/upvote`);
      // Server will emit real-time update; also refresh for consistency
    } catch (err) {
      setError('Failed to upvote.');
    } finally {
      setOptimisticVoting(null);
    }
  };

  const handleMarkAnswered = async (questionId) => {
    try {
      await apiClient.patch(`/api/qna/questions/${questionId}/answer`);
    } catch (err) {
      setError('Failed to mark as answered.');
    }
  };

  const openCount = questions.filter((q) => String(q.status || '').toUpperCase() !== 'ANSWERED').length;
  const answeredCount = questions.filter((q) => String(q.status || '').toUpperCase() === 'ANSWERED').length;

  return (
    <>
      <style>{`
        @keyframes qnaFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .qna-scrollbar::-webkit-scrollbar { width: 4px; }
        .qna-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .qna-scrollbar::-webkit-scrollbar-thumb { background: rgba(212,175,55,.2); border-radius: 4px; }
        .qna-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(212,175,55,.4); }
      `}</style>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Stats bar */}
        <div style={{ padding: '8px 14px 8px', display: 'flex', gap: 10, borderBottom: '1px solid rgba(212,175,55,.1)', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: '#a89878' }}>
            <span style={{ fontWeight: 700, color: GOLD_SOFT }}>{openCount}</span> open
          </div>
          <div style={{ fontSize: 11, color: '#a89878' }}>
            <span style={{ fontWeight: 700, color: '#22c55e' }}>{answeredCount}</span> answered
          </div>
          {isHost && questions.length > 0 && (
            <div style={{ fontSize: 11, color: '#a89878', marginLeft: 'auto' }}>
              {[...questions].sort((a, b) => b.upvotes - a.upvotes)[0]?.upvotes > 0
                ? `Top: "${[...questions].sort((a, b) => b.upvotes - a.upvotes)[0]?.text?.slice(0, 28)}…"`
                : ''}
            </div>
          )}
        </div>

        {/* Question list */}
        <div
          className="qna-scrollbar"
          style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {loading && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a89878', fontSize: 13 }}>
              Loading questions…
            </div>
          )}

          {!loading && questions.length === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" style={{ color: 'rgba(212,175,55,.22)' }}>
                <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              <div style={{ textAlign: 'center', color: '#a89878', fontSize: 12.5 }}>
                No questions yet.<br />Be the first to ask!
              </div>
            </div>
          )}

          {!loading && questions.map((q) => (
            <QuestionCard
              key={q._id}
              q={q}
              isHost={isHost}
              onUpvote={handleUpvote}
              onMarkAnswered={handleMarkAnswered}
              optimisticVoting={optimisticVoting}
            />
          ))}
          <div ref={listEndRef} />
        </div>

        {/* Error message */}
        {error && (
          <div style={{ padding: '6px 14px', background: 'rgba(239,68,68,.12)', borderTop: '1px solid rgba(239,68,68,.2)', color: '#fca5a5', fontSize: 12, flexShrink: 0 }}>
            {error}
            <button onClick={() => setError('')} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 12 }}>✕</button>
          </div>
        )}

        {/* Input area */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(212,175,55,.1)', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <textarea
              id="qna-question-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Ask a question… (Enter to submit)"
              rows={2}
              maxLength={500}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(212,175,55,.05)',
                color: '#f0e6d3',
                border: '1px solid rgba(212,175,55,.18)',
                borderRadius: 10,
                padding: '9px 12px',
                fontSize: 13,
                outline: 'none',
                fontFamily: "'Sora',sans-serif",
                resize: 'none',
                lineHeight: 1.5,
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10.5, color: 'rgba(168,152,120,.5)' }}>{draft.length}/500</span>
              <button
                id="qna-submit-btn"
                onClick={handleSubmit}
                disabled={!draft.trim() || submitting}
                style={{
                  padding: '7px 18px',
                  borderRadius: 9,
                  border: 'none',
                  background: draft.trim() && !submitting
                    ? 'linear-gradient(135deg,#d4af37,#b8860b)'
                    : 'rgba(212,175,55,.2)',
                  color: draft.trim() && !submitting ? '#050505' : '#5a5040',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: draft.trim() && !submitting ? 'pointer' : 'not-allowed',
                  fontFamily: "'Sora',sans-serif",
                  transition: 'all .2s',
                }}
              >
                {submitting ? 'Asking…' : 'Ask'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
