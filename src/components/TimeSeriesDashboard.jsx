import React from 'react';
import VizChart from './VizChart';
import { useCharts } from '../hooks/useCharts';
import { Trash2 } from 'lucide-react';

export default function TimeSeriesDashboard() {
  const { charts, loading, listCharts, deleteChart } = useCharts();

  const handleDelete = async (e, chartId) => {
    e.stopPropagation();
    try {
      await deleteChart(chartId);
    } catch (err) {
      console.error('Error deleting chart:', err);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-surface overflow-hidden">
      <div className="px-6 py-4 border-b border-divider">
        <h2 className="text-lg font-semibold text-gray-100">Charts</h2>
        <p className="text-xs text-gray-400 mt-1">
          Saved charts from your chat. Save charts from chat using the Save button on visualizations.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <p className="text-sm text-gray-400">Loading charts...</p>
          ) : charts.length === 0 ? (
            <div className="bg-surface-elevated border border-divider rounded-xl p-6 text-sm text-gray-400">
              No saved charts yet. Run a time-series tool with visualization in chat, then use Save to add charts here.
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
              {charts.map((chart) => {
                const viz = {
                  title: chart.title,
                  chartData: chart.visualization_data?.chartData || [],
                  screens: chart.visualization_data?.screens || [],
                  meta: chart.visualization_data?.meta || {},
                  call: chart.call_data || {},
                };
                return (
                  <div
                    key={chart.id}
                    className="relative bg-surface-elevated border border-divider rounded-xl overflow-hidden"
                  >
                    <div className="absolute top-3 right-3 z-10">
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
                    <div className="p-4">
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
