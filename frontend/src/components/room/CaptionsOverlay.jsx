/**
 * CaptionsOverlay — movie / YouTube-style live captions at the bottom of the meeting screen,
 * showing what EVERYONE in the room says.
 *
 * How it works
 *  - `show`       : this user has captions switched on. They are registered with the server as a caption
 *                   viewer and see the live captions of every participant (with speaker names).
 *  - `transcribe` : captions are on for the room and this user's mic is live. The browser's speech
 *                   recognition (Chrome / Edge) transcribes THIS user's microphone and sends the text to the
 *                   room. Never true while the user is muted (the server ignores muted users too).
 *
 * Mount it while `show || transcribe`; it renders nothing unless `show` is true.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const HOLD_MS = 4500;          // keep a caption on screen this long after that person stops speaking
const MAX_CHARS = 150;         // roughly two lines of subtitle text per speaker
const SEND_MAX_CHARS = 300;    // longest text sent to the room
const INTERIM_SEND_MS = 250;   // send in-progress (interim) text at most this often; final text is always sent
const NOTICE_MS = 4000;
const MAX_LINES = 2;           // speakers shown at once

function tail(text) {
  if (text.length <= MAX_CHARS) return text;
  const cut = text.slice(-MAX_CHARS);
  const space = cut.indexOf(' ');
  return '…' + (space > -1 && space < 30 ? cut.slice(space + 1) : cut);
}

export default function CaptionsOverlay({ socket, roomCode, show, transcribe, bottom = 112, language = 'en-US', render, onUpdate, onUnavailable }) {
  const [lines, setLines] = useState([]);   // [{ key, name, text }]
  const [notice, setNotice] = useState('');
  const [uncaptioned, setUncaptioned] = useState({}); // socketId -> name of speakers whose browser cannot caption
  const missing = Object.values(uncaptioned);
  useEffect(()=>{onUpdate?.({lines,notice,missing:Object.values(uncaptioned)});},[lines,notice,uncaptioned,onUpdate]);
  const onUnavailableRef = useRef(onUnavailable); onUnavailableRef.current = onUnavailable;
  const timersRef = useRef({});
  const noticeTimerRef = useRef(null);
  const showRef = useRef(show);   showRef.current = show;
  const socketRef = useRef(socket); socketRef.current = socket;
  const roomRef = useRef(roomCode); roomRef.current = roomCode;

  // Add or update one speaker's line; it disappears HOLD_MS after their last update.
  const upsert = useCallback((key, name, text) => {
    setLines((prev) => {
      const entry = { key, name, text: tail(text) };
      const i = prev.findIndex((l) => l.key === key);
      if (i > -1) { const next = prev.slice(); next[i] = entry; return next; }
      return [...prev, entry].slice(-MAX_LINES);
    });
    clearTimeout(timersRef.current[key]);
    timersRef.current[key] = setTimeout(() => {
      setLines((prev) => prev.filter((l) => l.key !== key));
    }, HOLD_MS);
  }, []);

  const clearAll = useCallback(() => {
    Object.values(timersRef.current).forEach(clearTimeout);
    timersRef.current = {};
    setLines([]);
  }, []);

  // 1) Tell the server this user is watching captions (re-announce after every reconnect).
  useEffect(() => {
    if (!socket || !show) return undefined;
    const announce = () => socket.emit('captions-set', { roomCode, on: true });
    announce();
    socket.on('connect', announce);
    return () => {
      socket.off('connect', announce);
      socket.emit('captions-set', { roomCode, on: false });
    };
  }, [socket, roomCode, show]);

  // 2) Show other people's captions while watching.
  useEffect(() => {
    if (!socket || !show) return undefined;
    const onCaption = (c) => {
      if (!c || typeof c.text !== 'string' || !c.text) return;
      upsert(String(c.socketId), c.userName || 'Guest', c.text);
    };
    const onUnavailable = (c) => { if (c?.socketId) setUncaptioned((prev) => ({ ...prev, [c.socketId]: c.userName || 'Guest' })); };
    const onLeft = (c) => setUncaptioned((prev) => { if (!(c?.socketId in prev)) return prev; const next = { ...prev }; delete next[c.socketId]; return next; });
    socket.on('caption', onCaption);
    socket.on('caption-unavailable', onUnavailable);
    socket.on('user-left', onLeft);
    return () => { socket.off('caption', onCaption); socket.off('caption-unavailable', onUnavailable); socket.off('user-left', onLeft); };
  }, [socket, show, upsert]);

  useEffect(() => { if (!show) clearAll(); }, [show, clearAll]);

  // 3) Transcribe this user's own microphone and share it with the room.
  useEffect(() => {
    if (!transcribe) return undefined;
    let wanted = true;

    const flash = (msg) => {
      if (!showRef.current) return;
      setNotice(msg);
      clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = setTimeout(() => setNotice(''), NOTICE_MS);
    };

    // Speech recognition cannot run in this browser: keep the notice up and tell the room this speaker is not captioned.
    const unavailable = (msg) => {
      wanted = false;
      clearTimeout(noticeTimerRef.current);
      setNotice(msg);
      onUnavailableRef.current?.(msg);
      socketRef.current?.emit('caption-unavailable', { roomCode: roomRef.current });
    };
    const UNSUPPORTED = "Your browser can't caption your speech (use Chrome or Edge). You'll still see everyone else's captions.";

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      unavailable(UNSUPPORTED);
      return () => setNotice('');
    }

    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = language;
    let lastSent = 0;

    r.onresult = (e) => {
      const result = e.results[e.results.length - 1];
      const heard = (result?.[0]?.transcript || '').trim();
      if (!heard) return;
      const final = !!result.isFinal;
      if (showRef.current) upsert('me', 'You', heard);
      const now = Date.now();
      if (final || now - lastSent >= INTERIM_SEND_MS) {
        lastSent = now;
        socketRef.current?.emit('caption', { roomCode: roomRef.current, text: heard.slice(-SEND_MAX_CHARS), final });
      }
    };

    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;   // routine
      wanted = false;
      if (e.error === 'not-allowed') {
        unavailable("Microphone permission denied — your speech can't be captioned.");
      } else if (e.error === 'network' || e.error === 'service-not-allowed' || e.error === 'language-not-supported') {
        // Brave and Chromium expose the API but have no speech service behind it.
        unavailable(UNSUPPORTED);
      } else {
        flash('Live captions are unavailable for your microphone right now.');
      }
    };

    // The browser ends a recognition session every so often — restart while still wanted.
    r.onend = () => {
      if (!wanted) return;
      try { r.start(); } catch { /* already starting */ }
    };

    try { r.start(); } catch { /* ignore */ }

    return () => {
      wanted = false;
      setNotice('');
      r.onresult = null;
      r.onerror = null;
      r.onend = null;
      try { r.stop(); } catch { /* ignore */ }
    };
  }, [transcribe, upsert, language]);

  // Clean up timers on unmount.
  useEffect(() => () => {
    Object.values(timersRef.current).forEach(clearTimeout);
    clearTimeout(noticeTimerRef.current);
  }, []);

  if (render) return render({lines,notice});
  if (!show || (lines.length === 0 && !notice && missing.length === 0)) return null;

  return (
    <div
      aria-live="polite"
      style={{
        position: 'absolute', left: 0, right: 0, bottom,
        display: 'flex', justifyContent: 'center', padding: '0 24px',
        pointerEvents: 'none', transition: 'bottom .25s ease',
      }}
    >
      <div
        style={{
          maxWidth: 'min(900px, 85%)', padding: '8px 16px', borderRadius: 6,
          background: 'rgba(0,0,0,.78)', color: '#fff',
          fontSize: 'clamp(16px, 1.7vw, 24px)', lineHeight: 1.4, textAlign: 'center',
          fontFamily: "'Sora', sans-serif", textShadow: '0 1px 2px rgba(0,0,0,.8)',
          wordBreak: 'break-word',
        }}
      >
        {notice && <div style={{ color: '#e5c76b' }}>{notice}</div>}
        {missing.length > 0 && <div style={{ color: '#a49c8a', fontSize: '0.75em' }}>Not captioned (browser unsupported): {missing.join(', ')}</div>}
        {lines.map((l) => (
          <div key={l.key}>
            <span style={{ color: '#e5c76b', fontWeight: 700 }}>{l.name}: </span>
            {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}
