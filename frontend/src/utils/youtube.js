// YouTube links are web pages, so they are shared through YouTube's own embedded player (like Jitsi).

const ID = /^[A-Za-z0-9_-]{11}$/;

/** The 11-character video id from any common YouTube link, or null. */
export function youtubeId(value) {
  let url;
  try { url = new URL(String(value || '').trim()); } catch { return null; }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '');
  let id = null;
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = url.searchParams.get('v') || (url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/) || [])[1];
  }
  return id && ID.test(id) ? id : null;
}

let apiPromise = null;
/** Loads the YouTube IFrame Player API once and resolves with window.YT. */
export function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(window.YT); };
      const script = Object.assign(document.createElement('script'), { src: 'https://www.youtube.com/iframe_api', async: true });
      script.onerror = () => { apiPromise = null; reject(new Error('YouTube could not be loaded.')); };
      document.head.appendChild(script);
    });
  }
  return apiPromise;
}
