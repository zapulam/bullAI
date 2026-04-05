import { useState, useEffect, useCallback } from 'react';

export const STORAGE_KEY = 'bullai_instant_prompts_v1';

export const DEFAULT_INSTANT_PROMPTS = [
  'Get me the most important tech stock news today',
  'What stocks may make big moves today?',
  'How is the market moving today?'
];

function normalizePrompts(raw) {
  if (!Array.isArray(raw)) return null;
  const cleaned = raw.map((s) => String(s).trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : null;
}

function loadFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored == null || stored === '') {
      return [...DEFAULT_INSTANT_PROMPTS];
    }
    const parsed = JSON.parse(stored);
    const normalized = normalizePrompts(parsed);
    return normalized ?? [...DEFAULT_INSTANT_PROMPTS];
  } catch {
    return [...DEFAULT_INSTANT_PROMPTS];
  }
}

export function useInstantPrompts() {
  const [prompts, setPrompts] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setPrompts(loadFromStorage());
    setLoaded(true);
  }, []);

  const savePrompts = useCallback((next) => {
    const cleaned = normalizePrompts(next) ?? [...DEFAULT_INSTANT_PROMPTS];
    setPrompts(cleaned);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    } catch {
      // ignore quota / private mode
    }
  }, []);

  return { prompts, loaded, savePrompts };
}
