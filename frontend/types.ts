// types.ts - KitchenFlow Type Definitions

// === ENUMS & CATEGORIES ===

export type IngredientCategory =
  | 'SPICE'        // Épices (cumin, paprika, curry...)
  | 'OIL'          // Huiles (olive, sésame, tournesol...)
  | 'SAUCE'        // Sauces (soja, worcestershire, tabasco...)
  | 'VINEGAR'      // Vinaigres (balsamique, cidre, riz...)
  | 'CONDIMENT'    // Condiments (moutarde, mayo, ketchup...)
  | 'HERB'         // Herbes (basilic, thym, romarin...)
  | 'GRAIN'        // Céréales/Féculents (riz, pâtes, quinoa...)
  | 'FLOUR'        // Farines (blé, sarrasin, maïs...)
  | 'SUGAR'        // Sucres/Édulcorants (sucre, miel, sirop...)
  | 'DAIRY'        // Produits laitiers (beurre, crème...)
  | 'PROTEIN'      // Protéines (légumineuses, tofu...)
  | 'CANNED'       // Conserves (tomates, haricots...)
  | 'FROZEN'       // Surgelés
  | 'BAKING'       // Pâtisserie (levure, cacao...)
  | 'OTHER';

export type StorageType =
  | 'PANTRY'       // Placard
  | 'DRAWER'       // Tiroir
  | 'FRIDGE'       // Réfrigérateur
  | 'FREEZER'      // Congélateur
  | 'COUNTER'      // Plan de travail
  | 'SPICE_RACK';  // Étagère à épices

export type RecipeCategory =
  | 'ENTREE'       // Entrée
  | 'PLAT'         // Plat principal
  | 'DESSERT'      // Dessert
  | 'SAUCE'        // Sauce
  | 'ACCOMPAGNEMENT' // Accompagnement
  | 'BOISSON'      // Boisson
  | 'SNACK';       // En-cas

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export type AIProvider = 'GEMINI' | 'OPENAI' | 'MISTRAL';

// === MAIN ENTITIES ===

export interface Ingredient {
  id: string;
  name: string;
  brand?: string;
  origin?: string;
  producer?: string;
  category: IngredientCategory;
  format: string;              // "100g", "500ml", "1L", "1 bouteille"

  // Profil sensoriel
  flavorProfile?: string;
  aromaProfile: string[];
  heatLevel?: number;          // 0-10 pour épices piquantes

  // Informations enrichies par IA
  description?: string;
  producerHistory?: string;
  suggestedUses: string[];
  pairings: string[];
  substitutes: string[];

  // Conservation
  shelfLife?: string;          // "6 mois", "1 an"
  storageInstructions?: string;

  // Métadonnées
  enrichedByAI: boolean;
  aiConfidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockItem {
  id: string;
  ingredientId: string;
  location: StorageLocation | string;
  addedByUserId: string;
  purchaseDate?: string;
  expiryDate?: string;
  openedDate?: string;
  isFinished: boolean;
  finishedDate?: string;
  quantity?: number;           // Pourcentage restant estimé (0-100)
  notes?: string;
}

export interface StorageLocation {
  unitId: string;
  x: number;
  y: number;
}

export interface StorageUnit {
  id: string;
  name: string;
  type: StorageType;
  width: number;
  height: number;
  temperature?: number;
  humidity?: number;
  icon?: string;
}

// === INVENTORY AGGREGATION ===

export interface InventoryIngredient extends Ingredient {
  stockCount: number;
  items: StockItem[];
  nearestExpiry?: string;
  hasExpiringSoon: boolean;    // < 30 jours
}

// === RECIPES (Phase 2) ===

export interface Recipe {
  id: string;
  name: string;
  category: RecipeCategory;
  cuisine?: string;
  ingredients: RecipeIngredient[];
  instructions: string[];
  prepTime: number;            // minutes
  cookTime: number;            // minutes
  servings: number;
  difficulty: Difficulty;

  // Suggestions IA
  winePairings?: string[];
  tips?: string[];
  variations?: string[];

  source: 'MANUAL' | 'AI' | 'IMPORTED';
  sourceUrl?: string;
  isFavorite: boolean;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeIngredient {
  ingredientId?: string;
  name: string;
  amount: number;
  unit: string;
  optional: boolean;
  inStock?: boolean;
  stockQuantity?: number;
}

// === AI CONFIGURATION ===

export interface AIConfig {
  provider: AIProvider;
  keys: {
    gemini: string;
    openai: string;
    mistral: string;
  };
}

// === TIMELINE & HISTORY ===

export interface TimelineEvent {
  id: string;
  date: string;
  type: 'IN' | 'OUT' | 'OPEN' | 'MOVE' | 'EXPIRE' | 'NOTE';
  description: string;
  ingredientId?: string;
  ingredientName?: string;
  userId: string;
}

// === SHOPPING LIST ===

export interface ShoppingListItem {
  id: string;
  name: string;
  category: IngredientCategory | 'OTHER';
  quantity: number;
  unit?: string;
  isChecked: boolean;
  linkedRecipeId?: string;
  notes?: string;
}

// === CHEF ASSISTANT (AI) ===

export interface ChefSuggestion {
  type: 'RECIPE' | 'IMPROVEMENT' | 'SUBSTITUTION' | 'PAIRING';
  title: string;
  description: string;
  ingredients?: string[];
  instructions?: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface RecipeImprovement {
  originalRecipe: string;
  improvements: {
    ingredient: string;
    suggestion: string;
    reason: string;
    available: boolean;
  }[];
  enhancedInstructions?: string[];
  tips?: string[];
}

// === BACKUP ===

export interface FullBackupData {
  ingredients: Ingredient[];
  stockItems: StockItem[];
  storageUnits: StorageUnit[];
  recipes: Recipe[];
  shoppingList: ShoppingListItem[];
  history: TimelineEvent[];
  timestamp: string;
  version: string;
}

// === USER ===

export interface User {
  id: string;
  email: string;
  createdAt?: string;
}

export interface AuthUser extends User {
  access_token: string;
  refresh_token: string;
}
