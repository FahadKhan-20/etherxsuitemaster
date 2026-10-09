import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../utils/apiClient';
import { useUI } from '../../context/UIContext';
import { getStoredUser } from '../../utils/auth';

const STEP_DAYS = { daily: 1, weekly: 7 };

/**
 * Next start of a scheduled meeting that has not ended yet. Repeating meetings roll forward by calendar
 * days in local time, so a 10:00 meeting stays at 10:00 across daylight-saving changes.
 */
export function nextStart(meeting, now = Date.now()) {
  const start = new Date(meeting.startAt);
  const length = meeting.duration * 60000;
  const step = STEP_DAYS[meeting.recurring];
  if (step && start.getTime() + length < now) {
    const skip = Math.max(0, Math.floor((now - start.getTime()) / (step * 86400000)) - 1);
    start.setDate(start.getDate() + skip * step);
    while (start.getTime() + length < now) start.setDate(start.getDate() + step);
  }
  return start.getTime() + length < now ? null : start.getTime();
}

/**
 * Reminds the signed-in user about their scheduled meetings while the app is open, using their
 * account's reminder setting. Each occurrence is announced once per browser.
 */
export default function MeetingReminders() {
  const { addToast } = useUI();
  const navigate = useNavigate();
  // addToast/navigate change identity between renders; keep the timers running regardless.
  const actions = useRef({ addToast, navigate });
  actions.current = { addToast, navigate };

  useEffect(() => {
    const userId = getStoredUser()?.id;
    if (!userId) return undefined;
    let state = { meetings: [], reminders: { enabled: true, minutes: 15 } };
    let stopped = false;

    const load = async () => {
      try {
        const [me, schedules] = await Promise.all([apiClient.get('/api/auth/me'), apiClient.get('/api/schedules')]);
        state = { meetings: schedules.data?.data?.meetings || [], reminders: { enabled: true, minutes: 15, ...me.data?.data?.user?.preferences?.reminders } };
      } catch { /* keep the last known list; retried on the next refresh */ }
    };
    const check = () => {
      if (stopped || !state.reminders.enabled) return;
      const now = Date.now();
      for (const meeting of state.meetings) {
        const start = nextStart(meeting, now);
        if (start === null || start - now > state.reminders.minutes * 60000 || start < now) continue;
        const key = `etherx_reminded:${userId}:${meeting._id}:${start}`;
        try { if (localStorage.getItem(key)) continue; localStorage.setItem(key, '1'); } catch { /* storage unavailable */ }
        const when = new Date(start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        actions.current.addToast(`“${meeting.title}” starts at ${when}.`, 'info', 10000);
        if ('Notification' in window && Notification.permission === 'granted') {
          const note = new Notification(`${meeting.title} starts at ${when}`, { body: 'Open EtherX Meet to join.', tag: key });
          note.onclick = () => { window.focus(); sessionStorage.setItem('etherx_host_room', meeting.roomCode); actions.current.navigate(`/room/${meeting.roomCode}`); };
        }
      }
    };

    load().then(check);
    const refresh = setInterval(load, 5 * 60000);
    const tick = setInterval(check, 30000);
    return () => { stopped = true; clearInterval(refresh); clearInterval(tick); };
  }, []);

  return null;
}
