import React, { useState } from 'react';
import { useAIConfig } from '../hooks/useAIConfig';
import { useTheme } from '../contexts/ThemeContext';
import { exportFullData, importFullData } from '../services/ingredientService';
import {
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  Moon,
  Monitor,
  Download,
  Upload,
  Loader2,
  Check,
  AlertCircle,
  Key
} from 'lucide-react';
import type { AIProvider } from '../types';

export const Settings: React.FC = () => {
  const { config, updateConfig } = useAIConfig();
  const { theme, setTheme } = useTheme();

  const [geminiKey, setGeminiKey] = useState(config.keys.gemini);
  const [openaiKey, setOpenaiKey] = useState(config.keys.openai);
  const [mistralKey, setMistralKey] = useState(config.keys.mistral);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(config.provider);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  const handleSaveAI = () => {
    setSaving(true);
    updateConfig({
      provider: selectedProvider,
      keys: {
        gemini: geminiKey,
        openai: openaiKey,
        mistral: mistralKey
      }
    });
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 500);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await exportFullData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kitchenflow-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportError('');

    try {
      const text = await file.text();
      const success = await importFullData(text);
      if (!success) {
        setImportError("Échec de l'import. Vérifiez le format du fichier.");
      } else {
        window.location.reload();
      }
    } catch (err) {
      setImportError("Erreur lors de la lecture du fichier.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-kitchen-100 dark:bg-kitchen-900/30 flex items-center justify-center">
          <SettingsIcon className="w-6 h-6 text-kitchen-600 dark:text-kitchen-400" />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-bold text-stone-900 dark:text-white">
            Paramètres
          </h1>
          <p className="text-stone-600 dark:text-stone-400">
            Configurez votre application
          </p>
        </div>
      </div>

      {/* Theme */}
      <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-6">
        <h2 className="font-semibold text-stone-900 dark:text-white mb-4 flex items-center gap-2">
          <Sun className="w-5 h-5" />
          Apparence
        </h2>

        <div className="flex gap-2">
          {[
            { value: 'light', icon: Sun, label: 'Clair' },
            { value: 'dark', icon: Moon, label: 'Sombre' },
            { value: 'system', icon: Monitor, label: 'Système' },
          ].map(option => (
            <button
              key={option.value}
              onClick={() => setTheme(option.value as 'light' | 'dark' | 'system')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border transition-all ${
                theme === option.value
                  ? 'border-kitchen-500 bg-kitchen-50 dark:bg-kitchen-900/20 text-kitchen-600 dark:text-kitchen-400'
                  : 'border-stone-200 dark:border-stone-700 hover:border-kitchen-300'
              }`}
            >
              <option.icon className="w-5 h-5" />
              <span className="font-medium">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* AI Configuration */}
      <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-6">
        <h2 className="font-semibold text-stone-900 dark:text-white mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          Configuration IA
        </h2>

        <div className="space-y-4">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
              Fournisseur IA
            </label>
            <div className="flex gap-2">
              {(['GEMINI', 'OPENAI', 'MISTRAL'] as AIProvider[]).map(provider => (
                <button
                  key={provider}
                  onClick={() => setSelectedProvider(provider)}
                  className={`flex-1 py-2 px-4 rounded-lg border transition-all ${
                    selectedProvider === provider
                      ? 'border-kitchen-500 bg-kitchen-50 dark:bg-kitchen-900/20 text-kitchen-600'
                      : 'border-stone-200 dark:border-stone-700 hover:border-kitchen-300'
                  }`}
                >
                  {provider}
                </button>
              ))}
            </div>
          </div>

          {/* API Keys */}
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
              <Key className="w-4 h-4 inline mr-1" />
              Clé API Gemini
            </label>
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIza..."
              className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-kitchen-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
              <Key className="w-4 h-4 inline mr-1" />
              Clé API OpenAI (optionnel)
            </label>
            <input
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-kitchen-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
              <Key className="w-4 h-4 inline mr-1" />
              Clé API Mistral (optionnel)
            </label>
            <input
              type="password"
              value={mistralKey}
              onChange={(e) => setMistralKey(e.target.value)}
              placeholder="..."
              className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-kitchen-500"
            />
          </div>

          <button
            onClick={handleSaveAI}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-kitchen-500 to-kitchen-600 hover:from-kitchen-600 hover:to-kitchen-700 text-white font-semibold flex items-center justify-center gap-2"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : saved ? (
              <>
                <Check className="w-5 h-5" />
                Enregistré !
              </>
            ) : (
              'Enregistrer'
            )}
          </button>
        </div>
      </div>

      {/* Backup */}
      <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-6">
        <h2 className="font-semibold text-stone-900 dark:text-white mb-4 flex items-center gap-2">
          <Download className="w-5 h-5" />
          Sauvegarde
        </h2>

        <div className="space-y-4">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full py-3 rounded-xl border border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 font-medium flex items-center justify-center gap-2"
          >
            {exporting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Download className="w-5 h-5" />
            )}
            Exporter les données
          </button>

          <label className="block">
            <div className="w-full py-3 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 hover:border-kitchen-500 cursor-pointer font-medium flex items-center justify-center gap-2 transition-colors">
              {importing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
              Importer une sauvegarde
            </div>
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>

          {importError && (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              {importError}
            </div>
          )}
        </div>
      </div>

      {/* Version */}
      <div className="text-center text-stone-500 text-sm">
        KitchenFlow v1.0.0
      </div>
    </div>
  );
};
