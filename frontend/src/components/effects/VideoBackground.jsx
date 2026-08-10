export default function VideoBackground() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        background: '#000000',
      }}
    />
  );
}

