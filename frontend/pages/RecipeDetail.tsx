import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, NavLink } from 'react-router-dom';
import {
  ArrowLeft,
  Heart,
  Edit3,
  Trash2,
  Clock,
  Users,
  ChefHat,
  ShoppingCart,
  Sparkles,
  Check,
  Link2,
  ExternalLink,
  BookOpen,
  Flame,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { getRecipeById, deleteRecipe, updateRecipe, linkRecipeIngredient } from '../services/recipeService';
import { matchIngredientsToInventory, suggestEnhancements } from '../services/aiService';
import { useIngredients } from '../hooks/useIngredients';
import type { RecipeWithIngredients, RecipeIngredientWithStock, RecipeCategory, Difficulty, RecipeEnhancement } from '../types';

// === CONSTANTS ===

const RECIPE_CATEGORY_COLORS: Record<string, string> = {
  ENTREE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  PLAT: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  DESSERT: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  SAUCE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  ACCOMPAGNEMENT: 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300',
  BOISSON: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  SNACK: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
};

const RECIPE_CATEGORY_LABELS: Record<RecipeCategory, string> = {
  ENTREE: 'Entr\u00e9e',
  PLAT: 'Plat',
  DESSERT: 'Dessert',
  SAUCE: 'Sauce',
  ACCOMPAGNEMENT: 'Accompagnement',
  BOISSON: 'Boisson',
  SNACK: 'Snack',
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  EASY: 'Facile',
  MEDIUM: 'Moyen',
  HARD: 'Difficile',
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  EASY: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  MEDIUM: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  HARD: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const SOURCE_LABELS: Record<string, string> = {
  MANUAL: 'Manuelle',
  AI: 'IA',
  IMPORTED: 'Import\u00e9e',
};

// === HELPERS ===

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

// === COMPONENT ===

export const RecipeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [recipe, setRecipe] = useState<RecipeWithIngredients | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Ingredient matching
  const { ingredients: inventoryIngredients } = useIngredients();
  const [matching, setMatching] = useState(false);
  const [matchMessage, setMatchMessage] = useState('');

  // Coup de pep's
  const [enhancements, setEnhancements] = useState<RecipeEnhancement | null>(null);
  const [loadingEnhancements, setLoadingEnhancements] = useState(false);
  const [enhancementError, setEnhancementError] = useState('');

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
        setError('Recette non trouv\u00e9e');
        return;
      }
      setRecipe(data);
    } catch (err: any) {
      setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  // Toggle favorite
  const handleToggleFavorite = async () => {
    if (!recipe) return;
    try {
      const updated = await updateRecipe(recipe.id, {
        isFavorite: !recipe.isFavorite,
      });
      setRecipe((prev) => (prev ? { ...prev, isFavorite: updated.isFavorite } : prev));
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  // Delete recipe
  const handleDelete = async () => {
    if (!recipe) return;
    setDeleting(true);
    try {
      await deleteRecipe(recipe.id);
      navigate('/recipes');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression');
      setDeleting(false);
    }
  };

  // Auto-match ingredients to inventory
  const handleAutoMatch = async () => {
    if (!recipe) return;
    setMatching(true);
    setMatchMessage('');
    try {
      const unmatchedIngredients = recipe.ingredients
        .filter(ing => !ing.ingredientId)
        .map(ing => ing.name);

      if (unmatchedIngredients.length === 0) {
        setMatchMessage('Tous les ingr\u00e9dients sont d\u00e9j\u00e0 li\u00e9s !');
        setMatching(false);
        return;
      }

      const inventory = inventoryIngredients.map(i => ({
        id: i.id,
        name: i.name,
        category: i.category,
      }));

      const matches = await matchIngredientsToInventory(unmatchedIngredients, inventory);
      let linked = 0;

      for (const match of matches) {
        if (match.matchedIngredientId && match.confidence !== 'LOW') {
          const ingLine = recipe.ingredients.find(
            i => i.name === match.recipeIngredientName && !i.ingredientId
          );
          if (ingLine) {
            try {
              await linkRecipeIngredient(recipe.id, ingLine.id, match.matchedIngredientId);
              linked++;
            } catch { /* skip failed links */ }
          }
        }
      }

      setMatchMessage(
        linked > 0
          ? `${linked} ingr\u00e9dient${linked > 1 ? 's' : ''} li\u00e9${linked > 1 ? 's' : ''} \u00e0 l'inventaire !`
          : 'Aucun nouveau match trouv\u00e9.'
      );
      if (linked > 0) await loadRecipe();
    } catch (err: any) {
      setMatchMessage(err.message || 'Erreur lors du matching IA');
    } finally {
      setMatching(false);
    }
  };

  // Coup de pep's
  const handleGetEnhancements = async () => {
    if (!recipe) return;
    setLoadingEnhancements(true);
    setEnhancementError('');
    try {
      const result = await suggestEnhancements(
        {
          name: recipe.name,
          ingredients: recipe.ingredients.map(i => i.name),
          instructions: recipe.instructions || [],
        },
        inventoryIngredients.map(i => ({ name: i.name, category: i.category }))
      );
      setEnhancements(result);
    } catch (err: any) {
      setEnhancementError(err.message || 'Erreur lors de la g\u00e9n\u00e9ration des suggestions');
    } finally {
      setLoadingEnhancements(false);
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
          {error || 'Recette non trouv\u00e9e'}
        </h2>
        <NavLink to="/recipes" className="text-kitchen-600 hover:underline">
          Retour aux recettes
        </NavLink>
      </div>
    );
  }

  // Derived data
  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
  const inStockCount = recipe.ingredients.filter((ing) => ing.inStock).length;
  const totalIngredients = recipe.ingredients.length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ===== Header Bar ===== */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/recipes')}
          className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-stone-600 dark:text-stone-400" />
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleFavorite}
            className={`p-2 rounded-lg transition-colors ${
              recipe.isFavorite
                ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
                : 'text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
            title={recipe.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            <Heart className={`w-5 h-5 ${recipe.isFavorite ? 'fill-current' : ''}`} />
          </button>

          <NavLink
            to={`/recipe/${recipe.id}/edit`}
            className="p-2 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors"
            title="Modifier"
          >
            <Edit3 className="w-5 h-5" />
          </NavLink>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Supprimer"
          >
            <Trash2 className="w-5 h-5" />
          </button>

          <NavLink
            to={`/recipe/${recipe.id}/cook`}
            className="p-2 text-stone-300 dark:text-stone-600 cursor-not-allowed rounded-lg"
            onClick={(e) => e.preventDefault()}
            title="Cuisiner (bient\u00f4t disponible)"
          >
            <Flame className="w-5 h-5" />
          </NavLink>
        </div>
      </div>

      {/* ===== Main Info Card ===== */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 dark:text-white mb-3">
          {recipe.name}
        </h1>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span
            className={`px-3 py-1 rounded-lg text-sm font-medium ${
              RECIPE_CATEGORY_COLORS[recipe.category] ||
              'bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-300'
            }`}
          >
            {RECIPE_CATEGORY_LABELS[recipe.category] || recipe.category}
          </span>

          {recipe.cuisine && (
            <span className="px-3 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-sm">
              {recipe.cuisine}
            </span>
          )}

          <span className={`px-3 py-1 rounded-lg text-sm font-medium ${DIFFICULTY_COLORS[recipe.difficulty]}`}>
            {DIFFICULTY_LABELS[recipe.difficulty]}
          </span>

          <span className="px-3 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 text-sm flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            {SOURCE_LABELS[recipe.source] || recipe.source}
          </span>
        </div>

        {/* Time & Servings */}
        <div className="flex flex-wrap items-center gap-4 text-stone-600 dark:text-stone-400">
          {totalTime > 0 && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-kitchen-500" />
              <span className="text-sm">
                {recipe.prepTime > 0 && (
                  <>
                    <span className="font-medium text-stone-900 dark:text-white">
                      {formatTime(recipe.prepTime)}
                    </span>
                    {' pr\u00e9p'}
                  </>
                )}
                {recipe.prepTime > 0 && recipe.cookTime > 0 && ' + '}
                {recipe.cookTime > 0 && (
                  <>
                    <span className="font-medium text-stone-900 dark:text-white">
                      {formatTime(recipe.cookTime)}
                    </span>
                    {' cuisson'}
                  </>
                )}
              </span>
            </div>
          )}

          {recipe.servings > 0 && (
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-kitchen-500" />
              <span className="text-sm">
                <span className="font-medium text-stone-900 dark:text-white">{recipe.servings}</span>
                {recipe.servingsText ? ` (${recipe.servingsText})` : ' portions'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ===== Ingredients Section ===== */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg text-stone-900 dark:text-white flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-kitchen-500" />
            Ingr\u00e9dients
            <span className="ml-1 px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 text-xs font-medium">
              {totalIngredients}
            </span>
          </h2>

          {recipe.unmatchedCount > 0 && (
            <button
              onClick={handleAutoMatch}
              disabled={matching}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-kitchen-50 dark:bg-kitchen-900/20 text-kitchen-600 dark:text-kitchen-400 text-sm font-medium hover:bg-kitchen-100 dark:hover:bg-kitchen-900/30 disabled:opacity-50 transition-colors"
            >
              {matching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              Lier \u00e0 l'inventaire
            </button>
          )}
        </div>

        {matchMessage && (
          <p className="text-sm text-kitchen-600 dark:text-kitchen-400 mb-3 bg-kitchen-50 dark:bg-kitchen-900/20 px-3 py-2 rounded-lg">
            {matchMessage}
          </p>
        )}

        <ul className="space-y-3">
          {recipe.ingredients.map((ing) => (
            <IngredientRow key={ing.id} ingredient={ing} />
          ))}
        </ul>

        {/* Stock summary */}
        <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800 text-sm text-stone-500 dark:text-stone-400">
          <span className="font-medium text-stone-700 dark:text-stone-300">{inStockCount}</span>
          {' '}ingr\u00e9dient{inStockCount > 1 ? 's' : ''} en stock sur{' '}
          <span className="font-medium text-stone-700 dark:text-stone-300">{totalIngredients}</span>
        </div>
      </div>

      {/* ===== Coup de pep's AI Card ===== */}
      <div className="bg-gradient-to-br from-kitchen-500/10 to-amber-500/10 dark:from-kitchen-500/5 dark:to-amber-500/5 rounded-2xl border border-kitchen-200 dark:border-kitchen-800/50 p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-kitchen-100 dark:bg-kitchen-900/50 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-kitchen-600 dark:text-kitchen-400" />
          </div>
          <div>
            <h2 className="font-semibold text-stone-900 dark:text-white">
              Coup de pep's
            </h2>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Sublimez cette recette avec vos ingr\u00e9dients sp\u00e9ciaux
            </p>
          </div>
        </div>

        {enhancementError && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-3">{enhancementError}</p>
        )}

        {!enhancements ? (
          <button
            onClick={handleGetEnhancements}
            disabled={loadingEnhancements || inventoryIngredients.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-kitchen-600 hover:bg-kitchen-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loadingEnhancements ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {loadingEnhancements ? 'Analyse en cours...' : 'Obtenir des suggestions'}
          </button>
        ) : (
          <div className="space-y-3">
            {enhancements.suggestions.map((s, i) => (
              <div key={i} className="flex gap-3 p-3 rounded-xl bg-white/60 dark:bg-stone-800/60">
                <div className="flex-shrink-0 mt-0.5">
                  {s.type === 'ADDITION' && <span className="text-lg">+</span>}
                  {s.type === 'SUBSTITUTION' && <span className="text-lg">\u21c4</span>}
                  {s.type === 'TECHNIQUE' && <span className="text-lg">\ud83d\udd25</span>}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-stone-900 dark:text-white text-sm">
                      {s.ingredientFromInventory}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      s.impact === 'TRANSFORMATIVE'
                        ? 'bg-kitchen-100 text-kitchen-700 dark:bg-kitchen-900/30 dark:text-kitchen-300'
                        : s.impact === 'NOTICEABLE'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                        : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
                    }`}>
                      {s.impact === 'TRANSFORMATIVE' ? 'Transforme' : s.impact === 'NOTICEABLE' ? 'Notable' : 'Subtil'}
                    </span>
                  </div>
                  <p className="text-sm text-stone-700 dark:text-stone-300">{s.description}</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 italic">{s.reason}</p>
                </div>
              </div>
            ))}

            {enhancements.chefComment && (
              <div className="mt-3 pt-3 border-t border-kitchen-200/50 dark:border-kitchen-800/30">
                <p className="text-sm text-kitchen-700 dark:text-kitchen-300 italic">
                  \ud83d\udc68\u200d\ud83c\udf73 {enhancements.chefComment}
                </p>
              </div>
            )}
          </div>
        )}

        {inventoryIngredients.length === 0 && !enhancements && (
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-2">
            Ajoutez des ingr\u00e9dients \u00e0 votre inventaire pour activer cette fonctionnalit\u00e9.
          </p>
        )}
      </div>

      {/* ===== Instructions Section ===== */}
      {recipe.instructions && recipe.instructions.length > 0 && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
          <h2 className="font-semibold text-lg text-stone-900 dark:text-white mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-kitchen-500" />
            Instructions
          </h2>

          <ol className="space-y-4">
            {recipe.instructions.map((step, index) => (
              <li key={index} className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-kitchen-100 dark:bg-kitchen-900/30 text-kitchen-700 dark:text-kitchen-300 flex items-center justify-center text-sm font-semibold">
                  {index + 1}
                </span>
                <p className="text-stone-700 dark:text-stone-300 leading-relaxed pt-1">
                  {step}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ===== Tips Section ===== */}
      {recipe.tips && recipe.tips.length > 0 && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
          <h2 className="font-semibold text-lg text-stone-900 dark:text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            Astuces
          </h2>
          <ul className="space-y-2">
            {recipe.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-stone-600 dark:text-stone-400">
                <span className="text-amber-500 mt-1 flex-shrink-0">&bull;</span>
                <span className="leading-relaxed">{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ===== Wine Pairings Section ===== */}
      {recipe.winePairings && recipe.winePairings.length > 0 && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
          <h2 className="font-semibold text-lg text-stone-900 dark:text-white mb-4 flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500" />
            Accords vins
          </h2>
          <div className="flex flex-wrap gap-2">
            {recipe.winePairings.map((wine, i) => (
              <span
                key={i}
                className="px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm font-medium"
              >
                {wine}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ===== Variations Section ===== */}
      {recipe.variations && recipe.variations.length > 0 && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
          <h2 className="font-semibold text-lg text-stone-900 dark:text-white mb-4 flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-purple-500" />
            Variations
          </h2>
          <div className="flex flex-wrap gap-2">
            {recipe.variations.map((variation, i) => (
              <span
                key={i}
                className="px-3 py-1.5 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-sm font-medium"
              >
                {variation}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ===== Source URL ===== */}
      {recipe.sourceUrl && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-4">
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 text-kitchen-600 dark:text-kitchen-400 hover:text-kitchen-700 dark:hover:text-kitchen-300 transition-colors"
          >
            <ExternalLink className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm truncate">{recipe.sourceUrl}</span>
          </a>
        </div>
      )}

      {/* ===== Bottom Action Bar ===== */}
      <div className="flex gap-3 pb-6">
        <NavLink
          to={`/recipe/${recipe.id}/shopping`}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-medium hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
        >
          <ShoppingCart className="w-5 h-5" />
          Liste de courses
        </NavLink>

        <NavLink
          to={`/recipe/${recipe.id}/edit`}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-kitchen-500 hover:bg-kitchen-600 text-white font-semibold transition-colors"
        >
          <Edit3 className="w-5 h-5" />
          Modifier
        </NavLink>
      </div>

      {/* ===== Delete Confirmation Modal ===== */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-semibold text-stone-900 dark:text-white mb-2">
              Supprimer cette recette ?
            </h3>
            <p className="text-stone-600 dark:text-stone-400 mb-6">
              Cette action supprimera d\u00e9finitivement &laquo;&nbsp;{recipe.name}&nbsp;&raquo; et toutes ses donn\u00e9es associ\u00e9es.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-stone-300 dark:border-stone-700 font-medium hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              >
                {deleting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Trash2 className="w-5 h-5" />
                )}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// === SUB-COMPONENT: Ingredient Row ===

interface IngredientRowProps {
  ingredient: RecipeIngredientWithStock;
}

const IngredientRow: React.FC<IngredientRowProps> = ({ ingredient: ing }) => {
  const amountDisplay = [
    ing.amount != null ? ing.amount : null,
    ing.unit || null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li className="flex items-center justify-between py-2 px-3 rounded-lg bg-stone-50 dark:bg-stone-800/50">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-stone-900 dark:text-white">
          {amountDisplay && (
            <span className="font-medium">{amountDisplay} </span>
          )}
          {ing.ingredientId ? (
            <NavLink
              to={`/ingredient/${ing.ingredientId}`}
              className="text-kitchen-600 dark:text-kitchen-400 hover:underline"
            >
              {ing.name}
            </NavLink>
          ) : (
            <span>{ing.name}</span>
          )}
        </span>
        {ing.optional && (
          <span className="text-stone-400 dark:text-stone-500 text-sm italic">(optionnel)</span>
        )}
      </div>

      <div className="flex-shrink-0 ml-3">
        {ing.inStock ? (
          <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-sm">
            <Check className="w-4 h-4" />
            <span className="hidden sm:inline">En stock</span>
            {ing.stockQuantity != null && (
              <span className="text-green-500/70 dark:text-green-400/70">({ing.stockQuantity})</span>
            )}
          </span>
        ) : ing.ingredientId ? (
          <span className="flex items-center gap-1.5 text-orange-500 dark:text-orange-400 text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span className="hidden sm:inline">\u00c9puis\u00e9</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-stone-400 dark:text-stone-500 text-sm">
            <Link2 className="w-4 h-4" />
            <span className="hidden sm:inline">Non li\u00e9</span>
          </span>
        )}
      </div>
    </li>
  );
};
