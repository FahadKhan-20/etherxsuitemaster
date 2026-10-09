// Bundled vector scenes work offline, without stock-image hotlinks.
const scene = (top, bottom, accent) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><path fill="url(#sky)" d="M0 0h1280v720H0z"/><circle cx="980" cy="170" r="88" fill="${accent}" opacity=".8"/><path d="M0 500L260 270l260 290 300-220 460 250v130H0z" fill="${bottom}" opacity=".75"/><path d="M0 610l340-130 240 155 390-180 310 180v85H0z" fill="${top}" opacity=".6"/></svg>`)}`;
export const MEETING_BACKGROUNDS = [
  { id: 'none', type: 'filter', label: 'None' },
  { id: 'half-blur', type: 'filter', label: 'Soft blur' },
  { id: 'blur', type: 'filter', label: 'Blur' },
  { id: 'studio', type: 'image', label: 'Studio', url: scene('#242d40', '#0f172a', '#d4af37') },
  { id: 'valley', type: 'image', label: 'Valley', url: scene('#80b6b0', '#234d48', '#f5e6be') },
  { id: 'sunset', type: 'image', label: 'Sunset', url: scene('#684b72', '#c57b52', '#ffe2a8') },
];
