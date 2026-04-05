import { useState, useEffect, useCallback, useRef } from 'react';
import { API_ENDPOINTS, buildApiUrl } from '../config/api';

export const useChatSessions = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inFlightRef = useRef(0);
  const manualAbortRef = useRef(null);

  const beginFetch = useCallback(() => {
    inFlightRef.current += 1;
    setLoading(true);
  }, []);

  const endFetch = useCallback(() => {
    inFlightRef.current = Math.max(0, inFlightRef.current - 1);
    if (inFlightRef.current === 0) {
      setLoading(false);
    }
  }, []);

  const loadSessions = useCallback(async (signal) => {
    const url = buildApiUrl(API_ENDPOINTS.CHAT_SESSIONS);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.sessions || [];
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;

    beginFetch();
    setError(null);
    loadSessions(ac.signal)
      .then((list) => {
        if (cancelled) return;
        setSessions(list);
      })
      .catch((err) => {
        if (cancelled || err.name === 'AbortError') return;
        console.error('Error fetching sessions:', err);
        setError(err.message);
        setSessions([]);
      })
      .finally(() => {
        if (!cancelled) {
          endFetch();
        }
      });

    return () => {
      cancelled = true;
      ac.abort();
      endFetch();
    };
  }, [beginFetch, endFetch, loadSessions]);

  const fetchSessions = useCallback(async () => {
    manualAbortRef.current?.abort();
    const ac = new AbortController();
    manualAbortRef.current = ac;

    beginFetch();
    setError(null);
    try {
      const list = await loadSessions(ac.signal);
      if (!ac.signal.aborted) {
        setSessions(list);
      }
    } catch (err) {
      if (err.name === 'AbortError' || ac.signal.aborted) return;
      console.error('Error fetching sessions:', err);
      setError(err.message);
      setSessions([]);
    } finally {
      if (manualAbortRef.current === ac) {
        manualAbortRef.current = null;
      }
      endFetch();
    }
  }, [beginFetch, endFetch, loadSessions]);

  const deleteSession = useCallback(async (conversationId) => {
    const url = buildApiUrl(`${API_ENDPOINTS.CHAT_SESSION_DELETE}/${conversationId}`);
    const response = await fetch(url, { method: 'DELETE' });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    await fetchSessions();
  }, [fetchSessions]);

  return {
    sessions,
    loading,
    error,
    refetch: fetchSessions,
    deleteSession,
  };
};
