import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit3,
  Trash2,
  Heart,
  Sparkles,
  Loader2,
  Package,
  MapPin,
  Calendar,
  AlertTriangle,
  Plus,
  Minus,
  Camera,
  RefreshCw,
  ChefHat,
  Flame,
  Clock,
  Info,
  CheckCircle2,
  X
} from 'lucide-react';
import { getIngredientById, getStockItems, updateIngredient, deleteIngredient, addStockItems, consumeStockItem, deleteStockItem } from '../services/ingredientService';
import { enrichIngredientData } from '../services/aiService';
import type { Ingredient, StockItem, IngredientCategory } from '../types';

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

export const IngredientDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [ingredient, setIngredient] = useState<Ingredient | null>(null);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // AI Enrichment states
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState('');
  const [enrichSuccess, setEnrichSuccess] = useState(false);

  // Actions states
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [addingStock, setAddingStock] = useState(false);

  // Load data
  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [ingredientData, allStock] = await Promise.all([
        getIngredientById(id),
        getStockItems()
      ]);

      if (!ingredientData) {
        setError('Ingrédient non trouvé');
        return;
      }

      setIngredient(ingredientData);
      setStockItems(allStock.filter(s => s.ingredientId === id && !s.isFinished));
    } catch (err: any) {
      setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  // Toggle favorite
  const handleToggleFavorite = async () => {
    if (!ingredient) return;
    try {
      const updated = await updateIngredient(ingredient.id, {
        isFavorite: !ingredient.isFavorite
      });
      setIngredient(updated);
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  // AI Enrichment
  const handleEnrichWithAI = async (imageBase64?: string) => {
    if (!ingredient) return;

    setEnriching(true);
    setEnrichError('');
    setEnrichSuccess(false);

    try {
      const enriched = await enrichIngredientData(
        ingredient.name,
        ingredient.brand ? `Marque: ${ingredient.brand}` : undefined,
        imageBase64
      );

      if (enriched) {
        const updated = await updateIngredient(ingredient.id, {
          ...enriched,
          enrichedByAI: true
        });
        setIngredient(updated);
        setEnrichSuccess(true);
        setTimeout(() => setEnrichSuccess(false), 3000);
      }
    } catch (err: any) {
      setEnrichError(err.message || "Erreur lors de l'enrichissement IA");
    } finally {
      setEnriching(false);
    }
  };

  // Handle image upload for AI
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      const base64 = result.split(',')[1];
      handleEnrichWithAI(base64);
    };
    reader.readAsDataURL(file);
  };

  // Delete ingredient
  const handleDelete = async () => {
    if (!ingredient) return;
    setDeleting(true);
    try {
      await deleteIngredient(ingredient.id);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression');
      setDeleting(false);
    }
  };

  // Add stock
  const handleAddStock = async () => {
    if (!ingredient) return;
    setAddingStock(true);
    try {
      await addStockItems(ingredient.id, 1);
      await loadData();
    } catch (err) {
      console.error('Error adding stock:', err);
    } finally {
      setAddingStock(false);
    }
  };

  // Consume stock item
  const handleConsumeStock = async (itemId: string) => {
    try {
      await consumeStockItem(itemId);
      await loadData();
    } catch (err) {
      console.error('Error consuming stock:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-kitchen-500" />
      </div>
    );
  }

  if (error || !ingredient) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-16 h-16 mx-auto text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-2">
          {error || 'Ingrédient non trouvé'}
        </h2>
        <Link to="/" className="text-kitchen-600 hover:underline">
          Retour à l'inventaire
        </Link>
      </div>
    );
  }

  const nearestExpiry = stockItems
    .filter(s => s.expiryDate)
    .sort((a, b) => new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime())[0];

  const daysUntilExpiry = nearestExpiry?.expiryDate
    ? Math.ceil((new Date(nearestExpiry.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleFavorite}
            className={`p-2 rounded-lg transition-colors ${
              ingredient.isFavorite
                ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
                : 'text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            <Heart className={`w-5 h-5 ${ingredient.isFavorite ? 'fill-current' : ''}`} />
          </button>
          <Link
            to={`/ingredient/${ingredient.id}/edit`}
            className="p-2 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg"
          >
            <Edit3 className="w-5 h-5" />
          </Link>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Info Card */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 dark:text-white">
                {ingredient.name}
              </h1>
              {ingredient.enrichedByAI && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs">
                  <Sparkles className="w-3 h-3" />
                  IA
                </span>
              )}
            </div>

            {ingredient.brand && (
              <p className="text-lg text-stone-600 dark:text-stone-400 mb-2">
                {ingredient.brand}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className={`px-3 py-1 rounded-lg text-sm font-medium ${CATEGORY_COLORS[ingredient.category]}`}>
                {CATEGORY_LABELS[ingredient.category]}
              </span>
              {ingredient.origin && (
                <span className="px-3 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-sm">
                  {ingredient.origin}
                </span>
              )}
              {ingredient.format && (
                <span className="px-3 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-sm">
                  {ingredient.format}
                </span>
              )}
              {ingredient.heatLevel !== undefined && ingredient.heatLevel > 0 && (
                <span className="flex items-center gap-1 px-3 py-1 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
                  <Flame className="w-4 h-4" />
                  {ingredient.heatLevel}/10
                </span>
              )}
            </div>

            {ingredient.description && (
              <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
                {ingredient.description}
              </p>
            )}
          </div>

          {/* Stock Info */}
          <div className="sm:w-48 p-4 rounded-xl bg-stone-50 dark:bg-stone-800/50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-stone-500">En stock</span>
              <span className="text-2xl font-bold text-stone-900 dark:text-white">
                {stockItems.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleAddStock}
                disabled={addingStock}
                className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-kitchen-500 hover:bg-kitchen-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {addingStock ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Ajouter
              </button>
            </div>

            {daysUntilExpiry !== null && (
              <div className={`mt-3 flex items-center gap-2 text-sm ${
                daysUntilExpiry <= 7
                  ? 'text-red-600 dark:text-red-400'
                  : daysUntilExpiry <= 30
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-stone-500'
              }`}>
                <Clock className="w-4 h-4" />
                {daysUntilExpiry <= 0 ? 'Expiré' : `Expire dans ${daysUntilExpiry}j`}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Enrichment Card */}
      <div className="bg-gradient-to-br from-purple-50 to-kitchen-50 dark:from-purple-900/20 dark:to-kitchen-900/20 rounded-2xl border border-purple-200 dark:border-purple-800 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="font-semibold text-stone-900 dark:text-white">
              Enrichissement IA
            </h2>
            <p className="text-sm text-stone-500">
              Complétez automatiquement les informations avec l'IA
            </p>
          </div>
        </div>

        {enrichError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
            {enrichError}
          </div>
        )}

        {enrichSuccess && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Informations enrichies avec succès !
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleEnrichWithAI()}
            disabled={enriching}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium disabled:opacity-50 transition-colors"
          >
            {enriching ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            {enriching ? 'Analyse en cours...' : 'Enrichir avec l\'IA'}
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={enriching}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 font-medium hover:bg-purple-50 dark:hover:bg-purple-900/30 disabled:opacity-50 transition-colors"
          >
            <Camera className="w-5 h-5" />
            Scanner une étiquette
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
        </div>

        {ingredient.aiConfidence && (
          <div className="mt-4 text-sm text-stone-500">
            Confiance IA : <span className={`font-medium ${
              ingredient.aiConfidence === 'HIGH' ? 'text-green-600' :
              ingredient.aiConfidence === 'MEDIUM' ? 'text-amber-600' : 'text-red-600'
            }`}>{ingredient.aiConfidence}</span>
          </div>
        )}
      </div>

      {/* Details Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Flavor Profile */}
        {(ingredient.flavorProfile || (ingredient.aromaProfile && ingredient.aromaProfile.length > 0)) && (
          <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-5">
            <h3 className="font-semibold text-stone-900 dark:text-white mb-3 flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-kitchen-500" />
              Profil Gustatif
            </h3>
            {ingredient.flavorProfile && (
              <p className="text-stone-600 dark:text-stone-400 mb-3">
                {ingredient.flavorProfile}
              </p>
            )}
            {ingredient.aromaProfile && ingredient.aromaProfile.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {ingredient.aromaProfile.map((aroma, i) => (
                  <span key={i} className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-sm">
                    {aroma}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Suggested Uses */}
        {ingredient.suggestedUses && ingredient.suggestedUses.length > 0 && (
          <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-5">
            <h3 className="font-semibold text-stone-900 dark:text-white mb-3 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-500" />
              Utilisations
            </h3>
            <ul className="space-y-2">
              {ingredient.suggestedUses.map((use, i) => (
                <li key={i} className="flex items-start gap-2 text-stone-600 dark:text-stone-400">
                  <span className="text-kitchen-500 mt-1">•</span>
                  {use}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Pairings */}
        {ingredient.pairings && ingredient.pairings.length > 0 && (
          <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-5">
            <h3 className="font-semibold text-stone-900 dark:text-white mb-3 flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-500" />
              Accords
            </h3>
            <div className="flex flex-wrap gap-2">
              {ingredient.pairings.map((pairing, i) => (
                <span key={i} className="px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-sm">
                  {pairing}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Substitutes */}
        {ingredient.substitutes && ingredient.substitutes.length > 0 && (
          <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-5">
            <h3 className="font-semibold text-stone-900 dark:text-white mb-3 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-purple-500" />
              Substituts
            </h3>
            <div className="flex flex-wrap gap-2">
              {ingredient.substitutes.map((sub, i) => (
                <span key={i} className="px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-sm">
                  {sub}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Storage Info */}
      {(ingredient.shelfLife || ingredient.storageInstructions) && (
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-5">
          <h3 className="font-semibold text-stone-900 dark:text-white mb-3 flex items-center gap-2">
            <Package className="w-5 h-5 text-stone-500" />
            Conservation
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ingredient.shelfLife && (
              <div>
                <span className="text-sm text-stone-500">Durée de conservation</span>
                <p className="text-stone-900 dark:text-white font-medium">{ingredient.shelfLife}</p>
              </div>
            )}
            {ingredient.storageInstructions && (
              <div>
                <span className="text-sm text-stone-500">Instructions</span>
                <p className="text-stone-900 dark:text-white">{ingredient.storageInstructions}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stock Items List */}
      {stockItems.length > 0 && (
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-5">
          <h3 className="font-semibold text-stone-900 dark:text-white mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-kitchen-500" />
            Détail du stock ({stockItems.length})
          </h3>
          <div className="space-y-3">
            {stockItems.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg bg-stone-50 dark:bg-stone-800/50"
              >
                <div className="flex items-center gap-4">
                  <span className="w-8 h-8 rounded-full bg-kitchen-100 dark:bg-kitchen-900/30 text-kitchen-600 dark:text-kitchen-400 flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-stone-900 dark:text-white font-medium">
                      {typeof item.location === 'string' ? item.location : 'Non rangé'}
                    </p>
                    <div className="flex items-center gap-3 text-sm text-stone-500">
                      {item.purchaseDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Acheté le {new Date(item.purchaseDate).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                      {item.expiryDate && (
                        <span className={`flex items-center gap-1 ${
                          new Date(item.expiryDate) < new Date() ? 'text-red-500' :
                          new Date(item.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? 'text-amber-500' : ''
                        }`}>
                          <AlertTriangle className="w-3 h-3" />
                          Expire le {new Date(item.expiryDate).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleConsumeStock(item.id)}
                  className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Marquer comme consommé"
                >
                  <Minus className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Producer History */}
      {ingredient.producerHistory && (
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-5">
          <h3 className="font-semibold text-stone-900 dark:text-white mb-3">
            Histoire du producteur
          </h3>
          <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
            {ingredient.producerHistory}
          </p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-semibold text-stone-900 dark:text-white mb-2">
              Supprimer cet ingrédient ?
            </h3>
            <p className="text-stone-600 dark:text-stone-400 mb-6">
              Cette action supprimera définitivement "{ingredient.name}" et tout son stock associé.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-stone-300 dark:border-stone-700 font-medium hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
