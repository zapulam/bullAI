import { currentEnv } from './environment.js';

const getApiBaseUrl = () => {
  return currentEnv.API_BASE_URL;
};

export const API_BASE_URL = getApiBaseUrl();

export const buildApiUrl = (endpoint) => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
};

export const API_ENDPOINTS = {
  CHAT: 'chat/generate',
  CHAT_HISTORY: 'chat/history',
  CHAT_CLEAR: 'chat/clear',
  CHAT_SESSIONS: 'chat/sessions',
  CHAT_SESSION_DELETE: 'chat/sessions',
  CHARTS: 'charts',
  SETTINGS_MEMORIES: 'settings/memories',
  SETTINGS_OPENAI_API_KEY: 'settings/openai-api-key',
  SETTINGS_ALPHA_VANTAGE_API_KEY: 'settings/alpha-vantage-api-key',
  SETTINGS_ALPHA_VANTAGE_KEY_TYPE: 'settings/alpha-vantage-key-type',
  SETTINGS_USER_PREFERENCES: 'settings/user-preferences',
  SETTINGS_PREFERRED_CHART_TYPE: 'settings/preferred-chart-type',
  SETTINGS_DEFAULT_TIME_SERIES: 'settings/default-time-series',
  SETTINGS_DEFAULT_TECHNICAL_INDICATOR: 'settings/default-technical-indicator',
  SETTINGS_RESPONSE_VERBOSITY: 'settings/response-verbosity',
};

export const apiCall = async (endpoint, options = {}) => {
  const url = buildApiUrl(endpoint);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    
    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API call to ${endpoint} failed:`, error);
    throw error;
  }
};

