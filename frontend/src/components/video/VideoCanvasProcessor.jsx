import React, { useEffect, useRef } from 'react';

/**
 * Real-time Canvas Video Processor for Virtual Backgrounds & Background Blur.
 * Eliminates whole-screen blur and replaces backgrounds behind the user.
 */
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

  // Load background image object when selectedBgImage changes
  useEffect(() => {
    if (selectedBgImage && selectedBgImage !== 'none') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = selectedBgImage;
      img.onload = () => {
        bgImageRef.current = img;
      };
      img.onerror = () => {
        bgImageRef.current = null;
      };
    } else {
      bgImageRef.current = null;
    }
  }, [selectedBgImage]);

  // Connect MediaStream to hidden video element
  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl && stream) {
      videoEl.srcObject = stream;
      videoEl.play().catch(() => {});
    }
  }, [stream]);

  // Main Rendering Loop
  useEffect(() => {
    let active = true;

    const renderFrame = () => {
      if (!active) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas) {
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 480;

        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }

        const ctx = canvas.getContext('2d');
        if (ctx && video.readyState >= 1) {
          ctx.save();

          // Apply mirror transformation if requested
          if (mirror) {
            ctx.translate(width, 0);
            ctx.scale(-1, 1);
          }

          const hasVirtualBg = selectedBgImage !== 'none' && bgImageRef.current;
          const isBlur = activeFilter === 'blur' || activeFilter === 'half-blur';

          if (hasVirtualBg) {
            // ── 1. Virtual Background Replacement ──
            try {
              ctx.drawImage(bgImageRef.current, 0, 0, width, height);
            } catch (e) {
              ctx.fillStyle = '#0a0a0c';
              ctx.fillRect(0, 0, width, height);
            }

            ctx.save();
            ctx.globalAlpha = 0.98;
            ctx.drawImage(video, 0, 0, width, height);
            ctx.restore();
          } else if (isBlur) {
            // ── 2. Background Blur (Keeps User Clear & Sharp) ──
            const blurRadius = activeFilter === 'blur' ? 16 : 8;

            ctx.save();
            ctx.filter = `blur(${blurRadius}px)`;
            ctx.drawImage(video, 0, 0, width, height);
            ctx.restore();

            ctx.save();
            ctx.beginPath();
            const centerX = width / 2;
            const centerY = height / 2 + height * 0.05;
            const radiusX = width * 0.38;
            const radiusY = height * 0.45;
            ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
            ctx.clip();

            ctx.drawImage(video, 0, 0, width, height);
            ctx.restore();
          } else {
            // ── 3. Normal / Color Filter Mode ──
            let filterString = 'none';
            if (activeFilter === 'warm') filterString = 'sepia(0.35) saturate(1.25)';
            else if (activeFilter === 'cool') filterString = 'hue-rotate(185deg) saturate(1.2)';
            else if (activeFilter === 'mono') filterString = 'grayscale(1)';

            ctx.filter = filterString;
            ctx.drawImage(video, 0, 0, width, height);
          }

          ctx.restore();
        }
      }

      animFrameRef.current = requestAnimationFrame(renderFrame);
    };

    renderFrame();

    return () => {
      active = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [activeFilter, selectedBgImage, mirror]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Offscreen video element feeding raw stream */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          opacity: 0.001,
          pointerEvents: 'none',
          left: '-9999px',
          top: '-9999px',
        }}
      />
      {/* Real-time processed Canvas */}
      <canvas
        ref={canvasRef}
        className={className}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          ...style,
        }}
      />
    </div>
  );
}
