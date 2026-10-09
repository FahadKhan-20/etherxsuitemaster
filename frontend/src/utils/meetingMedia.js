export function deviceConstraint(id) {
  return id && id !== 'default' ? { deviceId: { exact: id } } : true;
}

// Capture each kind independently: a missing camera must not disable a usable microphone.
export async function acquireMeetingMedia({ devices = {}, audio = true, video = true } = {}) {
  const tracks = [], failures = [];
  if (!navigator.mediaDevices?.getUserMedia) return { stream: new MediaStream(), error: 'Camera and microphone require HTTPS or localhost.' };
  await Promise.all(['audio', 'video'].map(async kind => {
    if (!(kind === 'audio' ? audio : video)) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ [kind]: deviceConstraint(devices[kind]) });
      tracks.push(...stream.getTracks());
    } catch (error) {
      const label = kind === 'audio' ? 'Microphone' : 'Camera';
      failures.push(`${label}: ${error.name === 'NotAllowedError' ? 'permission denied' : error.name === 'NotFoundError' ? 'device not found' : 'could not connect'}. You can still join without it.`);
    }
  }));
  return { stream: new MediaStream(tracks), error: failures.join(' ') };
}

export async function listMeetingDevices() {
  const devices = await navigator.mediaDevices?.enumerateDevices?.() || [];
  return { cameras: devices.filter(d => d.kind === 'videoinput'), microphones: devices.filter(d => d.kind === 'audioinput'), speakers: devices.filter(d => d.kind === 'audiooutput') };
}

export async function setAudioOutput(element, deviceId = 'default') {
  if (element?.setSinkId) await element.setSinkId(deviceId);
  else if (deviceId !== 'default') throw new Error('This browser supports only the default speaker.');
}

export async function playSpeakerTest(deviceId = 'default') {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    if (ctx.setSinkId) await ctx.setSinkId(deviceId);
    else if (deviceId !== 'default') throw new Error('Speaker selection is unavailable in this browser.');
    await ctx.resume();
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain).connect(ctx.destination);
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    await new Promise(resolve => { osc.onended = resolve; osc.start(); osc.stop(ctx.currentTime + 0.4); });
  } finally { await ctx.close(); }
}
