import { useState, useEffect } from 'react';
import apiClient from '../utils/apiClient';

export function useLiveKitToken(roomName, participantName) {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!roomName || !participantName) return;
    let cancelled = false;
    setLoading(true);
    setToken(null);
    setError(null);
    apiClient
      .post('/api/livekit/token', { roomName, participantName })
      .then((res) => { if (!cancelled) setToken(res.data.token); })
      .catch((err) => { if (!cancelled) setError(err.message ?? 'Token fetch failed'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [roomName, participantName]);

  return { token, loading, error };
}
