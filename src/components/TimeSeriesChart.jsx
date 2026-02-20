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
import { useYAxis } from 'recharts/es6/hooks';

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

function formatVolumeAxis(value) {
  if (value == null || Number.isNaN(Number(value))) return '';
  const num = Number(value);
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(0) + 'K';
  return String(Math.round(num));
}

const CANDLE_UP = '#22c55e';
const CANDLE_DOWN = '#ef4444';

function CandlestickShape(props) {
  const { x, width, payload, yAxisId } = props;
  const yAxis = useYAxis(yAxisId);
  if (!yAxis?.scale || payload?.open == null || payload?.high == null || payload?.low == null || payload?.close == null) {
    return null;
  }
  const scale = yAxis.scale;
  const mapFn = typeof scale === 'function' ? scale : scale?.map;
  if (typeof mapFn !== 'function') {
    return null;
  }
  const open = Number(payload.open);
  const high = Number(payload.high);
  const low = Number(payload.low);
  const close = Number(payload.close);
  const bodyTop = Math.min(open, close);
  const bodyBottom = Math.max(open, close);
  const isUp = close >= open;
  const fill = isUp ? CANDLE_UP : CANDLE_DOWN;
  const stroke = isUp ? CANDLE_UP : CANDLE_DOWN;
  const barWidth = Math.max(2, (width || 8) * 0.6);
  const xCenter = x + (width || 8) / 2 - barWidth / 2;
  const yHigh = mapFn(high);
  const yLow = mapFn(low);
  const yBodyTop = mapFn(bodyTop);
  const yBodyBottom = mapFn(bodyBottom);
  if (yHigh == null || yLow == null || yBodyTop == null || yBodyBottom == null) {
    return null;
  }
  const bodyHeight = Math.max(1, Math.abs(yBodyBottom - yBodyTop));
  return (
    <g>
      <line x1={x + (width || 8) / 2} y1={yHigh} x2={x + (width || 8) / 2} y2={yLow} stroke={stroke} strokeWidth={1} />
      <rect x={xCenter} y={yBodyTop} width={barWidth} height={bodyHeight} fill={fill} stroke={stroke} strokeWidth={1} />
    </g>
  );
}

export default function TimeSeriesChart({ series, height = 320, chartType = 'simple' }) {
  const [hiddenKeys, setHiddenKeys] = useState(new Set());

  const chartData = useMemo(() => {
    if (!series?.points?.length) return [];
    return series.points.map((point) => ({
      ...point,
      timestamp: point.timestamp ?? point.date,
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

  const closeStrokeColor =
    chartType === 'simple' && chartData.length >= 2
      ? (chartData[chartData.length - 1].close ?? 0) >= (chartData[0].close ?? 0)
        ? CANDLE_UP
        : CANDLE_DOWN
      : '#fbbf24';

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
              tickFormatter={formatVolumeAxis}
            />
            <Tooltip
              labelFormatter={formatTimestampLabel}
              formatter={(value, name) => [value, name]}
              contentStyle={{ background: '#0f172a', border: '1px solid #1f2937' }}
              itemStyle={{ color: '#e5e7eb' }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend onClick={handleLegendClick} />
            {chartType === 'simple' ? (
              <>
                {!hiddenKeys.has('close') && (
                  <Line yAxisId="price" type="monotone" dataKey="close" stroke={closeStrokeColor} dot={false} />
                )}
              </>
            ) : (
              <Bar
                yAxisId="price"
                dataKey="close"
                fill="transparent"
                barSize={20}
                shape={<CandlestickShape yAxisId="price" />}
              />
            )}
            {!hiddenKeys.has('volume') && (
              <Bar yAxisId="volume" dataKey="volume" fill="#64748b" barSize={20} opacity={0.5} />
            )}
            <Brush dataKey="timestamp" height={20} stroke="#22c55e" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
