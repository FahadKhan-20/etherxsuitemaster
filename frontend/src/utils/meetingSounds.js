// Short in-meeting notification sounds, synthesised with Web Audio so no sound files ship.
// Voiced like a soft marimba: a rounded sine body with a quick downward pitch settle, a faint
// short-lived overtone for the mallet "tok", and fast decay. Chat-style pings are a water-drop
// "bloop" (a sine that glides up). Cues are lists of notes:
//   ['tone', frequency Hz, start s, decay s, volume 0-1]  or  ['drop', from Hz, to Hz, start s, decay s, volume]
const G4 = 392, B4 = 493.88, D5 = 587.33, E5 = 659.25, G5 = 783.99;
const CUES = {
  join: [['tone', G4, 0, 0.32, 0.9], ['tone', D5, 0.1, 0.42, 1]],
  leave: [['tone', D5, 0, 0.32, 0.9], ['tone', G4, 0.1, 0.42, 0.95]],
  message: [['drop', 520, 1040, 0, 0.16, 0.8]],
  hand: [['tone', B4, 0, 0.22, 0.75], ['tone', E5, 0.07, 0.34, 0.85]],
  share: [['tone', G4, 0, 0.22, 0.75], ['tone', B4, 0.08, 0.22, 0.8], ['tone', D5, 0.16, 0.38, 0.9]],
  knock: [['tone', G5, 0, 0.5, 0.75], ['tone', D5, 0.22, 0.7, 0.8], ['tone', G5, 1.1, 0.5, 0.6], ['tone', D5, 1.32, 0.7, 0.65]],
};
const VOLUME = 0.3;
const GAP_MS = 400;

let ctx = null, output = null;
const lastPlayed = {};

function context() {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return null;
  if (!ctx || ctx.state === 'closed') {
    ctx = new Audio();
    output = ctx.createBiquadFilter();
    output.type = 'lowpass';
    output.frequency.value = 3200;
    output.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function voice(audio, frequency, at, decay, level, glideTo) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, at);
  osc.frequency.exponentialRampToValueAtTime(glideTo, at + Math.min(0.06, decay / 2));
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  osc.connect(gain).connect(output);
  osc.start(at);
  osc.stop(at + decay + 0.02);
}

/** Play a notification cue. Bursts of the same cue (ten people joining at once) collapse into one. */
export function playMeetingSound(kind) {
  const notes = CUES[kind];
  if (!notes) return;
  const now = Date.now();
  if (now - (lastPlayed[kind] || 0) < GAP_MS) return;
  lastPlayed[kind] = now;
  try {
    const audio = context();
    if (!audio) return;
    const start = audio.currentTime + 0.01;
    for (const note of notes) {
      if (note[0] === 'drop') {
        const [, from, to, offset, decay, volume] = note;
        voice(audio, from, start + offset, decay, VOLUME * volume, to);
      } else {
        const [, frequency, offset, decay, volume] = note;
        const at = start + offset;
        voice(audio, frequency * 1.03, at, decay, VOLUME * volume, frequency); // body, settling onto pitch
        voice(audio, frequency * 3.9, at, 0.05, VOLUME * volume * 0.12, frequency * 3.9); // mallet "tok"
      }
    }
  } catch {
    // Audio is a nicety; a blocked or missing AudioContext must never break the meeting.
  }
}
