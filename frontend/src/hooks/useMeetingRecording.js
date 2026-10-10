import { useCallback, useEffect, useRef, useState } from 'react';
import apiClient from '../utils/apiClient';

const RECORDING_MIME_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

function getSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  return RECORDING_MIME_TYPES.find(type => MediaRecorder.isTypeSupported(type)) || '';
}

function createVideoElement(stream) {
  const element = document.createElement('video');
  element.muted = true;
  element.playsInline = true;
  element.autoplay = true;
  element.setAttribute('aria-hidden', 'true');
  Object.assign(element.style, {
    position: 'fixed',
    width: '1px',
    height: '1px',
    left: '-2px',
    top: '-2px',
    opacity: '0',
    pointerEvents: 'none',
  });
  element.srcObject = stream;
  document.body.appendChild(element);
  const startPlayback = () => element.play().catch(() => {});
  element.addEventListener('loadedmetadata', startPlayback);
  element.addEventListener('canplay', startPlayback);
  startPlayback();
  return element;
}

const TILE_GAP = 12;
const hasLiveVideo = video => video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0
  && (video.srcObject?.getVideoTracks?.() || []).some(track => track.readyState === 'live' && track.enabled && !track.muted);
const roundRect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

// One tile as the meeting shows it: the camera (cropped to fill), or the person's initial in a circle,
// with their name in the corner. Screen shares are letterboxed so nothing is cut off.
function drawTile(ctx, { video, label, key }, x, y, w, h) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 14);
  ctx.fillStyle = '#16140f';
  ctx.fill();
  ctx.clip();
  const isScreen = key === 'screen-share';
  if (hasLiveVideo(video)) {
    const fit = isScreen ? Math.min : Math.max;
    const scale = fit(w / video.videoWidth, h / video.videoHeight);
    const vw = video.videoWidth * scale, vh = video.videoHeight * scale;
    ctx.drawImage(video, x + (w - vw) / 2, y + (h - vh) / 2, vw, vh);
  } else {
    const radius = Math.max(18, Math.min(w, h) * 0.16);
    ctx.fillStyle = '#0a84d0';
    ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${Math.round(radius)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const initials = label.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase() || '?';
    ctx.font = `600 ${Math.round(radius * (initials.length > 1 ? 0.8 : 1))}px sans-serif`;
    ctx.fillText(initials, x + w / 2, y + h / 2 + 1);
  }
  ctx.font = '500 15px sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const text = isScreen ? label : label.slice(0, 40);
  const pillW = ctx.measureText(text).width + 20;
  roundRect(ctx, x + 10, y + h - 38, pillW, 28, 8);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fill();
  ctx.fillStyle = '#f0ece2';
  ctx.fillText(text, x + 20, y + h - 24);
  ctx.restore();
}

// Grid like the meeting; a shared screen takes the stage with cameras in a column beside it.
function drawMeeting(ctx, canvas, tiles) {
  ctx.fillStyle = '#0b0a08';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const screen = tiles.find(t => t.key === 'screen-share');
  const others = tiles.filter(t => t !== screen);
  const area = { x: TILE_GAP, y: TILE_GAP, w: canvas.width - TILE_GAP * 2, h: canvas.height - TILE_GAP * 2 };
  if (screen) {
    const sideW = others.length ? Math.round(area.w * 0.22) : 0;
    drawTile(ctx, screen, area.x, area.y, area.w - (sideW ? sideW + TILE_GAP : 0), area.h);
    const rows = Math.max(others.length, 3), tileH = (area.h - TILE_GAP * (rows - 1)) / rows;
    others.forEach((tile, i) => drawTile(ctx, tile, area.x + area.w - sideW, area.y + i * (tileH + TILE_GAP), sideW, tileH));
    return;
  }
  const count = Math.max(others.length, 1);
  const columns = count <= 1 ? 1 : count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / columns);
  const tileW = (area.w - TILE_GAP * (columns - 1)) / columns, tileH = (area.h - TILE_GAP * (rows - 1)) / rows;
  others.forEach((tile, i) => drawTile(ctx, tile, area.x + (i % columns) * (tileW + TILE_GAP), area.y + Math.floor(i / columns) * (tileH + TILE_GAP), tileW, tileH));
}

export function useMeetingRecording({ roomCode, isHost, localStream, screenStream, peers, userName, socket, socketReady, onError }) {
  const [recordingState, setRecordingState] = useState('idle');
  const [recordingError, setRecordingError] = useState('');
  const recorderRef = useRef(null);
  const sessionRef = useRef(null);
  const videoElementsRef = useRef(new Map());
  const videoLabelsRef = useRef(new Map());
  const audioSourcesRef = useRef(new Map());
  const animationFrameRef = useRef(null);
  const chunksRef = useRef([]);
  const finishWaitersRef = useRef([]);
  // True from Stop until the file is saved. The recorder, canvas and chunks are shared refs, so a new
  // recording must not start (and server 'idle' must not hide the status) until the last one is saved.
  const savingRef = useRef(false);
  const completeFinish = useCallback(() => { savingRef.current = false; finishWaitersRef.current.splice(0).forEach(resolve => resolve()); }, []);

  const cleanupCapture = useCallback(() => {
    animationFrameRef.current?.stop();
    animationFrameRef.current = null;
    videoElementsRef.current.forEach(video => {
      video.pause();
      video.srcObject = null;
      video.remove();
    });
    videoElementsRef.current.clear();
    videoLabelsRef.current.clear();
    audioSourcesRef.current.forEach(({ node }) => node.disconnect());
    audioSourcesRef.current.clear();
    if (sessionRef.current?.audioContext) sessionRef.current.audioContext.close().catch(() => {});
    sessionRef.current?.canvasStream?.getTracks().forEach(track => track.stop());
    sessionRef.current = null;
  }, []);

  const downloadRecording = useCallback((blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }, []);

  const uploadRecording = useCallback(async (blob, duration) => {
    try {
      const formData = new FormData();
      formData.append('file', blob, `etherx-meeting-${roomCode}-${Date.now()}.webm`);
      formData.append('roomCode', roomCode);
      formData.append('duration', String(duration));
      await apiClient.post('/api/recordings/upload', formData);
      return true;
    } catch {
      return false;
    }
  }, [roomCode]);

  const finishRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder && !finishWaitersRef.current.length) return Promise.resolve();
    const completion = new Promise(resolve => finishWaitersRef.current.push(resolve));
    if (!recorder || recorder.state === 'inactive') return completion;
    savingRef.current = true;
    setRecordingState('stopping');
    recorder.stop();
    return completion;
  }, []);

  const startLocalRecording = useCallback(() => {
    if (typeof MediaRecorder === 'undefined') throw new Error('This browser does not support meeting recording.');
    const mimeType = getSupportedMimeType();
    if (!mimeType) throw new Error('This browser has no supported recording format.');
    if (!window.AudioContext && !window.webkitAudioContext) throw new Error('This browser does not support meeting audio capture.');

    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create the recording canvas.');
    const canvasStream = canvas.captureStream(30);
    const canvasTrack = canvasStream.getVideoTracks()[0];
    if (!canvasTrack || canvasTrack.readyState !== 'live') {
      canvasStream.getTracks().forEach(track => track.stop());
      throw new Error('Could not create a live recording video track.');
    }
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const destination = audioContext.createMediaStreamDestination();
    const recordingStream = new MediaStream(canvasStream.getVideoTracks());
    destination.stream.getAudioTracks().forEach(track => recordingStream.addTrack(track));
    const recorder = new MediaRecorder(recordingStream, { mimeType });
    const startedAt = Date.now();
    chunksRef.current = [];
    sessionRef.current = { canvas, context, canvasStream, audioContext, destination };
    recorderRef.current = recorder;

    const render = () => drawMeeting(context, canvas, Array.from(videoElementsRef.current.entries()).map(([key, video]) => ({
      key, video, label: videoLabelsRef.current.get(key) || 'Participant',
    })));
    // A worker timer keeps frames coming while the tab is in the background (requestAnimationFrame stops there).
    if (typeof Worker === 'function') {
      const ticker = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 1000 / 30);'], { type: 'text/javascript' })));
      ticker.onmessage = render;
      animationFrameRef.current = { stop: () => ticker.terminate() };
    } else {
      const timer = setInterval(render, 1000 / 30);
      animationFrameRef.current = { stop: () => clearInterval(timer) };
    }
    render();
    recorder.ondataavailable = event => { if (event.data.size > 0) chunksRef.current.push(event.data); };
    recorder.onerror = () => {
      setRecordingError('Recording failed, but the meeting is still active.');
      setRecordingState('error');
      cleanupCapture();
      recorderRef.current = null;
      completeFinish();
    };
    recorder.onstop = async () => {
      // Keep codec parameters on MediaRecorder; multipart uploads need the base media type.
      const blob = new Blob(chunksRef.current, { type: mimeType.split(';', 1)[0] });
      const duration = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
      cleanupCapture();
      recorderRef.current = null;
      chunksRef.current = [];
      if (!blob.size) {
        setRecordingError('The recording contained no media.');
        setRecordingState('error');
        completeFinish();
        return;
      }
      try {
        const uploaded = await uploadRecording(blob, duration);
        if (!uploaded) downloadRecording(blob, `etherx-meeting-${roomCode}-${Date.now()}.webm`);
        setRecordingState('completed');
      } finally { completeFinish(); }
      // Only clear the "saved" notice; never a recording that started since.
      window.setTimeout(() => setRecordingState(current => (current === 'completed' ? 'idle' : current)), 2500);
    };
    recorder.start(1000);
  }, [cleanupCapture, completeFinish, downloadRecording, roomCode, uploadRecording]);

  const syncCaptureSources = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    const streams = new Map();
    if (localStream) streams.set('local-video', localStream);
    if (screenStream) streams.set('screen-share', screenStream);
    if (localStream) streams.set('local-audio', localStream);
    Object.entries(peers || {}).forEach(([id, peer]) => {
      if (peer.stream) streams.set(id, peer.stream);
      if (peer.screenStream && !screenStream) streams.set('screen-share', peer.screenStream);
    });
    const activeKeys = new Set(streams.keys());
    videoElementsRef.current.forEach((video, key) => {
      if (!activeKeys.has(key)) {
        video.pause();
        video.srcObject = null;
        video.remove();
        videoElementsRef.current.delete(key);
        videoLabelsRef.current.delete(key);
      }
    });
    audioSourcesRef.current.forEach(({ node }, key) => {
      if (!activeKeys.has(key)) { node.disconnect(); audioSourcesRef.current.delete(key); }
    });
    streams.forEach((stream, key) => {
      if (!key.endsWith('-audio')) {
        const existing = videoElementsRef.current.get(key);
        if (!existing || existing.srcObject !== stream) {
          if (existing) { existing.pause(); existing.srcObject = null; existing.remove(); }
          videoElementsRef.current.set(key, createVideoElement(stream));
        }
        const label = key === 'local-video'
          ? userName || 'You'
          : key === 'screen-share'
            ? (screenStream ? `${userName || 'You'} is presenting` : `${Object.values(peers).find(p => p.screenStream)?.userName || 'Participant'} is presenting`)
            : peers[key]?.userName || 'Participant';
        videoLabelsRef.current.set(key, label);
      }
      const isDuplicateLocalAudio = key === 'local-video' && stream === localStream;
      const audioTracks = stream.getAudioTracks().filter(track => track.readyState === 'live');
      if (!isDuplicateLocalAudio && audioTracks.length > 0) {
        const sourceEntry = audioSourcesRef.current.get(key);
        if (!sourceEntry || sourceEntry.stream !== stream) {
          sourceEntry?.node.disconnect();
          try {
            const node = session.audioContext.createMediaStreamSource(stream);
            node.connect(session.destination);
            audioSourcesRef.current.set(key, { node, stream });
          } catch {
            audioSourcesRef.current.delete(key);
          }
        }
      } else {
        audioSourcesRef.current.get(key)?.node.disconnect();
        audioSourcesRef.current.delete(key);
      }
    });
  }, [localStream, peers, screenStream, userName]);

  useEffect(() => { if (recordingState === 'recording') syncCaptureSources(); }, [recordingState, syncCaptureSources]);

  useEffect(() => {
    if (!socket || !socketReady) return undefined;
    const onState = ({ state, error }) => {
      if (state === 'idle' && recorderRef.current?.state === 'recording') finishRecording();
      else if (state === 'idle' && savingRef.current) { /* keep 'stopping' until the file is saved */ }
      else setRecordingState(state || 'idle');
      if (error) { setRecordingError(error); onError?.(error); }
    };
    socket.on('recording-state', onState);
    return () => socket.off('recording-state', onState);
  }, [finishRecording, onError, socket, socketReady]);

  useEffect(() => () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    cleanupCapture();
  }, [cleanupCapture]);

  const startRecording = useCallback(() => {
    if (!isHost || !socket || recordingState === 'recording') return;
    if (savingRef.current || recordingState === 'stopping' || (recorderRef.current && recorderRef.current.state !== 'inactive')) {
      onError?.('Still saving the last recording. Try again in a moment.');
      return;
    }
    setRecordingError('');
    socket.emit('recording-start', { roomCode }, response => {
      if (!response?.ok) {
        const message = response?.error || 'Recording could not be started.';
        setRecordingError(message);
        onError?.(message);
        return;
      }
      try { startLocalRecording(); syncCaptureSources(); }
      catch (error) {
        setRecordingError(error.message);
        onError?.(error.message);
        socket.emit('recording-stop', { roomCode });
      }
    });
  }, [isHost, onError, recordingState, roomCode, socket, startLocalRecording, syncCaptureSources]);

  const stopRecording = useCallback(() => {
    if(finishWaitersRef.current.length)return finishRecording();
    if (!isHost || !socket || recordingState !== 'recording') return Promise.resolve();
    setRecordingState('stopping');
    socket.emit('recording-stop', { roomCode }, response => { if (!response?.ok && response?.error) setRecordingError(response.error); });
    return finishRecording();
  }, [finishRecording, isHost, recordingState, roomCode, socket]);

  return { recordingState, recordingError, isRecording: recordingState === 'recording' || recordingState === 'stopping', startRecording, stopRecording };
}
