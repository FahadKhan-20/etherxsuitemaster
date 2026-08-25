import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Download,
  Eraser,
  Highlighter,
  ImagePlus,
  MousePointer2,
  Paintbrush2,
  PanelRightOpen,
  RotateCcw,
  RotateCw,
  StickyNote,
  Trash2,
  ZoomIn,
  ZoomOut,
  X,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import Button from '../../ui/Button';
import { useWhiteboardSync } from '../../../hooks/useWhiteboardSync';

const stickyPalette = ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B'];
const templates = ['blank', 'kanban', 'mindmap', 'retro', 'flow'];

export default function Whiteboard({ isOpen, onClose, socket, socketReady, roomCode, isHost }) {
  const canvasRef = useRef(null);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#4F46E5');
  const [strokeSize, setStrokeSize] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [template, setTemplate] = useState('blank');
  const [layers, setLayers] = useState({
    guides: true,
    ink: true,
    notes: true,
    upload: true,
  });
  const currentStrokeIdRef = useRef(null);

  const {
    lines, notes, uploadedImage, laser,
    startStroke, extendStroke, endStroke,
    addSticky, updateSticky, moveSticky, deleteSticky,
    undo, redo, clearBoard, addImage, removeImage, moveLaser,
  } = useWhiteboardSync({ socket, socketReady, roomCode, isHost });

  const canEdit = !!isHost;

  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0, visible: false });

  const selectTool = (newTool) => {
    setTool(newTool);
    if (newTool === 'eraser' && strokeSize < 12) {
      setStrokeSize(24);
    } else if (newTool === 'pen' && strokeSize > 20) {
      setStrokeSize(4);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!layers.ink) {
      return;
    }

    lines.forEach((line) => {
      if (!line.points || !line.points.length) {
        return;
      }

      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (line.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = line.size || 24;
        ctx.globalAlpha = 1;
      } else if (line.tool === 'highlighter') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = line.color || '#4F46E5';
        ctx.lineWidth = (line.size || 4) * 2.5;
        ctx.globalAlpha = 0.24;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = line.color || '#4F46E5';
        ctx.lineWidth = line.size || 4;
        ctx.globalAlpha = 1;
      }

      ctx.moveTo(line.points[0].x, line.points[0].y);
      if (line.points.length === 1) {
        ctx.lineTo(line.points[0].x + 0.01, line.points[0].y + 0.01);
      } else {
        line.points.forEach((point) => ctx.lineTo(point.x, point.y));
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    });
  }, [layers.ink, lines]);

  if (!isOpen) {
    return null;
  }

  const pointerPosition = (event) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: 0, y: 0 };
    }

    return {
      x: ((event.clientX - rect.left) / rect.width) * canvasRef.current.width,
      y: ((event.clientY - rect.top) / rect.height) * canvasRef.current.height,
    };
  };

  const handlePointerDown = (event) => {
    if (!canEdit) {
      return;
    }
    const point = pointerPosition(event);
    setCursorPos({ x: point.x, y: point.y, visible: true });

    if (tool === 'sticky') {
      addSticky(
        `sticky-${Date.now()}`,
        point.x,
        point.y,
        'New idea',
        stickyPalette[notes.length % stickyPalette.length],
      );
      return;
    }

    if (tool === 'laser') {
      moveLaser(point.x, point.y, true);
      return;
    }

    const id = `line-${Date.now()}`;
    currentStrokeIdRef.current = id;
    setIsDrawing(true);
    startStroke(id, tool, color, strokeSize, point);
  };

  const handlePointerMove = (event) => {
    if (!canEdit) {
      return;
    }
    const point = pointerPosition(event);
    setCursorPos({ x: point.x, y: point.y, visible: true });

    if (tool === 'laser') {
      moveLaser(point.x, point.y, true);
      return;
    }

    if (!isDrawing || !currentStrokeIdRef.current) {
      return;
    }

    extendStroke(currentStrokeIdRef.current, point);
  };

  const handlePointerUp = () => {
    if (!canEdit) {
      return;
    }
    if (currentStrokeIdRef.current) {
      endStroke(currentStrokeIdRef.current);
      currentStrokeIdRef.current = null;
    }
    setIsDrawing(false);
    if (tool === 'laser') {
      moveLaser(0, 0, false);
    }
  };

  const exportPng = () => {
    const dataUrl = canvasRef.current?.toDataURL('image/png');
    if (!dataUrl) {
      return;
    }
    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = 'etherxmeet-whiteboard.png';
    anchor.click();
  };

  const exportPdf = () => {
    const dataUrl = canvasRef.current?.toDataURL('image/png');
    if (!dataUrl) {
      return;
    }
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [1280, 720] });
    pdf.addImage(dataUrl, 'PNG', 0, 0, 1280, 720);
    pdf.save('etherxmeet-whiteboard.pdf');
  };

  const backgroundGuide = useMemo(() => {
    switch (template) {
      case 'kanban':
        return 'bg-[linear-gradient(90deg,transparent_0,transparent_32%,rgba(255,255,255,0.08)_32%,rgba(255,255,255,0.08)_33%,transparent_33%,transparent_66%,rgba(255,255,255,0.08)_66%,rgba(255,255,255,0.08)_67%,transparent_67%)]';
      case 'mindmap':
        return 'bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12)_0,rgba(255,255,255,0.12)_2px,transparent_2px),linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:180px_180px,40px_40px,40px_40px]';
      case 'retro':
        return 'bg-[linear-gradient(90deg,rgba(16,185,129,0.08)_0,rgba(16,185,129,0.08)_33%,rgba(245,158,11,0.08)_33%,rgba(245,158,11,0.08)_66%,rgba(239,68,68,0.08)_66%,rgba(239,68,68,0.08)_100%)]';
      case 'flow':
        return 'bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:28px_28px]';
      default:
        return 'bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:40px_40px]';
    }
  }, [template]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[2000] bg-black/75 p-2 sm:p-3 backdrop-blur-sm"
    >
      <div className="flex h-full flex-col rounded-[24px] sm:rounded-[36px] border border-white/10 bg-[rgba(13,13,26,0.95)] p-3 sm:p-4 shadow-[0_30px_100px_rgba(4,8,24,0.62)] backdrop-blur-2xl overflow-y-auto">
        <div className="mb-3 sm:mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.28em] text-white/35">Collaborative whiteboard</p>
            <h2 className="mt-1 sm:mt-2 font-syne text-xl sm:text-3xl font-bold text-white">Sketch, map, and annotate</h2>
            {!canEdit && (
              <p className="mt-0.5 text-[11px] sm:text-xs text-white/40">View-only — the host is presenting this board.</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close whiteboard"
            className="relative z-10 flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white/80 transition-all hover:bg-white/20 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid flex-1 gap-3 sm:gap-4 lg:grid-cols-[auto_1fr_auto]">
          <div className="flex flex-row overflow-x-auto gap-2 lg:flex-col lg:gap-3 rounded-[20px] lg:rounded-[28px] border border-white/10 bg-white/5 p-2 lg:p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] shrink-0">
            <ToolButton active={tool === 'pen'} icon={Paintbrush2} label="Pen" onClick={() => selectTool('pen')} />
            <ToolButton active={tool === 'highlighter'} icon={Highlighter} label="Marker" onClick={() => selectTool('highlighter')} />
            <ToolButton active={tool === 'eraser'} icon={Eraser} label="Erase" onClick={() => selectTool('eraser')} />
            <ToolButton active={tool === 'sticky'} icon={StickyNote} label="Sticky" onClick={() => selectTool('sticky')} />
            <ToolButton active={tool === 'laser'} icon={MousePointer2} label="Laser" onClick={() => selectTool('laser')} />
            <ToolButton active={false} icon={RotateCcw} label="Undo" onClick={undo} />
            <ToolButton active={false} icon={RotateCw} label="Redo" onClick={redo} />
            {canEdit && <ToolButton active={false} icon={Trash2} label="Clear" onClick={clearBoard} />}
          </div>

          <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#0b1021] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="absolute left-4 top-4 z-20 flex flex-wrap gap-2">
              {templates.map((boardTemplate) => (
                <button
                  key={boardTemplate}
                  onClick={() => setTemplate(boardTemplate)}
                  className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.2em] ${
                    template === boardTemplate
                      ? 'border-cyan-400/20 bg-cyan-400/12 text-cyan-100'
                      : 'border-white/10 bg-black/20 text-white/45'
                  }`}
                >
                  {boardTemplate}
                </button>
              ))}
            </div>

            <div className={`absolute inset-0 ${layers.guides ? backgroundGuide : ''}`} />

            {layers.upload && uploadedImage && (
              <img
                src={uploadedImage}
                alt="Uploaded content"
                className="pointer-events-none absolute inset-0 h-full w-full object-contain"
              />
            )}

            <div
              className="absolute inset-0 origin-top-left"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
            >
              <canvas
                ref={canvasRef}
                width={1280}
                height={720}
                className={`absolute inset-0 h-full w-full touch-none ${canEdit ? (tool === 'eraser' ? 'cursor-none' : 'cursor-crosshair') : 'pointer-events-none'}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={() => {
                  handlePointerUp();
                  setCursorPos((prev) => ({ ...prev, visible: false }));
                }}
              />

              {tool === 'eraser' && cursorPos.visible && (
                <div
                  className="pointer-events-none absolute rounded-full border-2 border-white/80 bg-white/20 shadow-[0_0_12px_rgba(255,255,255,0.4)]"
                  style={{
                    width: `${(strokeSize / 1280) * 100}%`,
                    aspectRatio: '1 / 1',
                    left: `${(cursorPos.x / 1280) * 100}%`,
                    top: `${(cursorPos.y / 720) * 100}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              )}

              {layers.notes &&
                notes.map((note) => (
                  <motion.div
                    key={note.id}
                    drag={canEdit}
                    dragMomentum={false}
                    onDragEnd={(event, info) => {
                      moveSticky(note.id, note.x + info.offset.x, note.y + info.offset.y);
                    }}
                    className="group absolute flex min-h-[120px] w-40 flex-col rounded-[20px] border border-white/10 p-3 text-sm text-white shadow-[0_16px_40px_rgba(4,8,24,0.35)]"
                    style={{
                      left: note.x,
                      top: note.y,
                      background: note.color,
                    }}
                  >
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => deleteSticky(note.id)}
                        className="absolute right-2 top-2 z-10 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-black/40 text-white/80 transition-all hover:bg-black/70 hover:text-white"
                        title="Delete note"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    <textarea
                      defaultValue={note.text}
                      readOnly={!canEdit}
                      onChange={(event) => {
                        const text = event.target.value;
                        updateSticky(note.id, text);
                      }}
                      className="h-full w-full resize-none bg-transparent text-sm text-white focus:outline-none"
                    />
                  </motion.div>
                ))}

              {laser.visible && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="absolute h-5 w-5 rounded-full bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.8)]"
                  style={{ left: laser.x - 10, top: laser.y - 10 }}
                />
              )}
            </div>
          </div>

          <div className="flex w-full max-w-[260px] flex-col gap-4 rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-white/35">Board controls</p>
              <div className="mt-3 flex items-center gap-2">
                <Button variant="outline" onClick={() => setZoom((previous) => Math.max(0.6, previous - 0.1))}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-2 text-sm text-white/70">
                  {Math.round(zoom * 100)}%
                </div>
                <Button variant="outline" onClick={() => setZoom((previous) => Math.min(1.8, previous + 0.1))}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.28em] text-white/35">
                  {tool === 'eraser' ? 'Eraser size' : 'Color & stroke'}
                </p>
                <span className="font-mono text-xs font-semibold text-cyan-400">{strokeSize}px</span>
              </div>

              {tool === 'eraser' ? (
                <div className="mt-3 flex gap-2">
                  {[12, 24, 48, 80].map((s) => (
                    <button
                      key={s}
                      onClick={() => setStrokeSize(s)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-medium transition-all ${
                        strokeSize === s
                          ? 'border-cyan-400 bg-cyan-400/20 text-cyan-200 ring-2 ring-cyan-400/50'
                          : 'border-white/10 bg-black/20 text-white/60 hover:text-white'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  {['#4F46E5', '#06B6D4', '#10B981', '#EF4444', '#F59E0B', '#FFFFFF'].map((swatch) => (
                    <button
                      key={swatch}
                      onClick={() => setColor(swatch)}
                      className={`h-8 w-8 rounded-full border transition-all ${
                        color === swatch ? 'scale-110 border-white ring-2 ring-cyan-400/50' : 'border-white/10 opacity-70 hover:opacity-100'
                      }`}
                      style={{ background: swatch }}
                    />
                  ))}
                </div>
              )}

              <input
                className="mt-4 w-full accent-cyan-400 cursor-pointer"
                type="range"
                min={tool === 'eraser' ? 6 : 2}
                max={tool === 'eraser' ? 120 : 30}
                value={strokeSize}
                onChange={(event) => setStrokeSize(Number(event.target.value))}
              />
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-white/35">Layers</p>
              <div className="mt-3 space-y-2">
                {Object.entries(layers).map(([key, enabled]) => (
                  <button
                    key={key}
                    onClick={() => setLayers((previous) => ({ ...previous, [key]: !previous[key] }))}
                    className={`flex w-full items-center justify-between rounded-[18px] border px-3 py-2 text-sm capitalize ${
                      enabled ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100' : 'border-white/10 bg-black/10 text-white/55'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <PanelRightOpen className="h-4 w-4" />
                      {key}
                    </span>
                    <span>{enabled ? 'Visible' : 'Hidden'}</span>
                  </button>
                ))}
              </div>
            </div>

            {canEdit && (
              <label className="cursor-pointer rounded-[22px] border border-white/10 bg-black/10 px-4 py-3 text-sm text-white/65">
                <div className="flex items-center gap-2">
                  <ImagePlus className="h-4 w-4" />
                  Upload image
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => addImage(String(reader.result));
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
            )}

            <div className="mt-auto flex flex-col gap-2">
              <Button variant="outline" onClick={exportPng}>
                <Download className="h-4 w-4" />
                Export PNG
              </Button>
              <Button variant="primary" onClick={exportPdf}>
                <Download className="h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ToolButton({ active, icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 lg:gap-3 rounded-[14px] lg:rounded-[20px] border px-2.5 lg:px-3 py-2 lg:py-3 text-left text-xs lg:text-sm whitespace-nowrap transition-all ${
        active ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100' : 'border-white/10 bg-black/10 text-white/60 hover:text-white'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}