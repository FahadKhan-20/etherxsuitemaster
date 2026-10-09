import { describe, it, expect } from 'vitest';
import { normalizeRoomCode, isValidRoomCode } from '../src/utils/roomCode';

describe('room codes', () => {
  it('keeps hyphens and length so different codes stay different', () => {
    expect(normalizeRoomCode('weekly-review')).toBe('weekly-review');
    expect(normalizeRoomCode('etherx-ab12cd34ef')).toBe('etherx-ab12cd34ef');
    expect(normalizeRoomCode('etherx-ab12cd34eg')).not.toBe(normalizeRoomCode('etherx-ab12cd34ef'));
    expect(normalizeRoomCode(' Team Sync ')).toBe('teamsync');
    expect(normalizeRoomCode('ABC-DEFG-HIJ')).toBe('abc-defg-hij');
  });
  it('reads codes out of invite links', () => {
    expect(normalizeRoomCode('https://meet.example.com/room/weekly-review')).toBe('weekly-review');
    expect(normalizeRoomCode('http://localhost:3000/room/Etherx-AB12CD34EF?x=1')).toBe('etherx-ab12cd34ef');
    expect(normalizeRoomCode('https://meet.example.com/join?code=weekly-review')).toBe('weekly-review');
  });
  it('validates the server-supported shape', () => {
    for (const ok of ['weekly-review', 'etherx-ab12cd34ef', 'abc-defg-hij', 'team_sync']) expect(isValidRoomCode(ok)).toBe(true);
    for (const bad of ['', 'ab', 'a/b', 'x'.repeat(65), '-start']) expect(isValidRoomCode(bad)).toBe(false);
  });
});
