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
import { Save } from 'lucide-react';

const SCREEN_COLORS = ['#a78bfa', '#f472b6', '#34d399'];
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

export default function VizChart({ visualization, onSave, height = 320 }) {
  const [hiddenKeys, setHiddenKeys] = useState(new Set());

  const chartData = useMemo(() => {
    if (!visualization?.chartData?.length) return [];
    return visualization.chartData.map((point) => ({
      ...point,
      volume: point.volume ?? 0,
    }));
  }, [visualization?.chartData]);

  const meta = visualization?.meta || {};
  const screens = visualization?.screens || [];
  const call = visualization?.call || {};
  const title = visualization?.title || 'Chart';

  const priceKeys = ['open', 'high', 'low', 'close'];
  const screenTitles = screens.map((s) => s?.title).filter(Boolean);

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

  const handleSave = () => {
    if (onSave && visualization) {
      onSave({
        title,
        visualization_data: {
          chartData: visualization.chartData,
          screens: visualization.screens,
          meta: visualization.meta,
        },
        call_data: call,
      });
    }
  };

  if (!visualization || !chartData.length) {
    return (
      <div className="bg-surface-elevated border border-divider rounded-xl p-4 text-sm text-gray-400">
        No visualization data available.
      </div>
    );
  }

  return (
    <div className="bg-surface-elevated border border-divider rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400 mb-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-gray-200 font-semibold">{title}</span>
          {meta?.symbol && <span>Symbol: {meta.symbol}</span>}
          {meta?.interval && <span>Interval: {meta.interval}</span>}
          {meta?.lastRefreshed && (
            <span>Last refreshed: {meta.lastRefreshed}</span>
          )}
          {meta?.timeZone && <span>Time zone: {meta.timeZone}</span>}
        </div>
        {onSave && Object.keys(call).length > 0 && (
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 text-gray-300 hover:text-white hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
            title="Save chart to Charts page"
          >
            <Save className="w-4 h-4" />
            <span>Save</span>
          </button>
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
            {priceKeys.map(
              (key) =>
                !hiddenKeys.has(key) && (
                  <Line
                    key={key}
                    yAxisId="price"
                    type="monotone"
                    dataKey={key}
                    stroke={
                      key === 'open'
                        ? '#34d399'
                        : key === 'high'
                          ? '#60a5fa'
                          : key === 'low'
                            ? '#fca5a5'
                            : '#fbbf24'
                    }
                    dot={false}
                  />
                )
            )}
            {screenTitles.map((screenTitle, idx) =>
              !hiddenKeys.has(screenTitle) ? (
                <Line
                  key={screenTitle}
                  yAxisId="price"
                  type="monotone"
                  dataKey={screenTitle}
                  stroke={SCREEN_COLORS[idx % SCREEN_COLORS.length]}
                  dot={false}
                  strokeWidth={2}
                />
              ) : null
            )}
            {!hiddenKeys.has('volume') && (
              <Bar
                yAxisId="volume"
                dataKey="volume"
                fill="#64748b"
                barSize={20}
                opacity={0.5}
              />
            )}
            <Brush dataKey="timestamp" height={20} stroke="#22c55e" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
