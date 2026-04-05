import React, { useState, useEffect, useRef } from 'react';
import VizChart from './VizChart';
import { useCharts } from '../hooks/useCharts';
import { Trash2, RefreshCw, HelpCircle, X, Check, AlertCircle } from 'lucide-react';

const REFRESH_SUCCESS_HOLD_MS = 2000;
const REFRESH_SUCCESS_FADE_MS = 400;
const REFRESH_FEEDBACK_ERROR_MS = 4800;

export default function TimeSeriesDashboard() {
  const { charts, loading, error, deleteChart, refreshChart, refreshingChartId } = useCharts();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [errorBannerDismissed, setErrorBannerDismissed] = useState(false);
  const [refreshCardFeedback, setRefreshCardFeedback] = useState(null);
  const feedbackClearTimerRef = useRef(null);
  const successHoldTimerRef = useRef(null);

  useEffect(() => {
    setErrorBannerDismissed(false);
  }, [error]);

  useEffect(() => {
    if (!refreshCardFeedback?.exiting || refreshCardFeedback.status !== 'success') return undefined;
    const t = setTimeout(() => setRefreshCardFeedback(null), REFRESH_SUCCESS_FADE_MS);
    return () => clearTimeout(t);
  }, [refreshCardFeedback]);

  useEffect(() => {
    return () => {
      if (feedbackClearTimerRef.current) {
        clearTimeout(feedbackClearTimerRef.current);
      }
      if (successHoldTimerRef.current) {
        clearTimeout(successHoldTimerRef.current);
      }
    };
  }, []);

  const showErrorBanner = Boolean(error) && !errorBannerDismissed;

  const scheduleFeedbackClear = (ms) => {
    if (feedbackClearTimerRef.current) {
      clearTimeout(feedbackClearTimerRef.current);
    }
    feedbackClearTimerRef.current = setTimeout(() => {
      setRefreshCardFeedback(null);
      feedbackClearTimerRef.current = null;
    }, ms);
  };

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
    if (feedbackClearTimerRef.current) {
      clearTimeout(feedbackClearTimerRef.current);
      feedbackClearTimerRef.current = null;
    }
    if (successHoldTimerRef.current) {
      clearTimeout(successHoldTimerRef.current);
      successHoldTimerRef.current = null;
    }
    setRefreshCardFeedback(null);
    try {
      await refreshChart(chartId);
      setRefreshCardFeedback({ chartId, status: 'success' });
      successHoldTimerRef.current = setTimeout(() => {
        setRefreshCardFeedback((prev) =>
          prev?.chartId === chartId && prev.status === 'success'
            ? { ...prev, exiting: true }
            : prev
        );
        successHoldTimerRef.current = null;
      }, REFRESH_SUCCESS_HOLD_MS);
    } catch (err) {
      console.error('Error refreshing chart:', err);
      setRefreshCardFeedback({
        chartId,
        status: 'error',
        message: err?.message || 'Refresh failed',
      });
      scheduleFeedbackClear(REFRESH_FEEDBACK_ERROR_MS);
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
                      <li><span className="font-mono text-gray-200">Refresh</span> (bottom left) – fetches the latest data from Alpha Vantage and updates the chart. A short success or error animation appears on that chart card when the refresh finishes.</li>
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
        <div className="w-[100%] space-y-3">
          {showErrorBanner && (
            <div
              className="flex items-start justify-between gap-3 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200"
              role="alert"
            >
              <p className="min-w-0 flex-1">{error}</p>
              <button
                type="button"
                onClick={() => setErrorBannerDismissed(true)}
                className="shrink-0 p-1 text-red-300 hover:text-white hover:bg-red-900/50 rounded-lg transition-colors cursor-pointer"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {loading ? (
            <p className="text-sm text-gray-400">Loading charts...</p>
          ) : charts.length === 0 ? (
            <div className="text-sm text-gray-400">
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
                const canRefresh = Boolean(chart.call_data?.func);
                const isRefreshing = refreshingChartId === chart.id;
                const refreshTitle = canRefresh
                  ? 'Refresh chart — fetch latest data from Alpha Vantage'
                  : 'Refresh unavailable — this chart has no saved tool parameters. Save a new chart from chat.';
                const refreshAriaLabel = canRefresh
                  ? 'Refresh chart'
                  : 'Refresh unavailable: no saved tool parameters for this chart';

                const vizChartKey = `${chart.id}-${chart.visualization_data?.meta?.lastRefreshed ?? ''}-${(chart.visualization_data?.chartData?.length ?? 0)}`;

                const feedback = refreshCardFeedback?.chartId === chart.id ? refreshCardFeedback : null;

                return (
                  <div
                    key={chart.id}
                    className="relative bg-surface-elevated border border-divider rounded-xl overflow-hidden"
                  >
                    {feedback && (
                      <div
                        className={
                          feedback.status === 'success'
                            ? `absolute inset-0 z-20 pointer-events-none flex flex-col items-center justify-center gap-2 px-4 rounded-xl bg-green-950/80 backdrop-blur-[1px] transition-opacity duration-300 ${
                                feedback.exiting
                                  ? 'opacity-0'
                                  : 'opacity-100 chart-refresh-overlay-success'
                              }`
                            : 'absolute inset-0 z-20 pointer-events-none flex flex-col items-center justify-center gap-2 px-4 rounded-xl bg-red-950/85 backdrop-blur-[1px] chart-refresh-overlay-error'
                        }
                        role={feedback.status === 'success' ? 'status' : 'alert'}
                        aria-live={feedback.status === 'success' ? 'polite' : 'assertive'}
                      >
                        {feedback.status === 'success' ? (
                          <>
                            <span className="sr-only">Chart updated</span>
                            <Check
                              className="w-12 h-12 text-green-400 drop-shadow-lg chart-refresh-check-pop"
                              aria-hidden
                            />
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-10 h-10 text-red-400 shrink-0" aria-hidden />
                            {feedback.message ? (
                              <p className="text-xs text-red-100 text-center max-w-full line-clamp-4">
                                {feedback.message}
                              </p>
                            ) : null}
                          </>
                        )}
                      </div>
                    )}
                    <div className="absolute bottom-3 left-3 z-10">
                      <button
                        type="button"
                        onClick={(e) => handleRefresh(e, chart.id)}
                        disabled={!canRefresh || isRefreshing}
                        className="p-2 text-gray-400 hover:text-green-400 hover:bg-surface-hover rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        title={refreshTitle}
                        aria-label={refreshAriaLabel}
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
                        key={vizChartKey}
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
