import React, { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useIngredients } from '../hooks/useIngredients';
import {
  Plus,
  Search,
  Filter,
  Package,
  AlertTriangle,
  Heart,
  Sparkles,
  ChevronRight,
  Loader2,
  RefreshCw
} from 'lucide-react';
import type { IngredientCategory, InventoryIngredient } from '../types';

const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  SPICE: 'Épices',
  OIL: 'Huiles',
  SAUCE: 'Sauces',
  VINEGAR: 'Vinaigres',
  CONDIMENT: 'Condiments',
  HERB: 'Herbes',
  GRAIN: 'Céréales',
  FLOUR: 'Farines',
  SUGAR: 'Sucres',
  DAIRY: 'Produits laitiers',
  PROTEIN: 'Protéines',
  CANNED: 'Conserves',
  FROZEN: 'Surgelés',
  BAKING: 'Pâtisserie',
  OTHER: 'Autres'
};

const CATEGORY_COLORS: Record<IngredientCategory, string> = {
  SPICE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  OIL: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  SAUCE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  VINEGAR: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  CONDIMENT: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  HERB: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  GRAIN: 'bg-stone-100 text-stone-800 dark:bg-stone-700/30 dark:text-stone-300',
  FLOUR: 'bg-stone-100 text-stone-800 dark:bg-stone-700/30 dark:text-stone-300',
  SUGAR: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  DAIRY: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  PROTEIN: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  CANNED: 'bg-slate-100 text-slate-800 dark:bg-slate-700/30 dark:text-slate-300',
  FROZEN: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  BAKING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  OTHER: 'bg-gray-100 text-gray-800 dark:bg-gray-700/30 dark:text-gray-300'
};

export const Dashboard: React.FC = () => {
  const { ingredients, loading, error, refresh } = useIngredients();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<IngredientCategory | 'ALL'>('ALL');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showExpiringOnly, setShowExpiringOnly] = useState(
    searchParams.get('filter') === 'expiring'
  );

  // Filter ingredients
  const filteredIngredients = useMemo(() => {
    return ingredients.filter(ing => {
      // Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          ing.name.toLowerCase().includes(query) ||
          ing.brand?.toLowerCase().includes(query) ||
          ing.origin?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Category
      if (selectedCategory !== 'ALL' && ing.category !== selectedCategory) {
        return false;
      }

      // Favorites
      if (showFavoritesOnly && !ing.isFavorite) {
        return false;
      }

      // Expiring
      if (showExpiringOnly && !ing.hasExpiringSoon) {
        return false;
      }

      return true;
    });
  }, [ingredients, searchQuery, selectedCategory, showFavoritesOnly, showExpiringOnly]);

  // Stats
  const stats = useMemo(() => ({
    total: ingredients.length,
    inStock: ingredients.filter(i => i.stockCount > 0).length,
    expiring: ingredients.filter(i => i.hasExpiringSoon).length,
    favorites: ingredients.filter(i => i.isFavorite).length
  }), [ingredients]);

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
            Inventaire
          </h1>
          <p className="text-stone-600 dark:text-stone-400 mt-1">
            {stats.inStock} produits en stock
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
            to="/add-ingredient"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-kitchen-500 to-kitchen-600 hover:from-kitchen-600 hover:to-kitchen-700 text-white font-medium shadow-lg hover:shadow-xl transition-all"
          >
            <Plus className="w-5 h-5" />
            <span>Ajouter</span>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-stone-900 rounded-xl p-4 border border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-kitchen-100 dark:bg-kitchen-900/30 flex items-center justify-center">
              <Package className="w-5 h-5 text-kitchen-600 dark:text-kitchen-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900 dark:text-white">{stats.total}</p>
              <p className="text-sm text-stone-500">Produits</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-xl p-4 border border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Package className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900 dark:text-white">{stats.inStock}</p>
              <p className="text-sm text-stone-500">En stock</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowExpiringOnly(!showExpiringOnly)}
          className={`bg-white dark:bg-stone-900 rounded-xl p-4 border text-left transition-all ${
            showExpiringOnly
              ? 'border-amber-500 ring-2 ring-amber-500/20'
              : 'border-stone-200 dark:border-stone-800 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900 dark:text-white">{stats.expiring}</p>
              <p className="text-sm text-stone-500">À consommer</p>
            </div>
          </div>
        </button>

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
            placeholder="Rechercher un ingrédient..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white focus:ring-2 focus:ring-kitchen-500 focus:border-transparent"
          />
        </div>

        {/* Category Filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as IngredientCategory | 'ALL')}
            className="pl-10 pr-8 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white focus:ring-2 focus:ring-kitchen-500 appearance-none cursor-pointer"
          >
            <option value="ALL">Toutes catégories</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
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

      {/* Ingredients Grid */}
      {filteredIngredients.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-16 h-16 mx-auto text-stone-300 dark:text-stone-700 mb-4" />
          <h3 className="text-lg font-medium text-stone-900 dark:text-white mb-2">
            {ingredients.length === 0 ? 'Aucun ingrédient' : 'Aucun résultat'}
          </h3>
          <p className="text-stone-500 mb-4">
            {ingredients.length === 0
              ? 'Commencez par ajouter vos premiers ingrédients'
              : 'Essayez de modifier vos filtres'}
          </p>
          {ingredients.length === 0 && (
            <Link
              to="/add-ingredient"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-kitchen-500 hover:bg-kitchen-600 text-white font-medium"
            >
              <Plus className="w-5 h-5" />
              Ajouter un ingrédient
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIngredients.map((ingredient) => (
            <IngredientCard key={ingredient.id} ingredient={ingredient} />
          ))}
        </div>
      )}
    </div>
  );
};

// Ingredient Card Component
const IngredientCard: React.FC<{ ingredient: InventoryIngredient }> = ({ ingredient }) => {
  const daysUntilExpiry = ingredient.nearestExpiry
    ? Math.ceil((new Date(ingredient.nearestExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <Link
      to={`/ingredient/${ingredient.id}`}
      className="group bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-4 hover:shadow-lg hover:border-kitchen-300 dark:hover:border-kitchen-700 transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-stone-900 dark:text-white group-hover:text-kitchen-600 dark:group-hover:text-kitchen-400 transition-colors">
            {ingredient.name}
          </h3>
          {ingredient.brand && (
            <p className="text-sm text-stone-500">{ingredient.brand}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {ingredient.isFavorite && (
            <Heart className="w-4 h-4 text-red-500 fill-red-500" />
          )}
          {ingredient.enrichedByAI && (
            <Sparkles className="w-4 h-4 text-kitchen-500" />
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${CATEGORY_COLORS[ingredient.category]}`}>
          {CATEGORY_LABELS[ingredient.category]}
        </span>
        {ingredient.origin && (
          <span className="text-xs text-stone-500">{ingredient.origin}</span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className="font-semibold text-stone-900 dark:text-white">{ingredient.stockCount}</span>
            <span className="text-stone-500"> en stock</span>
          </div>
          {daysUntilExpiry !== null && daysUntilExpiry <= 30 && (
            <div className={`text-xs px-2 py-1 rounded-lg ${
              daysUntilExpiry <= 7
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
            }`}>
              {daysUntilExpiry <= 0 ? 'Expiré' : `${daysUntilExpiry}j`}
            </div>
          )}
        </div>
        <ChevronRight className="w-5 h-5 text-stone-400 group-hover:text-kitchen-500 transition-colors" />
      </div>
    </Link>
  );
};
