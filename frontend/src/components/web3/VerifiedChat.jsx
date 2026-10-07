import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, X, Send } from 'lucide-react';
import apiClient from '../../utils/apiClient';

const GOLD = '#d4af37';
const GOLD_BORDER = 'rgba(212,175,55,0.25)';

const messageKey = message => message._id || message.clientMessageId || `sequence:${message.sequence}`;

function mergeMessages(current, incoming) {
  const merged = new Map(current.map(message => [messageKey(message), message]));
  incoming.forEach(message => merged.set(messageKey(message), { ...merged.get(messageKey(message)), ...message }));
  return [...merged.values()].sort((left, right) => {
    if (Number.isFinite(left.sequence) && Number.isFinite(right.sequence)) return left.sequence - right.sequence;
    return new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime();
  });
}

function ChatContent({ roomCode, userName = 'Guest', userId, isHost, socketRef, socketReady, alwaysOpen }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const bottomRef = useRef(null);
  const messagesRef = useRef(null);
  const nearBottomRef = useRef(true);
  const isOpen = alwaysOpen || open;

  const scrollToLatest = useCallback((behavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
    nearBottomRef.current = true;
    setUnreadCount(0);
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await apiClient.get(`/api/rooms/chat/${roomCode}`);
      const history = Array.isArray(res.data?.data) ? res.data.data : [];
      setMessages(current => mergeMessages(current, history));
      if (isOpen) requestAnimationFrame(() => scrollToLatest('auto'));
    } catch { /* Socket delivery remains available if history is temporarily unavailable. */ }
  }, [roomCode, isOpen, scrollToLatest]);

  useEffect(() => {
    if (!isOpen) {
      nearBottomRef.current = false;
      return undefined;
    }
    nearBottomRef.current = true;
    setUnreadCount(0);
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [isOpen, fetchMessages]);

  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return undefined;

    const onMessage = message => {
      if (!message || message.roomCode !== roomCode) return;
      setMessages(current => {
        const alreadyPresent = current.some(item => messageKey(item) === messageKey(message));
        if (!alreadyPresent && (!isOpen || !nearBottomRef.current)) setUnreadCount(count => count + 1);
        return mergeMessages(current, [message]);
      });
    };
    const onReconnect = () => { fetchMessages(); };

    socket.on('chat:message-created', onMessage);
    socket.on('chat:message', onMessage);
    socket.on('reconnect', onReconnect);
    return () => {
      socket.off('chat:message-created', onMessage);
      socket.off('chat:message', onMessage);
      socket.off('reconnect', onReconnect);
    };
  }, [socketRef, socketReady, roomCode, isOpen, fetchMessages]);

  const handleScroll = () => {
    const element = messagesRef.current;
    if (!element) return;
    const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 24;
    nearBottomRef.current = atBottom;
    if (atBottom) setUnreadCount(0);
  };

  const handleSend = async () => {
    const text = input.trim();
    const socket = socketRef?.current;
    if (!text || sending || !socket) return;
    setSending(true);
    try {
      socket.emit('chat:send', {
        roomCode,
        message: text,
        audience: 'everyone',
        clientMessageId: crypto.randomUUID(),
      });
      setInput('');
    } finally {
      setSending(false);
    }
  };

  const panel = (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: 'rgba(12,12,16,0.97)', border: alwaysOpen ? 'none' : `1px solid ${GOLD_BORDER}`, borderRadius: alwaysOpen ? 0 : 16, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <MessageSquare size={14} color={GOLD} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#f0e6d3' }}>Room Chat</span>
        {unreadCount > 0 && <span style={{ marginLeft: 'auto', color: GOLD, fontSize: 11 }}>{unreadCount} new</span>}
      </div>
      <div ref={messagesRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && <p style={{ fontSize: 12, color: '#444', textAlign: 'center', marginTop: 40 }}>No messages yet. Be the first!</p>}
        {messages.map((message, index) => {
          const isSelf = String(message.senderUserId) === String(userId) || message.address === userName;
          return <div key={messageKey(message) || index} style={{ display: 'flex', flexDirection: 'column', alignItems: isSelf ? 'flex-end' : 'flex-start' }}>
            <span style={{ fontSize: 10, color: '#888', fontWeight: 600, marginBottom: 3 }}>{message.address || 'User'}</span>
            <div style={{ maxWidth: 220, background: isSelf ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${isSelf ? GOLD_BORDER : 'rgba(255,255,255,0.08)'}`, borderRadius: 10, padding: '8px 12px', fontSize: 13, color: '#f0e6d3', wordBreak: 'break-word' }}>{message.message}</div>
          </div>;
        })}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <input value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); handleSend(); } }} placeholder="Type a message…" disabled={sending} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: '#fff', outline: 'none', fontFamily: 'Inter, sans-serif' }} />
        <button onClick={handleSend} disabled={!input.trim() || sending} style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: input.trim() ? 'linear-gradient(135deg,#d4af37,#b8860b)' : 'rgba(255,255,255,0.06)', border: 'none', color: input.trim() ? '#000' : '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() ? 'pointer' : 'default' }}><Send size={14} /></button>
      </div>
    </div>
  );

  if (alwaysOpen) return panel;
  return <>
    <button onClick={() => setOpen(value => !value)} style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 100, width: 48, height: 48, borderRadius: '50%', background: open ? '#1a1a1a' : 'linear-gradient(135deg,#d4af37,#b8860b)', border: open ? `1px solid ${GOLD_BORDER}` : 'none', color: open ? GOLD : '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }} aria-label={open ? 'Close chat' : 'Open chat'}>{open ? <X size={18} /> : <MessageSquare size={18} />}</button>
    {open && <div style={{ position: 'fixed', bottom: 84, right: 24, zIndex: 99, width: 320, height: 420, boxShadow: '0 8px 40px rgba(0,0,0,0.7)' }}>{panel}</div>}
  </>;
}

export default function VerifiedChat(props) {
  return <ChatContent {...props} />;
}
