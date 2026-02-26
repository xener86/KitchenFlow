import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Link,
  FileText,
  Upload,
  ChefHat,
  Sparkles,
  Loader2,
  Globe,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { createRecipe, importRecipeFromUrl, importPaprikaFile } from '../services/recipeService';
import { parseRecipeFromText } from '../services/aiService';
import type { Recipe, RecipeCategory, Difficulty, RecipeImportResult } from '../types';

// === CONSTANTS ===

type ImportTab = 'url' | 'text' | 'paprika' | 'manual';

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

const TABS: { id: ImportTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'url', label: 'URL', icon: Globe },
  { id: 'text', label: 'Texte', icon: FileText },
  { id: 'paprika', label: 'Paprika', icon: Upload },
  { id: 'manual', label: 'Manuel', icon: ChefHat },
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

interface PaprikaCandidate {
  importResult: RecipeImportResult;
  selected: boolean;
}

// === HELPERS ===

let rowIdCounter = 0;
const nextId = () => `row_${++rowIdCounter}_${Date.now()}`;

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

export const AddRecipe: React.FC = () => {
  const navigate = useNavigate();
  const formRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<ImportTab>('manual');

  // URL import
  const [importUrl, setImportUrl] = useState('');
  const [importingUrl, setImportingUrl] = useState(false);

  // Text import
  const [rawText, setRawText] = useState('');
  const [parsingText, setParsingText] = useState(false);

  // Paprika import
  const [paprikaFile, setPaprikaFile] = useState<File | null>(null);
  const [importingPaprika, setImportingPaprika] = useState(false);
  const [paprikaCandidates, setPaprikaCandidates] = useState<PaprikaCandidate[]>([]);
  const [paprikaBatchProgress, setPaprikaBatchProgress] = useState<{ current: number; total: number } | null>(null);

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
  const [toast, setToast] = useState('');

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // === POPULATE FORM FROM IMPORT ===

  const populateFromImport = useCallback((result: RecipeImportResult) => {
    const r = result.recipe;
    if (r.name) setName(r.name);
    if (r.category) setCategory(r.category);
    if (r.cuisine) setCuisine(r.cuisine || '');
    if (r.difficulty) setDifficulty(r.difficulty);
    if (r.prepTime != null) setPrepTime(String(r.prepTime));
    if (r.cookTime != null) setCookTime(String(r.cookTime));
    if (r.servings != null) setServings(String(r.servings));
    if (r.sourceUrl) setSourceUrl(r.sourceUrl);
    if (r.winePairings?.length) setWinePairings(r.winePairings);
    if (r.tips?.length) setTips(r.tips);
    if (r.variations?.length) setVariations(r.variations);
    if ((r.winePairings?.length || r.tips?.length || r.variations?.length)) {
      setShowExtras(true);
    }

    if (result.ingredients?.length) {
      setIngredients(
        result.ingredients.map((ing) => ({
          id: nextId(),
          amount: ing.amount != null ? String(ing.amount) : '',
          unit: ing.unit || '',
          name: ing.name,
          optional: ing.optional || false,
        }))
      );
    }

    if (r.instructions?.length) {
      setInstructions(
        r.instructions.map((text) => ({
          id: nextId(),
          text,
        }))
      );
    }

    // Scroll to form after populating
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, []);

  // === URL IMPORT ===

  const handleImportUrl = async () => {
    if (!importUrl.trim()) return;
    setImportingUrl(true);
    setError('');

    try {
      const result = await importRecipeFromUrl(importUrl.trim());

      // If server signals that it needs AI parsing (raw text returned, no structured data)
      if ((result as any).rawText && result.parseMethod !== 'JSON_LD') {
        setRawText((result as any).rawText);
        setActiveTab('text');
        setToast('Aucune donnee structuree trouvee. Le texte brut a ete extrait - vous pouvez le parser avec l\'IA.');
      } else {
        populateFromImport(result);
        setSourceUrl(importUrl.trim());
        setToast('Recette importee avec succes !');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'import depuis l\'URL');
    } finally {
      setImportingUrl(false);
    }
  };

  // === TEXT PARSE ===

  const handleParseText = async () => {
    if (!rawText.trim()) return;
    setParsingText(true);
    setError('');

    try {
      const parsed = await parseRecipeFromText(rawText.trim());
      const { ingredients: parsedIngredients, ...recipeFields } = parsed;
      populateFromImport({
        recipe: recipeFields as Partial<Recipe>,
        ingredients: parsedIngredients || [],
        confidence: 'MEDIUM',
        parseMethod: 'AI_TEXT',
      });
      setToast('Recette parsee avec succes !');
    } catch (err: any) {
      // parseRecipeFromText may not be implemented yet
      const message = err?.message || '';
      if (
        message.includes('is not a function') ||
        message.includes('not implemented') ||
        message.includes('undefined')
      ) {
        setError('Fonctionnalite IA bientot disponible');
      } else {
        setError(message || 'Erreur lors du parsing IA');
      }
    } finally {
      setParsingText(false);
    }
  };

  // === PAPRIKA IMPORT ===

  const handlePaprikaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPaprikaFile(file);
      setPaprikaCandidates([]);
      setPaprikaBatchProgress(null);
    }
  };

  const handleImportPaprika = async () => {
    if (!paprikaFile) return;
    setImportingPaprika(true);
    setError('');

    try {
      const results = await importPaprikaFile(paprikaFile);
      setPaprikaCandidates(
        results.map((r) => ({ importResult: r, selected: true }))
      );
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'import du fichier Paprika');
    } finally {
      setImportingPaprika(false);
    }
  };

  const togglePaprikaCandidate = (index: number) => {
    setPaprikaCandidates((prev) =>
      prev.map((c, i) => (i === index ? { ...c, selected: !c.selected } : c))
    );
  };

  const selectAllPaprika = (selected: boolean) => {
    setPaprikaCandidates((prev) => prev.map((c) => ({ ...c, selected })));
  };

  const handleBatchImportPaprika = async () => {
    const selected = paprikaCandidates.filter((c) => c.selected);
    if (selected.length === 0) return;

    setPaprikaBatchProgress({ current: 0, total: selected.length });
    setError('');

    try {
      for (let i = 0; i < selected.length; i++) {
        setPaprikaBatchProgress({ current: i + 1, total: selected.length });
        const result = selected[i].importResult;
        const r = result.recipe;
        await createRecipe({
          name: r.name || 'Recette sans nom',
          category: r.category,
          cuisine: r.cuisine,
          ingredients: result.ingredients?.map((ing) => ({
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit,
            optional: ing.optional,
          })),
          instructions: r.instructions,
          prepTime: r.prepTime,
          cookTime: r.cookTime,
          servings: r.servings,
          servingsText: r.servingsText,
          difficulty: r.difficulty,
          winePairings: r.winePairings,
          tips: r.tips,
          variations: r.variations,
          source: 'IMPORTED',
          sourceUrl: r.sourceUrl,
        });
      }
      navigate('/recipes');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'import par lot');
      setPaprikaBatchProgress(null);
    }
  };

  // === INGREDIENT ROWS ===

  const updateIngredient = (id: string, field: keyof IngredientRow, value: string | boolean) => {
    setIngredients((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const removeIngredient = (id: string) => {
    setIngredients((prev) => {
      const next = prev.filter((row) => row.id !== id);
      return next.length === 0 ? [emptyIngredientRow()] : next;
    });
  };

  const addIngredient = () => {
    setIngredients((prev) => [...prev, emptyIngredientRow()]);
  };

  // === INSTRUCTION ROWS ===

  const updateInstruction = (id: string, text: string) => {
    setInstructions((prev) =>
      prev.map((row) => (row.id === id ? { ...row, text } : row))
    );
  };

  const removeInstruction = (id: string) => {
    setInstructions((prev) => {
      const next = prev.filter((row) => row.id !== id);
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
    // Support comma-separated input
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

      await createRecipe({
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
        source: sourceUrl.trim() ? 'IMPORTED' : 'MANUAL',
      });

      navigate('/recipes');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  // === RENDER ===

  const selectedPaprikaCount = paprikaCandidates.filter((c) => c.selected).length;

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
          Ajouter une recette
        </h1>
      </div>

      {/* Toast */}
      {toast && (
        <div className="mb-4 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm animate-in fade-in">
          {toast}
        </div>
      )}

      {/* Import Tabs */}
      <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 mb-6">
        <div className="flex border-b border-stone-200 dark:border-stone-800">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-kitchen-600 dark:text-kitchen-400 border-b-2 border-kitchen-500'
                    : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {/* URL Tab */}
          {activeTab === 'url' && (
            <div className="space-y-4">
              <p className="text-sm text-stone-600 dark:text-stone-400">
                Collez l'URL d'une recette pour l'importer automatiquement.
              </p>
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="url"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleImportUrl();
                      }
                    }}
                    placeholder="https://www.marmiton.org/recettes/..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-kitchen-500 focus:border-transparent"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleImportUrl}
                  disabled={importingUrl || !importUrl.trim()}
                  className="px-5 py-3 rounded-xl bg-kitchen-500 hover:bg-kitchen-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {importingUrl ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Link className="w-4 h-4" />
                  )}
                  Importer
                </button>
              </div>
            </div>
          )}

          {/* Text Tab */}
          {activeTab === 'text' && (
            <div className="space-y-4">
              <p className="text-sm text-stone-600 dark:text-stone-400">
                Collez le texte d'une recette et l'IA extraira les informations structurees.
              </p>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={8}
                placeholder="Collez ici le texte complet de la recette (ingredients, etapes, temps de cuisson...)"
                className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-kitchen-500 focus:border-transparent resize-y min-h-[200px]"
              />
              <button
                type="button"
                onClick={handleParseText}
                disabled={parsingText || !rawText.trim()}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {parsingText ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Parser avec l'IA
              </button>
            </div>
          )}

          {/* Paprika Tab */}
          {activeTab === 'paprika' && (
            <div className="space-y-4">
              <p className="text-sm text-stone-600 dark:text-stone-400">
                Importez vos recettes depuis un fichier Paprika (.paprikarecipes).
              </p>

              {/* File input + import button */}
              {paprikaCandidates.length === 0 && !paprikaBatchProgress && (
                <div className="flex gap-3 items-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:border-kitchen-500 hover:text-kitchen-600 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    {paprikaFile ? paprikaFile.name : 'Choisir un fichier .paprikarecipes'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".paprikarecipes"
                    onChange={handlePaprikaFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={handleImportPaprika}
                    disabled={importingPaprika || !paprikaFile}
                    className="px-5 py-3 rounded-xl bg-kitchen-500 hover:bg-kitchen-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {importingPaprika ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    Importer
                  </button>
                </div>
              )}

              {/* Candidates list */}
              {paprikaCandidates.length > 0 && !paprikaBatchProgress && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
                      {paprikaCandidates.length} recette{paprikaCandidates.length > 1 ? 's' : ''} trouvee{paprikaCandidates.length > 1 ? 's' : ''}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => selectAllPaprika(true)}
                        className="text-xs px-3 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                      >
                        Tout selectionner
                      </button>
                      <button
                        type="button"
                        onClick={() => selectAllPaprika(false)}
                        className="text-xs px-3 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                      >
                        Tout deselectionner
                      </button>
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto rounded-xl border border-stone-200 dark:border-stone-800 divide-y divide-stone-200 dark:divide-stone-800">
                    {paprikaCandidates.map((candidate, index) => {
                      const r = candidate.importResult;
                      return (
                        <label
                          key={index}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50 dark:hover:bg-stone-800/50 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={candidate.selected}
                            onChange={() => togglePaprikaCandidate(index)}
                            className="w-4 h-4 rounded border-stone-300 dark:border-stone-600 text-kitchen-500 focus:ring-kitchen-500"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-stone-900 dark:text-white truncate">
                              {r.recipe.name || 'Recette sans nom'}
                            </p>
                            <p className="text-xs text-stone-500 dark:text-stone-400">
                              {r.ingredients?.length || 0} ingredient{(r.ingredients?.length || 0) > 1 ? 's' : ''}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={handleBatchImportPaprika}
                    disabled={selectedPaprikaCount === 0}
                    className="w-full px-5 py-3 rounded-xl bg-kitchen-500 hover:bg-kitchen-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    <BookOpen className="w-4 h-4" />
                    Importer {selectedPaprikaCount} recette{selectedPaprikaCount > 1 ? 's' : ''}
                  </button>
                </div>
              )}

              {/* Batch progress */}
              {paprikaBatchProgress && (
                <div className="text-center py-6 space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-kitchen-500 mx-auto" />
                  <p className="text-sm font-medium text-stone-700 dark:text-stone-300">
                    Import en cours... {paprikaBatchProgress.current}/{paprikaBatchProgress.total}
                  </p>
                  <div className="w-full bg-stone-200 dark:bg-stone-700 rounded-full h-2">
                    <div
                      className="bg-kitchen-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(paprikaBatchProgress.current / paprikaBatchProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manual Tab */}
          {activeTab === 'manual' && (
            <p className="text-sm text-stone-600 dark:text-stone-400">
              Remplissez le formulaire ci-dessous pour creer une recette manuellement.
            </p>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Recipe Form (shown for all tabs) */}
      <div ref={formRef}>
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
                <Plus className="w-5 h-5" />
              )}
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
