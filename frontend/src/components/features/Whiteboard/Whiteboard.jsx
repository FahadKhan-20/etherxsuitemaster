import { useEffect, useRef, useState } from 'react';
import { useWhiteboardSync } from '../../../hooks/useWhiteboardSync';

const COLORS = ['#ffffff', '#d4af37', '#f87171', '#4ade80', '#60a5fa', '#c084fc', '#fb923c', '#000000'];
const SIZES  = [2, 4, 8, 16];

const TOOLS = [
  { id: 'pen',         label: 'Pen',       icon: '✏️' },
  { id: 'highlighter', label: 'Marker',    icon: '🖊' },
  { id: 'eraser',      label: 'Eraser',    icon: '🧹' },
  { id: 'laser',       label: 'Laser',     icon: '🔴' },
];

function Btn({ active, title, onClick, children, style = {} }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 36, height: 36, borderRadius: 8, border: 'none',
        background: active ? 'rgba(212,175,55,.22)' : 'rgba(255,255,255,.06)',
        outline: active ? '1.5px solid rgba(212,175,55,.6)' : '1px solid rgba(255,255,255,.1)',
        color: active ? '#e5c76b' : 'rgba(203,213,225,.9)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', fontSize: 15, transition: 'all .12s',
        fontFamily: "'Sora',sans-serif",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export default function Whiteboard({ onClose, socket, socketReady, roomCode, isHost }) {
  const canvasRef = useRef(null);
  const currentStrokeId = useRef(null);
  const isPointerDown = useRef(false);

  const [tool,  setTool]  = useState('pen');
  const [color, setColor] = useState('#ffffff');
  const [size,  setSize]  = useState(4);

  const {
    lines, uploadedImage, laser,
    startStroke, extendStroke, endStroke,
    undo, redo, clearBoard, addImage, moveLaser,
  } = useWhiteboardSync({ socket, socketReady, roomCode, isHost });

  const canEdit = !!isHost;

  // Redraw canvas whenever lines or uploadedImage change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid dots
    ctx.fillStyle = 'rgba(255,255,255,.04)';
    for (let x = 40; x < canvas.width; x += 40)
      for (let y = 40; y < canvas.height; y += 40)
        ctx.fillRect(x, y, 1, 1);

    if (uploadedImage) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = uploadedImage;
    }

    lines.forEach(line => {
      if (!line.points || !line.points.length) return;
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (line.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth   = line.size ? line.size * 4 : 24;
        ctx.globalAlpha = 1;
      } else if (line.tool === 'highlighter') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = line.color || '#ffffff';
        ctx.lineWidth   = (line.size || 4) * 3;
        ctx.globalAlpha = 0.3;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = line.color || '#ffffff';
        ctx.lineWidth   = line.size || 4;
        ctx.globalAlpha = 1;
      }

      ctx.moveTo(line.points[0].x, line.points[0].y);
      if (line.points.length === 1) {
        ctx.lineTo(line.points[0].x + 0.01, line.points[0].y + 0.01);
      } else {
        line.points.forEach(p => ctx.lineTo(p.x, p.y));
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    });
  }, [lines, uploadedImage]);

  function getPoint(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width)  * canvas.width,
      y: ((e.clientY - rect.top)  / rect.height) * canvas.height,
    };
  }

  function onPointerDown(e) {
    if (!canEdit) return;
    const pt = getPoint(e);
    if (tool === 'laser') { moveLaser(pt.x, pt.y, true); return; }
    isPointerDown.current = true;
    const id = `s-${Date.now()}`;
    currentStrokeId.current = id;
    startStroke(id, tool, color, size, pt);
  }

  function onPointerMove(e) {
    if (!canEdit) return;
    const pt = getPoint(e);
    if (tool === 'laser') { moveLaser(pt.x, pt.y, true); return; }
    if (!isPointerDown.current || !currentStrokeId.current) return;
    extendStroke(currentStrokeId.current, pt);
  }

  function onPointerUp() {
    if (!canEdit) return;
    if (currentStrokeId.current) { endStroke(currentStrokeId.current); currentStrokeId.current = null; }
    isPointerDown.current = false;
    if (tool === 'laser') moveLaser(0, 0, false);
  }

  function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => addImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  function download() {
    const a = document.createElement('a');
    a.download = 'etherx-whiteboard.png';
    a.href = canvasRef.current.toDataURL();
    a.click();
  }

  const sep = <div style={{ width: 1, height: 28, background: 'rgba(212,175,55,.2)', flexShrink: 0 }} />;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Sora',sans-serif",
    }}>
      <div style={{
        flex: 1, margin: 12, borderRadius: 20,
        border: '1px solid rgba(212,175,55,.15)',
        background: '#0a0a0a',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 30px 80px rgba(0,0,0,.7)',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 18px',
          borderBottom: '1px solid rgba(212,175,55,.1)',
          background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(12px)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: '#d4af37' }}>
              <rect x="3" y="3" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6"/>
              <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#f0e6d3' }}>Live Whiteboard</span>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
              background: 'rgba(212,175,55,.12)', border: '1px solid rgba(212,175,55,.25)',
              color: '#e5c76b', letterSpacing: '.04em',
            }}>LIVE</span>
            {!canEdit && (
              <span style={{ fontSize: 11, color: '#a89878' }}>View-only — presenter is drawing</span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px', borderRadius: 8,
              border: '1px solid rgba(239,68,68,.3)',
              background: 'rgba(239,68,68,.1)', color: '#f87171',
              fontSize: 12, cursor: 'pointer', fontFamily: "'Sora',sans-serif",
            }}
          >
            Close
          </button>
        </div>

        {/* Toolbar */}
        {canEdit && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
            background: 'rgba(0,0,0,.5)', borderBottom: '1px solid rgba(212,175,55,.08)',
            flexWrap: 'wrap', flexShrink: 0,
          }}>
            {/* Tools */}
            <div style={{ display: 'flex', gap: 4 }}>
              {TOOLS.map(t => (
                <Btn key={t.id} active={tool === t.id} title={t.label} onClick={() => setTool(t.id)}>
                  {t.icon}
                </Btn>
              ))}
            </div>

            {sep}

            {/* Colors */}
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {COLORS.map(c => (
                <button
                  key={c}
                  title={c}
                  onClick={() => { setColor(c); if (tool === 'eraser') setTool('pen'); }}
                  style={{
                    width: 22, height: 22, borderRadius: '50%', background: c,
                    border: color === c && tool !== 'eraser' ? '2px solid #d4af37' : '2px solid rgba(255,255,255,.2)',
                    cursor: 'pointer', padding: 0, outline: 'none', flexShrink: 0,
                  }}
                />
              ))}
            </div>

            {sep}

            {/* Sizes */}
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {SIZES.map(s => (
                <button
                  key={s}
                  title={`Size ${s}`}
                  onClick={() => setSize(s)}
                  style={{
                    width: 32, height: 32, borderRadius: 8, border: 'none',
                    background: size === s ? 'rgba(212,175,55,.15)' : 'rgba(255,255,255,.05)',
                    outline: size === s ? '1.5px solid rgba(212,175,55,.5)' : '1px solid rgba(255,255,255,.1)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <div style={{ width: s, height: s, borderRadius: '50%', background: color === '#000000' ? '#fff' : color }} />
                </button>
              ))}
            </div>

            {sep}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 4 }}>
              <Btn title="Undo" onClick={undo}>↩</Btn>
              <Btn title="Redo" onClick={redo}>↪</Btn>
              <Btn title="Clear board" onClick={clearBoard}>🗑️</Btn>
              <Btn title="Download PNG" onClick={download}>⬇️</Btn>
              <label title="Upload image" style={{
                width: 36, height: 36, borderRadius: 8,
                background: 'rgba(255,255,255,.06)',
                outline: '1px solid rgba(255,255,255,.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 15,
              }}>
                🖼
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
              </label>
            </div>
          </div>
        )}

        {/* Canvas area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#111827' }}>
          <canvas
            ref={canvasRef}
            width={1920}
            height={1080}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            style={{
              display: 'block', width: '100%', height: '100%',
              touchAction: 'none',
              cursor: canEdit ? (tool === 'eraser' ? 'cell' : 'crosshair') : 'default',
              pointerEvents: canEdit ? 'auto' : 'none',
            }}
          />

          {/* Laser pointer overlay */}
          {laser?.visible && (
            <div style={{
              position: 'absolute',
              left: `${(laser.x / 1920) * 100}%`,
              top:  `${(laser.y / 1080) * 100}%`,
              width: 18, height: 18,
              borderRadius: '50%',
              background: '#ef4444',
              boxShadow: '0 0 16px rgba(239,68,68,.9)',
              transform: 'translate(-50%,-50%)',
              pointerEvents: 'none',
              animation: 'laserPulse .8s ease-in-out infinite',
            }} />
          )}

          <style>{`@keyframes laserPulse{0%,100%{transform:translate(-50%,-50%) scale(1);opacity:.8}50%{transform:translate(-50%,-50%) scale(1.4);opacity:1}}`}</style>
        </div>
      </div>
    </div>
  );
}
