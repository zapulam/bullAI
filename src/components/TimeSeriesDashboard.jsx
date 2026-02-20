import React, { useState } from 'react';
import VizChart from './VizChart';
import { useCharts } from '../hooks/useCharts';
import { Trash2, RefreshCw, HelpCircle, X } from 'lucide-react';

export default function TimeSeriesDashboard() {
  const { charts, loading, listCharts, deleteChart, refreshChart, refreshingChartId } = useCharts();
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const handleDelete = async (e, chartId) => {
    e.stopPropagation();
    try {
      await deleteChart(chartId);
    } catch (err) {
      console.error('Error deleting chart:', err);
    }
  };

  const handleRefresh = async (e, chartId) => {
    e.stopPropagation();
    try {
      await refreshChart(chartId);
    } catch (err) {
      console.error('Error refreshing chart:', err);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-surface overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-end">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsHelpOpen((prev) => !prev)}
            className="p-1 text-gray-300 hover:text-white hover:bg-surface-hover rounded-lg transition-colors duration-200 cursor-pointer"
            title="Charts help"
            aria-label="Open charts help"
          >
            <HelpCircle className="w-5.5 h-5.5" />
          </button>
          {isHelpOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="charts-help-dialog-title"
            >
              <div
                className="absolute inset-0 bg-black/60 cursor-default"
                onClick={() => setIsHelpOpen(false)}
                role="presentation"
              />
              <div className="relative w-full max-w-4xl max-h-[90vh] flex justify-center items-start">
                <div className="absolute top-0 left-0 w-64 h-64 rounded-full bg-orange-400/20 blur-3xl pointer-events-none" aria-hidden="true" />
                <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full bg-green-400/20 blur-3xl pointer-events-none" aria-hidden="true" />
              <div
                className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-surface-elevated border border-divider rounded-xl shadow-[inset_0_0_30px_rgba(34,197,94,0.1),inset_0_0_40px_rgba(255,140,64,0.06),0_25px_50px_-12px_rgba(0,0,0,0.5)] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-divider bg-surface-elevated z-10">
                  <h2 id="charts-help-dialog-title" className="text-lg font-semibold bg-gradient-to-r from-orange-400 to-green-400 text-transparent bg-clip-text drop-shadow-[0_0_12px_rgba(255,140,64,0.35)]">
                    Charts Help
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsHelpOpen(false)}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
                    aria-label="Close help"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="px-5 py-5 space-y-6 text-left">
                  <section>
                    <h3 className="text-lg font-semibold text-white mb-2">What is the Charts dashboard?</h3>
                    <p className="text-sm text-gray-300 mb-2">
                      The Charts dashboard is your central place to view and manage time series visualizations saved from chat. When the AI returns stock price data (daily, weekly, or monthly) with a chart, you can save it here for quick access without re-running the conversation.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-white mb-2">Saving charts</h3>
                    <p className="text-sm text-gray-300 mb-2">
                      In chat, when a visualization appears (e.g. after asking for AAPL daily prices or adding indicators like SMA or EMA), use the <strong>Save</strong> button on the chart to add it to this dashboard. Charts are stored locally in your database.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-white mb-2">Chart controls</h3>
                    <p className="text-sm text-gray-300 mb-2">
                      Each chart card has two action buttons:
                    </p>
                    <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside mb-2">
                      <li><span className="font-mono text-gray-200">Refresh</span> (bottom left) – fetches the latest data from Alpha Vantage and updates the chart. Use this to see new price points after market hours.</li>
                      <li><span className="font-mono text-gray-200">Delete</span> (bottom right) – removes the chart from the dashboard. This does not affect your chat history.</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-white mb-2">Chart types</h3>
                    <p className="text-sm text-gray-300 mb-2">
                      Charts can be displayed as a simple line (close prices) or as candlesticks (open, high, low, close). You can add technical indicators such as SMA, EMA, or WMA when creating the chart in chat.
                    </p>
                  </section>
                </div>
              </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="w-[100%]">
          {loading ? (
            <p className="text-sm text-gray-400">Loading charts...</p>
          ) : charts.length === 0 ? (
            <div className="bg-surface-elevated border border-divider rounded-xl p-6 text-sm text-gray-400">
              No saved charts yet. Run a time-series tool with visualization in chat, then use Save to add charts here.
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 3xl:grid-cols-4">
              {charts.map((chart) => {
                const viz = {
                  title: chart.title,
                  chartData: chart.visualization_data?.chartData || [],
                  chartType: chart.visualization_data?.chartType ?? 'simple',
                  screens: chart.visualization_data?.screens || [],
                  meta: chart.visualization_data?.meta || {},
                  call: chart.call_data || {},
                };
                const canRefresh = chart.call_data?.func;
                const isRefreshing = refreshingChartId === chart.id;

                return (
                  <div
                    key={chart.id}
                    className="relative bg-surface-elevated border border-divider rounded-xl overflow-hidden"
                  >
                    <div className="absolute bottom-3 left-3 z-10">
                      <button
                        type="button"
                        onClick={(e) => handleRefresh(e, chart.id)}
                        disabled={!canRefresh || isRefreshing}
                        className="p-2 text-gray-400 hover:text-green-400 hover:bg-surface-hover rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Refresh chart"
                        aria-label="Refresh chart"
                      >
                        <RefreshCw
                          className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
                        />
                      </button>
                    </div>
                    <div className="absolute bottom-3 right-3 z-10">
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, chart.id)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
                        title="Delete chart"
                        aria-label="Delete chart"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div>
                      <VizChart
                        visualization={viz}
                        height={320}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
