import { useState, useEffect, useCallback } from 'react';
import { getRecipes } from '../services/recipeService';
import type { Recipe } from '../types';

export const useRecipes = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRecipes();
      setRecipes(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      console.error("Error loading recipes:", err);
      setError("Impossible de charger les recettes.");
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  return { recipes, loading, error, refresh: fetchRecipes };
};
