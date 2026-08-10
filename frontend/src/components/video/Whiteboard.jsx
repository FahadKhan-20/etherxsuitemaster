import { useEffect, useRef, useState } from 'react';

const COLORS = ['#ffffff', '#facc15', '#f87171', '#4ade80', '#60a5fa', '#c084fc', '#fb923c', '#f9a8d4', '#000000'];
const SIZES  = [2, 4, 8, 16];

function ToolBtn({ active, title, onClick, children }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 36, height: 36, borderRadius: 8, border: 'none',
        background: active ? 'rgba(250,204,21,0.2)' : 'rgba(255,255,255,0.06)',
        outline: active ? '1.5px solid rgba(250,204,21,0.6)' : '1px solid rgba(255,255,255,0.1)',
        color: active ? '#facc15' : 'rgba(203,213,225,0.9)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', fontSize: 16, transition: 'all 0.12s',
      }}
    >
      {children}
    </button>
  );
}

export default function Whiteboard({ onClose }) {
  const canvasRef  = useRef(null);
  const drawing    = useRef(false);
  const lastPos    = useRef(null);
  const startPos   = useRef(null);
  const snapshot   = useRef(null);
  const history    = useRef([]);

  const [tool,  setTool]  = useState('pen');
  const [color, setColor] = useState('#ffffff');
  const [size,  setSize]  = useState(4);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  function getPos(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width  / rect.width),
      y: (e.clientY - rect.top)  * (canvas.height / rect.height),
    };
  }

  function saveHistory() {
    const ctx = canvasRef.current.getContext('2d');
    history.current.push(ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height));
    if (history.current.length > 30) history.current.shift();
  }

  function onMouseDown(e) {
    saveHistory();
    const pos = getPos(e);
    drawing.current = true;
    lastPos.current = pos;
    startPos.current = pos;
    const ctx = canvasRef.current.getContext('2d');
    snapshot.current = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
  }

  function onMouseMove(e) {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e);

    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'pen') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastPos.current = pos;
    } else if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = size * 4;
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      lastPos.current = pos;
    } else {
      ctx.putImageData(snapshot.current, 0, 0);
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.beginPath();
      if (tool === 'line') {
        ctx.moveTo(startPos.current.x, startPos.current.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      } else if (tool === 'rect') {
        ctx.strokeRect(startPos.current.x, startPos.current.y, pos.x - startPos.current.x, pos.y - startPos.current.y);
      } else if (tool === 'circle') {
        const rx = (pos.x - startPos.current.x) / 2;
        const ry = (pos.y - startPos.current.y) / 2;
        ctx.ellipse(startPos.current.x + rx, startPos.current.y + ry, Math.abs(rx), Math.abs(ry), 0, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (tool === 'arrow') {
        const dx = pos.x - startPos.current.x;
        const dy = pos.y - startPos.current.y;
        const angle = Math.atan2(dy, dx);
        const headLen = 18;
        ctx.moveTo(startPos.current.x, startPos.current.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.lineTo(pos.x - headLen * Math.cos(angle - Math.PI / 6), pos.y - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(pos.x - headLen * Math.cos(angle + Math.PI / 6), pos.y - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
    }
  }

  function onMouseUp() { drawing.current = false; }

  function undo() {
    if (!history.current.length) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.putImageData(history.current.pop(), 0, 0);
  }

  function clear() {
    saveHistory();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function download() {
    const link = document.createElement('a');
    link.download = 'whiteboard.png';
    link.href = canvasRef.current.toDataURL();
    link.click();
  }

  const cursor = tool === 'eraser' ? 'cell' : tool === 'pen' ? 'crosshair' : 'crosshair';

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#111827' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexWrap: 'wrap',
      }}>
        {/* Drawing tools */}
        <div style={{ display: 'flex', gap: 4 }}>
          <ToolBtn active={tool === 'pen'}    title="Pen"      onClick={() => setTool('pen')}>✏️</ToolBtn>
          <ToolBtn active={tool === 'eraser'} title="Eraser"   onClick={() => setTool('eraser')}>🧹</ToolBtn>
          <ToolBtn active={tool === 'line'}   title="Line"     onClick={() => setTool('line')}>╱</ToolBtn>
          <ToolBtn active={tool === 'rect'}   title="Rectangle" onClick={() => setTool('rect')}>▭</ToolBtn>
          <ToolBtn active={tool === 'circle'} title="Circle"   onClick={() => setTool('circle')}>○</ToolBtn>
          <ToolBtn active={tool === 'arrow'}  title="Arrow"    onClick={() => setTool('arrow')}>→</ToolBtn>
        </div>

        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)' }} />

        {/* Colors */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {COLORS.map(c => (
            <button
              key={c}
              title={c}
              onClick={() => { setColor(c); if (tool === 'eraser') setTool('pen'); }}
              style={{
                width: 22, height: 22, borderRadius: '50%',
                background: c,
                border: color === c && tool !== 'eraser' ? '2px solid #facc15' : '2px solid rgba(255,255,255,0.2)',
                cursor: 'pointer', padding: 0, outline: 'none',
              }}
            />
          ))}
        </div>

        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)' }} />

        {/* Sizes */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {SIZES.map(s => (
            <button
              key={s}
              title={`Size ${s}`}
              onClick={() => setSize(s)}
              style={{
                width: 32, height: 32, borderRadius: 8, border: 'none',
                background: size === s ? 'rgba(250,204,21,0.15)' : 'rgba(255,255,255,0.05)',
                outline: size === s ? '1.5px solid rgba(250,204,21,0.5)' : '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <div style={{ width: s, height: s, borderRadius: '50%', background: color === '#000000' ? '#fff' : color }} />
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)' }} />

        {/* Actions */}
        <div style={{ display: 'flex', gap: 4 }}>
          <ToolBtn title="Undo" onClick={undo}>↩</ToolBtn>
          <ToolBtn title="Clear canvas" onClick={clear}>🗑️</ToolBtn>
          <ToolBtn title="Download as PNG" onClick={download}>⬇️</ToolBtn>
        </div>

        <div style={{ flex: 1 }} />

        <button
          onClick={onClose}
          style={{
            padding: '6px 14px', borderRadius: 999, border: '1px solid rgba(239,68,68,0.3)',
            background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: 12,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}
        >
          Stop whiteboard
        </button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={1920}
        height={1080}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{ flex: 1, display: 'block', cursor, width: '100%', height: '100%', touchAction: 'none' }}
      />
    </div>
  );
}
