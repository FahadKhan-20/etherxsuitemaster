import React, { useEffect, useRef, useState } from 'react';

export default function VideoCanvasProcessor({
  stream,
  activeFilter = 'none',
  selectedBgImage = 'none',
  colorFilter,
  mirror = true,
  className = '',
  style = {},
  onOutputStream,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const bgImageRef = useRef(null);
  const animFrameRef = useRef(null);
  const segmenterRef = useRef(null);
  const activeFilterRef = useRef(activeFilter);
  const selectedBgImageRef = useRef(selectedBgImage);
  const colorFilterRef=useRef(colorFilter);
  useEffect(()=>{colorFilterRef.current=colorFilter;},[colorFilter]);
  const mirrorRef = useRef(mirror);
  const outputRef = useRef(onOutputStream); outputRef.current = onOutputStream;
  const captureRef = useRef(null);
  const [segmenterLoaded, setSegmenterLoaded] = useState(false);

  // Keep refs in sync with latest props — no loop restart needed
  useEffect(() => { activeFilterRef.current = activeFilter; }, [activeFilter]);
  useEffect(() => { selectedBgImageRef.current = selectedBgImage; }, [selectedBgImage]);
  useEffect(() => { mirrorRef.current = mirror; }, [mirror]);

  // Load background image whenever selectedBgImage changes
  useEffect(() => {
    let cancelled = false;
    bgImageRef.current = null;
    if (selectedBgImage && selectedBgImage !== 'none') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { if (!cancelled) bgImageRef.current = img; };
      img.onerror = () => { if (!cancelled) bgImageRef.current = null; };
      img.src = selectedBgImage;
    } else {
      bgImageRef.current = null;
    }
    return () => { cancelled = true; };
  }, [selectedBgImage]);

  // Load MediaPipe script once
  useEffect(() => {
    let isMounted = true;
    if (!['blur','half-blur'].includes(activeFilter) && selectedBgImage === 'none') return;
    if (window.SelfieSegmentation) { setSegmenterLoaded(true); return; }
    if (document.getElementById('mediapipe-selfie-script')) {
      const iv = setInterval(() => {
        if (window.SelfieSegmentation) { clearInterval(iv); if (isMounted) setSegmenterLoaded(true); }
      }, 100);
      return () => clearInterval(iv);
    }
    const script = document.createElement('script');
    script.id = 'mediapipe-selfie-script';
    script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js';
    script.crossOrigin = 'anonymous';
    script.onload = () => { if (window.SelfieSegmentation && isMounted) setSegmenterLoaded(true); };
    document.body.appendChild(script);
    return () => { isMounted = false; };
  }, [activeFilter, selectedBgImage]);

  // Attach stream to hidden video
  useEffect(() => {
    const v = videoRef.current;
    if (v && stream) { v.srcObject = stream; v.play().catch(() => {}); }
  }, [stream]);

  // Init segmenter once loaded
  useEffect(() => {
    if (!segmenterLoaded || !window.SelfieSegmentation) return;
    try {
      const seg = new window.SelfieSegmentation({
        locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${f}`,
      });
      seg.setOptions({ modelSelection: 1, selfieMode: false });
      segmenterRef.current = seg;
    } catch (e) { console.error('SelfieSegmentation init error:', e); }
    return () => {
      if (segmenterRef.current) { try { segmenterRef.current.close(); } catch (_) {} segmenterRef.current = null; }
    };
  }, [segmenterLoaded]);

  // Single render loop — reads all values from refs so it never goes stale
  useEffect(() => {
    let active = true;
    let isProcessing = false;
    let latestResults = null;
    const offCanvas = document.createElement('canvas');
    const offCtx = offCanvas.getContext('2d');

    if (segmenterRef.current) {
      segmenterRef.current.onResults((r) => { latestResults = r; isProcessing = false; });
    }

    const renderFrame = () => {
      if (!active) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const filter = activeFilterRef.current;
      const bgUrl = selectedBgImageRef.current;
      const isMirror = mirrorRef.current;

      if (video && canvas && video.readyState >= 2 && video.videoWidth > 0) {
        const W = video.videoWidth;
        const H = video.videoHeight;

        if (canvas.width !== W || canvas.height !== H) {
          canvas.width = W; canvas.height = H;
        }
        if (offCanvas.width !== W || offCanvas.height !== H) { offCanvas.width = W; offCanvas.height = H; }

        const ctx = canvas.getContext('2d');
        const hasBg = bgUrl !== 'none' && bgImageRef.current;
        const isBlur = filter === 'blur' || filter === 'half-blur';

        if (segmenterRef.current && (hasBg || isBlur)) {
          // Re-register callback each time segmenter is active so results stay fresh
          if (!isProcessing) {
            isProcessing = true;
            segmenterRef.current.onResults((r) => { latestResults = r; isProcessing = false; });
            segmenterRef.current.send({ image: video }).catch(() => { isProcessing = false; });
          }

          if (latestResults) {
            const { segmentationMask, image } = latestResults;

            // 1. Person on offscreen canvas
            offCtx.save();
            offCtx.clearRect(0, 0, W, H);
            if (isMirror) { offCtx.translate(W, 0); offCtx.scale(-1, 1); }
            offCtx.drawImage(image, 0, 0, W, H);
            offCtx.globalCompositeOperation = 'destination-in';
            offCtx.drawImage(segmentationMask, 0, 0, W, H);
            offCtx.restore();

            // 2. Background
            ctx.save();
            ctx.clearRect(0, 0, W, H);
            if (hasBg) {
              ctx.drawImage(bgImageRef.current, 0, 0, W, H);
            } else if (isBlur) {
              if (isMirror) { ctx.translate(W, 0); ctx.scale(-1, 1); }
              ctx.filter = `blur(${filter === 'blur' ? 16 : 7}px)`;
              ctx.drawImage(image, 0, 0, W, H);
              ctx.filter = 'none';
            }
            ctx.restore();

            // 3. Person on top
            ctx.save();
            ctx.filter = ({warm:'sepia(.35) saturate(1.2)',mono:'grayscale(1) contrast(1.1)',vivid:'saturate(1.6) contrast(1.05)',soft:'brightness(1.08) contrast(.9)'})[colorFilterRef.current||filter] || 'none';
            ctx.drawImage(offCanvas, 0, 0, W, H);
            ctx.restore();
          } else {
            // Never expose the original room while the segmentation model warms up.
            ctx.save();
            ctx.filter = `blur(${filter === "half-blur" ? 8 : 20}px)`;
            if (isMirror) { ctx.translate(W, 0); ctx.scale(-1, 1); }
            ctx.drawImage(video, 0, 0, W, H);
            ctx.restore();
          }
        } else {
          // No effects or segmenter not ready yet
          ctx.save();
          if (isMirror) { ctx.translate(W, 0); ctx.scale(-1, 1); }
          if (bgUrl !== 'none') {
            // Keep a private fallback when the model or custom image is still loading.
            ctx.fillStyle = '#172033'; ctx.fillRect(0, 0, W, H);
            if (hasBg) ctx.drawImage(bgImageRef.current, 0, 0, W, H);
          } else if (isBlur) {
            ctx.filter = `blur(${filter === 'blur' ? 20 : 8}px)`;
            ctx.drawImage(video, 0, 0, W, H);
          } else {
            ctx.filter = ({warm:'sepia(.35) saturate(1.2)',mono:'grayscale(1) contrast(1.1)',vivid:'saturate(1.6) contrast(1.05)',soft:'brightness(1.08) contrast(.9)'})[colorFilterRef.current||filter] || 'none';
            ctx.drawImage(video, 0, 0, W, H);
          }
          ctx.restore();
        }
        if (outputRef.current && !captureRef.current && canvas.captureStream) {
          captureRef.current = canvas.captureStream(20);
          outputRef.current(captureRef.current);
        }
      }

      if (active) animFrameRef.current = requestAnimationFrame(renderFrame);
    };

    renderFrame();

    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  // Only restart loop when stream or segmenter changes — props update via refs
  }, [stream, segmenterLoaded]);

  useEffect(() => () => {
    captureRef.current?.getTracks().forEach(t => t.stop());
    captureRef.current = null;
    outputRef.current?.(null);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          position: 'absolute', width: '1px', height: '1px',
          opacity: 0.001, pointerEvents: 'none',
          left: '-9999px', top: '-9999px',
        }}
      />
      <canvas
        ref={canvasRef}
        className={className}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...style }}
      />
    </div>
  );
}
