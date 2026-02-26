import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ShoppingCart,
  Check,
  CheckSquare,
  Square,
  Loader2,
  AlertTriangle,
  ChefHat,
} from 'lucide-react';
import { getRecipeById, addToShoppingList } from '../services/recipeService';
import type { RecipeWithIngredients } from '../types';

// === COMPONENT ===

export const RecipeShoppingList: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [recipe, setRecipe] = useState<RecipeWithIngredients | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  // Load recipe
  useEffect(() => {
    loadRecipe();
  }, [id]);

  const loadRecipe = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const data = await getRecipeById(id);
      if (!data) {
        setError('Recette non trouvée');
        return;
      }
      setRecipe(data);

      // Pre-check items NOT in stock
      const notInStock = new Set<string>();
      data.ingredients.forEach((ing) => {
        if (!ing.inStock) {
          notInStock.add(ing.id);
        }
      });
      setCheckedIds(notInStock);
    } catch (err: any) {
      setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  // Toggle single item
  const toggleItem = (ingredientId: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(ingredientId)) {
        next.delete(ingredientId);
      } else {
        next.add(ingredientId);
      }
      return next;
    });
  };

  // Select all / deselect all
  const selectAll = () => {
    if (!recipe) return;
    setCheckedIds(new Set(recipe.ingredients.map((ing) => ing.id)));
  };

  const deselectAll = () => {
    setCheckedIds(new Set());
  };

  // Selected count
  const selectedCount = checkedIds.size;

  // Submit to shopping list
  const handleAddToShoppingList = async () => {
    if (!recipe || selectedCount === 0) return;
    setSubmitting(true);
    try {
      const items = recipe.ingredients
        .filter((ing) => checkedIds.has(ing.id))
        .map((ing) => ({
          name: ing.name,
          quantity: ing.amount,
          unit: ing.unit,
          linkedRecipeId: recipe.id,
        }));
      await addToShoppingList(items);
      navigate('/shopping-list');
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'ajout");
      setSubmitting(false);
    }
  };

  // === RENDER: Loading ===
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-kitchen-500" />
      </div>
    );
  }

  // === RENDER: Error / 404 ===
  if (error || !recipe) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-16 h-16 mx-auto text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-2">
          {error || 'Recette non trouvée'}
        </h2>
        <button
          onClick={() => navigate(-1)}
          className="text-kitchen-600 hover:underline"
        >
          Retour
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ===== Header ===== */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-stone-600 dark:text-stone-400" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-xl sm:text-2xl font-bold text-stone-900 dark:text-white truncate">
            {recipe.name}
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Sélectionnez les ingrédients à ajouter
          </p>
        </div>
        <ShoppingCart className="w-6 h-6 text-kitchen-500 flex-shrink-0" />
      </div>

      {/* ===== Select/Deselect Buttons ===== */}
      <div className="flex items-center gap-3">
        <button
          onClick={selectAll}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 text-sm font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
        >
          <CheckSquare className="w-4 h-4" />
          Tout sélectionner
        </button>
        <button
          onClick={deselectAll}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 text-sm font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
        >
          <Square className="w-4 h-4" />
          Tout désélectionner
        </button>
      </div>

      {/* ===== Ingredients List ===== */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 divide-y divide-stone-100 dark:divide-stone-800">
        {recipe.ingredients.map((ing) => {
          const isChecked = checkedIds.has(ing.id);
          const amountDisplay = [
            ing.amount != null ? ing.amount : null,
            ing.unit || null,
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <button
              key={ing.id}
              onClick={() => toggleItem(ing.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
            >
              {/* Checkbox */}
              <div
                className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors ${
                  isChecked
                    ? 'bg-kitchen-500 border-kitchen-500'
                    : 'border-stone-300 dark:border-stone-600'
                }`}
              >
                {isChecked && <Check className="w-3.5 h-3.5 text-white" />}
              </div>

              {/* Ingredient info */}
              <div className="flex-1 min-w-0">
                <span className="text-stone-900 dark:text-white">
                  {amountDisplay && (
                    <span className="font-medium">{amountDisplay} </span>
                  )}
                  {ing.name}
                </span>
                {ing.optional && (
                  <span className="ml-2 text-stone-400 dark:text-stone-500 text-sm italic">
                    (optionnel)
                  </span>
                )}
              </div>

              {/* Stock status badge */}
              <div className="flex-shrink-0">
                {ing.inStock ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
                    <Check className="w-3 h-3" />
                    En stock
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs font-medium">
                    <ShoppingCart className="w-3 h-3" />
                    À acheter
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* ===== Summary & Action ===== */}
      <div className="sticky bottom-0 bg-stone-50/80 dark:bg-stone-950/80 backdrop-blur-sm pb-6 pt-4 -mx-4 px-4 space-y-3">
        <p className="text-center text-sm text-stone-600 dark:text-stone-400">
          <span className="font-semibold text-stone-900 dark:text-white">
            {selectedCount}
          </span>{' '}
          article{selectedCount > 1 ? 's' : ''} sélectionné{selectedCount > 1 ? 's' : ''}
        </p>

        <button
          onClick={handleAddToShoppingList}
          disabled={selectedCount === 0 || submitting}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-kitchen-500 to-kitchen-600 hover:from-kitchen-600 hover:to-kitchen-700 text-white font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {submitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <ShoppingCart className="w-5 h-5" />
          )}
          Ajouter à la liste de courses
        </button>
      </div>
    </div>
  );
};
