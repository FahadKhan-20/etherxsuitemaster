import { describe, it, expect } from 'vitest';
import { dominantColor, tileShade } from '../src/utils/avatarTone';

const pixels = (...runs) => new Uint8ClampedArray(runs.flatMap(([count, rgba]) => Array.from({ length: count }, () => rgba).flat()));

describe('avatar tile colour', () => {
  it('picks the letter avatar background, not the white letter or transparent corners', () => {
    const google = pixels([70, [26, 115, 232, 255]], [20, [255, 255, 255, 255]], [40, [0, 0, 0, 0]]);
    expect(dominantColor(google)).toEqual([26, 115, 232]);
  });

  it('darkens the colour for the tile and returns null for an empty image', () => {
    expect(tileShade([200, 100, 50])).toBe('rgb(90, 45, 23)');
    expect(dominantColor(pixels([4, [9, 9, 9, 0]]))).toBe(null);
  });
});
