import type {
  Ingredient,
  StockItem,
  StorageUnit,
  InventoryIngredient,
  StorageLocation,
  TimelineEvent,
  FullBackupData
} from '../types';

const API_URL = '/api';

// === HELPERS ===

const getHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
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

// === INGREDIENTS ===

export const getIngredients = async (): Promise<Ingredient[]> => {
  const response = await fetch(`${API_URL}/ingredients`, { headers: getHeaders() });
  return handleResponse(response) || [];
};

export const getIngredientById = async (id: string): Promise<Ingredient | null> => {
  try {
    const response = await fetch(`${API_URL}/ingredients/${id}`, { headers: getHeaders() });
    return handleResponse(response);
  } catch {
    return null;
  }
};

export const createIngredient = async (ingredient: Omit<Ingredient, 'id' | 'createdAt' | 'updatedAt'>): Promise<Ingredient> => {
  const response = await fetch(`${API_URL}/ingredients`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(ingredient)
  });
  return handleResponse(response);
};

export const updateIngredient = async (id: string, updates: Partial<Ingredient>): Promise<Ingredient> => {
  const response = await fetch(`${API_URL}/ingredients/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(updates)
  });
  return handleResponse(response);
};

export const deleteIngredient = async (id: string): Promise<void> => {
  const response = await fetch(`${API_URL}/ingredients/${id}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  await handleResponse(response);
};

// === STOCK ITEMS ===

export const getStockItems = async (): Promise<StockItem[]> => {
  const response = await fetch(`${API_URL}/stock`, { headers: getHeaders() });
  return handleResponse(response) || [];
};

export const addStockItem = async (item: Omit<StockItem, 'id'>): Promise<StockItem> => {
  const response = await fetch(`${API_URL}/stock`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(item)
  });
  return handleResponse(response);
};

export const updateStockItem = async (id: string, updates: Partial<StockItem>): Promise<StockItem> => {
  const response = await fetch(`${API_URL}/stock/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(updates)
  });
  return handleResponse(response);
};

export const deleteStockItem = async (id: string): Promise<void> => {
  const response = await fetch(`${API_URL}/stock/${id}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  await handleResponse(response);
};

// Add multiple stock items at once
export const addStockItems = async (
  ingredientId: string,
  count: number,
  location: string | StorageLocation = 'Non rangé'
): Promise<void> => {
  const promises = [];
  for (let i = 0; i < count; i++) {
    const item: Omit<StockItem, 'id'> = {
      ingredientId,
      location,
      addedByUserId: 'current-user',
      purchaseDate: new Date().toISOString(),
      isFinished: false,
    };
    promises.push(addStockItem(item));
  }
  await Promise.all(promises);
};

// === STORAGE UNITS ===

export const getStorageUnits = async (): Promise<StorageUnit[]> => {
  const response = await fetch(`${API_URL}/storage`, { headers: getHeaders() });
  return handleResponse(response) || [];
};

export const createStorageUnit = async (unit: Omit<StorageUnit, 'id'>): Promise<StorageUnit> => {
  const response = await fetch(`${API_URL}/storage`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(unit)
  });
  return handleResponse(response);
};

export const updateStorageUnit = async (id: string, updates: Partial<StorageUnit>): Promise<StorageUnit> => {
  const response = await fetch(`${API_URL}/storage/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(updates)
  });
  return handleResponse(response);
};

export const deleteStorageUnit = async (id: string): Promise<void> => {
  const response = await fetch(`${API_URL}/storage/${id}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  await handleResponse(response);
};

// === INVENTORY (AGGREGATED) ===

export const getInventory = async (): Promise<InventoryIngredient[]> => {
  const [ingredients, stockItems] = await Promise.all([
    getIngredients(),
    getStockItems()
  ]);

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  return ingredients.map(ingredient => {
    const items = stockItems.filter(s => s.ingredientId === ingredient.id && !s.isFinished);

    // Find nearest expiry
    const expiryDates = items
      .filter(i => i.expiryDate)
      .map(i => new Date(i.expiryDate!))
      .sort((a, b) => a.getTime() - b.getTime());

    const nearestExpiry = expiryDates[0]?.toISOString();
    const hasExpiringSoon = expiryDates.some(d => d <= thirtyDaysFromNow);

    return {
      ...ingredient,
      stockCount: items.length,
      items,
      nearestExpiry,
      hasExpiringSoon
    };
  });
};

// === HISTORY ===

export const getHistory = async (): Promise<TimelineEvent[]> => {
  const response = await fetch(`${API_URL}/history`, { headers: getHeaders() });
  return handleResponse(response) || [];
};

export const addHistoryEvent = async (event: Omit<TimelineEvent, 'id'>): Promise<TimelineEvent> => {
  const response = await fetch(`${API_URL}/history`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(event)
  });
  return handleResponse(response);
};

// === BACKUP ===

export const exportFullData = async (): Promise<string> => {
  const [ingredients, stockItems, storageUnits, history] = await Promise.all([
    getIngredients(),
    getStockItems(),
    getStorageUnits(),
    getHistory()
  ]);

  const data: FullBackupData = {
    ingredients,
    stockItems,
    storageUnits,
    recipes: [], // Phase 2
    shoppingList: [],
    history,
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  };

  return JSON.stringify(data, null, 2);
};

export const importFullData = async (jsonString: string): Promise<boolean> => {
  try {
    const data = JSON.parse(jsonString) as FullBackupData;

    const response = await fetch(`${API_URL}/import`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });

    return response.ok;
  } catch (e) {
    console.error("Import failed", e);
    return false;
  }
};

// === CONVENIENCE FUNCTIONS ===

// Save ingredient with optional stock quantity
export const saveIngredient = async (
  ingredient: Omit<Ingredient, 'id' | 'createdAt' | 'updatedAt'>,
  quantity: number = 1,
  location?: string | StorageLocation
): Promise<string> => {
  const created = await createIngredient(ingredient);

  if (quantity > 0) {
    await addStockItems(created.id, quantity, location || 'Non rangé');
  }

  return created.id;
};

// Mark item as finished (consumed)
export const consumeStockItem = async (itemId: string): Promise<void> => {
  await updateStockItem(itemId, {
    isFinished: true,
    finishedDate: new Date().toISOString()
  });
};

// Move item to new location
export const moveStockItem = async (
  itemId: string,
  newLocation: string | StorageLocation
): Promise<void> => {
  await updateStockItem(itemId, { location: newLocation });
};
