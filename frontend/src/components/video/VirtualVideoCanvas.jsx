import { useEffect, useRef, useState } from 'react';

/**
 * VirtualVideoCanvas
 * Performs real-time AI Selfie Segmentation in browser via MediaPipe.
 * - Blurs ONLY the background, keeping the candidate crisp & clear.
 * - Replaces background with virtual images (Beach, Office, Valley, Forest, or Custom URL).
 */
export default function VirtualVideoCanvas({
  stream,
  filter = 'none',
  bgImage = 'none',
  isLocal = false,
  className = '',
  style = {},
}) {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const segmenterRef = useRef(null);
  const animFrameRef = useRef(null);
  const bgImgObjRef = useRef(null);
  const [segmenterLoaded, setSegmenterLoaded] = useState(false);

  // Initialize hidden video element
  if (!videoRef.current) {
    const v = document.createElement('video');
    v.autoplay = true;
    v.playsInline = true;
    v.muted = true;
    videoRef.current = v;
  }

  // Load background image object when bgImage changes
  useEffect(() => {
    if (bgImage && bgImage !== 'none') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = bgImage;
      img.onload = () => {
        bgImgObjRef.current = img;
      };
      img.onerror = () => {
        bgImgObjRef.current = null;
      };
    } else {
      bgImgObjRef.current = null;
    }
  }, [bgImage]);

  // Load MediaPipe SelfieSegmentation CDN script if not present
  useEffect(() => {
    let isMounted = true;

    const loadMediaPipe = async () => {
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
        return;
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
    };

    loadMediaPipe();

    return () => {
      isMounted = false;
    };
  }, []);

  // Update video element source from MediaStream
  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
      video.srcObject = stream;
      video.play().catch(() => {});
    }
  }, [stream]);

  // Initialize SelfieSegmentation model
  useEffect(() => {
    if (!segmenterLoaded || !window.SelfieSegmentation) return;

    try {
      const selfieSegmentation = new window.SelfieSegmentation({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
      });

      selfieSegmentation.setOptions({
        modelSelection: 1, // 1 for landscape / webcam video
        selfieMode: false, // Handle flipping manually on canvas for local view
      });

      segmenterRef.current = selfieSegmentation;
    } catch (e) {
      console.error('SelfieSegmentation initialization error:', e);
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

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const video = videoRef.current;

    // Create offscreen canvas for foreground person mask
    const offCanvas = document.createElement('canvas');
    const offCtx = offCanvas.getContext('2d');

    let active = true;
    let isProcessing = false;
    let latestResults = null;

    // Set up segmenter callback once per loop lifecycle
    if (segmenterRef.current) {
      segmenterRef.current.onResults((results) => {
        latestResults = results;
        isProcessing = false;
      });
    }

    const render = async () => {
      if (!active) return;

      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          offCanvas.width = video.videoWidth;
          offCanvas.height = video.videoHeight;
        }

        const w = canvas.width;
        const h = canvas.height;

        const isBlur = filter === 'blur' || filter === 'half-blur';
        const isImage = bgImage && bgImage !== 'none';

        if (!isBlur && !isImage) {
          // Standard Video Rendering (No virtual background / blur)
          ctx.save();
          if (isLocal) {
            ctx.translate(w, 0);
            ctx.scale(-1, 1);
          }
          ctx.drawImage(video, 0, 0, w, h);
          ctx.restore();
        } else if (segmenterRef.current) {
          // Real-time AI Selfie Segmentation
          if (!isProcessing) {
            isProcessing = true;
            segmenterRef.current.send({ image: video }).catch(() => {
              isProcessing = false;
            });
          }

          if (latestResults) {
            const { segmentationMask, image } = latestResults;

            // 1. Isolate Person (Candidate) on offscreen canvas
            offCtx.save();
            offCtx.clearRect(0, 0, w, h);
            if (isLocal) {
              offCtx.translate(w, 0);
              offCtx.scale(-1, 1);
            }
            offCtx.drawImage(image, 0, 0, w, h);
            offCtx.globalCompositeOperation = 'destination-in';
            offCtx.drawImage(segmentationMask, 0, 0, w, h);
            offCtx.restore();

            // 2. Draw Background on main canvas
            ctx.save();
            ctx.clearRect(0, 0, w, h);

            if (isImage && bgImgObjRef.current) {
              // Draw Virtual Background Image (Beach, Office, Valley, Forest, Custom)
              ctx.drawImage(bgImgObjRef.current, 0, 0, w, h);
            } else if (isBlur) {
              // Blur ONLY Background
              const blurPx = filter === 'blur' ? 14 : 6;
              if (isLocal) {
                ctx.translate(w, 0);
                ctx.scale(-1, 1);
              }
              ctx.filter = `blur(${blurPx}px)`;
              ctx.drawImage(image, 0, 0, w, h);
              ctx.filter = 'none';
            } else {
              if (isLocal) {
                ctx.translate(w, 0);
                ctx.scale(-1, 1);
              }
              ctx.drawImage(image, 0, 0, w, h);
            }
            ctx.restore();

            // 3. Composite Crisp Candidate on Top of Background
            ctx.drawImage(offCanvas, 0, 0, w, h);
          } else {
            // Draw fallback video while first frame segmenter processes
            ctx.save();
            if (isLocal) {
              ctx.translate(w, 0);
              ctx.scale(-1, 1);
            }
            ctx.drawImage(video, 0, 0, w, h);
            ctx.restore();
          }
        } else {
          // Fallback while segmenter script is loading
          ctx.save();
          if (isLocal) {
            ctx.translate(w, 0);
            ctx.scale(-1, 1);
          }
          if (isImage && bgImgObjRef.current) {
            ctx.drawImage(bgImgObjRef.current, 0, 0, w, h);
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(w / 2, h / 2, w * 0.35, h * 0.45, 0, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(video, 0, 0, w, h);
            ctx.restore();
          } else {
            ctx.drawImage(video, 0, 0, w, h);
          }
          ctx.restore();
        }
      }

      if (active) {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      active = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [filter, bgImage, segmenterLoaded, isLocal, stream]);

  return (
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
  );
}
