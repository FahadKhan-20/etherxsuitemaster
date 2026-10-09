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
  const completeFinish = useCallback(() => { finishWaitersRef.current.splice(0).forEach(resolve => resolve()); }, []);

  const cleanupCapture = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
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

    const render = () => {
      const videos = Array.from(videoElementsRef.current.entries());
      context.fillStyle = '#080808';
      context.fillRect(0, 0, canvas.width, canvas.height);
      const columns = videos.length <= 1 ? 1 : videos.length <= 4 ? 2 : 3;
      const rows = Math.max(1, Math.ceil(Math.max(videos.length, 1) / columns));
      const tileWidth = canvas.width / columns;
      const tileHeight = canvas.height / rows;
      videos.forEach(([key, video], index) => {
        const x = (index % columns) * tileWidth;
        const y = Math.floor(index / columns) * tileHeight;
        const hasCurrentFrame = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
          && video.videoWidth > 0 && video.videoHeight > 0;
        if (hasCurrentFrame) {
          const scale = Math.max(tileWidth / video.videoWidth, tileHeight / video.videoHeight);
          const width = video.videoWidth * scale;
          const height = video.videoHeight * scale;
          context.drawImage(video, x + (tileWidth - width) / 2, y + (tileHeight - height) / 2, width, height);
        } else {
          context.fillStyle = '#151515';
          context.fillRect(x, y, tileWidth, tileHeight);
          context.fillStyle = '#d4af37';
          context.font = 'bold 54px sans-serif';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.fillText((videoLabelsRef.current.get(key) || '?').charAt(0).toUpperCase(), x + tileWidth / 2, y + tileHeight / 2);
        }
      });
      animationFrameRef.current = requestAnimationFrame(render);
    };
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
      window.setTimeout(() => setRecordingState('idle'), 2500);
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
    Object.entries(peers || {}).forEach(([id, peer]) => { if (peer.stream) streams.set(id, peer.stream); });
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
            ? 'Screen share'
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
      if(state==='idle'&&recorderRef.current?.state==='recording')finishRecording();else setRecordingState(state || 'idle');
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
    if (!isHost || !socket || recordingState === 'recording' || recordingState === 'stopping') return;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') return;
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
