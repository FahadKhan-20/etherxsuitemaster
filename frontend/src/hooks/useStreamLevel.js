import { useEffect, useState } from 'react';

// Measure the existing track. Never acquire a second microphone for a meter.
export function useStreamLevel(stream, enabled = true) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    setLevel(0);
    if (!enabled || !stream?.getAudioTracks().some(t => t.enabled && t.readyState === 'live')) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    let ctx;
    try { ctx = new Audio(); } catch { return; }
    const source = ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const values = new Uint8Array(analyser.fftSize);
    ctx.resume().catch(() => {});
    const timer = setInterval(() => {
      analyser.getByteTimeDomainData(values);
      const rms = Math.sqrt(values.reduce((sum, v) => sum + ((v - 128) / 128) ** 2, 0) / values.length);
      setLevel(Math.min(1, rms * 5));
    }, 100);
    return () => { clearInterval(timer); source.disconnect(); ctx.close().catch(() => {}); };
  }, [stream, enabled]);
  return level;
}
