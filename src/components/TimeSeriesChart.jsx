import React, { useMemo, useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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

function formatPriceAxis(value, inPennies) {
  if (value == null || Number.isNaN(Number(value))) return '';
  const num = Number(value);
  return inPennies ? num.toFixed(2) : String(Math.round(num));
}

const CANDLE_UP = '#22c55e';
const CANDLE_DOWN = '#ef4444';
const BRUSH_HEIGHT = 24;

function niceDomain(min, max, padding = 0.02) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 100];
  const range = Math.max(max - min, 0.01);
  const pad = Math.max(range * padding, 0.01);
  let lo = min - pad;
  let hi = max + pad;
  if (hi < 1) {
    return [Math.max(0, Math.floor(lo * 100) / 100), Math.ceil(hi * 100) / 100];
  }
  const rawRange = hi - lo;
  const exp = Math.floor(Math.log10(rawRange));
  const frac = rawRange / Math.pow(10, exp);
  const step = (frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10) * Math.pow(10, exp);
  const niceMin = Math.floor(lo / step) * step;
  const niceMax = Math.ceil(hi / step) * step;
  return [niceMin, niceMax];
}

function getPriceDomain(chartData, padding = 0.02) {
  let min = Infinity;
  let max = -Infinity;
  const ohlcKeys = ['open', 'high', 'low', 'close'];
  for (const p of chartData) {
    for (const k of ohlcKeys) {
      const v = p[k];
      if (v == null) continue;
      const num = Number(v);
      if (!Number.isNaN(num)) {
        min = Math.min(min, num);
        max = Math.max(max, num);
      }
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 100];
  return niceDomain(min, max, padding);
}

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
  const chartData = useMemo(() => {
    if (!series?.points?.length) return [];
    return series.points.map((point) => ({
      ...point,
      timestamp: point.timestamp ?? point.date,
      volume: point.volume ?? 0,
    }));
  }, [series?.points]);

  const [brushRange, setBrushRange] = useState({ startIndex: 0, endIndex: 0 });

  useEffect(() => {
    const len = chartData.length;
    setBrushRange({
      startIndex: 0,
      endIndex: Math.max(0, len - 1),
    });
  }, [chartData]);

  const visibleData = useMemo(() => {
    const { startIndex, endIndex } = brushRange;
    if (startIndex == null || endIndex == null || endIndex < startIndex) return chartData;
    return chartData.slice(startIndex, endIndex + 1);
  }, [chartData, brushRange]);

  const handleBrushChange = (range) => {
    if (range?.startIndex != null && range?.endIndex != null) {
      setBrushRange({ startIndex: range.startIndex, endIndex: range.endIndex });
    }
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

  const priceDomain = useMemo(() => getPriceDomain(visibleData, 0.02), [visibleData]);
  const closeStrokeColor =
    chartType === 'simple' && visibleData.length >= 2
      ? (visibleData[visibleData.length - 1].close ?? 0) >= (visibleData[0].close ?? 0)
        ? CANDLE_UP
        : CANDLE_DOWN
      : '#fbbf24';

  const mainHeight = Math.max(200, height - BRUSH_HEIGHT);

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
      <div style={{ width: '100%', height, display: 'flex', flexDirection: 'column' }}>
        <ResponsiveContainer width="100%" height={mainHeight} minHeight={200} style={{ flexShrink: 0 }}>
          <ComposedChart
            data={visibleData}
            margin={{ top: 10, right: 24, left: 48, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTimeOnly}
              minTickGap={24}
              stroke="#9ca3af"
            />
            <YAxis
              yAxisId="price"
              domain={priceDomain}
              allowDataOverflow={false}
              allowDecimals={priceDomain[0] < 1}
              tickFormatter={(v) => formatPriceAxis(v, priceDomain[0] < 1)}
              stroke="#9ca3af"
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <YAxis
              yAxisId="volume"
              orientation="right"
              domain={[0, 'auto']}
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
            {chartType === 'simple' ? (
              <Line yAxisId="price" type="monotone" dataKey="close" stroke={closeStrokeColor} dot={false} legendType="none" />
            ) : (
              <Bar
                yAxisId="price"
                dataKey="close"
                fill="transparent"
                barSize={20}
                shape={<CandlestickShape yAxisId="price" />}
                legendType="none"
              />
            )}
            <Bar yAxisId="volume" dataKey="volume" fill="#64748b" barSize={20} opacity={0.5} legendType="none" />
          </ComposedChart>
        </ResponsiveContainer>
        <ResponsiveContainer width="100%" height={BRUSH_HEIGHT} style={{ flexShrink: 0 }}>
          <ComposedChart
            data={chartData}
            margin={{ top: 0, right: 24, left: 48, bottom: 0 }}
          >
            <XAxis dataKey="timestamp" hide />
            <YAxis domain={['auto', 'auto']} hide width={0} />
            <Line type="monotone" dataKey="close" stroke="#64748b" dot={false} strokeWidth={1} />
            <Brush
              dataKey="timestamp"
              data={chartData}
              height={BRUSH_HEIGHT}
              stroke="#22c55e"
              fill="#1f2937"
              travellerWidth={28}
              tickFormatter={() => ''}
              startIndex={brushRange.startIndex}
              endIndex={brushRange.endIndex}
              onChange={handleBrushChange}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
