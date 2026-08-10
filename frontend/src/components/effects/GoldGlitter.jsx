const COLORS = ['#d4af37', '#eedca0', '#c39a20', '#b8860b', '#eedca0', '#c39a20']

const particles = Array.from({ length: 80 }, (_, i) => {
  const t = i * 137.508
  return {
    id: i,
    x: (t * 6.7) % 100,
    y: (t * 4.1) % 100,
    size: 0.8 + (i % 6) * 0.55,
    delay: (i * 0.19) % 6,
    duration: 2.2 + (i % 8) * 0.45,
    color: COLORS[i % COLORS.length],
    blur: (i % 3) * 1.5,
  }
})

export default function GoldGlitter() {
  return (
    <>
      <style>{`
        @keyframes gg-pulse {
          0%,100% { opacity: 0; transform: scale(0) rotate(0deg); }
          30%      { opacity: 1; transform: scale(1.4) rotate(72deg); }
          60%      { opacity: 0.7; transform: scale(0.9) rotate(144deg); }
        }
      `}</style>
      <div style={{
        position: 'fixed', inset: 0,
        pointerEvents: 'none', zIndex: 0, overflow: 'hidden',
      }}>
        {particles.map(p => (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              background: p.color,
              boxShadow: `0 0 ${p.size * 3}px ${p.size * 1.5}px ${p.color}88`,
              filter: p.blur ? `blur(${p.blur}px)` : undefined,
              animation: `gg-pulse ${p.duration}s ${p.delay}s infinite ease-in-out`,
            }}
          />
        ))}
      </div>
    </>
  )
}
