import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS, buildApiUrl } from '../config/api';

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
  });
  const [alphaVantageKeyLoading, setAlphaVantageKeyLoading] = useState(false);
  const [alphaVantageKeySaving, setAlphaVantageKeySaving] = useState(false);
  const [alphaVantageKeyClearing, setAlphaVantageKeyClearing] = useState(false);
  const [alphaVantageKeyError, setAlphaVantageKeyError] = useState(null);

  const [memoryContent, setMemoryContent] = useState('');
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memorySaving, setMemorySaving] = useState(false);
  const [memoryError, setMemoryError] = useState(null);

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

    loadMemory();
    loadOpenAIKey();
    loadAlphaVantageKey();
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
      });
      setAlphaVantageKey('');
    } catch (err) {
      setAlphaVantageKeyError(err.message);
    } finally {
      setAlphaVantageKeyClearing(false);
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
                <h3 className="text-sm font-medium text-white">OpenAI API Key</h3>
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
                <h3 className="text-sm font-medium text-white">Alpha Vantage API Key</h3>
                <p className="text-xs text-gray-400">Add your Alpha Vantage API key to enable market data tools.</p>
                {alphaVantageKeyLoading ? (
                  <p className="text-sm text-gray-500 italic">Loading Alpha Vantage key status...</p>
                ) : null}
                {alphaVantageKeyError ? <p className="text-sm text-red-400">{alphaVantageKeyError}</p> : null}
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-surface border border-divider rounded-lg text-white text-sm"
                  placeholder={
                    alphaVantageKeyStatus.maskedKey || 'Enter Alpha Vantage API key'
                  }
                  value={alphaVantageKey}
                  onChange={(e) => setAlphaVantageKey(e.target.value)}
                />
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
            <h2 className="text-2xl font-semibold text-white mb-2">Memory</h2>
            {memoryLoading ? (
              <p className="text-sm text-gray-500 italic">Loading memory...</p>
            ) : null}
            {memoryError ? <p className="text-sm text-red-400">{memoryError}</p> : null}
            <p className="text-xs text-gray-400 mb-6">
              Store long-term facts, contacts, and preferences. Markdown is supported.
            </p>
            <textarea
              className="w-full px-3 py-2 bg-surface border border-divider rounded-lg text-white text-sm font-mono resize-y min-h-[200px]"
              placeholder="Enter your memories as markdown..."
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

