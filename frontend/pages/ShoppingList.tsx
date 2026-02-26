import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import {
  ShoppingCart,
  Trash2,
  Check,
  Loader2,
  BookOpen,
  ChefHat,
  Package,
  AlertTriangle,
} from 'lucide-react';
import {
  getShoppingList,
  updateShoppingListItem,
  deleteShoppingListItem,
  clearShoppingList,
  getRecipeById,
} from '../services/recipeService';
import type { ShoppingListItem } from '../types';

// === TYPES ===

interface ShoppingGroup {
  recipeId: string | null;
  recipeName: string;
  items: ShoppingListItem[];
}

// === COMPONENT ===

export const ShoppingList: React.FC = () => {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recipeNames, setRecipeNames] = useState<Record<string, string>>({});
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // Load shopping list
  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getShoppingList();
      setItems(data);

      // Resolve recipe names for linked items
      const recipeIds = [
        ...new Set(
          data
            .map((item) => item.linkedRecipeId)
            .filter((id): id is string => !!id)
        ),
      ];

      const names: Record<string, string> = {};
      await Promise.all(
        recipeIds.map(async (recipeId) => {
          try {
            const recipe = await getRecipeById(recipeId);
            if (recipe) {
              names[recipeId] = recipe.name;
            }
          } catch {
            // Ignore - will fall back to generic name
          }
        })
      );
      setRecipeNames(names);
    } catch (err: any) {
      setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  // Group items by linkedRecipeId
  const groups = useMemo((): ShoppingGroup[] => {
    const grouped = new Map<string | null, ShoppingListItem[]>();

    items.forEach((item) => {
      const key = item.linkedRecipeId || null;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    });

    const result: ShoppingGroup[] = [];

    // Recipe groups first
    grouped.forEach((groupItems, recipeId) => {
      if (recipeId) {
        result.push({
          recipeId,
          recipeName: recipeNames[recipeId] || 'Recette',
          items: groupItems,
        });
      }
    });

    // "Autres" group last
    const otherItems = grouped.get(null);
    if (otherItems && otherItems.length > 0) {
      result.push({
        recipeId: null,
        recipeName: 'Autres',
        items: otherItems,
      });
    }

    return result;
  }, [items, recipeNames]);

  // Toggle checked
  const handleToggleChecked = async (item: ShoppingListItem) => {
    const newChecked = !item.isChecked;
    // Optimistic update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isChecked: newChecked } : i))
    );
    try {
      await updateShoppingListItem(item.id, { isChecked: newChecked });
    } catch (err: any) {
      // Revert on error
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, isChecked: !newChecked } : i
        )
      );
    }
  };

  // Delete single item
  const handleDelete = async (id: string) => {
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      await deleteShoppingListItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err: any) {
      setError(err.message || "Erreur lors de la suppression");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // Clear all
  const handleClearAll = async () => {
    setClearing(true);
    try {
      await clearShoppingList();
      setItems([]);
      setShowClearConfirm(false);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression');
    } finally {
      setClearing(false);
    }
  };

  // Counts
  const totalCount = items.length;
  const checkedCount = items.filter((i) => i.isChecked).length;

  // === RENDER: Loading ===
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-kitchen-500" />
      </div>
    );
  }

  // === RENDER: Empty state ===
  if (items.length === 0 && !error) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 dark:text-white">
            Liste de courses
          </h1>
        </div>

        <div className="text-center py-12">
          <ShoppingCart className="w-16 h-16 mx-auto text-stone-300 dark:text-stone-700 mb-4" />
          <h3 className="text-lg font-medium text-stone-900 dark:text-white mb-2">
            Votre liste de courses est vide
          </h3>
          <p className="text-stone-500 dark:text-stone-400 mb-6">
            Ajoutez des ingrédients depuis vos recettes
          </p>
          <NavLink
            to="/recipes"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-kitchen-500 to-kitchen-600 hover:from-kitchen-600 hover:to-kitchen-700 text-white font-medium shadow-lg hover:shadow-xl transition-all"
          >
            <BookOpen className="w-5 h-5" />
            Voir les recettes
          </NavLink>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ===== Header ===== */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 dark:text-white">
            Liste de courses
          </h1>
          <span className="px-2.5 py-1 rounded-full bg-kitchen-100 dark:bg-kitchen-900/30 text-kitchen-700 dark:text-kitchen-300 text-sm font-semibold">
            {totalCount}
          </span>
        </div>

        {items.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Tout supprimer
          </button>
        )}
      </div>

      {/* Progress */}
      {totalCount > 0 && (
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-stone-600 dark:text-stone-400">
              Progression
            </span>
            <span className="text-sm font-medium text-stone-900 dark:text-white">
              {checkedCount} / {totalCount}
            </span>
          </div>
          <div className="w-full h-2 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-kitchen-500 to-kitchen-600 rounded-full transition-all duration-300"
              style={{
                width: `${totalCount > 0 ? (checkedCount / totalCount) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ===== Grouped Items ===== */}
      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.recipeId || 'others'}>
            {/* Group Header */}
            <div className="flex items-center gap-2 mb-3">
              {group.recipeId ? (
                <NavLink
                  to={`/recipe/${group.recipeId}`}
                  className="flex items-center gap-2 text-stone-900 dark:text-white hover:text-kitchen-600 dark:hover:text-kitchen-400 transition-colors"
                >
                  <ChefHat className="w-4 h-4 text-kitchen-500" />
                  <h2 className="font-semibold">{group.recipeName}</h2>
                </NavLink>
              ) : (
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-stone-400 dark:text-stone-500" />
                  <h2 className="font-semibold text-stone-900 dark:text-white">
                    {group.recipeName}
                  </h2>
                </div>
              )}
              <span className="px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 text-xs font-medium">
                {group.items.length}
              </span>
            </div>

            {/* Items */}
            <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 divide-y divide-stone-100 dark:divide-stone-800">
              {group.items.map((item) => {
                const isDeleting = deletingIds.has(item.id);
                const quantityDisplay = [
                  item.quantity != null && item.quantity > 0
                    ? item.quantity
                    : null,
                  item.unit || null,
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-4 py-3 first:rounded-t-2xl last:rounded-b-2xl"
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => handleToggleChecked(item)}
                      className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors ${
                        item.isChecked
                          ? 'bg-kitchen-500 border-kitchen-500'
                          : 'border-stone-300 dark:border-stone-600 hover:border-kitchen-400'
                      }`}
                    >
                      {item.isChecked && (
                        <Check className="w-3.5 h-3.5 text-white" />
                      )}
                    </button>

                    {/* Item info */}
                    <div className="flex-1 min-w-0">
                      <span
                        className={`transition-colors ${
                          item.isChecked
                            ? 'line-through text-stone-400 dark:text-stone-600'
                            : 'text-stone-900 dark:text-white'
                        }`}
                      >
                        {item.name}
                      </span>
                      {quantityDisplay && (
                        <span
                          className={`ml-2 text-sm transition-colors ${
                            item.isChecked
                              ? 'text-stone-300 dark:text-stone-700'
                              : 'text-stone-500 dark:text-stone-400'
                          }`}
                        >
                          {quantityDisplay}
                        </span>
                      )}
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={isDeleting}
                      className="p-1.5 rounded-lg text-stone-400 dark:text-stone-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ===== Clear Confirmation Modal ===== */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-semibold text-stone-900 dark:text-white mb-2">
              Tout supprimer ?
            </h3>
            <p className="text-stone-600 dark:text-stone-400 mb-6">
              Cette action supprimera tous les articles de votre liste de
              courses. Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-stone-300 dark:border-stone-700 font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleClearAll}
                disabled={clearing}
                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              >
                {clearing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Trash2 className="w-5 h-5" />
                )}
                Supprimer tout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
