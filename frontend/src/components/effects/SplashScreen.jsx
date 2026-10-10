import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import etherxLogo from '../../assets/etherx_transparent.png';

export default function SplashScreen({ onComplete }) {
  const [visible, setVisible] = useState(true);
  const videoRef = useRef(null);

  const handleFinish = () => {
    setVisible(false);
    setTimeout(() => {
      if (onComplete) onComplete();
    }, 400);
  };

  useEffect(() => {
    // Fallback auto-dismiss after 6 seconds if video is long or stuck
    const timer = setTimeout(() => {
      handleFinish();
    }, 6000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.03 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'var(--c-000000)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {/* Background Video */}
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            onEnded={handleFinish}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              zIndex: 1,
            }}
          >
            <source src="/splash.mp4" type="video/mp4" />
            <source src="/bg-animation.mp4" type="video/mp4" />
          </video>

          {/* Dark Overlay Vignette */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at center, color-mix(in srgb, var(--c-000000) 30%, transparent) 0%, color-mix(in srgb, var(--c-000000) 85%, transparent) 100%)',
              zIndex: 2,
            }}
          />

          {/* Center Brand Overlay */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            style={{
              position: 'relative',
              zIndex: 3,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 16,
              padding: '0 20px',
            }}
          >
            <img
              src={etherxLogo}
              alt="EtherX Meet"
              style={{
                width: 'clamp(140px, 30vw, 220px)',
                height: 'auto',
                filter: 'drop-shadow(0 0 30px rgba(212,175,55,0.4))',
              }}
            />

            <button
              onClick={handleFinish}
              style={{
                marginTop: 24,
                background: 'linear-gradient(135deg, var(--c-d4af37) 0%, var(--c-b8860b) 100%)',
                color: 'var(--t-000000)',
                border: 'none',
                padding: '12px 28px',
                borderRadius: '30px',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                letterSpacing: '0.04em',
                boxShadow: '0 4px 20px rgba(212,175,55,0.35)',
                transition: 'transform 0.2s, boxShadow 0.2s',
              }}
              onMouseEnter={(e) => (e.target.style.transform = 'scale(1.04)')}
              onMouseLeave={(e) => (e.target.style.transform = 'scale(1)')}
            >
              Enter Application →
            </button>
          </motion.div>

          {/* Top-Right Skip Button */}
          <button
            onClick={handleFinish}
            style={{
              position: 'absolute',
              top: 24,
              right: 24,
              zIndex: 4,
              background: 'color-mix(in srgb, var(--c-000000) 60%, transparent)',
              color: 'color-mix(in srgb, var(--t-ffffff) 80%, transparent)',
              border: '1px solid color-mix(in srgb, var(--c-ffffff) 15%, transparent)',
              padding: '8px 18px',
              borderRadius: '20px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
            }}
          >
            Skip Intro
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
