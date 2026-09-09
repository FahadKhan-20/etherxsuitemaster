import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Manages the collaborative whiteboard state and synchronizes operations
 * with the room via the existing Socket.io connection (from useWebRTC).
 *
 * The host/presenter emits operations; participants receive them live and
 * also receive the full board state when they join late (via 'get-whiteboard').
 *
 * @param {object} opts
 * @param {object|null} opts.socket       - The live Socket.io socket (from useWebRTC).
 * @param {boolean}    opts.socketReady   - Whether the socket is connected.
 * @param {string}     opts.roomCode      - The meeting room code.
 * @param {boolean}    opts.isHost        - Whether the local user is the host/presenter.
 */
export function useWhiteboardSync({ socket, socketReady, roomCode, isHost }) {
  const [lines, setLines] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [notes, setNotes] = useState([]);
  const [uploadedImage, setUploadedImage] = useState('');
  const [laser, setLaser] = useState({ x: 0, y: 0, visible: false });

  // Refs to avoid stale closures in callbacks
  const linesRef = useRef(lines);
  const notesRef = useRef(notes);
  const redoStackRef = useRef(redoStack);

  useEffect(() => { linesRef.current = lines; }, [lines]);
  useEffect(() => { notesRef.current = notes; }, [notes]);
  useEffect(() => { redoStackRef.current = redoStack; }, [redoStack]);

  // ── Apply a remote operation to local state ────────────────────────────────
  const applyOp = useCallback((op) => {
    switch (op.type) {
      case 'STROKE_START':
        setLines(prev => [...prev, { id: op.id, tool: op.tool, color: op.color, size: op.size, points: [op.point] }]);
        break;
      case 'STROKE_EXTEND':
        setLines(prev => prev.map(l => l.id === op.id ? { ...l, points: [...l.points, op.point] } : l));
        break;
      case 'STROKE_END':
        break;
      case 'STICKY_ADD':
        setNotes(prev => [...prev, { id: op.id, x: op.x, y: op.y, text: op.text, color: op.color }]);
        break;
      case 'STICKY_UPDATE':
        setNotes(prev => prev.map(n => n.id === op.id ? { ...n, text: op.text } : n));
        break;
      case 'STICKY_MOVE':
        setNotes(prev => prev.map(n => n.id === op.id ? { ...n, x: op.x, y: op.y } : n));
        break;
      case 'STICKY_DELETE':
        setNotes(prev => prev.filter(n => n.id !== op.id));
        break;
      case 'UNDO':
        setLines(prev => prev.slice(0, -1));
        break;
      case 'REDO':
        if (op.line) setLines(prev => [...prev, op.line]);
        break;
      case 'CLEAR':
        setLines([]);
        setNotes([]);
        break;
      case 'IMAGE_ADD':
        setUploadedImage(op.url);
        break;
      case 'IMAGE_REMOVE':
        setUploadedImage('');
        break;
      case 'LASER':
        setLaser({ x: op.x, y: op.y, visible: op.visible });
        break;
      default:
        break;
    }
  }, []);

  // ── Socket listeners: receive remote ops + late-joiner state ───────────────
  useEffect(() => {
    if (!socket || !socketReady) return;

    const onWhiteboardOp = (op) => applyOp(op);
    const onWhiteboardState = ({ board }) => {
      setLines(board.lines || []);
      setNotes(board.notes || []);
      setUploadedImage(board.uploadedImage || '');
      setLaser(board.laser || { x: 0, y: 0, visible: false });
    };

    socket.on('whiteboard-op', onWhiteboardOp);
    socket.on('whiteboard-state', onWhiteboardState);

    // Request current board state (late joiner)
    socket.emit('get-whiteboard', { roomCode });

    return () => {
      socket.off('whiteboard-op', onWhiteboardOp);
      socket.off('whiteboard-state', onWhiteboardState);
    };
  }, [socket, socketReady, roomCode, applyOp]);

  // ── Emit an operation (host only) ──────────────────────────────────────────
  const emitOp = useCallback((op) => {
    if (!isHost) return;
    // Apply locally first so the host sees the change immediately
    applyOp(op);
    socket?.emit('whiteboard-op', { roomCode, op });
  }, [isHost, socket, roomCode, applyOp]);

  // ── Drawing operations ─────────────────────────────────────────────────────
  const startStroke = useCallback((id, tool, color, size, point) => {
    emitOp({ type: 'STROKE_START', id, tool, color, size, point });
  }, [emitOp]);

  const extendStroke = useCallback((id, point) => {
    emitOp({ type: 'STROKE_EXTEND', id, point });
  }, [emitOp]);

  const endStroke = useCallback((id) => {
    emitOp({ type: 'STROKE_END', id });
  }, [emitOp]);

  // ── Sticky notes ───────────────────────────────────────────────────────────
  const addSticky = useCallback((id, x, y, text, color) => {
    emitOp({ type: 'STICKY_ADD', id, x, y, text, color });
  }, [emitOp]);

  const updateSticky = useCallback((id, text) => {
    emitOp({ type: 'STICKY_UPDATE', id, text });
  }, [emitOp]);

  const moveSticky = useCallback((id, x, y) => {
    emitOp({ type: 'STICKY_MOVE', id, x, y });
  }, [emitOp]);

  const deleteSticky = useCallback((id) => {
    emitOp({ type: 'STICKY_DELETE', id });
  }, [emitOp]);

  // ── Undo / Redo / Clear ────────────────────────────────────────────────────
  const undo = useCallback(() => {
    if (!linesRef.current.length) return;
    const removed = linesRef.current[linesRef.current.length - 1];
    setRedoStack(prev => [removed, ...prev]);
    emitOp({ type: 'UNDO' });
  }, [emitOp]);

  const redo = useCallback(() => {
    if (!redoStackRef.current.length) return;
    const line = redoStackRef.current[0];
    setRedoStack(prev => prev.slice(1));
    emitOp({ type: 'REDO', line });
  }, [emitOp]);

  const clearBoard = useCallback(() => {
    emitOp({ type: 'CLEAR' });
  }, [emitOp]);

  // ── Image upload / remove ──────────────────────────────────────────────────
  const addImage = useCallback((url) => {
    emitOp({ type: 'IMAGE_ADD', url });
  }, [emitOp]);

  const removeImage = useCallback(() => {
    emitOp({ type: 'IMAGE_REMOVE' });
  }, [emitOp]);

  // ── Laser pointer ──────────────────────────────────────────────────────────
  const moveLaser = useCallback((x, y, visible) => {
    emitOp({ type: 'LASER', x, y, visible });
  }, [emitOp]);

  return {
    lines, notes, uploadedImage, laser,
    startStroke, extendStroke, endStroke,
    addSticky, updateSticky, moveSticky, deleteSticky,
    undo, redo, clearBoard, addImage, removeImage, moveLaser,
  };
}