import React from 'react';
import TimeSeriesChart from './TimeSeriesChart';

export default function TimeSeriesDashboard({ series }) {
  return (
    <div className="flex flex-col h-full w-full bg-surface overflow-hidden">
      <div className="px-6 py-4 border-b border-divider">
        <h2 className="text-lg font-semibold text-gray-100">Time Series Dashboard</h2>
        <p className="text-xs text-gray-400 mt-1">
          Latest normalized Alpha Vantage series from your chats.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-6xl mx-auto space-y-4">
          {series ? (
            <TimeSeriesChart series={series} height={420} />
          ) : (
            <div className="bg-surface-elevated border border-divider rounded-xl p-6 text-sm text-gray-400">
              No time series data yet. Run a time-series tool in chat to populate this view.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
