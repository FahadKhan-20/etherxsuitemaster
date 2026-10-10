import { useCallback, useEffect, useRef, useState } from 'react';
import apiClient, { getApiErrorMessage } from '../utils/apiClient';

const fromServer = (meeting) => ({ id: meeting._id, title: meeting.title, date: meeting.startAt, duration: meeting.duration, recurring: meeting.recurring, participants: meeting.participants || [], roomCode: meeting.roomCode });

/** The signed-in account's scheduled meetings, stored server-side. */
export function useSchedules() {
  const [meetings, setMeetings] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const mounted = useRef(false);
  const requestVersion = useRef(0);

  const reload = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/schedules');
      if (mounted.current && version === requestVersion.current) {
        setMeetings((response.data?.data?.meetings || []).map(fromServer));
      }
    } catch (err) {
      if (mounted.current && version === requestVersion.current) {
        setError(getApiErrorMessage(err, 'Could not load scheduled meetings.'));
      }
    } finally {
      if (mounted.current && version === requestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    reload();
    return () => { mounted.current = false; requestVersion.current++; };
  }, [reload]);

  const create = useCallback(async (input) => {
    const response = await apiClient.post('/api/schedules', input);
    const meeting = fromServer(response.data.data.meeting);
    if (mounted.current) {
      requestVersion.current++;
      setLoading(false);
      setError('');
      setMeetings((previous) => [...previous, meeting]);
    }
    return meeting;
  }, []);

  const remove = useCallback(async (id) => {
    try {
      setError('');
      await apiClient.delete(`/api/schedules/${id}`);
      if (mounted.current) {
        requestVersion.current++;
        setLoading(false);
        setMeetings((previous) => previous.filter((meeting) => meeting.id !== id));
      }
    } catch (err) {
      if (mounted.current) setError(getApiErrorMessage(err, 'Could not delete this meeting.'));
    }
  }, []);

  return { meetings, create, remove, error, loading, reload };
}
