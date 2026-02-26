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
  generateCompleteProductSheet(productName: string, brandOrProducer?: string): Promise<Partial<Ingredient> | null>;
  suggestRecipesFromIngredients(ingredients: string[]): Promise<ChefSuggestion[]>;
  improveRecipe(recipe: string, availableIngredients: string[]): Promise<RecipeImprovement | null>;
  chat(history: Array<{ role: string; content: string }>, message: string): Promise<string>;
  parseRecipeFromText(text: string): Promise<ParsedRecipeResult>;
  parseRecipeFromHtml(rawText: string, url: string): Promise<ParsedRecipeResult>;
  matchIngredientsToInventory(
    recipeIngredients: string[],
    inventoryIngredients: Array<{ id: string; name: string; category: string }>
  ): Promise<Array<{ recipeIngredientName: string; matchedIngredientId: string | null; confidence: string }>>;
  suggestEnhancements(
    recipe: { name: string; ingredients: string[]; instructions: string[] },
    inventoryIngredients: Array<{ name: string; category: string }>
  ): Promise<RecipeEnhancement>;
}

// Intermediate type for parsed recipe results
interface ParsedRecipeResult {
  name?: string;
  category?: string;
  cuisine?: string;
  difficulty?: string;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  servingsText?: string;
  instructions?: string[];
  winePairings?: string[];
  tips?: string[];
  variations?: string[];
  sourceUrl?: string;
  ingredients?: Array<{ name: string; amount?: number; unit?: string; optional?: boolean }>;
}

// === GEMINI ADAPTER ===

class GeminiAdapter implements AIAdapter {
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  private async generateJSON(prompt: string | any[], schema: any, useSearch: boolean = false): Promise<any> {
    try {
      const config: any = {
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0.3
      };

      // Enable Google Search grounding for better product info
      if (useSearch) {
        config.tools = [{ googleSearch: {} }];
      }

      const response = await this.client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt as any,
        config
      });
      return response.text ? JSON.parse(response.text) : null;
    } catch (e) {
      console.error("Gemini Error", e);
      return null;
    }
  }

  // Schema complet pour une fiche produit détaillée
  private getCompleteProductSchema() {
    return {
      type: Type.OBJECT,
      properties: {
        // Informations de base
        name: { type: Type.STRING, description: "Nom exact du produit" },
        brand: { type: Type.STRING, description: "Marque ou nom commercial" },
        producer: { type: Type.STRING, description: "Nom du producteur/artisan" },
        origin: { type: Type.STRING, description: "Origine géographique précise (région, pays)" },
        category: {
          type: Type.STRING,
          enum: ['SPICE', 'OIL', 'SAUCE', 'VINEGAR', 'CONDIMENT', 'HERB', 'GRAIN', 'FLOUR', 'SUGAR', 'DAIRY', 'PROTEIN', 'CANNED', 'FROZEN', 'BAKING', 'OTHER'],
          description: "Catégorie du produit"
        },
        format: { type: Type.STRING, description: "Format disponible (ex: 100ml, 250g)" },

        // Description riche
        description: {
          type: Type.STRING,
          description: "Description détaillée et évocatrice du produit (minimum 100 mots), incluant son histoire, sa fabrication, ce qui le rend unique"
        },

        // Profil sensoriel complet
        flavorProfile: {
          type: Type.STRING,
          description: "Description détaillée du profil gustatif : premières notes, coeur, finale, texture en bouche"
        },
        aromaProfile: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Liste des notes aromatiques (ex: olive noire confite, ail confit, fumée de chêne, romarin)"
        },
        heatLevel: {
          type: Type.NUMBER,
          description: "Niveau de piquant de 0 à 10 (0 = pas piquant)"
        },

        // Histoire et savoir-faire
        producerHistory: {
          type: Type.STRING,
          description: "Histoire du producteur, son savoir-faire, sa philosophie, ses méthodes artisanales (minimum 80 mots)"
        },

        // Fabrication
        ingredients: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Liste des ingrédients composant le produit"
        },
        fabricationMethod: {
          type: Type.STRING,
          description: "Méthode de fabrication, processus artisanal, techniques utilisées"
        },

        // Utilisations culinaires détaillées
        suggestedUses: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Utilisations culinaires détaillées et créatives (minimum 5 suggestions)"
        },

        // Accords
        pairings: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Accords avec d'autres ingrédients, plats, vins (minimum 5 suggestions)"
        },

        // Alternatives
        substitutes: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Substituts possibles si le produit n'est pas disponible"
        },

        // Conservation
        shelfLife: {
          type: Type.STRING,
          description: "Durée de conservation (avant et après ouverture)"
        },
        storageInstructions: {
          type: Type.STRING,
          description: "Instructions de stockage détaillées"
        },

        // Conseils du chef
        chefTips: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Conseils et astuces de chef pour utiliser au mieux ce produit"
        },

        // Métadonnées
        confidence: {
          type: Type.STRING,
          enum: ['HIGH', 'MEDIUM', 'LOW'],
          description: "Niveau de confiance des informations"
        }
      },
      required: ['name', 'category', 'description', 'flavorProfile', 'suggestedUses', 'pairings']
    };
  }

  async generateCompleteProductSheet(productName: string, brandOrProducer?: string): Promise<Partial<Ingredient> | null> {
    const prompt = `Tu es un expert culinaire, gastronome et critique gastronomique de renom.

MISSION : Créer une FICHE PRODUIT COMPLÈTE et DÉTAILLÉE pour ce produit :
"${productName}"${brandOrProducer ? ` de "${brandOrProducer}"` : ''}

RECHERCHE APPROFONDIE :
1. Recherche des informations sur ce produit spécifique et son producteur
2. Si c'est un produit artisanal, trouve l'histoire du producteur, ses méthodes
3. Identifie l'origine géographique précise
4. Découvre les ingrédients et le processus de fabrication

EXIGENCES POUR LA FICHE :

📝 DESCRIPTION (minimum 100 mots) :
- Histoire et origine du produit
- Ce qui le rend unique et exceptionnel
- Contexte culturel ou régional
- Évocation sensorielle et émotionnelle

🍷 PROFIL GUSTATIF :
- Premières impressions en bouche
- Notes de cœur
- Finale et persistance
- Texture et sensations

👨‍🍳 HISTOIRE DU PRODUCTEUR (minimum 80 mots) :
- Qui est le producteur/artisan
- Son histoire, sa passion
- Ses méthodes de fabrication
- Sa philosophie

🍳 UTILISATIONS CULINAIRES (minimum 5) :
- Suggestions créatives et précises
- Exemples de plats spécifiques
- Techniques de cuisson recommandées
- Dosages conseillés

🤝 ACCORDS (minimum 5) :
- Avec quels ingrédients l'associer
- Quels plats sublimer
- Accords mets-vins si pertinent
- Combinaisons surprenantes

💡 CONSEILS DE CHEF :
- Astuces d'utilisation
- Erreurs à éviter
- Comment révéler tout son potentiel

Réponds en français avec des informations RICHES, PRÉCISES et ÉVOCATRICES.
Écris comme si tu rédigeais pour un guide gastronomique prestigieux.`;

    const res = await this.generateJSON(prompt, this.getCompleteProductSchema(), true);

    if (res) {
      return {
        ...res,
        enrichedByAI: true,
        aiConfidence: res.confidence || 'HIGH'
      };
    }
    return null;
  }

  async enrichIngredient(name: string, hint?: string, imageBase64?: string): Promise<Partial<Ingredient> | null> {
    // Si c'est une image, on analyse l'image d'abord
    if (imageBase64) {
      const contents = [
        { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
        {
          text: `Tu es un expert culinaire. Analyse cette image d'ingrédient ou d'étiquette.

ÉTAPE 1 : Identifie le produit
- Nom exact du produit
- Marque / Producteur
- Origine si visible

ÉTAPE 2 : Génère une fiche complète
Avec les mêmes exigences qu'une fiche produit professionnelle :
- Description détaillée et évocatrice (100+ mots)
- Profil gustatif complet
- Histoire du producteur si identifiable
- Utilisations culinaires créatives (5+)
- Accords recommandés (5+)
- Conseils de conservation

Réponds en JSON en français avec un maximum de détails.`
        }
      ];

      const res = await this.generateJSON(contents, this.getCompleteProductSchema(), false);
      if (res) {
        return {
          ...res,
          enrichedByAI: true,
          aiConfidence: res.confidence || 'MEDIUM'
        };
      }
      return null;
    }

    // Sinon, on utilise la génération complète avec recherche
    return this.generateCompleteProductSheet(name, hint);
  }

  async suggestRecipesFromIngredients(ingredients: string[]): Promise<ChefSuggestion[]> {
    const prompt = `Tu es un chef cuisinier créatif et passionné.

Avec ces ingrédients disponibles: ${ingredients.join(', ')}

Propose 3-5 idées de recettes ou d'utilisations créatives.
Pour chaque suggestion, fournis :
- Un titre accrocheur
- Une description appétissante
- Les ingrédients principaux utilisés
- Les étapes clés de la préparation
- Un conseil de chef

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
          chefTip: { type: Type.STRING },
          confidence: { type: Type.STRING, enum: ['HIGH', 'MEDIUM', 'LOW'] }
        }
      }
    };

    const res = await this.generateJSON(prompt, schema, false);
    return res || [];
  }

  async improveRecipe(recipe: string, availableIngredients: string[]): Promise<RecipeImprovement | null> {
    const prompt = `Tu es un chef gastronome expert et créatif.

Recette originale:
${recipe}

Ingrédients disponibles dans ma cuisine:
${availableIngredients.join(', ')}

MISSION : Sublime cette recette !

Propose des améliorations en utilisant les ingrédients disponibles :
- Ajouts pour enrichir les saveurs
- Substitutions pour améliorer
- Techniques pour sublimer
- Présentation pour épater

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
        tips: { type: Type.ARRAY, items: { type: Type.STRING } },
        presentationIdeas: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    };

    return await this.generateJSON(prompt, schema, false);
  }

  private getRecipeSchema() {
    return {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "Nom de la recette" },
        category: { type: Type.STRING, enum: ['ENTREE', 'PLAT', 'DESSERT', 'SAUCE', 'ACCOMPAGNEMENT', 'BOISSON', 'SNACK'] },
        cuisine: { type: Type.STRING, description: "Type de cuisine (indienne, française, italienne...)" },
        difficulty: { type: Type.STRING, enum: ['EASY', 'MEDIUM', 'HARD'] },
        prepTime: { type: Type.NUMBER, description: "Temps de préparation en minutes" },
        cookTime: { type: Type.NUMBER, description: "Temps de cuisson en minutes" },
        servings: { type: Type.NUMBER, description: "Nombre de portions" },
        servingsText: { type: Type.STRING, description: "Portions en texte original (ex: '6-8 personnes')" },
        ingredients: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Nom de l'ingrédient" },
              amount: { type: Type.NUMBER, description: "Quantité" },
              unit: { type: Type.STRING, description: "Unité (g, kg, ml, cl, l, c.s., c.c., pièce, bouquet...)" },
              optional: { type: Type.BOOLEAN, description: "Ingrédient optionnel" },
            },
            required: ['name']
          }
        },
        instructions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Étapes de préparation" },
        winePairings: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Accords mets-vins" },
        tips: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Astuces et conseils" },
        variations: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Variantes possibles" },
      },
      required: ['name', 'ingredients', 'instructions']
    };
  }

  async parseRecipeFromText(text: string): Promise<ParsedRecipeResult> {
    const prompt = `Tu es un expert culinaire. Parse ce texte de recette et extrais toutes les informations structurées.

Le texte peut venir d'un copier-coller de Paprika, d'un site web, ou d'une saisie libre.
Extrais soigneusement :
- Le nom de la recette
- La catégorie (ENTREE, PLAT, DESSERT, SAUCE, ACCOMPAGNEMENT, BOISSON, SNACK)
- La cuisine (indienne, française, etc.)
- La difficulté (EASY, MEDIUM, HARD)
- Les temps de préparation et cuisson en minutes
- Le nombre de portions
- Chaque ingrédient avec sa quantité et unité (gère ½, ¼, ¾, les c.s., c.c., etc.)
- Les étapes de préparation (une par élément du tableau)
- Les accords vins, astuces et variantes si présents

TEXTE DE LA RECETTE :
${text}

Réponds en JSON en français.`;

    const res = await this.generateJSON(prompt, this.getRecipeSchema());
    if (!res) throw new Error('Impossible de parser la recette');
    return res;
  }

  async parseRecipeFromHtml(rawText: string, url: string): Promise<ParsedRecipeResult> {
    const truncated = rawText.length > 15000 ? rawText.substring(0, 15000) + '...' : rawText;
    const prompt = `Tu es un expert culinaire. Ce texte a été extrait d'une page web de recette (${url}).
Extrais la recette et structure toutes les informations.

Ignore les publicités, menus de navigation, commentaires et contenu non lié à la recette.
Concentre-toi uniquement sur la recette elle-même.

TEXTE DE LA PAGE :
${truncated}

Réponds en JSON en français.`;

    const res = await this.generateJSON(prompt, this.getRecipeSchema());
    if (!res) throw new Error('Impossible de parser la recette depuis cette page');
    return res;
  }

  async matchIngredientsToInventory(
    recipeIngredients: string[],
    inventoryIngredients: Array<{ id: string; name: string; category: string }>
  ): Promise<Array<{ recipeIngredientName: string; matchedIngredientId: string | null; confidence: string }>> {
    if (!inventoryIngredients.length || !recipeIngredients.length) return recipeIngredients.map(name => ({ recipeIngredientName: name, matchedIngredientId: null, confidence: 'LOW' }));

    const inventoryList = inventoryIngredients.map(i => `${i.id}|${i.name} (${i.category})`).join('\n');

    const prompt = `Tu es un expert culinaire. Pour chaque ingrédient de recette ci-dessous, trouve le meilleur match dans l'inventaire.

INGRÉDIENTS DE LA RECETTE :
${recipeIngredients.map((n, i) => `${i + 1}. ${n}`).join('\n')}

INVENTAIRE DISPONIBLE (format: id|nom (catégorie)) :
${inventoryList}

RÈGLES DE MATCHING :
- "curry en poudre" → "Curry" = match HIGH
- "huile d'olive" → "Huile d'olive vierge extra" = match HIGH
- "sel" → "Sel de Guérande" = match HIGH
- "tomates" → pas dans l'inventaire = null
- Sois intelligent sur les synonymes et variantes
- En cas de doute, mets null plutôt qu'un mauvais match

Réponds en JSON.`;

    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          recipeIngredientName: { type: Type.STRING },
          matchedIngredientId: { type: Type.STRING, description: "UUID de l'ingrédient inventaire ou chaîne vide si pas de match" },
          confidence: { type: Type.STRING, enum: ['HIGH', 'MEDIUM', 'LOW'] },
        },
        required: ['recipeIngredientName', 'confidence']
      }
    };

    const res = await this.generateJSON(prompt, schema);
    if (!res) return recipeIngredients.map(name => ({ recipeIngredientName: name, matchedIngredientId: null, confidence: 'LOW' }));

    return res.map((r: any) => ({
      ...r,
      matchedIngredientId: r.matchedIngredientId || null,
    }));
  }

  async suggestEnhancements(
    recipe: { name: string; ingredients: string[]; instructions: string[] },
    inventoryIngredients: Array<{ name: string; category: string }>
  ): Promise<RecipeEnhancement> {
    const inventoryList = inventoryIngredients.map(i => `- ${i.name} (${i.category})`).join('\n');

    const prompt = `Tu es un chef gastronome créatif et passionné.

RECETTE : ${recipe.name}
INGRÉDIENTS : ${recipe.ingredients.join(', ')}
INSTRUCTIONS : ${recipe.instructions.join(' | ')}

INGRÉDIENTS SPÉCIAUX DANS L'ARMOIRE DU CUISINIER :
${inventoryList}

MISSION "COUP DE PEP'S" :
Propose des améliorations créatives en utilisant les ingrédients spéciaux disponibles.
- ADDITION : un ingrédient à ajouter pour sublimer le plat
- SUBSTITUTION : remplacer un ingrédient basique par un meilleur
- TECHNIQUE : une technique ou astuce pour améliorer le résultat

Pour chaque suggestion, indique l'impact : SUBTLE (nuance), NOTICEABLE (notable), TRANSFORMATIVE (transforme le plat).

Termine par un commentaire de chef enthousiaste et personnalisé.`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        suggestions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ['ADDITION', 'SUBSTITUTION', 'TECHNIQUE'] },
              ingredientFromInventory: { type: Type.STRING, description: "Nom de l'ingrédient de l'inventaire utilisé" },
              description: { type: Type.STRING, description: "Description de la suggestion" },
              reason: { type: Type.STRING, description: "Pourquoi cette amélioration fonctionne" },
              impact: { type: Type.STRING, enum: ['SUBTLE', 'NOTICEABLE', 'TRANSFORMATIVE'] },
            },
            required: ['type', 'ingredientFromInventory', 'description', 'reason', 'impact']
          }
        },
        chefComment: { type: Type.STRING, description: "Commentaire enthousiaste du chef" },
      },
      required: ['suggestions', 'chefComment']
    };

    const res = await this.generateJSON(prompt, schema);
    if (!res) throw new Error('Impossible de générer les suggestions');
    return res;
  }

  async chat(history: Array<{ role: string; content: string }>, message: string): Promise<string> {
    try {
      const systemPrompt = `Tu es un assistant culinaire expert, passionné et chaleureux.
Tu connais tout sur la cuisine, les ingrédients, les techniques, les accords.
Tu aides avec enthousiasme pour les questions de cuisine, les substitutions d'ingrédients,
les conseils de conservation et les idées de recettes.
Réponds de manière concise, pratique et inspirante en français.`;

      const messages = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: "Bonjour ! Je suis votre assistant culinaire. Que puis-je faire pour vous aujourd'hui ? 🍳" }] },
        ...history.map(h => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }]
        })),
        { role: 'user', parts: [{ text: message }] }
      ];

      const response = await this.client.models.generateContent({
        model: 'gemini-2.5-flash',
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

  async generateCompleteProductSheet(productName: string, brandOrProducer?: string): Promise<Partial<Ingredient> | null> {
    const system = `Tu es un expert culinaire et gastronome de renom.
Crée des fiches produit ULTRA-DÉTAILLÉES comme pour un guide gastronomique prestigieux.

Réponds en JSON avec ces champs :
- name, brand, producer, origin, category, format
- description (100+ mots, évocateur)
- flavorProfile (détaillé : attaque, cœur, finale)
- aromaProfile (array de notes aromatiques)
- heatLevel (0-10)
- producerHistory (80+ mots sur le producteur)
- ingredients (array)
- fabricationMethod
- suggestedUses (array, 5+ suggestions créatives)
- pairings (array, 5+ accords)
- substitutes (array)
- shelfLife, storageInstructions
- chefTips (array de conseils)
- confidence (HIGH/MEDIUM/LOW)`;

    const user = `Crée une fiche produit complète pour : "${productName}"${brandOrProducer ? ` de "${brandOrProducer}"` : ''}

Recherche des informations sur ce produit et son producteur.
Fournis une fiche RICHE et DÉTAILLÉE en français.`;

    const res = await this.call([
      { role: "system", content: system },
      { role: "user", content: user }
    ]);

    if (res) {
      return { ...res, enrichedByAI: true, aiConfidence: res.confidence || 'MEDIUM' };
    }
    return null;
  }

  async enrichIngredient(name: string, hint?: string): Promise<Partial<Ingredient> | null> {
    return this.generateCompleteProductSheet(name, hint);
  }

  async suggestRecipesFromIngredients(ingredients: string[]): Promise<ChefSuggestion[]> {
    const system = `Tu es un chef créatif. Réponds en JSON avec un array de suggestions.
Chaque suggestion: { type, title, description, ingredients (array), instructions (array), chefTip, confidence }`;

    const user = `Avec ces ingrédients: ${ingredients.join(', ')}. Propose 3-5 idées de recettes créatives en français.`;

    return await this.call([
      { role: "system", content: system },
      { role: "user", content: user }
    ]) || [];
  }

  async improveRecipe(recipe: string, availableIngredients: string[]): Promise<RecipeImprovement | null> {
    const system = `Tu es un chef gastronome. Réponds en JSON avec:
{ originalRecipe, improvements: [{ ingredient, suggestion, reason, available }], enhancedInstructions, tips, presentationIdeas }`;

    const user = `Recette: ${recipe}\nIngrédients disponibles: ${availableIngredients.join(', ')}\nSublime cette recette en français.`;

    return await this.call([
      { role: "system", content: system },
      { role: "user", content: user }
    ]);
  }

  async parseRecipeFromText(text: string): Promise<ParsedRecipeResult> {
    const system = `Tu es un expert culinaire. Parse du texte de recette en JSON structuré.
Réponds en JSON avec: name, category (ENTREE/PLAT/DESSERT/SAUCE/ACCOMPAGNEMENT/BOISSON/SNACK), cuisine, difficulty (EASY/MEDIUM/HARD), prepTime (minutes), cookTime (minutes), servings, servingsText, ingredients (array de {name, amount, unit, optional}), instructions (array de string), winePairings, tips, variations.
Gère les fractions (½, ¼), les unités françaises (c.s., c.c., pincée, gousse).`;

    const res = await this.call([
      { role: "system", content: system },
      { role: "user", content: `Parse cette recette:\n\n${text}` }
    ]);
    if (!res) throw new Error('Impossible de parser la recette');
    return res;
  }

  async parseRecipeFromHtml(rawText: string, url: string): Promise<ParsedRecipeResult> {
    const truncated = rawText.length > 15000 ? rawText.substring(0, 15000) + '...' : rawText;
    const system = `Tu es un expert culinaire. Extrais la recette d'un texte de page web.
Ignore les pubs, menus, commentaires. Réponds en JSON avec: name, category, cuisine, difficulty, prepTime, cookTime, servings, ingredients [{name, amount, unit, optional}], instructions [string], winePairings, tips, variations.`;

    const res = await this.call([
      { role: "system", content: system },
      { role: "user", content: `Extrais la recette de cette page (${url}):\n\n${truncated}` }
    ]);
    if (!res) throw new Error('Impossible de parser la recette depuis cette page');
    return res;
  }

  async matchIngredientsToInventory(
    recipeIngredients: string[],
    inventoryIngredients: Array<{ id: string; name: string; category: string }>
  ): Promise<Array<{ recipeIngredientName: string; matchedIngredientId: string | null; confidence: string }>> {
    if (!inventoryIngredients.length || !recipeIngredients.length) return recipeIngredients.map(name => ({ recipeIngredientName: name, matchedIngredientId: null, confidence: 'LOW' }));

    const system = `Tu es un expert culinaire. Match chaque ingrédient de recette à l'inventaire.
Réponds en JSON: array de {recipeIngredientName, matchedIngredientId (UUID ou null), confidence (HIGH/MEDIUM/LOW)}.
Sois intelligent: "curry en poudre" = "Curry", "huile d'olive" = "Huile d'olive vierge extra". En cas de doute, mets null.`;

    const inventoryList = inventoryIngredients.map(i => `${i.id}|${i.name} (${i.category})`).join('\n');

    const res = await this.call([
      { role: "system", content: system },
      { role: "user", content: `INGRÉDIENTS RECETTE:\n${recipeIngredients.join('\n')}\n\nINVENTAIRE (id|nom):\n${inventoryList}` }
    ]);
    if (!res) return recipeIngredients.map(name => ({ recipeIngredientName: name, matchedIngredientId: null, confidence: 'LOW' }));
    return res.map((r: any) => ({ ...r, matchedIngredientId: r.matchedIngredientId || null }));
  }

  async suggestEnhancements(
    recipe: { name: string; ingredients: string[]; instructions: string[] },
    inventoryIngredients: Array<{ name: string; category: string }>
  ): Promise<RecipeEnhancement> {
    const system = `Tu es un chef gastronome créatif. Mission "Coup de pep's".
Réponds en JSON: { suggestions: [{type: ADDITION/SUBSTITUTION/TECHNIQUE, ingredientFromInventory, description, reason, impact: SUBTLE/NOTICEABLE/TRANSFORMATIVE}], chefComment: string }`;

    const inventoryList = inventoryIngredients.map(i => `${i.name} (${i.category})`).join(', ');

    const res = await this.call([
      { role: "system", content: system },
      { role: "user", content: `Recette: ${recipe.name}\nIngrédients: ${recipe.ingredients.join(', ')}\nIngrédients spéciaux dispo: ${inventoryList}\n\nSuggère des améliorations créatives.` }
    ]);
    if (!res) throw new Error('Impossible de générer les suggestions');
    return res;
  }

  async chat(history: Array<{ role: string; content: string }>, message: string): Promise<string> {
    const messages = [
      { role: "system", content: "Tu es un assistant culinaire expert et passionné. Réponds en français de manière concise, pratique et inspirante." },
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

export const generateCompleteProductSheet = (productName: string, brandOrProducer?: string) =>
  getAiProvider().generateCompleteProductSheet(productName, brandOrProducer);

export const suggestRecipes = (ingredients: string[]) =>
  getAiProvider().suggestRecipesFromIngredients(ingredients);

export const improveRecipe = (recipe: string, availableIngredients: string[]) =>
  getAiProvider().improveRecipe(recipe, availableIngredients);

export const chatWithChef = (history: Array<{ role: string; content: string }>, message: string) =>
  getAiProvider().chat(history, message);

// === RECIPE AI FUNCTIONS (Phase 2) ===

import type { Recipe, RecipeEnhancement } from '../types';

export const parseRecipeFromText = async (text: string): Promise<ParsedRecipeResult> =>
  getAiProvider().parseRecipeFromText(text);

export const parseRecipeFromHtml = async (rawText: string, url: string): Promise<ParsedRecipeResult> =>
  getAiProvider().parseRecipeFromHtml(rawText, url);

export const matchIngredientsToInventory = async (
  recipeIngredients: string[],
  inventoryIngredients: Array<{ id: string; name: string; category: string }>
) => getAiProvider().matchIngredientsToInventory(recipeIngredients, inventoryIngredients);

export const suggestEnhancements = async (
  recipe: { name: string; ingredients: string[]; instructions: string[] },
  inventoryIngredients: Array<{ name: string; category: string }>
): Promise<RecipeEnhancement> => getAiProvider().suggestEnhancements(recipe, inventoryIngredients);
