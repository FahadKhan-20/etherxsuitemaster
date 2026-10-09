// One meeting-code format everywhere: lowercase, no spaces, otherwise exactly as issued.
// Never strip punctuation or shorten: "weekly-review" and "weeklyreview" are different rooms.

/** Room code from a typed code or an invite link (/room/<code> or /join?code=<code>). */
export function normalizeRoomCode(value) {
  const input = typeof value === 'string' ? value.trim() : '';
  let code = input;
  try {
    const url = new URL(input, window.location.origin);
    const roomPath = url.pathname.match(/\/room\/([^/]+)/i);
    if (roomPath) code = decodeURIComponent(roomPath[1]);
    else if (/\/join\/?$/i.test(url.pathname) && url.searchParams.get('code')) code = url.searchParams.get('code');
  } catch {
    // Not a link: treat it as a code.
  }
  return code.replace(/\s+/g, '').toLowerCase();
}

/** Codes this app issues and the server accepts in a meeting link. */
export const isValidRoomCode = (code) => /^[a-z0-9][a-z0-9_-]{2,63}$/.test(code);
