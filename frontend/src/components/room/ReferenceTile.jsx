import { useEffect, useRef } from 'react';
import { useStreamLevel } from '../../hooks/useStreamLevel';

export default function ReferenceTile({ person, children }) {
  const ref = useRef(null);
  const level = useStreamLevel(person.stream, person.isPerson && !person.muted);
  const speaking = person.isPerson && !person.muted && level > .2;
  useEffect(() => {
    if (ref.current && person.stream) { ref.current.srcObject = person.stream; ref.current.play().catch(() => {}); }
  }, [person.stream, person.showVid, person.isScreen]);
  useEffect(() => { if (speaking) person.onSpeaking?.(person.key); }, [speaking, person.key, person.onSpeaking]);
  return children({ ...person, videoRef: ref, screenRef: ref,
    ring: speaking ? 'var(--c-d9b54a)' : person.ring,
    glow: speaking ? `0 0 0 ${2 + Math.round(level * 8)}px rgba(217,181,74,${.12 + level * .22})` : 'none',
    bars: [.55,1,.7].map(k => Math.max(3,Math.round(12*k*(.2+level*.8)))+'px'),
  });
}
