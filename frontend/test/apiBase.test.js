import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBase } from '../src/utils/apiBase';

const at = (url) => vi.stubGlobal('location', new URL(url));
describe('apiBase', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('uses the configured localhost backend on this computer', () => {
    at('http://localhost:3000/recordings');
    expect(apiBase('http://localhost:5000/')).toBe('http://localhost:5000');
  });
  it('goes through the page origin (Vite proxy) when a phone opens the LAN address', () => {
    at('http://10.139.165.55:3000/recordings');
    expect(apiBase('http://localhost:5000')).toBe('http://10.139.165.55:3000');
  });
  it('keeps a real deployed API URL and falls back to the page origin when unset', () => {
    at('http://10.139.165.55:3000/');
    expect(apiBase('https://api.etherx.example')).toBe('https://api.etherx.example');
    expect(apiBase('')).toBe('http://10.139.165.55:3000');
  });
});
