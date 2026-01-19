import { GoogleGenAI, Type } from '@google/genai';
import type { Ingredient, AIConfig, ChefSuggestion, RecipeImprovement } from '../types';

// === CONFIG MANAGEMENT ===

const AI_CONFIG_KEY = 'kf_ai_config';

export const getAIConfig = (): AIConfig => {
  try {
    const stored = localStorage.getItem(AI_CONFIG_KEY);
    if (stored) return JSON.parse(stored);
  } catch { }
  return {
    provider: 'GEMINI',
    keys: { gemini: '', openai: '', mistral: '' }
  };
};

export const saveAIConfig = (config: AIConfig): void => {
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
};

// === AI ADAPTER INTERFACE ===

interface AIAdapter {
  enrichIngredient(name: string, hint?: string, imageBase64?: string): Promise<Partial<Ingredient> | null>;
  suggestRecipesFromIngredients(ingredients: string[]): Promise<ChefSuggestion[]>;
  improveRecipe(recipe: string, availableIngredients: string[]): Promise<RecipeImprovement | null>;
  chat(history: Array<{ role: string; content: string }>, message: string): Promise<string>;
}

// === GEMINI ADAPTER ===

class GeminiAdapter implements AIAdapter {
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  private async generateJSON(prompt: string | any[], schema: any): Promise<any> {
    try {
      const response = await this.client.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt as any,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature: 0.3
        }
      });
      return response.text ? JSON.parse(response.text) : null;
    } catch (e) {
      console.error("Gemini Error", e);
      return null;
    }
  }

  async enrichIngredient(name: string, hint?: string, imageBase64?: string): Promise<Partial<Ingredient> | null> {
    let contents: any;

    if (imageBase64) {
      contents = [
        { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
        {
          text: `Tu es un expert culinaire. Analyse cette image d'ingrédient ou d'étiquette.
Extrais toutes les informations: nom, marque, origine, catégorie, profil gustatif.
Suggère des utilisations culinaires, des accords et des substituts possibles.
Réponds en JSON en français.`
        }
      ];
    } else {
      contents = `Tu es un expert culinaire et gastronome.
Analyse cet ingrédient: "${name}" ${hint ? `(indice: ${hint})` : ''}.

Fournis une description détaillée incluant:
- Profil gustatif et aromatique
- Utilisations culinaires recommandées
- Accords avec d'autres ingrédients
- Substituts possibles
- Conseils de conservation

Réponds en JSON en français.`;
    }

    const schema = {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        brand: { type: Type.STRING },
        origin: { type: Type.STRING },
        category: { type: Type.STRING },
        flavorProfile: { type: Type.STRING },
        aromaProfile: { type: Type.ARRAY, items: { type: Type.STRING } },
        heatLevel: { type: Type.NUMBER },
        description: { type: Type.STRING },
        suggestedUses: { type: Type.ARRAY, items: { type: Type.STRING } },
        pairings: { type: Type.ARRAY, items: { type: Type.STRING } },
        substitutes: { type: Type.ARRAY, items: { type: Type.STRING } },
        shelfLife: { type: Type.STRING },
        storageInstructions: { type: Type.STRING },
        confidence: { type: Type.STRING, enum: ['HIGH', 'MEDIUM', 'LOW'] }
      }
    };

    const res = await this.generateJSON(contents, schema);
    if (res) {
      return {
        ...res,
        enrichedByAI: true,
        aiConfidence: res.confidence || 'MEDIUM'
      };
    }
    return null;
  }

  async suggestRecipesFromIngredients(ingredients: string[]): Promise<ChefSuggestion[]> {
    const prompt = `Tu es un chef cuisinier créatif.
Avec ces ingrédients disponibles: ${ingredients.join(', ')}

Propose 3-5 idées de recettes ou d'utilisations créatives.
Pour chaque suggestion, indique:
- Le titre
- Une brève description
- Les ingrédients principaux utilisés
- Les étapes clés

Réponds en JSON en français.`;

    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ['RECIPE', 'IMPROVEMENT', 'SUBSTITUTION', 'PAIRING'] },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
          instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
          confidence: { type: Type.STRING, enum: ['HIGH', 'MEDIUM', 'LOW'] }
        }
      }
    };

    const res = await this.generateJSON(prompt, schema);
    return res || [];
  }

  async improveRecipe(recipe: string, availableIngredients: string[]): Promise<RecipeImprovement | null> {
    const prompt = `Tu es un chef gastronome expert.

Recette originale:
${recipe}

Ingrédients disponibles dans ma cuisine:
${availableIngredients.join(', ')}

Propose des améliorations pour cette recette en utilisant les ingrédients disponibles.
Suggère des ajouts, substitutions ou techniques pour sublimer le plat.

Réponds en JSON en français.`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        originalRecipe: { type: Type.STRING },
        improvements: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              ingredient: { type: Type.STRING },
              suggestion: { type: Type.STRING },
              reason: { type: Type.STRING },
              available: { type: Type.BOOLEAN }
            }
          }
        },
        enhancedInstructions: { type: Type.ARRAY, items: { type: Type.STRING } },
        tips: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    };

    return await this.generateJSON(prompt, schema);
  }

  async chat(history: Array<{ role: string; content: string }>, message: string): Promise<string> {
    try {
      const systemPrompt = `Tu es un assistant culinaire expert et passionné.
Tu aides avec les questions de cuisine, les techniques, les substitutions d'ingrédients,
les conseils de conservation et les idées de recettes.
Réponds de manière concise et pratique en français.`;

      const messages = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: "Compris ! Je suis prêt à vous aider en cuisine. Que puis-je faire pour vous ?" }] },
        ...history.map(h => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }]
        })),
        { role: 'user', parts: [{ text: message }] }
      ];

      const response = await this.client.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: messages as any,
        config: { temperature: 0.7 }
      });

      return response.text || "Désolé, je n'ai pas pu générer de réponse.";
    } catch (e) {
      console.error("Chat error", e);
      return "Une erreur est survenue. Veuillez réessayer.";
    }
  }
}

// === REST ADAPTER (OpenAI/Mistral) ===

class RestAdapter implements AIAdapter {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(apiKey: string, provider: 'OPENAI' | 'MISTRAL') {
    this.apiKey = apiKey;
    this.baseUrl = provider === 'OPENAI'
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://api.mistral.ai/v1/chat/completions';
    this.model = provider === 'OPENAI' ? 'gpt-4o-mini' : 'mistral-large-latest';
  }

  private async call(messages: any[], jsonMode = true): Promise<any> {
    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          response_format: jsonMode ? { type: "json_object" } : undefined
        })
      });
      const data = await res.json();
      const content = data.choices[0].message.content;
      return jsonMode ? JSON.parse(content) : content;
    } catch (e) {
      console.error("REST API Error", e);
      return null;
    }
  }

  async enrichIngredient(name: string, hint?: string): Promise<Partial<Ingredient> | null> {
    const system = `Tu es un expert culinaire. Réponds en JSON avec les champs:
name, brand, origin, category, flavorProfile, aromaProfile (array), description,
suggestedUses (array), pairings (array), substitutes (array), shelfLife, storageInstructions, confidence.`;

    const user = `Analyse cet ingrédient: "${name}" ${hint ? `(${hint})` : ''}. Fournis une description complète en français.`;

    const res = await this.call([
      { role: "system", content: system },
      { role: "user", content: user }
    ]);

    if (res) {
      return { ...res, enrichedByAI: true, aiConfidence: res.confidence || 'MEDIUM' };
    }
    return null;
  }

  async suggestRecipesFromIngredients(ingredients: string[]): Promise<ChefSuggestion[]> {
    const system = `Tu es un chef créatif. Réponds en JSON avec un array de suggestions.
Chaque suggestion: { type, title, description, ingredients (array), instructions (array), confidence }`;

    const user = `Avec ces ingrédients: ${ingredients.join(', ')}. Propose 3-5 idées de recettes en français.`;

    return await this.call([
      { role: "system", content: system },
      { role: "user", content: user }
    ]) || [];
  }

  async improveRecipe(recipe: string, availableIngredients: string[]): Promise<RecipeImprovement | null> {
    const system = `Tu es un chef gastronome. Réponds en JSON avec:
{ originalRecipe, improvements: [{ ingredient, suggestion, reason, available }], enhancedInstructions, tips }`;

    const user = `Recette: ${recipe}\nIngrédients disponibles: ${availableIngredients.join(', ')}\nAméliore cette recette en français.`;

    return await this.call([
      { role: "system", content: system },
      { role: "user", content: user }
    ]);
  }

  async chat(history: Array<{ role: string; content: string }>, message: string): Promise<string> {
    const messages = [
      { role: "system", content: "Tu es un assistant culinaire expert. Réponds en français de manière concise et pratique." },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: "user", content: message }
    ];

    return await this.call(messages, false) || "Une erreur est survenue.";
  }
}

// === FACTORY ===

export const getAiProvider = (): AIAdapter => {
  const config = getAIConfig();

  if (config.provider === 'OPENAI' && config.keys.openai) {
    return new RestAdapter(config.keys.openai, 'OPENAI');
  }
  if (config.provider === 'MISTRAL' && config.keys.mistral) {
    return new RestAdapter(config.keys.mistral, 'MISTRAL');
  }

  const key = config.keys.gemini || (process.env as any).GEMINI_API_KEY || '';
  return new GeminiAdapter(key);
};

// === EXPORTED CONVENIENCE FUNCTIONS ===

export const enrichIngredientData = (name: string, hint?: string, imageBase64?: string) =>
  getAiProvider().enrichIngredient(name, hint, imageBase64);

export const suggestRecipes = (ingredients: string[]) =>
  getAiProvider().suggestRecipesFromIngredients(ingredients);

export const improveRecipe = (recipe: string, availableIngredients: string[]) =>
  getAiProvider().improveRecipe(recipe, availableIngredients);

export const chatWithChef = (history: Array<{ role: string; content: string }>, message: string) =>
  getAiProvider().chat(history, message);
