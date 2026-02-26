import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  Save,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { getRecipeById, updateRecipe } from '../services/recipeService';
import type { RecipeCategory, Difficulty, RecipeWithIngredients } from '../types';

// === CONSTANTS ===

const CATEGORIES: { value: RecipeCategory; label: string }[] = [
  { value: 'ENTREE', label: 'Entree' },
  { value: 'PLAT', label: 'Plat principal' },
  { value: 'DESSERT', label: 'Dessert' },
  { value: 'SAUCE', label: 'Sauce' },
  { value: 'ACCOMPAGNEMENT', label: 'Accompagnement' },
  { value: 'BOISSON', label: 'Boisson' },
  { value: 'SNACK', label: 'En-cas' },
];

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: 'EASY', label: 'Facile' },
  { value: 'MEDIUM', label: 'Moyen' },
  { value: 'HARD', label: 'Difficile' },
];

// === TYPES ===

interface IngredientRow {
  id: string;
  amount: string;
  unit: string;
  name: string;
  optional: boolean;
}

interface InstructionRow {
  id: string;
  text: string;
}

// === HELPERS ===

let rowIdCounter = 0;
const nextId = () => `edit_row_${++rowIdCounter}_${Date.now()}`;

const emptyIngredientRow = (): IngredientRow => ({
  id: nextId(),
  amount: '',
  unit: '',
  name: '',
  optional: false,
});

const emptyInstructionRow = (): InstructionRow => ({
  id: nextId(),
  text: '',
});

// === COMPONENT ===

export const EditRecipe: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // Loading state
  const [loading, setLoading] = useState(true);
  const [recipe, setRecipe] = useState<RecipeWithIngredients | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState<RecipeCategory>('PLAT');
  const [cuisine, setCuisine] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
  const [prepTime, setPrepTime] = useState<string>('');
  const [cookTime, setCookTime] = useState<string>('');
  const [servings, setServings] = useState<string>('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [ingredients, setIngredients] = useState<IngredientRow[]>([emptyIngredientRow()]);
  const [instructions, setInstructions] = useState<InstructionRow[]>([emptyInstructionRow()]);

  // Extras (collapsible)
  const [showExtras, setShowExtras] = useState(false);
  const [winePairings, setWinePairings] = useState<string[]>([]);
  const [tips, setTips] = useState<string[]>([]);
  const [variations, setVariations] = useState<string[]>([]);
  const [newWinePairing, setNewWinePairing] = useState('');
  const [newTip, setNewTip] = useState('');
  const [newVariation, setNewVariation] = useState('');

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // === LOAD RECIPE ===

  useEffect(() => {
    if (!id) return;

    const loadRecipe = async () => {
      setLoading(true);
      try {
        const data = await getRecipeById(id);
        if (!data) {
          setError('Recette introuvable');
          setLoading(false);
          return;
        }

        setRecipe(data);

        // Populate form fields
        setName(data.name);
        setCategory(data.category);
        setCuisine(data.cuisine || '');
        setDifficulty(data.difficulty);
        setPrepTime(data.prepTime ? String(data.prepTime) : '');
        setCookTime(data.cookTime ? String(data.cookTime) : '');
        setServings(data.servings ? String(data.servings) : '');
        setSourceUrl(data.sourceUrl || '');

        // Populate ingredients
        if (data.ingredients?.length) {
          setIngredients(
            data.ingredients.map((ing) => ({
              id: nextId(),
              amount: ing.amount != null ? String(ing.amount) : '',
              unit: ing.unit || '',
              name: ing.name,
              optional: ing.optional || false,
            }))
          );
        }

        // Populate instructions
        if (data.instructions?.length) {
          setInstructions(
            data.instructions.map((text) => ({
              id: nextId(),
              text,
            }))
          );
        }

        // Populate extras
        if (data.winePairings?.length) setWinePairings(data.winePairings);
        if (data.tips?.length) setTips(data.tips);
        if (data.variations?.length) setVariations(data.variations);
        if (data.winePairings?.length || data.tips?.length || data.variations?.length) {
          setShowExtras(true);
        }
      } catch (err: any) {
        setError(err.message || 'Erreur lors du chargement de la recette');
      } finally {
        setLoading(false);
      }
    };

    loadRecipe();
  }, [id]);

  // === INGREDIENT ROWS ===

  const updateIngredient = (rowId: string, field: keyof IngredientRow, value: string | boolean) => {
    setIngredients((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
  };

  const removeIngredient = (rowId: string) => {
    setIngredients((prev) => {
      const next = prev.filter((row) => row.id !== rowId);
      return next.length === 0 ? [emptyIngredientRow()] : next;
    });
  };

  const addIngredient = () => {
    setIngredients((prev) => [...prev, emptyIngredientRow()]);
  };

  // === INSTRUCTION ROWS ===

  const updateInstruction = (rowId: string, text: string) => {
    setInstructions((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, text } : row))
    );
  };

  const removeInstruction = (rowId: string) => {
    setInstructions((prev) => {
      const next = prev.filter((row) => row.id !== rowId);
      return next.length === 0 ? [emptyInstructionRow()] : next;
    });
  };

  const addInstruction = () => {
    setInstructions((prev) => [...prev, emptyInstructionRow()]);
  };

  // === TAG HELPERS ===

  const addTag = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    inputSetter: React.Dispatch<React.SetStateAction<string>>,
    value: string
  ) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const tags = trimmed.split(',').map((t) => t.trim()).filter(Boolean);
    setter((prev) => [...prev, ...tags]);
    inputSetter('');
  };

  const removeTag = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number
  ) => {
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTagKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    inputSetter: React.Dispatch<React.SetStateAction<string>>,
    value: string
  ) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(setter, inputSetter, value);
    }
  };

  // === SUBMIT ===

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (!name.trim()) {
      setError('Le nom de la recette est requis');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const validIngredients = ingredients
        .filter((row) => row.name.trim())
        .map((row) => ({
          name: row.name.trim(),
          amount: row.amount ? parseFloat(row.amount) : undefined,
          unit: row.unit.trim() || undefined,
          optional: row.optional,
        }));

      const validInstructions = instructions
        .map((row) => row.text.trim())
        .filter(Boolean);

      await updateRecipe(id, {
        name: name.trim(),
        category,
        cuisine: cuisine.trim() || undefined,
        difficulty,
        prepTime: prepTime ? parseInt(prepTime, 10) : undefined,
        cookTime: cookTime ? parseInt(cookTime, 10) : undefined,
        servings: servings ? parseInt(servings, 10) : undefined,
        sourceUrl: sourceUrl.trim() || undefined,
        ingredients: validIngredients,
        instructions: validInstructions,
        winePairings: winePairings.length > 0 ? winePairings : undefined,
        tips: tips.length > 0 ? tips : undefined,
        variations: variations.length > 0 ? variations : undefined,
      });

      navigate(`/recipe/${id}`);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // === LOADING STATE ===

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-kitchen-500 mx-auto" />
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Chargement de la recette...
          </p>
        </div>
      </div>
    );
  }

  if (!recipe && error) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-serif text-2xl font-bold text-stone-900 dark:text-white">
            Modifier la recette
          </h1>
        </div>
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      </div>
    );
  }

  // === RENDER ===

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-serif text-2xl font-bold text-stone-900 dark:text-white">
          Modifier la recette
        </h1>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Recipe Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-6 space-y-4">
          <h2 className="font-semibold text-stone-900 dark:text-white">Informations de base</h2>

          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
              Nom de la recette *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Risotto aux champignons"
              required
              className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-kitchen-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Categorie
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as RecipeCategory)}
                className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-kitchen-500 focus:border-transparent"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Cuisine
              </label>
              <input
                type="text"
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                placeholder="Ex: Italienne, Francaise..."
                className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-kitchen-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
              Difficulte
            </label>
            <div className="flex gap-2">
              {DIFFICULTY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDifficulty(opt.value)}
                  className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                    difficulty === opt.value
                      ? opt.value === 'EASY'
                        ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border-2 border-green-400 dark:border-green-600'
                        : opt.value === 'MEDIUM'
                          ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-2 border-amber-400 dark:border-amber-600'
                          : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border-2 border-red-400 dark:border-red-600'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border-2 border-transparent hover:bg-stone-200 dark:hover:bg-stone-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time & Servings */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Preparation (min)
              </label>
              <input
                type="number"
                min="0"
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value)}
                placeholder="30"
                className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-kitchen-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Cuisson (min)
              </label>
              <input
                type="number"
                min="0"
                value={cookTime}
                onChange={(e) => setCookTime(e.target.value)}
                placeholder="45"
                className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-kitchen-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Portions
              </label>
              <input
                type="number"
                min="1"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                placeholder="4"
                className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-kitchen-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Source URL */}
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
              URL source (optionnel)
            </label>
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-kitchen-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Ingredients */}
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-6 space-y-4">
          <h2 className="font-semibold text-stone-900 dark:text-white">Ingredients</h2>

          <div className="space-y-2">
            {ingredients.map((row, index) => (
              <div key={row.id} className="flex items-center gap-2">
                <span className="text-xs text-stone-400 dark:text-stone-500 w-5 text-right shrink-0">
                  {index + 1}
                </span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={row.amount}
                  onChange={(e) => updateIngredient(row.id, 'amount', e.target.value)}
                  placeholder="Qte"
                  className="w-16 px-2 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-kitchen-500 focus:border-transparent"
                />
                <input
                  type="text"
                  value={row.unit}
                  onChange={(e) => updateIngredient(row.id, 'unit', e.target.value)}
                  placeholder="Unite"
                  className="w-20 px-2 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-kitchen-500 focus:border-transparent"
                />
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) => updateIngredient(row.id, 'name', e.target.value)}
                  placeholder="Nom de l'ingredient"
                  className="flex-1 px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-kitchen-500 focus:border-transparent"
                />
                <label className="flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400 shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={row.optional}
                    onChange={(e) => updateIngredient(row.id, 'optional', e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-stone-300 dark:border-stone-600 text-kitchen-500 focus:ring-kitchen-500"
                  />
                  Opt.
                </label>
                <button
                  type="button"
                  onClick={() => removeIngredient(row.id)}
                  className="p-1.5 text-stone-400 hover:text-red-500 dark:hover:text-red-400 transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addIngredient}
            className="flex items-center gap-2 text-sm text-kitchen-600 dark:text-kitchen-400 hover:text-kitchen-700 dark:hover:text-kitchen-300 font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter un ingredient
          </button>
        </div>

        {/* Instructions */}
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-6 space-y-4">
          <h2 className="font-semibold text-stone-900 dark:text-white">Instructions</h2>

          <div className="space-y-3">
            {instructions.map((row, index) => (
              <div key={row.id} className="flex items-start gap-2">
                <span className="mt-3 text-sm font-semibold text-kitchen-500 dark:text-kitchen-400 w-6 text-right shrink-0">
                  {index + 1}.
                </span>
                <textarea
                  value={row.text}
                  onChange={(e) => {
                    updateInstruction(row.id, e.target.value);
                    // Auto-grow textarea
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  rows={2}
                  placeholder={`Etape ${index + 1}...`}
                  className="flex-1 px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-kitchen-500 focus:border-transparent resize-none overflow-hidden"
                />
                <button
                  type="button"
                  onClick={() => removeInstruction(row.id)}
                  className="mt-2 p-1.5 text-stone-400 hover:text-red-500 dark:hover:text-red-400 transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addInstruction}
            className="flex items-center gap-2 text-sm text-kitchen-600 dark:text-kitchen-400 hover:text-kitchen-700 dark:hover:text-kitchen-300 font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter une etape
          </button>
        </div>

        {/* Extras (collapsible) */}
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800">
          <button
            type="button"
            onClick={() => setShowExtras(!showExtras)}
            className="w-full flex items-center justify-between px-6 py-4 text-left"
          >
            <h2 className="font-semibold text-stone-900 dark:text-white">
              Extras
            </h2>
            {showExtras ? (
              <ChevronUp className="w-5 h-5 text-stone-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-stone-400" />
            )}
          </button>

          {showExtras && (
            <div className="px-6 pb-6 space-y-5 border-t border-stone-200 dark:border-stone-800 pt-4">
              {/* Wine Pairings */}
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
                  Accords vins
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {winePairings.map((tag, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-sm"
                    >
                      {tag}
                      <button type="button" onClick={() => removeTag(setWinePairings, i)}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newWinePairing}
                    onChange={(e) => setNewWinePairing(e.target.value)}
                    onKeyDown={(e) => handleTagKeyDown(e, setWinePairings, setNewWinePairing, newWinePairing)}
                    placeholder="Ex: Bourgogne, Chablis... (virgule pour separer)"
                    className="flex-1 px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-kitchen-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => addTag(setWinePairings, setNewWinePairing, newWinePairing)}
                    className="p-2 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tips */}
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
                  Astuces
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tips.map((tag, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-sm"
                    >
                      {tag}
                      <button type="button" onClick={() => removeTag(setTips, i)}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTip}
                    onChange={(e) => setNewTip(e.target.value)}
                    onKeyDown={(e) => handleTagKeyDown(e, setTips, setNewTip, newTip)}
                    placeholder="Ex: Laisser reposer 10 min avant de servir"
                    className="flex-1 px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-kitchen-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => addTag(setTips, setNewTip, newTip)}
                    className="p-2 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Variations */}
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
                  Variantes
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {variations.map((tag, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-sm"
                    >
                      {tag}
                      <button type="button" onClick={() => removeTag(setVariations, i)}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newVariation}
                    onChange={(e) => setNewVariation(e.target.value)}
                    onKeyDown={(e) => handleTagKeyDown(e, setVariations, setNewVariation, newVariation)}
                    placeholder="Ex: Remplacer le riz par du quinoa"
                    className="flex-1 px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-kitchen-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => addTag(setVariations, setNewVariation, newVariation)}
                    className="p-2 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 py-3 px-4 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-medium hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-kitchen-500 to-kitchen-600 hover:from-kitchen-600 hover:to-kitchen-700 text-white font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
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
