// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { UserProvider } from '../src/context/UserContext';
import WorkspaceHeader from '../src/components/layout/WorkspaceHeader';
import Scheduler from '../src/components/features/Scheduler';
import { useSchedules } from '../src/hooks/useSchedules';
import apiClient from '../src/utils/apiClient';

vi.mock('../src/utils/apiClient', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() }, getApiErrorMessage: (error, fallback) => error.message || fallback }));
let roots = [], hook;
function mount(element) {
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = createRoot(container); roots.push({ root, container });
  act(() => root.render(element));
  return { root, container };
}
const settle = async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
const input = (selector, value) => act(() => { const element = document.querySelector(selector); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); });
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const entries = new Map();
  vi.stubGlobal('localStorage', { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, String(value)), removeItem: key => entries.delete(key), clear: () => entries.clear() });
  localStorage.clear();
  localStorage.setItem('nexmeet_user', JSON.stringify({ id: 'test-user', name: 'Test User', avatar: 'https://example.invalid/photo.png', timezone: 'Asia/Kolkata' }));
  vi.mocked(apiClient.get).mockReset(); vi.mocked(apiClient.post).mockReset(); vi.mocked(apiClient.delete).mockReset();
});
afterEach(() => { for (const { root, container } of roots) { act(() => root.unmount()); container.remove(); } roots = []; vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.style.overflow = ''; });

describe('shared workspace header', () => {
  it.each([['/', 'Dashboard'], ['/dashboard', 'Home']])('uses the same profile photo and navigation layout on %s', (path, destination) => {
    mount(<UserProvider><MemoryRouter initialEntries={[path]}><WorkspaceHeader /></MemoryRouter></UserProvider>);
    expect(document.querySelector('.workspace-nav-button').textContent).toBe(destination);
    expect(document.querySelector('.workspace-avatar img').src).toBe('https://example.invalid/photo.png');
    act(() => document.querySelector('.workspace-avatar img').dispatchEvent(new Event('error')));
    expect(document.querySelector('.workspace-avatar img')).toBeNull();
    expect(document.querySelector('.workspace-avatar').textContent).toBe('T');
  });
});

describe('schedule recovery', () => {
  function Probe() { hook = useSchedules(); return null; }
  it('recovers a failed load when retried and shows real schedules', async () => {
    apiClient.get.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ data: { data: { meetings: [{ _id: 'one', title: 'Saved meeting', startAt: '2027-01-01T10:00:00Z', participants: [] }] } } });
    mount(<Probe />); await settle(); expect(hook.error).toBe('Offline'); expect(hook.loading).toBe(false);
    await act(async () => hook.reload()); expect(hook.error).toBe(''); expect(hook.meetings[0].title).toBe('Saved meeting');
  });
  it('ignores a stale request that finishes after the latest retry', async () => {
    let finishOld;
    apiClient.get.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; })).mockResolvedValueOnce({ data: { data: { meetings: [{ _id: 'new', title: 'Latest' }] } } });
    mount(<Probe />); await act(async () => hook.reload());
    await act(async () => finishOld({ data: { data: { meetings: [{ _id: 'old', title: 'Stale' }] } } }));
    expect(hook.meetings.map(meeting => meeting.id)).toEqual(['new']);
  });
  it('does not lose a newly created meeting when an older load completes', async () => {
    let finishOld;
    apiClient.get.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }));
    apiClient.post.mockResolvedValue({ data: { data: { meeting: { _id: 'created', title: 'Created' } } } });
    mount(<Probe />); await act(async () => hook.create({}));
    await act(async () => finishOld({ data: { data: { meetings: [] } } }));
    expect(hook.meetings[0].id).toBe('created'); expect(hook.loading).toBe(false);
  });
});

describe('scheduler validation before requests', () => {
  it('shows timezone and inline email errors, then saves corrected input', async () => {
    const schedule = vi.fn(async () => ({ id: 'saved', roomCode: 'saved-room' }));
    mount(<UserProvider><Scheduler isOpen onClose={vi.fn()} onSchedule={schedule} /></UserProvider>);
    expect(document.querySelector('.scheduler-timezone').textContent).toContain('Asia/Kolkata');
    input('#scheduler-meeting-title', 'Planning'); input('#scheduler-date', '2099-01-10'); input('#scheduler-time', '10:00'); input('#scheduler-participants', 'bad');
    await act(async () => document.querySelector('.scheduler-save').click());
    expect(schedule).not.toHaveBeenCalled(); expect(document.querySelector('#scheduler-participants').getAttribute('aria-invalid')).toBe('true');
    input('#scheduler-participants', 'alice@example.com');
    await act(async () => document.querySelector('.scheduler-save').click());
    expect(schedule).toHaveBeenCalledWith(expect.objectContaining({ startAt: '2099-01-10T04:30:00.000Z', participants: ['alice@example.com'] }));
  });
});
