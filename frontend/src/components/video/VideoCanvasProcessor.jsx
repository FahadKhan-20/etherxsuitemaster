import React, { useEffect, useRef, useState } from 'react';

/**
 * Real-time AI Video Processor for Virtual Backgrounds & Background Blur.
 * Uses MediaPipe AI Selfie Segmentation to isolate the candidate from the background.
 * - Keeps candidate sharp, crisp, and completely unblurred.
 * - Blurs ONLY the background when "Blur" or "Half Blur" is selected.
 * - Replaces background behind the candidate with selected Virtual Background images.
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
  const segmenterRef = useRef(null);
  const [segmenterLoaded, setSegmenterLoaded] = useState(false);

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

  // Load MediaPipe SelfieSegmentation CDN script dynamically
  useEffect(() => {
    let isMounted = true;

    if (window.SelfieSegmentation) {
      if (isMounted) setSegmenterLoaded(true);
      return;
    }

    if (document.getElementById('mediapipe-selfie-script')) {
      const checkInterval = setInterval(() => {
        if (window.SelfieSegmentation) {
          clearInterval(checkInterval);
          if (isMounted) setSegmenterLoaded(true);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }

    const script = document.createElement('script');
    script.id = 'mediapipe-selfie-script';
    script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js';
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      if (window.SelfieSegmentation && isMounted) {
        setSegmenterLoaded(true);
      }
    };
    document.body.appendChild(script);

    return () => {
      isMounted = false;
    };
  }, []);

  // Connect MediaStream to hidden video element
  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl && stream) {
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
        videoEl.play().catch(() => {});
      }
    }
  }, [stream]);

  // Initialize SelfieSegmentation instance
  useEffect(() => {
    if (!segmenterLoaded || !window.SelfieSegmentation) return;

    try {
      const selfieSegmentation = new window.SelfieSegmentation({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
      });

      selfieSegmentation.setOptions({
        modelSelection: 1, // 1 for landscape webcam
        selfieMode: false,
      });

      segmenterRef.current = selfieSegmentation;
    } catch (e) {
      console.error('SelfieSegmentation init error:', e);
    }

    return () => {
      if (segmenterRef.current) {
        try {
          segmenterRef.current.close();
        } catch (e) {}
        segmenterRef.current = null;
      }
    };
  }, [segmenterLoaded]);

  // Main Rendering Loop
  useEffect(() => {
    let active = true;
    let isProcessing = false;
    let latestResults = null;

    const offCanvas = document.createElement('canvas');
    const offCtx = offCanvas.getContext('2d');

    const renderFrame = async () => {
      if (!active) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState >= 2 && video.videoWidth > 0) {
        const width = video.videoWidth;
        const height = video.videoHeight;

        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
          offCanvas.width = width;
          offCanvas.height = height;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          const hasVirtualBg = selectedBgImage !== 'none' && bgImageRef.current;
          const isBlur = activeFilter === 'blur' || activeFilter === 'half-blur';

          if (segmenterRef.current && (hasVirtualBg || isBlur)) {
            // AI Selfie Segmentation frame processing
            if (!isProcessing) {
              isProcessing = true;
              segmenterRef.current.onResults((results) => {
                latestResults = results;
                isProcessing = false;
              });
              segmenterRef.current.send({ image: video }).catch(() => {
                isProcessing = false;
              });
            }

            if (latestResults) {
              const { segmentationMask, image } = latestResults;

              // 1. Isolate sharp candidate on offscreen canvas
              offCtx.save();
              offCtx.clearRect(0, 0, width, height);
              if (mirror) {
                offCtx.translate(width, 0);
                offCtx.scale(-1, 1);
              }
              offCtx.drawImage(image, 0, 0, width, height);
              offCtx.globalCompositeOperation = 'destination-in';
              offCtx.drawImage(segmentationMask, 0, 0, width, height);
              offCtx.restore();

              // 2. Render background on main canvas
              ctx.save();
              ctx.clearRect(0, 0, width, height);

              if (hasVirtualBg) {
                // Render selected Virtual Background Image
                ctx.drawImage(bgImageRef.current, 0, 0, width, height);
              } else if (isBlur) {
                // Blur ONLY background
                const blurRadius = activeFilter === 'blur' ? 16 : 7;
                if (mirror) {
                  ctx.translate(width, 0);
                  ctx.scale(-1, 1);
                }
                ctx.filter = `blur(${blurRadius}px)`;
                ctx.drawImage(image, 0, 0, width, height);
                ctx.filter = 'none';
              }
              ctx.restore();

              // 3. Draw sharp candidate over background
              ctx.drawImage(offCanvas, 0, 0, width, height);
            } else {
              // Direct video draw while initial ML frame computes
              ctx.save();
              if (mirror) {
                ctx.translate(width, 0);
                ctx.scale(-1, 1);
              }
              ctx.drawImage(video, 0, 0, width, height);
              ctx.restore();
            }
          } else {
            // Fallback before ML segmenter loads, or for standard video / color filters
            ctx.save();
            if (mirror) {
              ctx.translate(width, 0);
              ctx.scale(-1, 1);
            }

            if (hasVirtualBg) {
              ctx.drawImage(bgImageRef.current, 0, 0, width, height);
              ctx.save();
              ctx.beginPath();
              ctx.ellipse(width / 2, height / 2 + height * 0.05, width * 0.35, height * 0.45, 0, 0, 2 * Math.PI);
              ctx.clip();
              ctx.drawImage(video, 0, 0, width, height);
              ctx.restore();
            } else if (isBlur) {
              const blurRadius = activeFilter === 'blur' ? 16 : 8;
              ctx.save();
              ctx.filter = `blur(${blurRadius}px)`;
              ctx.drawImage(video, 0, 0, width, height);
              ctx.restore();

              ctx.save();
              ctx.beginPath();
              ctx.ellipse(width / 2, height / 2 + height * 0.05, width * 0.35, height * 0.45, 0, 0, 2 * Math.PI);
              ctx.clip();
              ctx.drawImage(video, 0, 0, width, height);
              ctx.restore();
            } else {
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
      }

      if (active) {
        animFrameRef.current = requestAnimationFrame(renderFrame);
      }
    };

    renderFrame();

    return () => {
      active = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [activeFilter, selectedBgImage, mirror, segmenterLoaded]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
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
