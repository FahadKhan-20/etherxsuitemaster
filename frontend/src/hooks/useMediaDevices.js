import { useState, useEffect, useRef, useCallback } from 'react';
import { acquireMeetingMedia, deviceConstraint, listMeetingDevices } from '../utils/meetingMedia';

export function useMediaDevices({ initialDevices = {} } = {}) {
  const [stream, setStream] = useState(null);
  const streamRef = useRef(null), requestIdRef = useRef(0);
  const pendingPermissionRef = useRef(null);
  const enabledRef = useRef({ audio: true, video: true });
  const [devices, setDevices] = useState({ cameras: [], microphones: [], speakers: [] });
  const [selectedDevices, setSelectedDevices] = useState(initialDevices);
  const selectedRef = useRef(initialDevices);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
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
    const result = await acquireMeetingMedia({ devices: selectedRef.current });
    if (id !== requestIdRef.current) { result.stream.getTracks().forEach(t => t.stop()); return; }
    pendingPermissionRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    result.stream.getTracks().forEach(track => { track.enabled = enabledRef.current[track.kind]; });
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
      track.enabled = !track.enabled;
      enabledRef.current[kind] = track.enabled;
      (kind === 'video' ? setIsVideoEnabled : setIsAudioEnabled)(track.enabled);
    } else if (pendingPermissionRef.current === requestIdRef.current) {
      // Keep fast prejoin choices while the browser permission request is still pending.
      enabledRef.current[kind] = !enabledRef.current[kind];
      (kind === 'video' ? setIsVideoEnabled : setIsAudioEnabled)(enabledRef.current[kind]);
    } else {
      const id = requestIdRef.current;
      try {
        const extra = await navigator.mediaDevices.getUserMedia({ [kind]: deviceConstraint(selectedRef.current[kind]) });
        if (id !== requestIdRef.current) { extra.getTracks().forEach(t => t.stop()); return; }
        const target = current || new MediaStream();
        extra.getTracks().forEach(t => target.addTrack(t));
        streamRef.current = target;
        setStream(new MediaStream(target.getTracks()));
        enabledRef.current[kind] = true;
        (kind === 'video' ? setIsVideoEnabled : setIsAudioEnabled)(true);
        setError('');
        await enumerateDevices();
      } catch { setError(`Could not enable ${kind === 'video' ? 'camera' : 'microphone'}. Check browser permissions.`); }
    }
  }, [enumerateDevices]);
  const switchDevice = useCallback(async (kind, deviceId) => {
    if (selectedRef.current[kind] === deviceId) return;
    const current = streamRef.current, id = requestIdRef.current;
    if (current) {
      const extra = await navigator.mediaDevices.getUserMedia({ [kind]: deviceConstraint(deviceId) });
      if (id !== requestIdRef.current) { extra.getTracks().forEach(t => t.stop()); return; }
      const old = current.getTracks().filter(t => t.kind === kind);
      const enabled = old.length > 0 && old[0].enabled;
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
