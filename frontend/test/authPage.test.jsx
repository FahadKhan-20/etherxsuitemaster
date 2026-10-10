// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthPage from '../src/pages/AuthPage';
import apiClient from '../src/utils/apiClient';

vi.mock('../src/utils/apiClient', () => ({
  default: { post: vi.fn() },
  getApiErrorMessage: (error, fallback) => error.response?.data?.message || fallback,
}));

let roots = [];
function mount(path) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push({ root, container });
  act(() => root.render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<AuthPage mode="signin" />} />
        <Route path="/register" element={<AuthPage mode="signup" />} />
        <Route path="/" element={<p id="home">home</p>} />
      </Routes>
    </MemoryRouter>,
  ));
}
const $ = (selector) => document.querySelector(selector);
const type = (placeholder, value) => act(() => {
  const el = $(`input[placeholder="${placeholder}"]`);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
const click = (selector) => act(() => { $(selector).click(); });
const submit = async () => act(async () => { $('.exm-auth-submit').click(); await Promise.resolve(); });
const errorText = () => $('.exm-auth-error')?.textContent;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const entries = new Map();
  vi.stubGlobal('localStorage', { getItem: (k) => entries.get(k) ?? null, setItem: (k, v) => entries.set(k, String(v)), removeItem: (k) => entries.delete(k), clear: () => entries.clear() });
  vi.mocked(apiClient.post).mockReset();
});
afterEach(() => {
  for (const { root, container } of roots) { act(() => root.unmount()); container.remove(); }
  roots = [];
  vi.unstubAllGlobals();
});

describe('create account', () => {
  it('checks name, password strength and terms before calling the server, then signs in', async () => {
    mount('/register');
    await submit();
    expect(errorText()).toBe('Enter your name.');
    type('Full name', 'Vinay Gk'); type('Email', 'v@example.com'); type('Password', 'short');
    await submit();
    expect(errorText()).toMatch(/at least 8 characters/);
    type('Password', 'Passw0rd99');
    await submit();
    expect(errorText()).toBe('Please accept the Terms to continue.');
    expect(apiClient.post).not.toHaveBeenCalled();

    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: { token: 'jwt', user: { _id: 'u1', name: 'Vinay Gk', email: 'v@example.com' } } } });
    click('.exm-auth-tick');
    await submit();
    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/register', { name: 'Vinay Gk', email: 'v@example.com', password: 'Passw0rd99' });
    expect(localStorage.getItem('nexmeet_token')).toBe('jwt');
    expect($('#home')).not.toBeNull();
  });
});

describe('sign in', () => {
  it('shows the server error, then signs in and remembers the email', async () => {
    mount('/login');
    type('Email', 'v@example.com'); type('Password', 'wrong');
    vi.mocked(apiClient.post).mockRejectedValueOnce({ response: { data: { message: 'Invalid credentials' } } });
    await submit();
    expect(errorText()).toBe('Invalid credentials');
    expect($('#home')).toBeNull();

    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { success: true, data: { token: 'jwt', user: { _id: 'u1', name: 'Vinay Gk' } } } });
    click('.exm-auth-check[aria-pressed]');
    type('Password', 'Passw0rd99');
    await submit();
    expect(apiClient.post).toHaveBeenLastCalledWith('/api/auth/login', { email: 'v@example.com', password: 'Passw0rd99' });
    expect(localStorage.getItem('etherxmeet_remember_email')).toBe('v@example.com');
    expect($('#home')).not.toBeNull();
  });

  it('sends a password reset link for the typed email', async () => {
    mount('/login');
    const forgot = () => [...document.querySelectorAll('.exm-auth-link-muted')].at(-1);
    await act(async () => { forgot().click(); });
    expect(errorText()).toBe('Enter your email first.');
    type('Email', 'v@example.com');
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true } });
    await act(async () => { forgot().click(); await Promise.resolve(); });
    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/forgot-password', { email: 'v@example.com' });
    expect(forgot().textContent).toBe('Reset link sent');
  });
});
