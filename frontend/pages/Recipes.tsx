import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useRecipes } from '../hooks/useRecipes';
import {
  BookOpen,
  Plus,
  Search,
  Clock,
  Users,
  Heart,
  Star,
  Filter,
  ChefHat,
  Sparkles,
  ChevronRight,
  Loader2,
  RefreshCw
} from 'lucide-react';
import type { Recipe, RecipeCategory } from '../types';

const RECIPE_CATEGORY_LABELS: Record<RecipeCategory, string> = {
  ENTREE: 'Entree',
  PLAT: 'Plat',
  DESSERT: 'Dessert',
  SAUCE: 'Sauce',
  ACCOMPAGNEMENT: 'Accompagnement',
  BOISSON: 'Boisson',
  SNACK: 'En-cas',
};

const RECIPE_CATEGORY_COLORS: Record<string, string> = {
  ENTREE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  PLAT: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  DESSERT: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  SAUCE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  ACCOMPAGNEMENT: 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300',
  BOISSON: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  SNACK: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  EASY: 'Facile',
  MEDIUM: 'Moyen',
  HARD: 'Difficile',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  HARD: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const SOURCE_LABELS: Record<string, string> = {
  MANUAL: 'Manuel',
  AI: 'IA',
  IMPORTED: 'Importee',
};

const SOURCE_COLORS: Record<string, string> = {
  MANUAL: 'bg-stone-100 text-stone-700 dark:bg-stone-700/30 dark:text-stone-300',
  AI: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  IMPORTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
};

export const Recipes: React.FC = () => {
  const { recipes, loading, error, refresh } = useRecipes();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<RecipeCategory | 'ALL'>('ALL');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Filter recipes
  const filteredRecipes = useMemo(() => {
    return recipes.filter(recipe => {
      // Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          recipe.name.toLowerCase().includes(query) ||
          recipe.cuisine?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Category
      if (selectedCategory !== 'ALL' && recipe.category !== selectedCategory) {
        return false;
      }

      // Favorites
      if (showFavoritesOnly && !recipe.isFavorite) {
        return false;
      }

      return true;
    });
  }, [recipes, searchQuery, selectedCategory, showFavoritesOnly]);

  // Stats
  const stats = useMemo(() => ({
    total: recipes.length,
    favorites: recipes.filter(r => r.isFavorite).length,
    imported: recipes.filter(r => r.source === 'IMPORTED').length,
    ai: recipes.filter(r => r.source === 'AI').length,
    manual: recipes.filter(r => r.source === 'MANUAL').length,
  }), [recipes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-kitchen-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 dark:text-white">
            Recettes
          </h1>
          <p className="text-stone-600 dark:text-stone-400 mt-1">
            {stats.total} recette{stats.total !== 1 ? 's' : ''} au total
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="p-2 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg"
            title="Actualiser"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <Link
            to="/add-recipe"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-kitchen-500 to-kitchen-600 hover:from-kitchen-600 hover:to-kitchen-700 text-white font-medium shadow-lg hover:shadow-xl transition-all"
          >
            <Plus className="w-5 h-5" />
            <span>Ajouter une recette</span>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-stone-900 rounded-xl p-4 border border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-kitchen-100 dark:bg-kitchen-900/30 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-kitchen-600 dark:text-kitchen-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900 dark:text-white">{stats.total}</p>
              <p className="text-sm text-stone-500">Recettes</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={`bg-white dark:bg-stone-900 rounded-xl p-4 border text-left transition-all ${
            showFavoritesOnly
              ? 'border-red-500 ring-2 ring-red-500/20'
              : 'border-stone-200 dark:border-stone-800 hover:border-red-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Heart className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900 dark:text-white">{stats.favorites}</p>
              <p className="text-sm text-stone-500">Favoris</p>
            </div>
          </div>
        </button>

        <div className="bg-white dark:bg-stone-900 rounded-xl p-4 border border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900 dark:text-white">{stats.imported}</p>
              <p className="text-sm text-stone-500">Importees</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-xl p-4 border border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <ChefHat className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900 dark:text-white">{stats.ai}</p>
              <p className="text-sm text-stone-500">Generees IA</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une recette..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white focus:ring-2 focus:ring-kitchen-500 focus:border-transparent"
          />
        </div>

        {/* Category Filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as RecipeCategory | 'ALL')}
            className="pl-10 pr-8 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white focus:ring-2 focus:ring-kitchen-500 appearance-none cursor-pointer"
          >
            <option value="ALL">Toutes categories</option>
            {Object.entries(RECIPE_CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Recipes Grid */}
      {filteredRecipes.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 mx-auto text-stone-300 dark:text-stone-700 mb-4" />
          <h3 className="text-lg font-medium text-stone-900 dark:text-white mb-2">
            {recipes.length === 0 ? 'Aucune recette' : 'Aucun resultat'}
          </h3>
          <p className="text-stone-500 mb-4">
            {recipes.length === 0
              ? 'Commencez par ajouter vos premieres recettes'
              : 'Essayez de modifier vos filtres'}
          </p>
          {recipes.length === 0 && (
            <Link
              to="/add-recipe"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-kitchen-500 hover:bg-kitchen-600 text-white font-medium"
            >
              <Plus className="w-5 h-5" />
              Ajouter une recette
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}
    </div>
  );
};

// Recipe Card Component
const RecipeCard: React.FC<{ recipe: Recipe }> = ({ recipe }) => {
  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h${mins}` : `${hours}h`;
  };

  return (
    <Link
      to={`/recipe/${recipe.id}`}
      className="group bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-4 hover:shadow-lg hover:border-kitchen-300 dark:hover:border-kitchen-700 transition-all"
    >
      {/* Top row: name + favorite/source icons */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-stone-900 dark:text-white group-hover:text-kitchen-600 dark:group-hover:text-kitchen-400 transition-colors truncate">
            {recipe.name}
          </h3>
          {recipe.cuisine && (
            <p className="text-sm text-stone-500 truncate">{recipe.cuisine}</p>
          )}
        </div>
        <div className="flex items-center gap-2 ml-2 shrink-0">
          {recipe.isFavorite && (
            <Heart className="w-4 h-4 text-red-500 fill-red-500" />
          )}
          {recipe.source === 'AI' && (
            <Sparkles className="w-4 h-4 text-violet-500" />
          )}
        </div>
      </div>

      {/* Badges: category + difficulty + source */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${RECIPE_CATEGORY_COLORS[recipe.category] || ''}`}>
          {RECIPE_CATEGORY_LABELS[recipe.category] || recipe.category}
        </span>
        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${DIFFICULTY_COLORS[recipe.difficulty] || ''}`}>
          {DIFFICULTY_LABELS[recipe.difficulty] || recipe.difficulty}
        </span>
        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${SOURCE_COLORS[recipe.source] || ''}`}>
          {SOURCE_LABELS[recipe.source] || recipe.source}
        </span>
      </div>

      {/* Bottom row: time, servings, arrow */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {totalTime > 0 && (
            <div className="flex items-center gap-1 text-sm text-stone-600 dark:text-stone-400">
              <Clock className="w-4 h-4" />
              <span>{formatTime(totalTime)}</span>
            </div>
          )}
          {recipe.servings > 0 && (
            <div className="flex items-center gap-1 text-sm text-stone-600 dark:text-stone-400">
              <Users className="w-4 h-4" />
              <span>{recipe.servings}</span>
            </div>
          )}
        </div>
        <ChevronRight className="w-5 h-5 text-stone-400 group-hover:text-kitchen-500 transition-colors" />
      </div>
    </Link>
  );
};
