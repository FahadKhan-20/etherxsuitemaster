import { afterEach, describe, expect, it, vi } from 'vitest';
import { newId } from '../src/utils/id';

describe('newId', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('works without crypto.randomUUID (phones opening the app over http on the LAN)', () => {
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: (a) => real.getRandomValues(a) });
    const ids = new Set(Array.from({ length: 50 }, () => newId()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
