import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Loader2,
  Sparkles,
  Camera,
  X,
  Plus,
  Trash2,
  Wand2,
  Search
} from 'lucide-react';
import { getIngredientById, updateIngredient } from '../services/ingredientService';
import { enrichIngredientData, generateCompleteProductSheet } from '../services/aiService';
import type { Ingredient, IngredientCategory } from '../types';

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

export const EditIngredient: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    origin: '',
    producer: '',
    category: 'OTHER' as IngredientCategory,
    format: '',
    description: '',
    flavorProfile: '',
    aromaProfile: [] as string[],
    heatLevel: 0,
    suggestedUses: [] as string[],
    pairings: [] as string[],
    substitutes: [] as string[],
    shelfLife: '',
    storageInstructions: '',
    producerHistory: '',
  });

  const [newAroma, setNewAroma] = useState('');
  const [newUse, setNewUse] = useState('');
  const [newPairing, setNewPairing] = useState('');
  const [newSubstitute, setNewSubstitute] = useState('');

  // Load ingredient data
  useEffect(() => {
    const loadIngredient = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const data = await getIngredientById(id);
        if (data) {
          setFormData({
            name: data.name || '',
            brand: data.brand || '',
            origin: data.origin || '',
            producer: data.producer || '',
            category: data.category || 'OTHER',
            format: data.format || '',
            description: data.description || '',
            flavorProfile: data.flavorProfile || '',
            aromaProfile: data.aromaProfile || [],
            heatLevel: data.heatLevel || 0,
            suggestedUses: data.suggestedUses || [],
            pairings: data.pairings || [],
            substitutes: data.substitutes || [],
            shelfLife: data.shelfLife || '',
            storageInstructions: data.storageInstructions || '',
            producerHistory: data.producerHistory || '',
          });
        } else {
          setError('Ingrédient non trouvé');
        }
      } catch (err: any) {
        setError(err.message || 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    };

    loadIngredient();
  }, [id]);

  // Régénération complète de la fiche avec Google Search
  const handleRegenerateSheet = async () => {
    if (!formData.name) {
      setError("Le nom du produit est requis pour la régénération");
      return;
    }

    setRegenerating(true);
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
          producer: (result as any).producer || prev.producer,
          category: (result.category as IngredientCategory) || prev.category,
          format: result.format || prev.format,
          description: result.description || prev.description,
          flavorProfile: result.flavorProfile || prev.flavorProfile,
          aromaProfile: result.aromaProfile?.length ? result.aromaProfile : prev.aromaProfile,
          heatLevel: result.heatLevel ?? prev.heatLevel,
          suggestedUses: result.suggestedUses?.length ? result.suggestedUses : prev.suggestedUses,
          pairings: result.pairings?.length ? result.pairings : prev.pairings,
          substitutes: result.substitutes?.length ? result.substitutes : prev.substitutes,
          shelfLife: result.shelfLife || prev.shelfLife,
          storageInstructions: result.storageInstructions || prev.storageInstructions,
          producerHistory: (result as any).producerHistory || prev.producerHistory,
        }));
      } else {
        setError("Impossible de régénérer la fiche. Vérifiez votre clé API Gemini.");
      }
    } catch (err: any) {
      setError(err.message || "Erreur lors de la régénération IA");
    } finally {
      setRegenerating(false);
    }
  };

  // AI Enrichment (complémentaire)
  const handleEnrichWithAI = async (imageBase64?: string) => {
    setEnriching(true);
    setError('');

    try {
      const enriched = await enrichIngredientData(
        formData.name,
        formData.brand ? `Marque: ${formData.brand}` : undefined,
        imageBase64
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
          aromaProfile: enriched.aromaProfile?.length ? enriched.aromaProfile : prev.aromaProfile,
          heatLevel: enriched.heatLevel ?? prev.heatLevel,
          suggestedUses: enriched.suggestedUses?.length ? enriched.suggestedUses : prev.suggestedUses,
          pairings: enriched.pairings?.length ? enriched.pairings : prev.pairings,
          substitutes: enriched.substitutes?.length ? enriched.substitutes : prev.substitutes,
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

  // Save
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !formData.name) {
      setError('Le nom est requis');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await updateIngredient(id, {
        ...formData,
        enrichedByAI: true
      });
      navigate(`/ingredient/${id}`);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Tag management helpers
  const addTag = (field: 'aromaProfile' | 'suggestedUses' | 'pairings' | 'substitutes', value: string, setter: (v: string) => void) => {
    if (!value.trim()) return;
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], value.trim()]
    }));
    setter('');
  };

  const removeTag = (field: 'aromaProfile' | 'suggestedUses' | 'pairings' | 'substitutes', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-kitchen-500" />
      </div>
    );
  }

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
          Modifier l'ingrédient
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* AI Enrichment */}
        <div className="bg-gradient-to-br from-purple-500/10 to-kitchen-500/10 dark:from-purple-900/30 dark:to-kitchen-900/30 rounded-xl border border-purple-200 dark:border-purple-800 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-kitchen-500 flex items-center justify-center flex-shrink-0">
              <Wand2 className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-stone-900 dark:text-white mb-1">
                IA & Enrichissement
              </h2>
              <p className="text-sm text-stone-600 dark:text-stone-400 mb-4">
                Régénérez la fiche complète avec recherche Google, ou enrichissez les informations existantes.
              </p>

              <div className="flex flex-wrap gap-3">
                {/* Bouton principal : Régénérer la fiche */}
                <button
                  type="button"
                  onClick={handleRegenerateSheet}
                  disabled={regenerating || enriching || !formData.name}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-kitchen-500 hover:from-purple-600 hover:to-kitchen-600 text-white font-semibold shadow-lg disabled:opacity-50 transition-all"
                >
                  {regenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Recherche...
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      Régénérer la fiche
                    </>
                  )}
                </button>

                {/* Enrichir (sans écraser) */}
                <button
                  type="button"
                  onClick={() => handleEnrichWithAI()}
                  disabled={enriching || regenerating || !formData.name}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 font-medium hover:bg-purple-50 dark:hover:bg-purple-900/30 disabled:opacity-50 transition-all"
                >
                  {enriching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  Compléter
                </button>

                {/* Scanner étiquette */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={enriching || regenerating}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-medium hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-50 transition-all"
                >
                  <Camera className="w-5 h-5" />
                  Scanner
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>
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
                Niveau de piquant (0-10)
              </label>
              <input
                type="range"
                min="0"
                max="10"
                value={formData.heatLevel}
                onChange={(e) => setFormData({ ...formData, heatLevel: parseInt(e.target.value) })}
                className="w-full accent-kitchen-500"
              />
              <div className="text-center text-sm text-stone-500">{formData.heatLevel}/10</div>
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
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
              Profil gustatif
            </label>
            <textarea
              value={formData.flavorProfile}
              onChange={(e) => setFormData({ ...formData, flavorProfile: e.target.value })}
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-kitchen-500"
              placeholder="Décrivez le goût, la texture..."
            />
          </div>
        </div>

        {/* Aromas */}
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-6">
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
            Notes aromatiques
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {formData.aromaProfile.map((tag, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-sm">
                {tag}
                <button type="button" onClick={() => removeTag('aromaProfile', i)} className="hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newAroma}
              onChange={(e) => setNewAroma(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag('aromaProfile', newAroma, setNewAroma))}
              className="flex-1 px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white"
              placeholder="Ajouter une note..."
            />
            <button
              type="button"
              onClick={() => addTag('aromaProfile', newAroma, setNewAroma)}
              className="px-4 py-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Suggested Uses */}
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-6">
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
            Utilisations suggérées
          </label>
          <div className="space-y-2 mb-3">
            {formData.suggestedUses.map((use, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                <span className="flex-1 text-stone-700 dark:text-stone-300">{use}</span>
                <button type="button" onClick={() => removeTag('suggestedUses', i)} className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 p-1 rounded">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newUse}
              onChange={(e) => setNewUse(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag('suggestedUses', newUse, setNewUse))}
              className="flex-1 px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white"
              placeholder="Ajouter une utilisation..."
            />
            <button
              type="button"
              onClick={() => addTag('suggestedUses', newUse, setNewUse)}
              className="px-4 py-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Pairings */}
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-6">
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
            Accords
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {formData.pairings.map((tag, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-sm">
                {tag}
                <button type="button" onClick={() => removeTag('pairings', i)} className="hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newPairing}
              onChange={(e) => setNewPairing(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag('pairings', newPairing, setNewPairing))}
              className="flex-1 px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white"
              placeholder="Ajouter un accord..."
            />
            <button
              type="button"
              onClick={() => addTag('pairings', newPairing, setNewPairing)}
              className="px-4 py-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Substitutes */}
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-6">
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
            Substituts
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {formData.substitutes.map((tag, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-sm">
                {tag}
                <button type="button" onClick={() => removeTag('substitutes', i)} className="hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newSubstitute}
              onChange={(e) => setNewSubstitute(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag('substitutes', newSubstitute, setNewSubstitute))}
              className="flex-1 px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white"
              placeholder="Ajouter un substitut..."
            />
            <button
              type="button"
              onClick={() => addTag('substitutes', newSubstitute, setNewSubstitute)}
              className="px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Conservation */}
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-6 space-y-4">
          <h2 className="font-semibold text-stone-900 dark:text-white">Conservation</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Durée de conservation
              </label>
              <input
                type="text"
                value={formData.shelfLife}
                onChange={(e) => setFormData({ ...formData, shelfLife: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-kitchen-500"
                placeholder="Ex: 2 ans, 6 mois après ouverture"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Instructions de stockage
              </label>
              <input
                type="text"
                value={formData.storageInstructions}
                onChange={(e) => setFormData({ ...formData, storageInstructions: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-kitchen-500"
                placeholder="Ex: Au frais et au sec"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
              Histoire du producteur
            </label>
            <textarea
              value={formData.producerHistory}
              onChange={(e) => setFormData({ ...formData, producerHistory: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-kitchen-500"
              placeholder="Informations sur le producteur, son histoire, ses méthodes..."
            />
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
            disabled={saving}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-kitchen-500 to-kitchen-600 hover:from-kitchen-600 hover:to-kitchen-700 text-white font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
};
