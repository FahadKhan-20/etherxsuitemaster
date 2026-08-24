import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, X, Send } from 'lucide-react';
import apiClient from '../../utils/apiClient';

const GOLD = '#d4af37';
const GOLD_BORDER = 'rgba(212,175,55,0.25)';

function ChatContent({ roomCode, userName = 'Guest', alwaysOpen }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const isOpen = alwaysOpen || open;

  const fetchMessages = useCallback(async () => {
    try {
      const res = await apiClient.get(`/api/rooms/chat/${roomCode}`);
      setMessages(res.data?.data ?? []);
    } catch { /* ignore */ }
  }, [roomCode]);

  useEffect(() => {
    if (!isOpen) return;
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [isOpen, fetchMessages]);

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await apiClient.post(`/api/rooms/chat/${roomCode}`, {
        address: userName,
        message: text,
      });
      setInput('');
      await fetchMessages();
    } catch { /* ignore */ } finally {
      setSending(false);
    }
  };

  const panel = (
    <div style={{
      display: 'flex', flexDirection: 'column',
      width: '100%', height: '100%',
      background: 'rgba(12,12,16,0.97)',
      border: alwaysOpen ? 'none' : `1px solid ${GOLD_BORDER}`,
      borderRadius: alwaysOpen ? 0 : 16,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <MessageSquare size={14} color={GOLD} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#f0e6d3' }}>Room Chat</span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && (
          <p style={{ fontSize: 12, color: '#444', textAlign: 'center', marginTop: 40 }}>No messages yet. Be the first!</p>
        )}
        {messages.map((m, idx) => {
          const isSelf = m.address === userName;
          return (
            <div key={m._id || idx} style={{ display: 'flex', flexDirection: 'column', alignItems: isSelf ? 'flex-end' : 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: '#888', fontWeight: 600 }}>
                  {m.address || 'User'}
                </span>
              </div>
              <div style={{
                maxWidth: 220,
                background: isSelf ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${isSelf ? GOLD_BORDER : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 10, padding: '8px 12px',
                fontSize: 13, color: '#f0e6d3', wordBreak: 'break-word',
              }}>
                {m.message}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Type a message…"
          disabled={sending}
          style={{
            flex: 1, background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 8, padding: '8px 10px',
            fontSize: 13, color: '#fff', outline: 'none',
            fontFamily: 'Inter, sans-serif',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          style={{
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            background: input.trim() ? 'linear-gradient(135deg,#d4af37,#b8860b)' : 'rgba(255,255,255,0.06)',
            border: 'none', color: input.trim() ? '#000' : '#555',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: input.trim() ? 'pointer' : 'default',
          }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );

  if (alwaysOpen) return panel;

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 100,
          width: 48, height: 48, borderRadius: '50%',
          background: open ? '#1a1a1a' : 'linear-gradient(135deg,#d4af37,#b8860b)',
          border: open ? `1px solid ${GOLD_BORDER}` : 'none',
          color: open ? GOLD : '#000',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          transition: 'all 0.2s',
        }}
        aria-label={open ? 'Close chat' : 'Open chat'}
      >
        {open ? <X size={18} /> : <MessageSquare size={18} />}
      </button>

      {open && (
        <div style={{
          position: 'fixed', bottom: 84, right: 24, zIndex: 99,
          width: 320, height: 420,
          boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
        }}>
          {panel}
        </div>
      )}
    </>
  );
}

export default function VerifiedChat({ roomCode, userName = 'Guest', embedded = false }) {
  return <ChatContent roomCode={roomCode} userName={userName} alwaysOpen={embedded} />;
}
