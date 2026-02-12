import { useState, useCallback, useEffect } from 'react';
import { API_ENDPOINTS, buildApiUrl } from '../config/api';

export function useCharts() {
  const [charts, setCharts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const listCharts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = buildApiUrl(API_ENDPOINTS.CHARTS);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to list charts: ${response.statusText}`);
      }
      const data = await response.json();
      setCharts(data.charts || []);
      return data.charts || [];
    } catch (err) {
      setError(err.message);
      setCharts([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const saveChart = useCallback(async (title, visualization_data, call_data) => {
    setError(null);
    try {
      const url = buildApiUrl(API_ENDPOINTS.CHARTS);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          visualization_data,
          call_data,
        }),
      });
      if (!response.ok) {
        throw new Error(`Failed to save chart: ${response.statusText}`);
      }
      const saved = await response.json();
      setCharts((prev) => [saved, ...prev]);
      return saved;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const deleteChart = useCallback(async (chartId) => {
    setError(null);
    try {
      const url = buildApiUrl(`${API_ENDPOINTS.CHARTS}/${chartId}`);
      const response = await fetch(url, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(`Failed to delete chart: ${response.statusText}`);
      }
      setCharts((prev) => prev.filter((c) => c.id !== chartId));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  useEffect(() => {
    listCharts();
  }, [listCharts]);

  return {
    charts,
    loading,
    error,
    listCharts,
    saveChart,
    deleteChart,
  };
}
