import type { Recipe, RecipeWithIngredients, ShoppingListItem, RecipeImportResult } from '../types';

const API_URL = '/api';

const getHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

const getAuthHeader = () => {
  const token = localStorage.getItem('auth_token');
  return { 'Authorization': token ? `Bearer ${token}` : '' };
};

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    // Token expiré ou invalide → déconnecter et rediriger vers login
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error('Session expirée, reconnexion nécessaire');
    }
    const errorText = await response.text();
    throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
  }
  if (response.status === 204) return null;
  return response.json();
};

// === RECIPES ===

export const getRecipes = async (params?: { category?: string; search?: string; favorite?: boolean }): Promise<Recipe[]> => {
  const query = new URLSearchParams();
  if (params?.category) query.set('category', params.category);
  if (params?.search) query.set('search', params.search);
  if (params?.favorite) query.set('favorite', 'true');
  const qs = query.toString();
  const response = await fetch(`${API_URL}/recipes${qs ? `?${qs}` : ''}`, { headers: getHeaders() });
  return (await handleResponse(response)) || [];
};

export const getRecipeById = async (id: string): Promise<RecipeWithIngredients | null> => {
  try {
    const response = await fetch(`${API_URL}/recipes/${id}`, { headers: getHeaders() });
    return handleResponse(response);
  } catch {
    return null;
  }
};

export const createRecipe = async (recipe: {
  name: string;
  category?: string;
  cuisine?: string;
  ingredients?: Array<{ ingredientId?: string; name: string; amount?: number; unit?: string; optional?: boolean }>;
  instructions?: string[];
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  servingsText?: string;
  difficulty?: string;
  winePairings?: string[];
  tips?: string[];
  variations?: string[];
  source?: string;
  sourceUrl?: string;
  isFavorite?: boolean;
  imageUrl?: string;
}): Promise<Recipe> => {
  const response = await fetch(`${API_URL}/recipes`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(recipe)
  });
  return handleResponse(response);
};

export const updateRecipe = async (id: string, updates: Partial<Recipe> & { ingredients?: Array<{ ingredientId?: string; name: string; amount?: number; unit?: string; optional?: boolean }> }): Promise<Recipe> => {
  const response = await fetch(`${API_URL}/recipes/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(updates)
  });
  return handleResponse(response);
};

export const deleteRecipe = async (id: string): Promise<void> => {
  const response = await fetch(`${API_URL}/recipes/${id}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  await handleResponse(response);
};

// === IMPORT ===

export const importRecipeFromUrl = async (url: string): Promise<RecipeImportResult & { rawText?: string }> => {
  const response = await fetch(`${API_URL}/recipes/import-url`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ url })
  });
  return handleResponse(response);
};

export const importPaprikaFile = async (file: File): Promise<RecipeImportResult[]> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_URL}/recipes/import-paprika`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: formData
  });
  return handleResponse(response);
};

// === INGREDIENT LINKING ===

export const linkRecipeIngredient = async (
  recipeId: string,
  ingredientLineId: string,
  inventoryIngredientId: string | null
): Promise<void> => {
  const response = await fetch(`${API_URL}/recipes/${recipeId}/ingredients/${ingredientLineId}/link`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ ingredientId: inventoryIngredientId })
  });
  await handleResponse(response);
};

// === SHOPPING LIST ===

export const getShoppingList = async (): Promise<ShoppingListItem[]> => {
  const response = await fetch(`${API_URL}/shopping-list`, { headers: getHeaders() });
  return (await handleResponse(response)) || [];
};

export const addToShoppingList = async (
  items: Array<{ name: string; quantity?: number; unit?: string; linkedRecipeId?: string }>
): Promise<ShoppingListItem[]> => {
  const response = await fetch(`${API_URL}/shopping-list`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ items })
  });
  return handleResponse(response);
};

export const updateShoppingListItem = async (id: string, updates: Partial<ShoppingListItem>): Promise<ShoppingListItem> => {
  const response = await fetch(`${API_URL}/shopping-list/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(updates)
  });
  return handleResponse(response);
};

export const deleteShoppingListItem = async (id: string): Promise<void> => {
  const response = await fetch(`${API_URL}/shopping-list/${id}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  await handleResponse(response);
};

export const clearShoppingList = async (recipeId?: string): Promise<void> => {
  const qs = recipeId ? `?recipeId=${recipeId}` : '';
  const response = await fetch(`${API_URL}/shopping-list${qs}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  await handleResponse(response);
};
