/**
 * CaptionsOverlay — movie / YouTube-style live captions shown at the bottom of the
 * meeting screen. Uses the browser's speech recognition (Chrome / Edge) on the local
 * microphone while it is mounted, and stops completely when it unmounts.
 *
 * Mount it only while captions are on:  {captionsOn && <CaptionsOverlay ... />}
 */
import { useEffect, useRef, useState } from 'react';

const HOLD_MS = 4500;     // keep the last caption on screen this long after speech stops
const MAX_CHARS = 150;    // roughly two lines of subtitle text
const NOTICE_MS = 4000;   // how long an error notice stays before captions switch themselves off

function tail(text) {
  if (text.length <= MAX_CHARS) return text;
  const cut = text.slice(-MAX_CHARS);
  const space = cut.indexOf(' ');
  return '…' + (space > -1 && space < 30 ? cut.slice(space + 1) : cut);
}

export default function CaptionsOverlay({ bottom = 112, onUnavailable }) {
  const [text, setText] = useState('');
  const [notice, setNotice] = useState('');
  const hideTimerRef = useRef(null);
  const noticeTimerRef = useRef(null);
  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;

  useEffect(() => {
    let wanted = true;

    const fail = (msg) => {
      wanted = false;
      setNotice(msg);
      clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = setTimeout(() => onUnavailableRef.current?.(), NOTICE_MS);
    };

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      fail('Live captions need Chrome or Edge.');
      return () => clearTimeout(noticeTimerRef.current);
    }

    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';

    r.onresult = (e) => {
      const result = e.results[e.results.length - 1];
      const heard = (result?.[0]?.transcript || '').trim();
      if (!heard) return;
      setText(tail(heard));
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setText(''), HOLD_MS);
    };

    r.onerror = (e) => {
      // 'no-speech' and 'aborted' are routine; anything else means captions cannot continue.
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        fail('Microphone permission denied — captions are off.');
      } else {
        fail('Live captions are unavailable right now.');
      }
    };

    // The browser ends a recognition session after a while — restart while still wanted.
    r.onend = () => {
      if (!wanted) return;
      try { r.start(); } catch { /* already starting */ }
    };

    try { r.start(); } catch { /* ignore */ }

    return () => {
      wanted = false;
      r.onresult = null;
      r.onerror = null;
      r.onend = null;
      try { r.stop(); } catch { /* ignore */ }
      clearTimeout(hideTimerRef.current);
      clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const shown = notice || text;
  if (!shown) return null;

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
          background: 'rgba(0,0,0,.78)', color: notice ? '#e5c76b' : '#fff',
          fontSize: 'clamp(16px, 1.7vw, 24px)', lineHeight: 1.4, textAlign: 'center',
          fontFamily: "'Sora', sans-serif", textShadow: '0 1px 2px rgba(0,0,0,.8)',
          wordBreak: 'break-word',
        }}
      >
        {shown}
      </div>
    </div>
  );
}
