import { useState, useEffect, useRef, useCallback } from 'react';
import { acquireMeetingMedia, deviceConstraint, listMeetingDevices } from '../utils/meetingMedia';

/** Lobby camera and microphone. Both start off, like joining a call muted with the camera off. */
export function useMediaDevices({ initialDevices = {}, audio = false, video = false } = {}) {
  const [stream, setStream] = useState(null);
  const streamRef = useRef(null), requestIdRef = useRef(0);
  const pendingPermissionRef = useRef(null);
  const captureIdsRef = useRef({ audio: 0, video: 0 });
  const pendingCaptureRef = useRef({ audio: false, video: false });
  const enabledRef = useRef({ audio, video });
  const [devices, setDevices] = useState({ cameras: [], microphones: [], speakers: [] });
  const [selectedDevices, setSelectedDevices] = useState(initialDevices);
  const selectedRef = useRef(initialDevices);
  const [isVideoEnabled, setIsVideoEnabled] = useState(video);
  const [isAudioEnabled, setIsAudioEnabled] = useState(audio);
  const [error, setError] = useState('');
  const videoRef = useRef(null);

  const enumerateDevices = useCallback(async () => {
    try { setDevices(await listMeetingDevices()); } catch { /* Device list is optional. */ }
  }, []);
  const stopStream = useCallback(() => {
    requestIdRef.current++;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setStream(null);
  }, []);
  const releaseStream = useCallback(() => {
    // Transfer ownership to the call. Lobby cleanup must not stop these tracks.
    requestIdRef.current++;
    const current = streamRef.current;
    streamRef.current = null;
    setStream(null);
    return current;
  }, []);
  const requestPermission = useCallback(async () => {
    const id = ++requestIdRef.current;
    pendingPermissionRef.current = id;
    const result = await acquireMeetingMedia({ devices: selectedRef.current, audio: true, video: enabledRef.current.video });
    if (id !== requestIdRef.current) { result.stream.getTracks().forEach(t => t.stop()); return; }
    pendingPermissionRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    result.stream.getTracks().forEach(track => {
      if (track.kind === 'video' && !enabledRef.current.video) {
        result.stream.removeTrack(track); track.stop();
      } else track.enabled = enabledRef.current[track.kind];
    });
    streamRef.current = result.stream;
    setStream(result.stream);
    enabledRef.current = {
      video: result.stream.getVideoTracks().some(track => track.enabled),
      audio: result.stream.getAudioTracks().some(track => track.enabled),
    };
    setIsVideoEnabled(enabledRef.current.video);
    setIsAudioEnabled(enabledRef.current.audio);
    setError(result.error);
    await enumerateDevices();
  }, [enumerateDevices]);
  const toggleKind = useCallback(async kind => {
    const current = streamRef.current;
    const track = current?.getTracks().find(t => t.kind === kind && t.readyState === 'live');
    if (track) {
      if (kind === 'video') {
        captureIdsRef.current.video++;
        current.getVideoTracks().forEach(t => { current.removeTrack(t); t.stop(); });
        enabledRef.current.video = false;
        setIsVideoEnabled(false);
        setStream(new MediaStream(current.getTracks()));
      } else {
        track.enabled = !track.enabled;
        enabledRef.current.audio = track.enabled;
        setIsAudioEnabled(track.enabled);
      }
    } else if (pendingPermissionRef.current === requestIdRef.current || pendingCaptureRef.current[kind]) {
      // Keep fast prejoin choices while the browser permission request is still pending.
      enabledRef.current[kind] = !enabledRef.current[kind];
      (kind === 'video' ? setIsVideoEnabled : setIsAudioEnabled)(enabledRef.current[kind]);
    } else {
      const id = requestIdRef.current;
      const captureId = ++captureIdsRef.current[kind];
      pendingCaptureRef.current[kind] = captureId;
      enabledRef.current[kind] = true;
      (kind === 'video' ? setIsVideoEnabled : setIsAudioEnabled)(true);
      try {
        const extra = await navigator.mediaDevices.getUserMedia({ [kind]: deviceConstraint(selectedRef.current[kind]) });
        if (id !== requestIdRef.current || captureId !== captureIdsRef.current[kind] || !enabledRef.current[kind]) { extra.getTracks().forEach(t => t.stop()); return; }
        const target = streamRef.current || new MediaStream();
        extra.getTracks().forEach(t => target.addTrack(t));
        streamRef.current = target;
        setStream(new MediaStream(target.getTracks()));
        enabledRef.current[kind] = true;
        (kind === 'video' ? setIsVideoEnabled : setIsAudioEnabled)(true);
        setError('');
        await enumerateDevices();
      } catch {
        if (id !== requestIdRef.current || captureId !== captureIdsRef.current[kind]) return;
        enabledRef.current[kind] = false;
        (kind === 'video' ? setIsVideoEnabled : setIsAudioEnabled)(false);
        setError(`Could not enable ${kind === 'video' ? 'camera' : 'microphone'}. Check browser permissions.`);
      } finally {
        if (pendingCaptureRef.current[kind] === captureId) pendingCaptureRef.current[kind] = false;
      }
    }
  }, [enumerateDevices]);
  const switchDevice = useCallback(async (kind, deviceId) => {
    if (selectedRef.current[kind] === deviceId) return;
    const current = streamRef.current, id = requestIdRef.current;
    const captureId = ++captureIdsRef.current[kind];
    if (current && (kind !== 'video' || enabledRef.current.video)) {
      const extra = await navigator.mediaDevices.getUserMedia({ [kind]: deviceConstraint(deviceId) });
      if (id !== requestIdRef.current || captureId !== captureIdsRef.current[kind] || (kind === 'video' && !enabledRef.current.video)) { extra.getTracks().forEach(t => t.stop()); return; }
      const old = current.getTracks().filter(t => t.kind === kind);
      const enabled = enabledRef.current[kind];
      old.forEach(t => { current.removeTrack(t); t.stop(); });
      extra.getTracks().forEach(t => { t.enabled = enabled; current.addTrack(t); });
      setStream(new MediaStream(current.getTracks()));
    }
    selectedRef.current = { ...selectedRef.current, [kind]: deviceId };
    setSelectedDevices(selectedRef.current);
  }, []);
  useEffect(() => {
    enumerateDevices();
    navigator.mediaDevices?.addEventListener('devicechange', enumerateDevices);
    return () => {
      requestIdRef.current++;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      navigator.mediaDevices?.removeEventListener('devicechange', enumerateDevices);
    };
  }, [enumerateDevices]);
  useEffect(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, [stream]);
  return { stream, devices, selectedDevices, error, videoRef, isVideoEnabled, isAudioEnabled, requestPermission, stopStream, releaseStream, switchDevice, toggleVideo: () => toggleKind('video'), toggleAudio: () => toggleKind('audio') };
}
