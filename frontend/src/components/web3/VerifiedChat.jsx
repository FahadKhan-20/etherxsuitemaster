import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import apiClient from '../../utils/apiClient';

const GOLD = '#d4af37';
const GOLD_BORDER = 'rgba(212,175,55,0.25)';

const messageKey = (message) => message.id || message._id || message.clientMessageId;

function mergeMessages(current, incoming) {
  const byId = new Map(current.map((message) => [messageKey(message), message]));
  incoming.forEach((message) => {
    const key = messageKey(message);
    if (key) byId.set(key, { ...byId.get(key), ...message });
  });
  return [...byId.values()].sort((left, right) => (
    (left.sequence ?? Number.MAX_SAFE_INTEGER) - (right.sequence ?? Number.MAX_SAFE_INTEGER)
    || new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime()
  ));
}

function ChatContent({
  roomCode,
  userName = 'Guest',
  socketRef,
  socketReady,
  visible = false,
  onUnreadChange,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [audience, setAudience] = useState('everyone');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [unread, setUnread] = useState(0);
  const listRef = useRef(null);
  const nearBottomRef = useRef(true);
  const visibleRef = useRef(visible);
  const unreadRef = useRef(0);

  const updateUnread = useCallback((count) => {
    unreadRef.current = count;
    setUnread(count);
    onUnreadChange?.(count);
  }, [onUnreadChange]);

  const isNearBottom = () => {
    const list = listRef.current;
    return !list || list.scrollHeight - list.scrollTop - list.clientHeight < 64;
  };

  const fetchMessages = useCallback(async () => {
    try {
      const response = await apiClient.get(`/api/rooms/chat/${roomCode}`);
      setMessages((current) => mergeMessages(current, response.data?.data || []));
    } catch {
      // Socket delivery remains available when history is unavailable.
    }
  }, [roomCode]);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    if (!roomCode || !socketReady) return undefined;
    const socket = socketRef?.current;
    if (!socket) return undefined;

    const handleMessage = (message) => {
      if (message.roomCode !== roomCode.toLowerCase()) return;
      const shouldScroll = visibleRef.current && nearBottomRef.current;
      setMessages((current) => mergeMessages(current, [message]));
      if (shouldScroll) {
        requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }));
      } else if (!visibleRef.current || !shouldScroll) {
        updateUnread(unreadRef.current + 1);
      }
    };

    socket.on('chat:message', handleMessage);
    fetchMessages();
    return () => socket.off('chat:message', handleMessage);
  }, [fetchMessages, roomCode, socketReady, socketRef, updateUnread]);

  useEffect(() => {
    if (!visible) return;
    updateUnread(0);
    requestAnimationFrame(() => {
      if (nearBottomRef.current) listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    });
  }, [updateUnread, visible]);

  const handleSend = () => {
    const text = input.trim();
    const socket = socketRef?.current;
    if (!text || sending || !socket) return;
    setSending(true);
    setError('');
    socket.timeout(5000).emit(
      'chat:send',
      {
        roomCode,
        text,
        audience,
        clientMessageId: crypto.randomUUID(),
      },
      (timeoutError, result) => {
        setSending(false);
        if (timeoutError || !result?.ok) {
          setError(result?.error || 'Message could not be sent.');
          return;
        }
        setInput('');
      },
    );
  };

  const panel = (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: 'rgba(12,12,16,0.97)', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <MessageSquare size={14} color={GOLD} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#f0e6d3' }}>Room Chat</span>
        {unread > 0 && <span style={{ marginLeft: 'auto', borderRadius: 9, background: '#ef4444', color: '#fff', padding: '2px 6px', fontSize: 10, fontWeight: 700 }}>{unread} new</span>}
      </div>
      <div
        ref={listRef}
        onScroll={() => { nearBottomRef.current = isNearBottom(); }}
        style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        {messages.length === 0 && <p style={{ fontSize: 12, color: '#444', textAlign: 'center', marginTop: 40 }}>No messages yet. Be the first!</p>}
        {messages.map((message) => {
          const isSelf = message.address === userName;
          return (
            <div key={messageKey(message)} style={{ display: 'flex', flexDirection: 'column', alignItems: isSelf ? 'flex-end' : 'flex-start' }}>
              <span style={{ fontSize: 10, color: '#888', fontWeight: 600, marginBottom: 3 }}>{message.address || 'User'}</span>
              <div style={{ maxWidth: 220, background: isSelf ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${isSelf ? GOLD_BORDER : 'rgba(255,255,255,0.08)'}`, borderRadius: 10, padding: '8px 12px', fontSize: 13, color: '#f0e6d3', wordBreak: 'break-word' }}>
                {message.message}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={audience} onChange={(event) => setAudience(event.target.value)} style={{ width: 86, background: '#181818', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 4px', color: '#f0e6d3', fontSize: 11 }}>
            <option value="everyone">Everyone</option>
            <option value="host">Host</option>
          </select>
          <textarea value={input} rows={1} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); handleSend(); } }} placeholder="Type a message…" disabled={sending} style={{ flex: 1, minWidth: 0, resize: 'none', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, padding: '8px 10px', fontSize: 13, lineHeight: 1.35, color: '#fff', outline: 'none' }} />
          <button onClick={handleSend} disabled={!input.trim() || sending} style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: input.trim() ? 'linear-gradient(135deg,#d4af37,#b8860b)' : 'rgba(255,255,255,0.06)', border: 'none', color: input.trim() ? '#000' : '#555', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Send size={14} />
          </button>
        </div>
        {error && <p style={{ margin: '6px 0 0', color: '#fca5a5', fontSize: 11 }}>{error}</p>}
      </div>
    </div>
  );

  return visible ? panel : null;
}

export default function VerifiedChat(props) {
  return <ChatContent {...props} />;
}
