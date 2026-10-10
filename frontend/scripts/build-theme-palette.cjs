#!/usr/bin/env node
// One-off migration: rewrites hard-coded colours under src/ into theme tokens and writes
// src/styles/theme-palette.css. Every colour keeps its exact value in dark mode; light mode
// values follow the EtherX ivory/charcoal/gold palette.
//   --c-<hex>  colour used as a surface, border, fill or shadow
//   --t-<hex>  colour used as text or an icon stroke (darker in light mode, for contrast)
// Usage: node scripts/build-theme-palette.cjs        (run from frontend/)
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../src');
const OUT = path.join(SRC, 'styles/theme-palette.css');
// Canvas drawing, user-picked colours and avatar tones must keep literal values.
const SKIP = [/\/Whiteboard\//, /ColorPicker\.jsx$/, /VideoCanvasProcessor\.jsx$/, /VirtualVideoCanvas\.jsx$/,
  /AudioVisualizer\.jsx$/, /GoldGlitter\.jsx$/, /useMeetingRecording\.js$/, /meetingBackgrounds\.js$/,
  /context\/UserContext\.jsx$/, /effects\/SplashScreen\.jsx$/, /splash-screen\.css$/, /ui\/GoogleMark\.jsx$/, /brand\/EtherXLogo\.jsx$/, /utils\/avatarTone\.js$/, /utils\/theme\.js$/, /\/data\//,
  /components\/ui\/dist\//, /styles\/theme-palette\.css$/];
// Same colour in both themes: dark text on gold, video letterbox.
const FIXED = new Set(['1a1608', '1a1405', '050504']);

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(css|jsx|js)$/.test(entry.name) && !SKIP.some((re) => re.test(full))) files.push(full);
  }
})(SRC);

const used = { c: new Set(), t: new Set(), s: new Set() };
const hex6 = (h) => (h.length === 3 ? h.split('').map((c) => c + c).join('') : h).toLowerCase();
const toHex = (r, g, b) => [r, g, b].map((v) => Number(v).toString(16).padStart(2, '0')).join('');

function hsl(hex) {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [43, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
function fromHsl(h, s, l) {
  const a = s * Math.min(l, 1 - l), f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return '#' + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}
const lerp = (points, x) => {
  for (let i = 1; i < points.length; i++) if (x <= points[i][0]) {
    const [x0, y0] = points[i - 1], [x1, y1] = points[i];
    return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return points.at(-1)[1];
};
const SURFACE_L = [[0, 0.955], [0.05, 0.955], [0.085, 0.995], [0.11, 0.95], [0.14, 0.88], [0.2, 0.82], [0.3, 0.74], [0.5, 0.55], [0.7, 0.35], [0.9, 0.18], [1, 0.1]];

function lightSurface(hex) {
  if (FIXED.has(hex)) return '#' + hex;
  const [h, s, l] = hsl(hex);
  if (s >= 0.45 && l >= 0.25 && l <= 0.85) return '#' + hex; // brand gold, red, green fills stay
  const neutral = s < 0.05;
  return fromHsl(neutral ? 43 : h, neutral ? 0.22 : Math.min(0.45, s * 0.6 + 0.15), lerp(SURFACE_L, l));
}
function lightText(hex) {
  if (FIXED.has(hex)) return '#' + hex;
  const [h, s, l] = hsl(hex);
  if (l < 0.3) return '#' + hex; // dark text only appears on light accents (gold buttons)
  if (s >= 0.45) return fromHsl(h, s, Math.min(l, 0.36)); // gold/red/green text darkens for ivory
  return fromHsl(s < 0.05 ? 43 : h, 0.25, Math.max(0.12, Math.min(0.46, 0.98 - l * 0.95)));
}

const TEXT_KEYS = /^(color|textColor|caretColor|caret-color|WebkitTextFillColor|-webkit-text-fill-color|fill|stroke|fg|[a-z]+Fg|capColor|check)$/;
// Colours read by canvas, image data URLs or libraries (QR codes) cannot use CSS variables.
const LITERAL = /(fillStyle|strokeStyle|shadowColor)\s*=\s*['"`][^'"`]*$|addColorStop\([^)]*$|data:image[^'"`]*$|^\s*(dark|light)\s*:\s*['"]$/;
function roleAt(text, index) {
  const before = text.slice(Math.max(0, index - 80), index);
  const line = text.slice(text.lastIndexOf('\n', index - 1) + 1, index);
  if (LITERAL.test(line) || LITERAL.test(line.split(/[{,]/).pop())) return null;
  if (/text-\[$/.test(before) || /(stroke|fill)=\{?["']?$/.test(before) || /\.color\s*=\s*['"]$/.test(before)) return 't';
  // "prop: value ... <here>" in CSS, or "prop": "<here>" in a JSX style object or JS colour map
  const m = before.split(/[;{},]/).pop().match(/^\s*["']?([-\w]+)["']?\s*:/);
  return m && TEXT_KEYS.test(m[1]) ? 't' : 'c';
}
// the last "prop:" before this point whose value runs up to it (values may contain commas, e.g. layered shadows)
const propAt = (text, index) => (text.slice(Math.max(0, index - 200), index).match(/["']?([-\w]+)["']?\s*:\s*[^:;{}]*$/) || [])[1] || '';
const isShadow = (text, index) => /shadow|filter/i.test(propAt(text, index)) || /(shadow|drop-shadow)[-_\w]*\[[^\]]*$/.test(text.slice(Math.max(0, index - 200), index));

function textUsesOfConstants(text) {
  for (const [, name, hex] of text.matchAll(/const ([A-Z][A-Z_0-9]*)\s*=\s*'var\(--c-([0-9a-f]{6})\)'/g)) {
    text = text.replace(new RegExp(`\\b(color|fill|stroke)(\\s*[:=]\\s*\\{?\\s*)${name}\\b`, 'g'), (m, prop, sep) => {
      used.t.add(hex);
      return `${prop}${sep}'var(--t-${hex})'`;
    });
  }
  return text;
}

function convert(text) {
  // rgba(): text, neutral lines and dark surfaces follow the theme; black shadows soften; tinted glows stay.
  text = text.replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/g, (match, r, g, b, a, offset) => {
    const hex = toHex(r, g, b);
    const [, s] = hsl(hex);
    const black = r === '0' && g === '0' && b === '0';
    let role = roleAt(text, offset);
    if (!role) return match;
    if (black) role = isShadow(text, offset) ? 's' : 'c'; // black shadows soften in light; black fills follow the theme
    else if (role === 'c' && s >= 0.45) return match; // tinted glows and fills stay; text and neutral lines follow the theme
    used[role].add(hex);
    const mix = `color-mix(in srgb, var(--${role}-${hex}) ${Math.round(parseFloat(a) * 1000) / 10}%, transparent)`;
    // inside a Tailwind arbitrary value (bg-[...]) spaces must be underscores
    return text.slice(Math.max(0, offset - 200), offset).split(/[\s"'`]/).pop().includes('[') ? mix.replace(/, /g, ',').replace(/ /g, '_') : mix;
  });
  return text.replace(/(?<![&\w])#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F\w])/g, (match, h, offset) => {
    const hex = hex6(h);
    const role = roleAt(text, offset);
    if (!role) return match;
    used[role].add(hex);
    return `var(--${role}-${hex})`;
  });
}

let changed = 0;
for (const file of files) {
  const before = fs.readFileSync(file, 'utf8');
  for (const [, role, hex] of before.matchAll(/var\(--([cts])-([0-9a-f]{6})\)/g)) used[role].add(hex); // already converted
  const after = textUsesOfConstants(convert(before));
  if (after !== before) { fs.writeFileSync(file, after); changed++; }
}

const sorted = (set) => [...set].sort();
const lines = ['/* Generated by scripts/build-theme-palette.cjs. Dark values are the original EtherX colours. */', ':root {'];
for (const role of ['c', 't', 's']) for (const hex of sorted(used[role])) lines.push(`  --${role}-${hex}: #${hex};`);
lines.push('}', ':root[data-theme="light"] {',
  '  /* Tailwind palette colours used for text, lines and overlays */',
  '  --color-white: #2a2415;', '  --color-black: #f7f5ef;', '  --color-gray-300: #4a4030;', '  --color-gray-400: #6b6150;', '  --color-gray-500: #7a6f58;');
for (const hex of sorted(used.c)) lines.push(`  --c-${hex}: ${lightSurface(hex)};`);
for (const hex of sorted(used.t)) lines.push(`  --t-${hex}: ${lightText(hex)};`);
for (const hex of sorted(used.s)) lines.push(`  --s-${hex}: rgb(70 55 25 / 0.22);`); // soft warm shadow
lines.push('}', '');
fs.writeFileSync(OUT, lines.join('\n'));
console.log(`rewrote ${changed} files; ${used.c.size} surface + ${used.t.size} text + ${used.s.size} shadow tokens -> ${path.relative(process.cwd(), OUT)}`);
