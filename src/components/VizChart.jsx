import React, { useMemo, useState, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
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
import { Save, Maximize2, X } from 'lucide-react';

const SCREEN_COLORS = ['#a78bfa', '#f472b6', '#34d399'];
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

function formatVolume(n) {
  if (n == null || Number.isNaN(Number(n))) return '-';
  const num = Number(n);
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return String(Math.round(num));
}

function formatVolumeAxis(value) {
  if (value == null || Number.isNaN(Number(value))) return '';
  const num = Number(value);
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(0) + 'K';
  return String(Math.round(num));
}

function formatPrice(v) {
  if (v == null || Number.isNaN(Number(v))) return '-';
  return Number(v).toFixed(2);
}

function formatPriceAxis(value, inPennies) {
  if (value == null || Number.isNaN(Number(value))) return '';
  const num = Number(value);
  return inPennies ? num.toFixed(2) : String(Math.round(num));
}

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

function getPriceDomain(chartData, screenTitles, padding = 0.02) {
  let min = Infinity;
  let max = -Infinity;
  const ohlcKeys = ['open', 'high', 'low', 'close'];
  const screenKeys = (screenTitles || []).filter((k) => k && String(k).toLowerCase() !== 'volume');
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
    for (const k of screenKeys) {
      const v = p[k];
      if (v == null) continue;
      const num = Number(v);
      if (!Number.isNaN(num) && num < 1e6) {
        min = Math.min(min, num);
        max = Math.max(max, num);
      }
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 100];
  return niceDomain(min, max, padding);
}

function ChartTooltip({ active, payload, label, screenTitles = [] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  const screenKeys = screenTitles.filter((k) => p[k] != null);
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs font-mono shadow-lg"
      style={{
        background: '#0f172a',
        borderColor: '#1f2937',
        color: '#e5e7eb',
      }}
    >
      <div className="mb-1.5 font-semibold text-gray-200">
        {formatTimestampLabel(p.timestamp || label)}
      </div>
      <div className="grid grid-cols-4 gap-x-4 gap-y-0.5">
        <span className="text-gray-400">O</span>
        <span>{formatPrice(p.open)}</span>
        <span className="text-gray-400">H</span>
        <span>{formatPrice(p.high)}</span>
        <span className="text-gray-400">L</span>
        <span>{formatPrice(p.low)}</span>
        <span className="text-gray-400">C</span>
        <span>{formatPrice(p.close)}</span>
      </div>
      <div className="mt-1.5 border-t border-gray-700 pt-1.5">
        <span className="text-gray-400">Vol </span>
        <span>{formatVolume(p.volume)}</span>
      </div>
      {screenKeys.length > 0 && (
        <div className="mt-1 border-t border-gray-700 pt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
          {screenKeys.map((k) => (
            <span key={k}>
              <span className="text-gray-400">{k} </span>
              <span>{formatPrice(p[k])}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const BRUSH_HEIGHT = 4;

function ChartBody({ chartData, chartType, screenTitles, chartHeight }) {
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

  const priceDomain = useMemo(
    () => getPriceDomain(visibleData, screenTitles, 0.02),
    [visibleData, screenTitles]
  );
  const closeStrokeColor =
    chartType === 'simple' && visibleData.length >= 2
      ? (visibleData[visibleData.length - 1].close ?? 0) >= (visibleData[0].close ?? 0)
        ? CANDLE_UP
        : CANDLE_DOWN
      : '#fbbf24';

  const mainHeight = Math.max(200, (chartHeight ?? DEFAULT_CHART_HEIGHT) - BRUSH_HEIGHT);

  const handleBrushChange = (range) => {
    if (range?.startIndex != null && range?.endIndex != null) {
      setBrushRange({ startIndex: range.startIndex, endIndex: range.endIndex });
    }
  };

  return (
    <div
      className="viz-chart h-full items-center"
      style={{
        width: '100%',
        minHeight: 200 + BRUSH_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <ResponsiveContainer width="100%" height={mainHeight} minHeight={200} style={{ flexShrink: 0 }}>
        <ComposedChart
          data={visibleData}
          margin={{ top: 10, right: 18, left: 18, bottom: 2 }}
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
            content={(props) => <ChartTooltip {...props} screenTitles={screenTitles} />}
            contentStyle={{ background: 'transparent', border: 'none', padding: 0 }}
          />
          {chartType === 'simple' ? (
            <>
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="close"
                stroke={closeStrokeColor}
                dot={false}
                legendType="none"
              />
              {screenTitles.map((screenTitle, idx) => (
                <Line
                  key={screenTitle}
                  yAxisId="price"
                  type="monotone"
                  dataKey={screenTitle}
                  stroke={SCREEN_COLORS[idx % SCREEN_COLORS.length]}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </>
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
          <Bar
            yAxisId="volume"
            dataKey="volume"
            fill="#64748b"
            barSize={20}
            opacity={0.35}
            legendType="none"
          />
        </ComposedChart>
      </ResponsiveContainer>
      <ResponsiveContainer width="100%" height={BRUSH_HEIGHT} style={{ flexShrink: 0 }}>
        <ComposedChart
          data={chartData}
          margin={{ top: 0, right: 24, left: 24, bottom: 0 }}
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
  );
}

const DEFAULT_CHART_HEIGHT = 320;

export default function VizChart({ visualization, onSave, height = DEFAULT_CHART_HEIGHT }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenHeight, setFullscreenHeight] = useState(600);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isFullscreen]);

  useLayoutEffect(() => {
    if (!isFullscreen) return;
    const updateHeight = () => {
      const reserved = 116;
      setFullscreenHeight(Math.max(200 + BRUSH_HEIGHT, Math.round(window.innerHeight - reserved)));
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [isFullscreen]);

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
  const chartType = visualization?.chartType ?? 'simple';

  const screenTitles = screens.map((s) => s?.title).filter(Boolean);

  const handleSave = () => {
    if (onSave && visualization) {
      onSave({
        title,
        visualization_data: {
          chartData: visualization.chartData,
          chartType: visualization.chartType ?? 'simple',
          screens: visualization.screens,
          meta: visualization.meta,
        },
        call_data: call,
      });
    }
  };

  if (!visualization || !chartData.length) {
    return (
      <div className="bg-surface-elevated border border-divider rounded-xl p-4 text-xs text-gray-400">
        No visualization data available.
      </div>
    );
  }

  return (
    <>
      <div className="bg-surface-elevated border border-divider rounded-xl p-4 pb-6 overflow-hidden">
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
          <div className="flex items-center gap-1">
            {onSave && Object.keys(call).length > 0 && (
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-1 px-2 py-2 text-gray-300 hover:text-white hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
                title="Save chart to Charts page"
              >
                <Save className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="flex items-center gap-1 px-2 py-2 text-gray-300 hover:text-white hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
              title="Expand to fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="h-full min-h-[204px]" style={{ height: height ?? DEFAULT_CHART_HEIGHT }}>
          <ChartBody
            chartData={chartData}
            chartType={chartType}
            screenTitles={screenTitles}
            chartHeight={height ?? DEFAULT_CHART_HEIGHT}
          />
        </div>
      </div>
      {isFullscreen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/80"
            role="dialog"
            aria-modal="true"
            aria-label="Chart fullscreen"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsFullscreen(false);
            }}
          >
            <div
              className="bg-surface-elevated border border-divider rounded-xl p-4 m-4 w-full max-w-[100%] overflow-hidden flex flex-col max-h-[calc(100vh-2rem)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 text-s text-gray-400 mb-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-gray-200 font-semibold">{title}</span>
                  {meta?.symbol && <span>Symbol: {meta.symbol}</span>}
                  {meta?.interval && <span>Interval: {meta.interval}</span>}
                  {meta?.lastRefreshed && (
                    <span>Last refreshed: {meta.lastRefreshed}</span>
                  )}
                  {meta?.timeZone && <span>Time zone: {meta.timeZone}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => setIsFullscreen(false)}
                  className="flex items-center gap-2 px-2 py-2 text-gray-300 hover:text-white hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
                  aria-label="Close fullscreen"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 min-h-0 flex flex-col">
                <ChartBody
                  chartData={chartData}
                  chartType={chartType}
                  screenTitles={screenTitles}
                  chartHeight={fullscreenHeight ?? DEFAULT_CHART_HEIGHT}
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
