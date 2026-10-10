import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { playMeetingSound } from '../src/utils/meetingSounds';

class FakeAudioContext {
  static oscillators = [];
  state = 'running';
  currentTime = 0;
  destination = {};
  createOscillator() { const osc = { frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (n) => n, start: vi.fn(), stop: vi.fn() }; FakeAudioContext.oscillators.push(osc); return osc; }
  createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (n) => n }; }
  createBiquadFilter() { return { frequency: {}, connect: (n) => n }; }
  createDelay() { return { delayTime: {}, connect: (n) => n }; }
  resume() { return Promise.resolve(); }
}

describe('meeting notification sounds', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(10_000); FakeAudioContext.oscillators = []; window.AudioContext = FakeAudioContext; });
  afterEach(() => { vi.useRealTimers(); delete window.AudioContext; });

  it('plays each note of a cue and collapses bursts of the same cue', () => {
    playMeetingSound('join');
    playMeetingSound('join');
    const perJoin = FakeAudioContext.oscillators.length;
    expect(perJoin).toBeGreaterThan(0);
    expect(FakeAudioContext.oscillators.every((osc) => osc.start.mock.calls.length === 1)).toBe(true);
    vi.setSystemTime(10_500);
    playMeetingSound('join');
    expect(FakeAudioContext.oscillators).toHaveLength(perJoin * 2);
    playMeetingSound('message');
    expect(FakeAudioContext.oscillators.length).toBeGreaterThan(perJoin * 2);
  });

  it('ignores unknown cues and browsers without Web Audio', () => {
    playMeetingSound('nope');
    delete window.AudioContext;
    vi.setSystemTime(20_000);
    expect(() => playMeetingSound('leave')).not.toThrow();
    expect(FakeAudioContext.oscillators).toHaveLength(0);
  });
});
