import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, X, Send } from 'lucide-react';
import apiClient from '../../utils/apiClient';
import { getStoredUser } from '../../utils/auth';

const GOLD = '#d4af37';
const GOLD_BORDER = 'rgba(212,175,55,0.25)';

function ChatContent({ roomCode, userName = 'Guest', alwaysOpen, socket }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null), aliveRef = useRef(true);
  const isOpen = alwaysOpen || open;
  const userId = getStoredUser()?.id;

  const fetchMessages = useCallback(async () => {
    try {
      const res = await apiClient.get(`/api/rooms/chat/${roomCode}`);
      if (aliveRef.current) { setMessages(res.data?.data ?? []); setError(''); }
    } catch { if (aliveRef.current) setError('Chat could not connect. Your unsent message stays here.'); }
  }, [roomCode]);

  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);
  useEffect(() => {
    if (!isOpen) return;
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    const receive = message => { if (message.roomCode === roomCode) setMessages(prev=>prev.some(m=>m._id === message._id) ? prev : [...prev,message]); };
    socket?.on('chat:message-created',receive);
    return () => { clearInterval(interval); socket?.off('chat:message-created',receive); };
  }, [isOpen, fetchMessages, socket, roomCode]);
  useEffect(() => { if (isOpen) bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' }); }, [messages, isOpen]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true); setError('');
    try {
      await apiClient.post(`/api/rooms/chat/${roomCode}`, { message: text });
      if (aliveRef.current) setInput('');
      await fetchMessages();
    } catch { if (aliveRef.current) setError('Message not sent. Check your connection and try again.'); }
    finally { if (aliveRef.current) setSending(false); }
  };

  const panel = (
    <div className="exmeet-chat" style={{
      display: 'flex', flexDirection: 'column',
      width: '100%', height: '100%',
      background: 'var(--meeting-panel, rgba(12,12,16,0.97))',
      border: alwaysOpen ? 'none' : `1px solid ${GOLD_BORDER}`,
      borderRadius: alwaysOpen ? 0 : 16,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div className="exmeet-chat-notice" style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
        {!alwaysOpen && <MessageSquare size={14} color={GOLD} />}
        <span style={{ fontSize: 12, color: 'var(--meeting-muted, #a89878)' }}>{alwaysOpen ? 'Messages are visible to everyone in this meeting.' : 'Room Chat'}</span>
      </div>

      {/* Messages */}
      <div className="exmeet-chat-messages" role="log" aria-label="Room messages" aria-live="polite" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--meeting-muted, #a89878)', textAlign: 'center', marginTop: 40 }}>No messages yet. Start the conversation.</p>
        )}
        {messages.map((m, idx) => {
          const isSelf = m.senderId ? String(m.senderId) === String(userId) : m.address === userName;
          return (
            <div key={m._id || idx} style={{ display: 'flex', flexDirection: 'column', alignItems: isSelf ? 'flex-end' : 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <span style={{ fontSize: 12, color: 'var(--meeting-muted, #a89878)', fontWeight: 600 }}>
                  {m.address || 'User'}
                </span>
                {m.createdAt && <time style={{ fontSize: 10, color: 'var(--meeting-muted, #888)' }} dateTime={m.createdAt}>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>}
              </div>
              <div style={{
                maxWidth: '100%',
                background: isSelf ? 'var(--meeting-soft-gold, rgba(212,175,55,0.15))' : 'var(--meeting-raised, rgba(255,255,255,0.06))',
                border: '1px solid var(--meeting-line, rgba(255,255,255,0.08))',
                borderRadius: 10, padding: '8px 12px',
                fontSize: 13, lineHeight: 1.5, color: 'var(--meeting-text, #f0e6d3)', wordBreak: 'break-word', whiteSpace: 'pre-wrap',
              }}>
                {m.message}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <div role="alert" style={{padding:'10px 12px',color:'#fca5a5',fontSize:12}}>{error}<button type="button" aria-label="Retry chat" onClick={fetchMessages} style={{background:'none',border:0,color:'#d4af37',cursor:'pointer'}}>Retry</button></div>}
      {/* Input */}
      <div className="exmeet-chat-compose" style={{ padding: '14px', borderTop: '1px solid var(--meeting-line, rgba(255,255,255,0.06))', display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          aria-label="Message everyone" maxLength={1000} placeholder="Message everyone…"
          disabled={sending}
          style={{
            flex: 1, minWidth: 0, background: 'var(--meeting-raised, rgba(255,255,255,0.06))',
            border: '1px solid var(--meeting-line, rgba(255,255,255,0.10))',
            borderRadius: 8, padding: '8px 10px',
            fontSize: 13, color: 'var(--meeting-text, #fff)', outline: 'none',
            fontFamily: 'Inter, sans-serif',
          }}
        />
        <button
          aria-label="Send message" onClick={handleSend}
          disabled={!input.trim() || sending}
          style={{
            width: 38, height: 38, borderRadius: 9, flexShrink: 0,
            background: input.trim() ? 'var(--meeting-gold, #d4af37)' : 'var(--meeting-raised, rgba(255,255,255,0.06))',
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

export default function VerifiedChat({ roomCode, userName = 'Guest', embedded = false, socket }) {
  return <ChatContent roomCode={roomCode} userName={userName} alwaysOpen={embedded} socket={socket}/>;
}
