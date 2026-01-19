import { useState, useEffect, useCallback } from 'react';
import { getStorageUnits } from '../services/ingredientService';
import type { StorageUnit } from '../types';

export const useStorage = () => {
  const [units, setUnits] = useState<StorageUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getStorageUnits();
      setUnits(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      console.error("Error loading storage units:", err);
      setError("Impossible de charger les rangements.");
      setUnits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  return { units, loading, error, refresh: fetchUnits };
};
