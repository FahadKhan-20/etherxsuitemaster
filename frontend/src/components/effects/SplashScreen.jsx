import { useEffect, useState } from 'react';
import { LOGO_LETTERS, LOGO_VIEWBOX, LogoDefs, LogoLetter, SHIELD_PATHS } from '../brand/EtherXLogo';
import './splash-screen.css';

// EtherX Meet intro, built from the vector logo so it stays sharp while zoomed: the shield's outline
// traces itself, the gold shield fills in under it, the shield shrinks left, then each letter of the
// wordmark pops in. The last frame is exactly the logo.
const HOLD_MS = 900; // logo stays this long after the last letter lands
const FALLBACK_MS = 7000; // leave even if animations never report (hidden tab, throttled CPU)
export const SPLASH_FADE_MS = 500;

export default function SplashScreen({ onDone }) {
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [landed, setLanded] = useState(reduced);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLeaving(true), landed ? HOLD_MS : FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [landed]);

  useEffect(() => {
    if (!leaving) return undefined;
    const timer = setTimeout(onDone, SPLASH_FADE_MS);
    return () => clearTimeout(timer);
  }, [leaving, onDone]);

  useEffect(() => {
    const skip = (event) => { if (['Escape', ' ', 'Enter'].includes(event.key)) setLeaving(true); };
    window.addEventListener('keydown', skip);
    return () => window.removeEventListener('keydown', skip);
  }, []);

  return (
    <div className="exm-splash" data-leaving={leaving} data-reduced={reduced} onClick={() => setLeaving(true)} role="presentation">
      <div className="exm-splash-art">
        <svg viewBox={LOGO_VIEWBOX} role="img" aria-label="EtherX Meet">
          <LogoDefs />
          <path className="exm-splash-shield-art" d={SHIELD_PATHS.join(' ')} fill="url(#exm-logo-shield)" />
          {SHIELD_PATHS.map((d, i) => <path key={i} className="exm-splash-line" d={d} pathLength="1" style={{ animationDelay: `${i * 90}ms, 1200ms` }} />)}
          {LOGO_LETTERS.map(({ box: [x0, x1, , y1], face }, i) => (
            <g
              key={i} className="exm-splash-letter"
              style={{ transformOrigin: `${(x0 + x1) / 2}px ${y1}px`, animationDelay: `${1950 + i * 50}ms` }}
              onAnimationEnd={i === LOGO_LETTERS.length - 1 ? () => setLanded(true) : undefined}
            >
              <LogoLetter face={face} />
            </g>
          ))}
        </svg>
      </div>
      <span className="exm-splash-skip">Click or press Esc to skip</span>
    </div>
  );
}
