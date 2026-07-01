import { useRef, useState, useCallback } from 'react';

/**
 * useAudioAnalyser
 *
 * Captures the local microphone via the Web Audio API and exposes
 * a normalised volume level (0-100) plus a boolean speaking indicator.
 *
 * Usage:
 *   const { start, stop, volume, isSpeaking } = useAudioAnalyser();
 */
export function useAudioAnalyser() {
  // All mutable Web-Audio handles live in a ref so they never trigger re-renders
  const refsRef = useRef({ analyser: null, ctx: null, dataArray: null, raf: null, stream: null });
  const [volume, setVolume] = useState(0);       // 0-100
  const [isSpeaking, setIsSpeaking] = useState(false);

  /**
   * Request microphone access, build the analyser graph, and start the
   * requestAnimationFrame loop that samples frequency data each frame.
   */
  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256; // 128 frequency bins — lightweight
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      refsRef.current = { analyser, ctx, dataArray, stream, raf: null };

      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        // Average amplitude across all frequency bins
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        // Map 0-255 → 0-100
        const normalized = Math.min(100, Math.round((avg / 255) * 100));
        setVolume(normalized);
        // A threshold of 12/100 filters out background noise
        setIsSpeaking(normalized > 12);
        refsRef.current.raf = requestAnimationFrame(tick);
      };
      refsRef.current.raf = requestAnimationFrame(tick);
    } catch {
      // Permission denied or device not available — stay silent, no error UI
    }
  }, []);

  /**
   * Cancel the animation loop, stop all microphone tracks, and close
   * the AudioContext to release the device.
   */
  const stop = useCallback(() => {
    const r = refsRef.current;
    if (r.raf) cancelAnimationFrame(r.raf);
    r.stream?.getTracks().forEach(t => t.stop());
    r.ctx?.close();
    refsRef.current = { analyser: null, ctx: null, dataArray: null, raf: null, stream: null };
    setVolume(0);
    setIsSpeaking(false);
  }, []);

  return { start, stop, volume, isSpeaking };
}
