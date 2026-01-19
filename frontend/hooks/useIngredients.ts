import { useState, useEffect, useCallback } from 'react';
import { getInventory } from '../services/ingredientService';
import type { InventoryIngredient } from '../types';

export const useIngredients = () => {
  const [ingredients, setIngredients] = useState<InventoryIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIngredients = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getInventory();
      setIngredients(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      console.error("Error loading ingredients:", err);
      setError("Impossible de charger les ingrédients.");
      setIngredients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIngredients();
  }, [fetchIngredients]);

  return { ingredients, loading, error, refresh: fetchIngredients };
};
