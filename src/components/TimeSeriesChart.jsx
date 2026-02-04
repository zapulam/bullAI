import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Brush,
} from 'recharts';

const formatTimestampLabel = (value) => {
  if (!value || typeof value !== 'string') return '';
  if (value.includes('T')) {
    return value.replace('T', ' ').replace('Z', '');
  }
  return value;
};

const formatTimeOnly = (value) => {
  const label = formatTimestampLabel(value);
  if (!label) return '';
  const parts = label.split(' ');
  return parts[1] || label;
};

export default function TimeSeriesChart({ series, height = 320 }) {
  const [hiddenKeys, setHiddenKeys] = useState(new Set());

  const chartData = useMemo(() => {
    if (!series?.points?.length) return [];
    return series.points.map((point) => ({
      ...point,
      volume: point.volume ?? 0,
    }));
  }, [series?.points]);

  const handleLegendClick = (payload) => {
    const key = payload?.dataKey;
    if (!key) return;
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (!series) {
    return (
      <div className="bg-surface-elevated border border-divider rounded-xl p-4 text-sm text-gray-400">
        No time series data available.
      </div>
    );
  }

  if (!series.points || series.points.length === 0) {
    return (
      <div className="bg-surface-elevated border border-divider rounded-xl p-4 text-sm text-gray-400">
        Time series data is empty.
      </div>
    );
  }

  return (
    <div className="bg-surface-elevated border border-divider rounded-xl p-4">
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mb-3">
        <span className="text-gray-200 font-semibold">
          {series?.meta?.symbol || 'Symbol'}
        </span>
        {series?.meta?.interval && (
          <span>Interval: {series.meta.interval}</span>
        )}
        {series?.meta?.lastRefreshed && (
          <span>Last refreshed: {series.meta.lastRefreshed}</span>
        )}
        {series?.meta?.timeZone && (
          <span>Time zone: {series.meta.timeZone}</span>
        )}
      </div>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <ComposedChart data={chartData} margin={{ top: 10, right: 24, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTimeOnly}
              minTickGap={24}
              stroke="#9ca3af"
            />
            <YAxis
              yAxisId="price"
              stroke="#9ca3af"
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <YAxis
              yAxisId="volume"
              orientation="right"
              stroke="#6b7280"
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              labelFormatter={formatTimestampLabel}
              formatter={(value, name) => [value, name]}
              contentStyle={{ background: '#0f172a', border: '1px solid #1f2937' }}
              itemStyle={{ color: '#e5e7eb' }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend onClick={handleLegendClick} />
            {!hiddenKeys.has('open') && (
              <Line yAxisId="price" type="monotone" dataKey="open" stroke="#34d399" dot={false} />
            )}
            {!hiddenKeys.has('high') && (
              <Line yAxisId="price" type="monotone" dataKey="high" stroke="#60a5fa" dot={false} />
            )}
            {!hiddenKeys.has('low') && (
              <Line yAxisId="price" type="monotone" dataKey="low" stroke="#fca5a5" dot={false} />
            )}
            {!hiddenKeys.has('close') && (
              <Line yAxisId="price" type="monotone" dataKey="close" stroke="#fbbf24" dot={false} />
            )}
            {!hiddenKeys.has('volume') && (
              <Bar yAxisId="volume" dataKey="volume" fill="#64748b" barSize={20} opacity={0.5} />
            )}
            <Brush dataKey="timestamp" height={20} stroke="#22c55e" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-gray-500 mt-3">
        Toggle series in the legend. Drag the brush to zoom.
      </p>
    </div>
  );
}
