import React, { useState, useEffect, useRef } from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';
import { API_ENDPOINTS, buildApiUrl } from '../config/api';

function HelpBubble({ content, label }) {
  return (
    <span className="group relative inline-flex align-middle ml-1.5">
      <HelpCircle
        className="w-4 h-4 text-gray-500 hover:text-gray-400 cursor-help shrink-0"
        aria-label={label}
      />
      <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-10 px-3 py-2 w-72 max-w-[calc(100vw-4rem)] text-xs text-gray-200 bg-surface-elevated border border-divider rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-150">
        {content}
      </span>
    </span>
  );
}

function PrefDropdown({ id, value, options, onChange, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <button
        type="button"
        id={id}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={`${id}-label`}
        className="w-full px-4 py-2.5 my-1 flex items-center justify-between text-left bg-surface border border-divider rounded-xl text-white text-sm font-medium transition-all duration-200 hover:border-gray-500 hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-divider disabled:hover:bg-surface cursor-pointer"
      >
        <span>{selectedOption.label}</span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {isOpen && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 mt-1.5 py-1.5 bg-surface-elevated border border-divider rounded-xl shadow-xl z-50 overflow-hidden"
        >
          {options.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`px-4 py-2.5 text-sm font-medium cursor-pointer transition-colors duration-150 ${
                opt.value === value
                  ? 'bg-gray-700/50 text-white'
                  : 'text-gray-200 hover:bg-gray-700/30'
              }`}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Settings() {
  const [openaiKey, setOpenaiKey] = useState('');
  const [openaiKeyStatus, setOpenaiKeyStatus] = useState({ hasKey: false, maskedKey: null });
  const [openaiKeyLoading, setOpenaiKeyLoading] = useState(false);
  const [openaiKeySaving, setOpenaiKeySaving] = useState(false);
  const [openaiKeyClearing, setOpenaiKeyClearing] = useState(false);
  const [openaiKeyError, setOpenaiKeyError] = useState(null);
  const [alphaVantageKey, setAlphaVantageKey] = useState('');
  const [alphaVantageKeyStatus, setAlphaVantageKeyStatus] = useState({
    hasKey: false,
    maskedKey: null,
    keyType: 'free',
  });
  const [alphaVantageKeyTypeSaving, setAlphaVantageKeyTypeSaving] = useState(false);
  const [alphaVantageKeyLoading, setAlphaVantageKeyLoading] = useState(false);
  const [alphaVantageKeySaving, setAlphaVantageKeySaving] = useState(false);
  const [alphaVantageKeyClearing, setAlphaVantageKeyClearing] = useState(false);
  const [alphaVantageKeyError, setAlphaVantageKeyError] = useState(null);

  const [memoryContent, setMemoryContent] = useState('');
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memorySaving, setMemorySaving] = useState(false);
  const [memoryError, setMemoryError] = useState(null);

  const [preferredChartType, setPreferredChartType] = useState('simple');
  const [defaultTimeSeries, setDefaultTimeSeries] = useState('daily');
  const [defaultTechnicalIndicator, setDefaultTechnicalIndicator] = useState('none');
  const [responseVerbosity, setResponseVerbosity] = useState('standard');
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferencesError, setPreferencesError] = useState(null);

  useEffect(() => {
    const loadOpenAIKey = async () => {
      setOpenaiKeyLoading(true);
      setOpenaiKeyError(null);
      try {
        const url = buildApiUrl(API_ENDPOINTS.SETTINGS_OPENAI_API_KEY);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to load OpenAI key status: ${response.statusText}`);
        }
        const data = await response.json();
        setOpenaiKeyStatus({
          hasKey: Boolean(data.has_key),
          maskedKey: data.masked_key || null,
        });
      } catch (err) {
        setOpenaiKeyError(err.message);
      } finally {
        setOpenaiKeyLoading(false);
      }
    };

    const loadAlphaVantageKey = async () => {
      setAlphaVantageKeyLoading(true);
      setAlphaVantageKeyError(null);
      try {
        const url = buildApiUrl(API_ENDPOINTS.SETTINGS_ALPHA_VANTAGE_API_KEY);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to load Alpha Vantage key status: ${response.statusText}`);
        }
        const data = await response.json();
        setAlphaVantageKeyStatus({
          hasKey: Boolean(data.has_key),
          maskedKey: data.masked_key || null,
          keyType: data.key_type || 'free',
        });
      } catch (err) {
        setAlphaVantageKeyError(err.message);
      } finally {
        setAlphaVantageKeyLoading(false);
      }
    };

    const loadMemory = async () => {
      setMemoryLoading(true);
      setMemoryError(null);
      try {
        const url = buildApiUrl(API_ENDPOINTS.SETTINGS_MEMORIES);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to load memory: ${response.statusText}`);
        }
        const data = await response.json();
        setMemoryContent(data.content || '');
      } catch (err) {
        setMemoryError(err.message);
      } finally {
        setMemoryLoading(false);
      }
    };

    const loadUserPreferences = async () => {
      setPreferencesLoading(true);
      setPreferencesError(null);
      try {
        const url = buildApiUrl(API_ENDPOINTS.SETTINGS_USER_PREFERENCES);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to load user preferences: ${response.statusText}`);
        }
        const data = await response.json();
        setPreferredChartType(data.preferred_chart_type || 'simple');
        setDefaultTimeSeries(data.default_time_series || 'daily');
        setDefaultTechnicalIndicator(data.default_technical_indicator || 'none');
        setResponseVerbosity(data.response_verbosity || 'standard');
      } catch (err) {
        setPreferencesError(err.message);
      } finally {
        setPreferencesLoading(false);
      }
    };

    loadMemory();
    loadOpenAIKey();
    loadAlphaVantageKey();
    loadUserPreferences();
  }, []);

  const handleSaveOpenAIKey = async () => {
    if (!openaiKey.trim()) {
      setOpenaiKeyError('OpenAI API key is required.');
      return;
    }
    setOpenaiKeySaving(true);
    setOpenaiKeyError(null);
    try {
      const url = buildApiUrl(API_ENDPOINTS.SETTINGS_OPENAI_API_KEY);
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: openaiKey.trim() }),
      });
      if (!response.ok) {
        throw new Error(`Failed to save OpenAI key: ${response.statusText}`);
      }
      const data = await response.json();
      setOpenaiKeyStatus({
        hasKey: Boolean(data.has_key),
        maskedKey: data.masked_key || null,
      });
      setOpenaiKey('');
    } catch (err) {
      setOpenaiKeyError(err.message);
    } finally {
      setOpenaiKeySaving(false);
    }
  };

  const handleClearOpenAIKey = async () => {
    setOpenaiKeyClearing(true);
    setOpenaiKeyError(null);
    try {
      const url = buildApiUrl(API_ENDPOINTS.SETTINGS_OPENAI_API_KEY);
      const response = await fetch(url, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(`Failed to clear OpenAI key: ${response.statusText}`);
      }
      const data = await response.json();
      setOpenaiKeyStatus({
        hasKey: Boolean(data.has_key),
        maskedKey: data.masked_key || null,
      });
      setOpenaiKey('');
    } catch (err) {
      setOpenaiKeyError(err.message);
    } finally {
      setOpenaiKeyClearing(false);
    }
  };

  const handleSaveAlphaVantageKey = async () => {
    if (!alphaVantageKey.trim()) {
      setAlphaVantageKeyError('Alpha Vantage API key is required.');
      return;
    }
    setAlphaVantageKeySaving(true);
    setAlphaVantageKeyError(null);
    try {
      const url = buildApiUrl(API_ENDPOINTS.SETTINGS_ALPHA_VANTAGE_API_KEY);
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: alphaVantageKey.trim() }),
      });
      if (!response.ok) {
        throw new Error(`Failed to save Alpha Vantage key: ${response.statusText}`);
      }
      const data = await response.json();
      setAlphaVantageKeyStatus({
        hasKey: Boolean(data.has_key),
        maskedKey: data.masked_key || null,
        keyType: data.key_type || 'free',
      });
      setAlphaVantageKey('');
    } catch (err) {
      setAlphaVantageKeyError(err.message);
    } finally {
      setAlphaVantageKeySaving(false);
    }
  };

  const handleClearAlphaVantageKey = async () => {
    setAlphaVantageKeyClearing(true);
    setAlphaVantageKeyError(null);
    try {
      const url = buildApiUrl(API_ENDPOINTS.SETTINGS_ALPHA_VANTAGE_API_KEY);
      const response = await fetch(url, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(`Failed to clear Alpha Vantage key: ${response.statusText}`);
      }
      const data = await response.json();
      setAlphaVantageKeyStatus({
        hasKey: Boolean(data.has_key),
        maskedKey: data.masked_key || null,
        keyType: data.key_type || 'free',
      });
      setAlphaVantageKey('');
    } catch (err) {
      setAlphaVantageKeyError(err.message);
    } finally {
      setAlphaVantageKeyClearing(false);
    }
  };

  const handleToggleAlphaVantageKeyType = async () => {
    const newKeyType = alphaVantageKeyStatus.keyType === 'premium' ? 'free' : 'premium';
    setAlphaVantageKeyTypeSaving(true);
    setAlphaVantageKeyError(null);
    try {
      const url = buildApiUrl(API_ENDPOINTS.SETTINGS_ALPHA_VANTAGE_KEY_TYPE);
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key_type: newKeyType }),
      });
      if (!response.ok) {
        throw new Error(`Failed to update key type: ${response.statusText}`);
      }
      const data = await response.json();
      setAlphaVantageKeyStatus((prev) => ({
        ...prev,
        keyType: data.key_type || newKeyType,
      }));
    } catch (err) {
      setAlphaVantageKeyError(err.message);
    } finally {
      setAlphaVantageKeyTypeSaving(false);
    }
  };

  const handleSaveMemory = async () => {
    setMemorySaving(true);
    setMemoryError(null);
    try {
      const url = buildApiUrl(API_ENDPOINTS.SETTINGS_MEMORIES);
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: memoryContent }),
      });
      if (!response.ok) {
        throw new Error(`Failed to save memory: ${response.statusText}`);
      }
    } catch (err) {
      setMemoryError(err.message);
    } finally {
      setMemorySaving(false);
    }
  };

  const handlePreferredChartTypeChange = async (value) => {
    setPreferredChartType(value);
    setPreferencesSaving(true);
    setPreferencesError(null);
    try {
      const url = buildApiUrl(API_ENDPOINTS.SETTINGS_PREFERRED_CHART_TYPE);
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chart_type: value }),
      });
      if (!response.ok) {
        throw new Error(`Failed to update preferred chart type: ${response.statusText}`);
      }
    } catch (err) {
      setPreferencesError(err.message);
    } finally {
      setPreferencesSaving(false);
    }
  };

  const handleDefaultTimeSeriesChange = async (value) => {
    setDefaultTimeSeries(value);
    setPreferencesSaving(true);
    setPreferencesError(null);
    try {
      const url = buildApiUrl(API_ENDPOINTS.SETTINGS_DEFAULT_TIME_SERIES);
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time_series: value }),
      });
      if (!response.ok) {
        throw new Error(`Failed to update default time series: ${response.statusText}`);
      }
    } catch (err) {
      setPreferencesError(err.message);
    } finally {
      setPreferencesSaving(false);
    }
  };

  const handleDefaultTechnicalIndicatorChange = async (e) => {
    const value = e.target.value;
    setDefaultTechnicalIndicator(value);
    setPreferencesSaving(true);
    setPreferencesError(null);
    try {
      const url = buildApiUrl(API_ENDPOINTS.SETTINGS_DEFAULT_TECHNICAL_INDICATOR);
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indicator: value }),
      });
      if (!response.ok) {
        throw new Error(`Failed to update default technical indicator: ${response.statusText}`);
      }
    } catch (err) {
      setPreferencesError(err.message);
    } finally {
      setPreferencesSaving(false);
    }
  };

  const handleResponseVerbosityChange = async (value) => {
    setResponseVerbosity(value);
    setPreferencesSaving(true);
    setPreferencesError(null);
    try {
      const url = buildApiUrl(API_ENDPOINTS.SETTINGS_RESPONSE_VERBOSITY);
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verbosity: value }),
      });
      if (!response.ok) {
        throw new Error(`Failed to update response verbosity: ${response.statusText}`);
      }
    } catch (err) {
      setPreferencesError(err.message);
    } finally {
      setPreferencesSaving(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-surface overflow-hidden">
      <div className="flex-1 overflow-y-auto px-6 py-6 text-left">
        <div className="space-y-6 max-w-6xl mx-auto">
          <section className="bg-surface-elevated/40 rounded-2xl p-5">
            <h2 className="text-2xl font-semibold text-white mb-2">Credentials</h2>
            <p className="text-xs text-gray-400 border-b border-divider pb-6 mb-6">
                    Your keys are stored securely in the local database and are not displayed in full.
                  </p>
            <div className="space-y-6">
              <div className="space-y-3 pb-6 border-b border-divider">
                <h3 className="text-sm font-medium text-white inline-flex items-center">
                  OpenAI API Key
                  <HelpBubble
                    label="OpenAI API key help"
                    content="Get your API key at platform.openai.com/api-keys. Sign in or create an OpenAI account, then create a new secret key. Your key is stored locally and never sent to third parties."
                  />
                </h3>
                <p className="text-xs text-gray-400">Add your OpenAI API key to enable chat features.</p>
                {openaiKeyLoading ? (
                  <p className="text-sm text-gray-500 italic">Loading OpenAI key status...</p>
                ) : null}
                {openaiKeyError ? <p className="text-sm text-red-400">{openaiKeyError}</p> : null}
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-surface border border-divider rounded-lg text-white text-sm"
                  placeholder={
                    openaiKeyStatus.maskedKey || 'Enter OpenAI API key'
                  }
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                />
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <button
                    onClick={handleSaveOpenAIKey}
                    disabled={openaiKeySaving || !openaiKey.trim()}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 cursor-pointer"
                  >
                    {openaiKeySaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={handleClearOpenAIKey}
                    disabled={openaiKeyClearing || !openaiKeyStatus.hasKey}
                    className="px-4 py-2 bg-surface border border-divider text-gray-200 text-sm font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 cursor-pointer"
                  >
                    {openaiKeyClearing ? 'Clearing...' : 'Clear'}
                  </button>
                  
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-white inline-flex items-center">
                  Alpha Vantage API Key
                  <HelpBubble
                    label="Alpha Vantage API key help"
                    content="Get your API key at alphavantage.co. A free tier is available or you can upgrade to the premium tier. When the Premium toggle is on here, 
                    the chat uses the premium agent with premium-tier API access (higher rate limits and additional endpoints) instead of the standard free agent. 
                    If you have premium toggled on here and do not actually have a premium Alpha Vantage account, you will experience errors."
                  />
                </h3>
                <p className="text-xs text-gray-400">Add your Alpha Vantage API key to enable market data tools.</p>
                {alphaVantageKeyLoading ? (
                  <p className="text-sm text-gray-500 italic">Loading Alpha Vantage key status...</p>
                ) : null}
                {alphaVantageKeyError ? <p className="text-sm text-red-400">{alphaVantageKeyError}</p> : null}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <input
                    type="text"
                    className="flex-1 min-w-0 px-3 py-2 bg-surface border border-divider rounded-lg text-white text-sm"
                    placeholder={
                      alphaVantageKeyStatus.maskedKey || 'Enter Alpha Vantage API key'
                    }
                    value={alphaVantageKey}
                    onChange={(e) => setAlphaVantageKey(e.target.value)}
                  />
                  <label className="flex items-center gap-2 shrink-0 cursor-pointer">
                    <span className="text-sm text-gray-400">Premium API</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={alphaVantageKeyStatus.keyType === 'premium'}
                      disabled={alphaVantageKeyTypeSaving}
                      onClick={handleToggleAlphaVantageKeyType}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50 ${
                        alphaVantageKeyStatus.keyType === 'premium'
                          ? 'bg-green-600'
                          : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                          alphaVantageKeyStatus.keyType === 'premium'
                            ? 'translate-x-5'
                            : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </label>
                </div>
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <button
                    onClick={handleSaveAlphaVantageKey}
                    disabled={alphaVantageKeySaving || !alphaVantageKey.trim()}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 cursor-pointer"
                  >
                    {alphaVantageKeySaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={handleClearAlphaVantageKey}
                    disabled={alphaVantageKeyClearing || !alphaVantageKeyStatus.hasKey}
                    className="px-4 py-2 bg-surface border border-divider text-gray-200 text-sm font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 cursor-pointer"
                  >
                    {alphaVantageKeyClearing ? 'Clearing...' : 'Clear'}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-surface-elevated/40 rounded-2xl p-5">
            <h2 className="text-2xl font-semibold text-white mb-2">User Preferences</h2>
            {preferencesLoading ? (
              <p className="text-sm text-gray-500 italic">Loading preferences...</p>
            ) : null}
            {preferencesError ? <p className="text-sm text-red-400">{preferencesError}</p> : null}
            {preferencesSaving ? (
              <p className="text-sm text-gray-500 italic">Saving...</p>
            ) : null}
            <p className="text-xs text-gray-400 border-b border-divider pb-6 mb-6">
              These preferences are included in the system prompt and affect how the AI responds and creates charts.
            </p>
            <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
              <div className="space-y-2">
                <label id="preferred-chart-type-label" htmlFor="preferred-chart-type" className="block text-sm font-medium text-white">
                  Preferred Chart Type
                </label>
                <PrefDropdown
                  id="preferred-chart-type"
                  value={preferredChartType}
                  options={[
                    { value: 'simple', label: 'Simple' },
                    { value: 'candlestick', label: 'Candlestick' },
                  ]}
                  onChange={handlePreferredChartTypeChange}
                  disabled={preferencesSaving}
                />
                <p className="text-xs text-gray-400">Line chart of close prices vs OHLC candlestick chart.</p>
              </div>
              <div className="space-y-2">
                <label id="default-time-series-label" htmlFor="default-time-series" className="block text-sm font-medium text-white">
                  Default Time Series
                </label>
                <PrefDropdown
                  id="default-time-series"
                  value={defaultTimeSeries}
                  options={[
                    { value: 'daily', label: 'Daily' },
                    { value: 'weekly', label: 'Weekly' },
                    { value: 'monthly', label: 'Monthly' },
                  ]}
                  onChange={handleDefaultTimeSeriesChange}
                  disabled={preferencesSaving}
                />
                <p className="text-xs text-gray-400">Default when user requests a price chart without specifying timeframe.</p>
              </div>
              <div className="space-y-2">
                <label id="default-technical-indicator-label" htmlFor="default-technical-indicator" className="block text-sm font-medium text-white">
                  Default Technical Indicator
                </label>
                <PrefDropdown
                  id="default-technical-indicator"
                  value={defaultTechnicalIndicator}
                  options={[
                    { value: 'none', label: 'None' },
                    { value: 'sma:20', label: 'SMA(20)' },
                    { value: 'sma:50', label: 'SMA(50)' },
                    { value: 'ema:20', label: 'EMA(20)' },
                    { value: 'ema:50', label: 'EMA(50)' },
                    { value: 'wma:20', label: 'WMA(20)' },
                    { value: 'wma:50', label: 'WMA(50)' },
                  ]}
                  onChange={handleDefaultTechnicalIndicatorChange}
                  disabled={preferencesSaving}
                />
                <p className="text-xs text-gray-400">Add this indicator by default to price charts when creating them.</p>
              </div>
              <div className="space-y-2">
                <label id="response-verbosity-label" htmlFor="response-verbosity" className="block text-sm font-medium text-white">
                  Response Verbosity
                </label>
                <PrefDropdown
                  id="response-verbosity"
                  value={responseVerbosity}
                  options={[
                    { value: 'brief', label: 'Brief' },
                    { value: 'standard', label: 'Standard' },
                    { value: 'detailed', label: 'Detailed' },
                  ]}
                  onChange={handleResponseVerbosityChange}
                  disabled={preferencesSaving}
                />
                <p className="text-xs text-gray-400">Controls how concise or thorough the AI responses are.</p>
              </div>
            </div>
          </section>

          <section className="bg-surface-elevated/40 rounded-2xl p-5">
            <h2 className="text-2xl font-semibold text-white mb-2">Memory</h2>
            {memoryLoading ? (
              <p className="text-sm text-gray-500 italic">Loading memory...</p>
            ) : null}
            {memoryError ? <p className="text-sm text-red-400">{memoryError}</p> : null}
            <p className="text-xs text-gray-400 mb-6">
              Store long-term facts, contacts, and preferences.
            </p>
            <textarea
              className="w-full px-3 py-2 bg-surface border border-divider rounded-lg text-white text-sm font-mono resize-y min-h-[200px]"
              placeholder="Enter your preferences as markdown..."
              value={memoryContent}
              onChange={(e) => setMemoryContent(e.target.value.slice(0, 5000))}
              maxLength={5000}
              rows={14}
            />
            <div className="flex items-center justify-between gap-2 mt-3">
            <button
                type="button"
                onClick={handleSaveMemory}
                disabled={memorySaving}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 cursor-pointer"
              >
                {memorySaving ? 'Saving...' : 'Save'}
              </button>
              <span className="text-xs text-gray-500">
                {memoryContent.length}/5000 characters
              </span>

            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

