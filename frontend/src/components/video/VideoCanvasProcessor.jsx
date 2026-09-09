import React, { useEffect, useRef, useState } from 'react';

export default function VideoCanvasProcessor({
  stream,
  activeFilter = 'none',
  selectedBgImage = 'none',
  mirror = true,
  className = '',
  style = {},
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const bgImageRef = useRef(null);
  const animFrameRef = useRef(null);
  const segmenterRef = useRef(null);
  const activeFilterRef = useRef(activeFilter);
  const selectedBgImageRef = useRef(selectedBgImage);
  const mirrorRef = useRef(mirror);
  const [segmenterLoaded, setSegmenterLoaded] = useState(false);

  // Keep refs in sync with latest props — no loop restart needed
  useEffect(() => { activeFilterRef.current = activeFilter; }, [activeFilter]);
  useEffect(() => { selectedBgImageRef.current = selectedBgImage; }, [selectedBgImage]);
  useEffect(() => { mirrorRef.current = mirror; }, [mirror]);

  // Load background image whenever selectedBgImage changes
  useEffect(() => {
    if (selectedBgImage && selectedBgImage !== 'none') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = selectedBgImage;
      img.onload = () => { bgImageRef.current = img; };
      img.onerror = () => { bgImageRef.current = null; };
    } else {
      bgImageRef.current = null;
    }
  }, [selectedBgImage]);

  // Load MediaPipe script once
  useEffect(() => {
    let isMounted = true;
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
  }, []);

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
          offCanvas.width = W; offCanvas.height = H;
        }

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
            ctx.drawImage(offCanvas, 0, 0, W, H);
          } else {
            // Waiting for first segmentation result
            ctx.save();
            if (isMirror) { ctx.translate(W, 0); ctx.scale(-1, 1); }
            ctx.drawImage(video, 0, 0, W, H);
            ctx.restore();
          }
        } else {
          // No effects or segmenter not ready yet
          ctx.save();
          if (isMirror) { ctx.translate(W, 0); ctx.scale(-1, 1); }
          if (hasBg) {
            // Fallback oval composite before segmenter loads
            ctx.drawImage(bgImageRef.current, 0, 0, W, H);
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(W / 2, H / 2 + H * 0.05, W * 0.35, H * 0.45, 0, 0, 2 * Math.PI);
            ctx.clip();
            ctx.drawImage(video, 0, 0, W, H);
            ctx.restore();
          } else if (isBlur) {
            const r = filter === 'blur' ? 16 : 8;
            ctx.filter = `blur(${r}px)`;
            ctx.drawImage(video, 0, 0, W, H);
            ctx.filter = 'none';
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(W / 2, H / 2 + H * 0.05, W * 0.35, H * 0.45, 0, 0, 2 * Math.PI);
            ctx.clip();
            ctx.drawImage(video, 0, 0, W, H);
            ctx.restore();
          } else {
            ctx.drawImage(video, 0, 0, W, H);
          }
          ctx.restore();
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
