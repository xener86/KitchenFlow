import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  Sparkles,
  Loader2,
  Plus,
  X,
  Package,
  Wand2,
  Search
} from 'lucide-react';
import { saveIngredient } from '../services/ingredientService';
import { enrichIngredientData, generateCompleteProductSheet } from '../services/aiService';
import type { IngredientCategory, Ingredient } from '../types';

const CATEGORIES: { value: IngredientCategory; label: string }[] = [
  { value: 'SPICE', label: 'Épices' },
  { value: 'OIL', label: 'Huiles' },
  { value: 'SAUCE', label: 'Sauces' },
  { value: 'VINEGAR', label: 'Vinaigres' },
  { value: 'CONDIMENT', label: 'Condiments' },
  { value: 'HERB', label: 'Herbes' },
  { value: 'GRAIN', label: 'Céréales/Féculents' },
  { value: 'FLOUR', label: 'Farines' },
  { value: 'SUGAR', label: 'Sucres' },
  { value: 'DAIRY', label: 'Produits laitiers' },
  { value: 'PROTEIN', label: 'Protéines' },
  { value: 'CANNED', label: 'Conserves' },
  { value: 'FROZEN', label: 'Surgelés' },
  { value: 'BAKING', label: 'Pâtisserie' },
  { value: 'OTHER', label: 'Autres' },
];

export const AddIngredient: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    origin: '',
    category: 'OTHER' as IngredientCategory,
    format: '',
    description: '',
    flavorProfile: '',
    aromaProfile: [] as string[],
    suggestedUses: [] as string[],
    pairings: [] as string[],
    substitutes: [] as string[],
    shelfLife: '',
    storageInstructions: '',
  });

  const [quantity, setQuantity] = useState(1);
  const [location, setLocation] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [error, setError] = useState('');
  const [newTag, setNewTag] = useState('');
  const [showAutoGenerate, setShowAutoGenerate] = useState(false);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setImagePreview(result);
      // Extract base64 without the data:image/... prefix
      setImageBase64(result.split(',')[1]);
    };
    reader.readAsDataURL(file);
  };

  // Génération automatique de fiche complète avec recherche Google
  const handleAutoGenerate = async () => {
    if (!formData.name) {
      setError("Entrez le nom du produit pour générer la fiche");
      return;
    }

    setAutoGenerating(true);
    setError('');

    try {
      const result = await generateCompleteProductSheet(
        formData.name,
        formData.brand || undefined
      );

      if (result) {
        setFormData(prev => ({
          ...prev,
          name: result.name || prev.name,
          brand: result.brand || prev.brand,
          origin: result.origin || prev.origin,
          category: (result.category as IngredientCategory) || prev.category,
          format: result.format || prev.format,
          description: result.description || prev.description,
          flavorProfile: result.flavorProfile || prev.flavorProfile,
          aromaProfile: result.aromaProfile || prev.aromaProfile,
          suggestedUses: result.suggestedUses || prev.suggestedUses,
          pairings: result.pairings || prev.pairings,
          substitutes: result.substitutes || prev.substitutes,
          shelfLife: result.shelfLife || prev.shelfLife,
          storageInstructions: result.storageInstructions || prev.storageInstructions,
        }));
        setShowAutoGenerate(false);
      } else {
        setError("Impossible de générer la fiche. Vérifiez votre clé API Gemini.");
      }
    } catch (err: any) {
      setError(err.message || "Erreur lors de la génération IA");
    } finally {
      setAutoGenerating(false);
    }
  };

  const handleEnrichWithAI = async () => {
    if (!formData.name && !imageBase64) {
      setError("Entrez un nom ou ajoutez une photo pour l'enrichissement IA");
      return;
    }

    setEnriching(true);
    setError('');

    try {
      const enriched = await enrichIngredientData(
        formData.name,
        formData.brand ? `Marque: ${formData.brand}` : undefined,
        imageBase64 || undefined
      );

      if (enriched) {
        setFormData(prev => ({
          ...prev,
          name: enriched.name || prev.name,
          brand: enriched.brand || prev.brand,
          origin: enriched.origin || prev.origin,
          category: (enriched.category as IngredientCategory) || prev.category,
          description: enriched.description || prev.description,
          flavorProfile: enriched.flavorProfile || prev.flavorProfile,
          aromaProfile: enriched.aromaProfile || prev.aromaProfile,
          suggestedUses: enriched.suggestedUses || prev.suggestedUses,
          pairings: enriched.pairings || prev.pairings,
          substitutes: enriched.substitutes || prev.substitutes,
          shelfLife: enriched.shelfLife || prev.shelfLife,
          storageInstructions: enriched.storageInstructions || prev.storageInstructions,
        }));
      }
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'enrichissement IA");
    } finally {
      setEnriching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      setError('Le nom est requis');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const ingredient: Omit<Ingredient, 'id' | 'createdAt' | 'updatedAt'> = {
        ...formData,
        enrichedByAI: false,
        isFavorite: false,
      };

      await saveIngredient(ingredient, quantity, location || undefined);
      navigate('/');
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  const addTag = (field: 'aromaProfile' | 'suggestedUses' | 'pairings' | 'substitutes') => {
    if (!newTag.trim()) return;
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], newTag.trim()]
    }));
    setNewTag('');
  };

  const removeTag = (field: 'aromaProfile' | 'suggestedUses' | 'pairings' | 'substitutes', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-serif text-2xl font-bold text-stone-900 dark:text-white">
          Ajouter un ingrédient
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Image Upload */}
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-6">
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-3">
            Photo (optionnel)
          </label>
          <div className="flex items-center gap-4">
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Aperçu"
                  className="w-24 h-24 object-cover rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview(null);
                    setImageBase64(null);
                  }}
                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-24 h-24 border-2 border-dashed border-stone-300 dark:border-stone-700 rounded-xl flex flex-col items-center justify-center gap-1 hover:border-kitchen-500 transition-colors"
              >
                <Camera className="w-6 h-6 text-stone-400" />
                <span className="text-xs text-stone-500">Photo</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleEnrichWithAI}
              disabled={enriching || (!formData.name && !imageBase64)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {enriching ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
              Enrichir avec l'IA
            </button>
          </div>
        </div>

        {/* Auto Generate Card */}
        <div className="bg-gradient-to-br from-purple-500/10 to-kitchen-500/10 dark:from-purple-900/30 dark:to-kitchen-900/30 rounded-xl border border-purple-200 dark:border-purple-800 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-kitchen-500 flex items-center justify-center flex-shrink-0">
              <Wand2 className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-stone-900 dark:text-white mb-1">
                Génération automatique IA
              </h2>
              <p className="text-sm text-stone-600 dark:text-stone-400 mb-4">
                Entrez le nom du produit (et optionnellement la marque), puis cliquez pour générer automatiquement une fiche détaillée avec recherche Google.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-purple-300 dark:border-purple-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  placeholder="Ex: Huile lèche doigt"
                />
                <input
                  type="text"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-purple-300 dark:border-purple-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  placeholder="Marque ou producteur (optionnel)"
                />
              </div>

              <button
                type="button"
                onClick={handleAutoGenerate}
                disabled={autoGenerating || !formData.name}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-kitchen-500 hover:from-purple-600 hover:to-kitchen-600 text-white font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {autoGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Génération en cours...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    Générer la fiche complète
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-6 space-y-4">
          <h2 className="font-semibold text-stone-900 dark:text-white">Informations de base</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Nom *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-kitchen-500"
                placeholder="Ex: Paprika fumé"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Marque
              </label>
              <input
                type="text"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-kitchen-500"
                placeholder="Ex: La Chinata"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Origine
              </label>
              <input
                type="text"
                value={formData.origin}
                onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-kitchen-500"
                placeholder="Ex: Espagne"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Catégorie
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as IngredientCategory })}
                className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-kitchen-500"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Format
              </label>
              <input
                type="text"
                value={formData.format}
                onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-kitchen-500"
                placeholder="Ex: 75g, 500ml"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Conservation
              </label>
              <input
                type="text"
                value={formData.shelfLife}
                onChange={(e) => setFormData({ ...formData, shelfLife: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-kitchen-500"
                placeholder="Ex: 2 ans"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-kitchen-500"
              placeholder="Description de l'ingrédient..."
            />
          </div>
        </div>

        {/* Stock Info */}
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-6 space-y-4">
          <h2 className="font-semibold text-stone-900 dark:text-white">Stock</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Quantité
              </label>
              <input
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-kitchen-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Emplacement
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-kitchen-500"
                placeholder="Ex: Placard épices"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Date d'expiration
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-kitchen-500"
              />
            </div>
          </div>
        </div>

        {/* Tags Section */}
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-6 space-y-4">
          <h2 className="font-semibold text-stone-900 dark:text-white">Détails (enrichis par IA)</h2>

          {/* Aromas */}
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
              Notes aromatiques
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.aromaProfile.map((tag, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-sm">
                  {tag}
                  <button type="button" onClick={() => removeTag('aromaProfile', i)}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Suggested Uses */}
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
              Utilisations suggérées
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.suggestedUses.map((tag, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-sm">
                  {tag}
                  <button type="button" onClick={() => removeTag('suggestedUses', i)}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Pairings */}
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
              Accords
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.pairings.map((tag, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-sm">
                  {tag}
                  <button type="button" onClick={() => removeTag('pairings', i)}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 py-3 px-4 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-medium hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-kitchen-500 to-kitchen-600 hover:from-kitchen-600 hover:to-kitchen-700 text-white font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Plus className="w-5 h-5" />
            )}
            Ajouter
          </button>
        </div>
      </form>
    </div>
  );
};
