import { useEffect, useState } from 'react';

// [tile, circle] colours for people without a readable photo, picked from their name.
const TONES = [['#0b4f73', '#1a8fd6'], ['#5b3f8c', '#9b72cb'], ['#1e5b3a', '#34a853'], ['#7a3b14', '#e8710a'], ['#6b1f4f', '#d0478f'], ['#0f5b5b', '#12a4af']];
export const nameTone = (name) => TONES[[...(name || '')].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 0) % TONES.length];

// Dominant colour of a profile photo, so a camera-off tile can match the person's avatar
// (Google's letter avatars are a flat colour behind a white letter). Results are cached per URL.
const cache = new Map();

export function dominantColor(pixels) {
  const bins = new Map();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const key = (r >> 5) << 6 | (g >> 5) << 3 | (b >> 5);
    const bin = bins.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    bin.n++; bin.r += r; bin.g += g; bin.b += b;
    bins.set(key, bin);
  }
  let best = null;
  for (const bin of bins.values()) if (!best || bin.n > best.n) best = bin;
  return best ? [best.r / best.n, best.g / best.n, best.b / best.n].map(Math.round) : null;
}

/** Resolves to [r, g, b], or null when the photo cannot be read (offline, or no CORS). */
export function avatarColor(src) {
  if (!src) return Promise.resolve(null);
  if (!cache.has(src)) {
    cache.set(src, new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.referrerPolicy = 'no-referrer';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 32;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, 32, 32);
          resolve(dominantColor(ctx.getImageData(0, 0, 32, 32).data));
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    }));
  }
  return cache.get(src);
}

/** Darker shade of an avatar colour for the tile behind it, like Meet. */
export const tileShade = ([r, g, b], amount = 0.45) => `rgb(${Math.round(r * amount)}, ${Math.round(g * amount)}, ${Math.round(b * amount)})`;

/** { tile, circle } colours for one person's camera-off view: the photo's colour when readable, else the name's. */
export function useAvatarTone(src, name) {
  const [photo, setPhoto] = useState(null);
  useEffect(() => {
    let alive = true;
    setPhoto(null);
    avatarColor(src).then((rgb) => { if (alive) setPhoto(rgb); });
    return () => { alive = false; };
  }, [src]);
  const [tile, circle] = nameTone(name);
  return photo ? { tile: tileShade(photo), circle } : { tile, circle };
}
