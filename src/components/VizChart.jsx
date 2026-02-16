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
  Legend,
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

function ChartBody({ chartData, hiddenKeys, handleLegendClick, chartType, screenTitles, chartHeight }) {
  return (
    <div style={{ width: '100%', height: chartHeight, minHeight: 200 }}>
      <ResponsiveContainer width="100%" height={chartHeight} minHeight={200}>
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
          {chartType === 'simple' ? (
            <>
              {!hiddenKeys.has('close') && (
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="close"
                  stroke="#fbbf24"
                  dot={false}
                />
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
  );
}

export default function VizChart({ visualization, onSave, height = 320 }) {
  const [hiddenKeys, setHiddenKeys] = useState(new Set());
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
    const updateHeight = () => setFullscreenHeight(Math.round(window.innerHeight * 0.9));
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
      <div className="bg-surface-elevated border border-divider rounded-xl p-4 text-sm text-gray-400">
        No visualization data available.
      </div>
    );
  }

  return (
    <>
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-gray-300 hover:text-white hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
              title="Expand to fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
              <span>Expand</span>
            </button>
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
        </div>
        <ChartBody
          chartData={chartData}
          hiddenKeys={hiddenKeys}
          handleLegendClick={handleLegendClick}
          chartType={chartType}
          screenTitles={screenTitles}
          chartHeight={height}
        />
      </div>
      {isFullscreen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
            role="dialog"
            aria-modal="true"
            aria-label="Chart fullscreen"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsFullscreen(false);
            }}
          >
            <div
              className="bg-surface-elevated border border-divider rounded-xl p-4 w-full max-w-[90%]"
              onClick={(e) => e.stopPropagation()}
            >
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
                <button
                  type="button"
                  onClick={() => setIsFullscreen(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-gray-300 hover:text-white hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
                  aria-label="Close fullscreen"
                >
                  <X className="w-4 h-4" />
                  <span>Close</span>
                </button>
              </div>
              <ChartBody
                chartData={chartData}
                hiddenKeys={hiddenKeys}
                handleLegendClick={handleLegendClick}
                chartType={chartType}
                screenTitles={screenTitles}
                chartHeight={fullscreenHeight}
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
