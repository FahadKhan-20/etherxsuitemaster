export async function copyMeetingText(text) {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return; }
    catch { /* Browser permissions can block the modern clipboard API; try the selection fallback. */ }
  }
  const input = document.createElement('textarea');
  input.value = text; input.style.position = 'fixed'; input.style.opacity = '0';
  document.body.appendChild(input); input.select();
  try { if (!document.execCommand('copy')) throw new Error('Clipboard unavailable'); }
  finally { input.remove(); }
}
