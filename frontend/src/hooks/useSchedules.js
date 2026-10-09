import { useCallback, useEffect, useState } from 'react';
import apiClient, { getApiErrorMessage } from '../utils/apiClient';

const fromServer = (m) => ({ id: m._id, title: m.title, date: m.startAt, duration: m.duration, recurring: m.recurring, participants: m.participants || [], roomCode: m.roomCode });

/** The signed-in account's scheduled meetings, stored server-side. */
export function useSchedules() {
  const [meetings, setMeetings] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiClient.get('/api/schedules')
      .then((res) => { if (!cancelled) setMeetings((res.data?.data?.meetings || []).map(fromServer)); })
      .catch((err) => { if (!cancelled) setError(getApiErrorMessage(err, 'Could not load scheduled meetings.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const create = useCallback(async (input) => {
    const res = await apiClient.post('/api/schedules', input);
    const meeting = fromServer(res.data.data.meeting);
    setMeetings((prev) => [...prev, meeting]);
    return meeting;
  }, []);

  const remove = useCallback(async (id) => {
    try {
      setError('');
      await apiClient.delete(`/api/schedules/${id}`);
      setMeetings((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not delete this meeting.'));
    }
  }, []);

  return { meetings, create, remove, error, loading };
}
