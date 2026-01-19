import { useState, useEffect, useCallback } from 'react';
import { getAIConfig, saveAIConfig } from '../services/aiService';
import type { AIConfig } from '../types';

export const useAIConfig = () => {
  const [config, setConfig] = useState<AIConfig>({
    provider: 'GEMINI',
    keys: { gemini: '', openai: '', mistral: '' }
  });
  const [loading, setLoading] = useState(true);

  const fetchConfig = useCallback(() => {
    setLoading(true);
    try {
      const data = getAIConfig();
      setConfig(data);
    } catch (err) {
      console.error("Error loading AI config:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateConfig = useCallback((newConfig: AIConfig) => {
    saveAIConfig(newConfig);
    setConfig(newConfig);
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return { config, loading, updateConfig, refresh: fetchConfig };
};
