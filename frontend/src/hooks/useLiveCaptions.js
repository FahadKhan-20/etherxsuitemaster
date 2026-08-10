import { useCallback, useRef, useState } from 'react';

/**
 * useLiveCaptions — Feature 2
 *
 * Uses the Web Speech API (SpeechRecognition) to produce live, local captions.
 * Requires Chrome or Edge (no server-side processing).
 *
 * @param {string} userName - Display name for the caption speaker label.
 * @returns {{ captions, captionsActive, toggleCaptions }}
 */
export function useLiveCaptions(userName) {
  // captions: [{id, speaker, text, final}]
  const [captions, setCaptions] = useState([]);
  const [active, setActive]     = useState(false);

  const recogRef = useRef(null);
  const idRef    = useRef(0);
  // Track intended active state in a ref so the onend restart handler
  // can check without stale closure issues.
  const activeRef = useRef(false);

  const toggle = useCallback(() => {
    if (activeRef.current) {
      // ── Stop ──
      recogRef.current?.stop();
      recogRef.current = null;
      activeRef.current = false;
      setActive(false);
      return;
    }

    // ── Start ──
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert('Live captions require Chrome or Edge.');
      return;
    }

    const r = new SR();
    r.continuous      = true;
    r.interimResults  = true;
    r.lang            = 'en-US';

    r.onresult = (e) => {
      const result = e.results[e.results.length - 1];
      const text   = result[0].transcript;
      const final  = result.isFinal;

      setCaptions(prev => {
        const last = prev[prev.length - 1];
        // Update the in-progress (non-final) entry instead of creating a new one
        if (last && !last.final) {
          return [...prev.slice(0, -1), { ...last, text, final }];
        }
        // Keep at most 5 entries in history to avoid memory growth
        return [
          ...prev.slice(-4),
          { id: ++idRef.current, speaker: userName, text, final },
        ];
      });
    };

    r.onerror = (e) => {
      // 'no-speech' is benign — just restart if still active
      if (e.error !== 'no-speech') {
        activeRef.current = false;
        setActive(false);
      }
    };

    r.onend = () => {
      // If still intended to be active, restart automatically
      if (activeRef.current && recogRef.current) {
        try { recogRef.current.start(); } catch {}
      }
    };

    r.start();
    recogRef.current = r;
    activeRef.current = true;
    setActive(true);
  }, [userName]);

  return {
    /** Array of caption entries: [{id, speaker, text, final}] */
    captions,
    /** Whether captions are currently active */
    captionsActive: active,
    /** Toggle captions on/off */
    toggleCaptions: toggle,
  };
}
