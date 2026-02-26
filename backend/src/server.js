import express from 'express';
import cors from 'cors';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 3111;
const JWT_SECRET = process.env.JWT_SECRET || 'kitchenflow-dev-secret-change-in-prod';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token invalide' });
    }
    req.user = user;
    next();
  });
};

// ==================== AUTH ROUTES ====================

// Signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    // Check if user exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, created_at) VALUES ($1, $2, NOW()) RETURNING id, email, created_at',
      [email, hashedPassword]
    );

    const user = result.rows[0];

    // Generate tokens
    const access_token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    const refresh_token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({
      user: { id: user.id, email: user.email },
      access_token,
      refresh_token
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    // Find user
    const result = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Generate tokens
    const access_token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    const refresh_token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      user: { id: user.id, email: user.email },
      access_token,
      refresh_token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Logout
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  // JWT is stateless, just return success
  res.status(200).json({ message: 'Déconnexion réussie' });
});

// ==================== INGREDIENTS ROUTES ====================

// Get all ingredients
app.get('/api/ingredients', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM ingredients WHERE user_id = $1 ORDER BY name',
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get ingredients error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Get single ingredient
app.get('/api/ingredients/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM ingredients WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ingrédient non trouvé' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get ingredient error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Create ingredient
app.post('/api/ingredients', authenticateToken, async (req, res) => {
  try {
    const {
      name, brand, origin, producer, category, format,
      flavorProfile, aromaProfile, heatLevel, description,
      producerHistory, suggestedUses, pairings, substitutes,
      shelfLife, storageInstructions, enrichedByAI, aiConfidence, isFavorite
    } = req.body;

    const result = await pool.query(
      `INSERT INTO ingredients (
        user_id, name, brand, origin, producer, category, format,
        flavor_profile, aroma_profile, heat_level, description,
        producer_history, suggested_uses, pairings, substitutes,
        shelf_life, storage_instructions, enriched_by_ai, ai_confidence, is_favorite,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW())
      RETURNING *`,
      [
        req.user.userId, name, brand, origin, producer, category, format,
        flavorProfile, JSON.stringify(aromaProfile || []), heatLevel, description,
        producerHistory, JSON.stringify(suggestedUses || []), JSON.stringify(pairings || []), JSON.stringify(substitutes || []),
        shelfLife, storageInstructions, enrichedByAI || false, aiConfidence, isFavorite || false
      ]
    );

    res.status(201).json(formatIngredient(result.rows[0]));
  } catch (error) {
    console.error('Create ingredient error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Update ingredient
app.put('/api/ingredients/:id', authenticateToken, async (req, res) => {
  try {
    const {
      name, brand, origin, producer, category, format,
      flavorProfile, aromaProfile, heatLevel, description,
      producerHistory, suggestedUses, pairings, substitutes,
      shelfLife, storageInstructions, enrichedByAI, aiConfidence, isFavorite
    } = req.body;

    const result = await pool.query(
      `UPDATE ingredients SET
        name = COALESCE($1, name),
        brand = COALESCE($2, brand),
        origin = COALESCE($3, origin),
        producer = COALESCE($4, producer),
        category = COALESCE($5, category),
        format = COALESCE($6, format),
        flavor_profile = COALESCE($7, flavor_profile),
        aroma_profile = COALESCE($8, aroma_profile),
        heat_level = COALESCE($9, heat_level),
        description = COALESCE($10, description),
        producer_history = COALESCE($11, producer_history),
        suggested_uses = COALESCE($12, suggested_uses),
        pairings = COALESCE($13, pairings),
        substitutes = COALESCE($14, substitutes),
        shelf_life = COALESCE($15, shelf_life),
        storage_instructions = COALESCE($16, storage_instructions),
        enriched_by_ai = COALESCE($17, enriched_by_ai),
        ai_confidence = COALESCE($18, ai_confidence),
        is_favorite = COALESCE($19, is_favorite),
        updated_at = NOW()
      WHERE id = $20 AND user_id = $21
      RETURNING *`,
      [
        name, brand, origin, producer, category, format,
        flavorProfile, aromaProfile ? JSON.stringify(aromaProfile) : null, heatLevel, description,
        producerHistory, suggestedUses ? JSON.stringify(suggestedUses) : null,
        pairings ? JSON.stringify(pairings) : null, substitutes ? JSON.stringify(substitutes) : null,
        shelfLife, storageInstructions, enrichedByAI, aiConfidence, isFavorite,
        req.params.id, req.user.userId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ingrédient non trouvé' });
    }

    res.json(formatIngredient(result.rows[0]));
  } catch (error) {
    console.error('Update ingredient error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Delete ingredient
app.delete('/api/ingredients/:id', authenticateToken, async (req, res) => {
  try {
    // Also delete related stock items
    await pool.query('DELETE FROM stock_items WHERE ingredient_id = $1', [req.params.id]);

    const result = await pool.query(
      'DELETE FROM ingredients WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ingrédient non trouvé' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Delete ingredient error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== STOCK ROUTES ====================

// Get all stock items
app.get('/api/stock', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.* FROM stock_items s
       JOIN ingredients i ON s.ingredient_id = i.id
       WHERE i.user_id = $1
       ORDER BY s.created_at DESC`,
      [req.user.userId]
    );
    res.json(result.rows.map(formatStockItem));
  } catch (error) {
    console.error('Get stock error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Create stock item
app.post('/api/stock', authenticateToken, async (req, res) => {
  try {
    const { ingredientId, location, purchaseDate, expiryDate, openedDate, quantity, notes } = req.body;

    const result = await pool.query(
      `INSERT INTO stock_items (
        ingredient_id, location, added_by_user_id, purchase_date, expiry_date,
        opened_date, is_finished, quantity, notes, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, false, $7, $8, NOW())
      RETURNING *`,
      [ingredientId, JSON.stringify(location), req.user.userId, purchaseDate, expiryDate, openedDate, quantity, notes]
    );

    res.status(201).json(formatStockItem(result.rows[0]));
  } catch (error) {
    console.error('Create stock error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Update stock item
app.put('/api/stock/:id', authenticateToken, async (req, res) => {
  try {
    const { location, expiryDate, openedDate, isFinished, finishedDate, quantity, notes } = req.body;

    const result = await pool.query(
      `UPDATE stock_items SET
        location = COALESCE($1, location),
        expiry_date = COALESCE($2, expiry_date),
        opened_date = COALESCE($3, opened_date),
        is_finished = COALESCE($4, is_finished),
        finished_date = COALESCE($5, finished_date),
        quantity = COALESCE($6, quantity),
        notes = COALESCE($7, notes)
      WHERE id = $8
      RETURNING *`,
      [location ? JSON.stringify(location) : null, expiryDate, openedDate, isFinished, finishedDate, quantity, notes, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stock non trouvé' });
    }

    res.json(formatStockItem(result.rows[0]));
  } catch (error) {
    console.error('Update stock error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Delete stock item
app.delete('/api/stock/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM stock_items WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stock non trouvé' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Delete stock error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== STORAGE UNITS ROUTES ====================

// Get all storage units
app.get('/api/storage', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM storage_units WHERE user_id = $1 ORDER BY name',
      [req.user.userId]
    );
    res.json(result.rows.map(formatStorageUnit));
  } catch (error) {
    console.error('Get storage error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Create storage unit
app.post('/api/storage', authenticateToken, async (req, res) => {
  try {
    const { name, type, width, height, temperature, humidity, icon } = req.body;

    const result = await pool.query(
      `INSERT INTO storage_units (user_id, name, type, width, height, temperature, humidity, icon, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [req.user.userId, name, type, width || 1, height || 1, temperature, humidity, icon]
    );

    res.status(201).json(formatStorageUnit(result.rows[0]));
  } catch (error) {
    console.error('Create storage error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Update storage unit
app.put('/api/storage/:id', authenticateToken, async (req, res) => {
  try {
    const { name, type, width, height, temperature, humidity, icon } = req.body;

    const result = await pool.query(
      `UPDATE storage_units SET
        name = COALESCE($1, name),
        type = COALESCE($2, type),
        width = COALESCE($3, width),
        height = COALESCE($4, height),
        temperature = COALESCE($5, temperature),
        humidity = COALESCE($6, humidity),
        icon = COALESCE($7, icon)
      WHERE id = $8 AND user_id = $9
      RETURNING *`,
      [name, type, width, height, temperature, humidity, icon, req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rangement non trouvé' });
    }

    res.json(formatStorageUnit(result.rows[0]));
  } catch (error) {
    console.error('Update storage error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Delete storage unit
app.delete('/api/storage/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM storage_units WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rangement non trouvé' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Delete storage error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== HISTORY ROUTES ====================

// Get history
app.get('/api/history', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM history_events WHERE user_id = $1 ORDER BY date DESC LIMIT 100',
      [req.user.userId]
    );
    res.json(result.rows.map(formatHistoryEvent));
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Add history event
app.post('/api/history', authenticateToken, async (req, res) => {
  try {
    const { date, type, description, ingredientId, ingredientName } = req.body;

    const result = await pool.query(
      `INSERT INTO history_events (user_id, date, type, description, ingredient_id, ingredient_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.userId, date || new Date().toISOString(), type, description, ingredientId, ingredientName]
    );

    res.status(201).json(formatHistoryEvent(result.rows[0]));
  } catch (error) {
    console.error('Add history error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== RECIPES ROUTES ====================

// Get all recipes
app.get('/api/recipes', authenticateToken, async (req, res) => {
  try {
    const { category, search, favorite } = req.query;
    let query = 'SELECT * FROM recipes WHERE user_id = $1';
    const params = [req.user.userId];
    let paramIndex = 2;

    if (category) {
      query += ` AND category = $${paramIndex++}`;
      params.push(category);
    }
    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR cuisine ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (favorite === 'true') {
      query += ' AND is_favorite = true';
    }

    query += ' ORDER BY updated_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows.map(formatRecipe));
  } catch (error) {
    console.error('Get recipes error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Get single recipe with ingredients and stock status
app.get('/api/recipes/:id', authenticateToken, async (req, res) => {
  try {
    const recipeResult = await pool.query(
      'SELECT * FROM recipes WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );

    if (recipeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Recette non trouvée' });
    }

    const recipe = formatRecipe(recipeResult.rows[0]);

    // Get recipe ingredients with stock info
    const ingredientsResult = await pool.query(
      `SELECT ri.*, i.name as inv_name, i.category as inv_category,
        (SELECT COUNT(*) FROM stock_items s WHERE s.ingredient_id = ri.ingredient_id AND s.is_finished = false) as stock_count
       FROM recipe_ingredients ri
       LEFT JOIN ingredients i ON i.id = ri.ingredient_id
       WHERE ri.recipe_id = $1
       ORDER BY ri.sort_order`,
      [req.params.id]
    );

    let matchedCount = 0;
    let unmatchedCount = 0;
    const ingredients = ingredientsResult.rows.map(row => {
      const hasMatch = !!row.ingredient_id;
      if (hasMatch) matchedCount++;
      else unmatchedCount++;

      return {
        id: row.id,
        ingredientId: row.ingredient_id,
        name: row.name,
        amount: row.amount ? parseFloat(row.amount) : null,
        unit: row.unit,
        optional: row.is_optional,
        sortOrder: row.sort_order,
        inStock: hasMatch && parseInt(row.stock_count) > 0,
        stockQuantity: parseInt(row.stock_count) || 0,
        inventoryName: row.inv_name,
        inventoryCategory: row.inv_category,
      };
    });

    res.json({ ...recipe, ingredients, matchedCount, unmatchedCount });
  } catch (error) {
    console.error('Get recipe error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Create recipe with ingredients (transaction)
app.post('/api/recipes', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      name, category, cuisine, instructions, prepTime, cookTime,
      servings, servingsText, difficulty, winePairings, tips, variations,
      source, sourceUrl, isFavorite, imageUrl, ingredients
    } = req.body;

    const recipeResult = await client.query(
      `INSERT INTO recipes (
        user_id, name, category, cuisine, instructions, prep_time, cook_time,
        servings, servings_text, difficulty, wine_pairings, tips, variations,
        source, source_url, is_favorite, image_url, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
      RETURNING *`,
      [
        req.user.userId, name, category || 'PLAT', cuisine,
        JSON.stringify(instructions || []), prepTime || 0, cookTime || 0,
        servings || 4, servingsText, difficulty || 'MEDIUM',
        JSON.stringify(winePairings || []), JSON.stringify(tips || []), JSON.stringify(variations || []),
        source || 'MANUAL', sourceUrl, isFavorite || false, imageUrl
      ]
    );

    const recipeId = recipeResult.rows[0].id;

    // Insert recipe ingredients
    if (ingredients && ingredients.length > 0) {
      for (let i = 0; i < ingredients.length; i++) {
        const ing = ingredients[i];
        await client.query(
          `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, name, amount, unit, is_optional, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [recipeId, ing.ingredientId || null, ing.name, ing.amount || null, ing.unit || null, ing.optional || false, i]
        );
      }
    }

    await client.query('COMMIT');

    const recipe = formatRecipe(recipeResult.rows[0]);
    recipe.ingredients = (ingredients || []).map((ing, i) => ({
      name: ing.name,
      amount: ing.amount || null,
      unit: ing.unit || null,
      optional: ing.optional || false,
      ingredientId: ing.ingredientId || null,
    }));

    res.status(201).json(recipe);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create recipe error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  } finally {
    client.release();
  }
});

// Update recipe (replace ingredients)
app.put('/api/recipes/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      name, category, cuisine, instructions, prepTime, cookTime,
      servings, servingsText, difficulty, winePairings, tips, variations,
      source, sourceUrl, isFavorite, imageUrl, ingredients
    } = req.body;

    const result = await client.query(
      `UPDATE recipes SET
        name = COALESCE($1, name),
        category = COALESCE($2, category),
        cuisine = COALESCE($3, cuisine),
        instructions = COALESCE($4, instructions),
        prep_time = COALESCE($5, prep_time),
        cook_time = COALESCE($6, cook_time),
        servings = COALESCE($7, servings),
        servings_text = COALESCE($8, servings_text),
        difficulty = COALESCE($9, difficulty),
        wine_pairings = COALESCE($10, wine_pairings),
        tips = COALESCE($11, tips),
        variations = COALESCE($12, variations),
        source = COALESCE($13, source),
        source_url = COALESCE($14, source_url),
        is_favorite = COALESCE($15, is_favorite),
        image_url = COALESCE($16, image_url),
        updated_at = NOW()
      WHERE id = $17 AND user_id = $18
      RETURNING *`,
      [
        name, category, cuisine,
        instructions ? JSON.stringify(instructions) : null,
        prepTime, cookTime, servings, servingsText, difficulty,
        winePairings ? JSON.stringify(winePairings) : null,
        tips ? JSON.stringify(tips) : null,
        variations ? JSON.stringify(variations) : null,
        source, sourceUrl, isFavorite, imageUrl,
        req.params.id, req.user.userId
      ]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Recette non trouvée' });
    }

    // Replace ingredients if provided
    if (ingredients) {
      await client.query('DELETE FROM recipe_ingredients WHERE recipe_id = $1', [req.params.id]);
      for (let i = 0; i < ingredients.length; i++) {
        const ing = ingredients[i];
        await client.query(
          `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, name, amount, unit, is_optional, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [req.params.id, ing.ingredientId || null, ing.name, ing.amount || null, ing.unit || null, ing.optional || false, i]
        );
      }
    }

    await client.query('COMMIT');
    res.json(formatRecipe(result.rows[0]));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update recipe error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  } finally {
    client.release();
  }
});

// Delete recipe
app.delete('/api/recipes/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM recipes WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Recette non trouvée' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Delete recipe error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Link/unlink recipe ingredient to inventory
app.put('/api/recipes/:id/ingredients/:lineId/link', authenticateToken, async (req, res) => {
  try {
    const { ingredientId } = req.body;

    // Verify recipe belongs to user
    const recipeCheck = await pool.query(
      'SELECT id FROM recipes WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );
    if (recipeCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Recette non trouvée' });
    }

    const result = await pool.query(
      'UPDATE recipe_ingredients SET ingredient_id = $1 WHERE id = $2 AND recipe_id = $3 RETURNING *',
      [ingredientId || null, req.params.lineId, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ingrédient de recette non trouvé' });
    }

    res.json(formatRecipeIngredient(result.rows[0]));
  } catch (error) {
    console.error('Link ingredient error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== IMPORT ROUTES ====================

// Import recipe from URL (fetch + parse JSON-LD)
app.post('/api/recipes/import-url', authenticateToken, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL requise' });
    }

    // Fetch the page
    const response = await fetch(url, {
      headers: { 'User-Agent': 'KitchenFlow/1.0 RecipeImporter' }
    });
    if (!response.ok) {
      return res.status(400).json({ error: `Impossible de charger l'URL (${response.status})` });
    }

    const html = await response.text();

    // Try to find JSON-LD with Recipe schema
    const jsonLdMatch = html.match(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    let recipeData = null;

    if (jsonLdMatch) {
      for (const match of jsonLdMatch) {
        try {
          const jsonContent = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
          const parsed = JSON.parse(jsonContent);

          // Handle both single object and @graph array
          const candidates = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);
          for (const candidate of candidates) {
            if (candidate['@type'] === 'Recipe' || (Array.isArray(candidate['@type']) && candidate['@type'].includes('Recipe'))) {
              recipeData = candidate;
              break;
            }
          }
          if (recipeData) break;
        } catch { /* continue to next script tag */ }
      }
    }

    if (recipeData) {
      // Parse JSON-LD recipe into our format
      const parseTime = (iso) => {
        if (!iso) return 0;
        const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
        if (match) return (parseInt(match[1] || 0) * 60) + parseInt(match[2] || 0);
        const minMatch = iso.match(/(\d+)/);
        return minMatch ? parseInt(minMatch[1]) : 0;
      };

      const parseServings = (val) => {
        if (!val) return { servings: 4, servingsText: null };
        const str = Array.isArray(val) ? val[0] : String(val);
        const num = parseInt(str);
        return { servings: isNaN(num) ? 4 : num, servingsText: str };
      };

      const servingsInfo = parseServings(recipeData.recipeYield);

      // Parse instructions
      let instructions = [];
      const rawInstructions = recipeData.recipeInstructions;
      if (Array.isArray(rawInstructions)) {
        instructions = rawInstructions.map(step => {
          if (typeof step === 'string') return step;
          if (step.text) return step.text;
          if (step.itemListElement) return step.itemListElement.map(s => s.text || s).join(' ');
          return String(step);
        });
      } else if (typeof rawInstructions === 'string') {
        instructions = rawInstructions.split('\n').filter(s => s.trim());
      }

      // Parse ingredients (freeform text lines)
      const ingredientLines = (recipeData.recipeIngredient || []).map(line => {
        const parsed = parseIngredientLine(typeof line === 'string' ? line : String(line));
        return parsed;
      });

      res.json({
        recipe: {
          name: recipeData.name || '',
          category: 'PLAT',
          cuisine: recipeData.recipeCuisine || null,
          instructions,
          prepTime: parseTime(recipeData.prepTime),
          cookTime: parseTime(recipeData.cookTime),
          servings: servingsInfo.servings,
          servingsText: servingsInfo.servingsText,
          difficulty: 'MEDIUM',
          source: 'IMPORTED',
          sourceUrl: url,
          imageUrl: recipeData.image ? (Array.isArray(recipeData.image) ? recipeData.image[0] : (typeof recipeData.image === 'string' ? recipeData.image : recipeData.image.url)) : null,
        },
        ingredients: ingredientLines,
        confidence: 'HIGH',
        parseMethod: 'JSON_LD',
      });
    } else {
      // No JSON-LD found, return raw text for AI parsing on frontend
      // Strip HTML tags for cleaner text
      const textContent = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 10000); // Limit text sent to frontend

      res.json({
        recipe: { sourceUrl: url, source: 'IMPORTED' },
        ingredients: [],
        confidence: 'LOW',
        parseMethod: 'NEEDS_AI',
        rawText: textContent,
      });
    }
  } catch (error) {
    console.error('Import URL error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'import' });
  }
});

// Import from Paprika (.paprikarecipes file)
app.post('/api/recipes/import-paprika', authenticateToken, async (req, res) => {
  try {
    // Handle multipart upload inline (without multer for now, using raw buffer)
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Find the file content in multipart data
    const { default: AdmZip } = await import('adm-zip');
    const { gunzipSync } = await import('zlib');

    // Try to extract the zip data from multipart boundary
    let zipBuffer = buffer;

    // If it's multipart, extract the file part
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart')) {
      const boundary = contentType.split('boundary=')[1];
      if (boundary) {
        const boundaryBuffer = Buffer.from(`--${boundary}`);
        const parts = [];
        let start = 0;

        // Simple multipart parser
        while (true) {
          const idx = buffer.indexOf(boundaryBuffer, start);
          if (idx === -1) break;
          if (start > 0) {
            parts.push(buffer.slice(start, idx));
          }
          start = idx + boundaryBuffer.length;
        }

        // Find the file part (skip headers, get content)
        for (const part of parts) {
          const headerEnd = part.indexOf('\r\n\r\n');
          if (headerEnd !== -1) {
            const headers = part.slice(0, headerEnd).toString();
            if (headers.includes('filename=')) {
              zipBuffer = part.slice(headerEnd + 4, part.length - 2); // trim trailing \r\n
              break;
            }
          }
        }
      }
    }

    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();
    const recipes = [];

    for (const entry of entries) {
      if (entry.entryName.endsWith('.paprikarecipe')) {
        try {
          const gzipped = entry.getData();
          const jsonStr = gunzipSync(gzipped).toString('utf-8');
          const paprika = JSON.parse(jsonStr);

          // Parse ingredient lines
          const ingredientLines = (paprika.ingredients || '').split('\n')
            .filter(line => line.trim())
            .map(line => parseIngredientLine(line.trim()));

          // Parse instructions
          const instructions = (paprika.directions || '').split('\n')
            .filter(line => line.trim());

          // Parse times
          const parseTimeStr = (str) => {
            if (!str) return 0;
            const match = str.match(/(\d+)/);
            return match ? parseInt(match[1]) : 0;
          };

          // Parse servings
          const servingsStr = paprika.servings || '';
          const servingsMatch = servingsStr.match(/(\d+)/);
          const servings = servingsMatch ? parseInt(servingsMatch[1]) : 4;

          // Map category
          const paprikaCategory = (paprika.categories || [])[0] || '';
          const categoryMap = {
            'entrée': 'ENTREE', 'entree': 'ENTREE', 'starter': 'ENTREE', 'appetizer': 'ENTREE',
            'plat': 'PLAT', 'main': 'PLAT', 'dinner': 'PLAT', 'lunch': 'PLAT',
            'dessert': 'DESSERT', 'desserts': 'DESSERT',
            'sauce': 'SAUCE', 'sauces': 'SAUCE',
            'accompagnement': 'ACCOMPAGNEMENT', 'side': 'ACCOMPAGNEMENT',
            'boisson': 'BOISSON', 'drink': 'BOISSON', 'beverage': 'BOISSON',
            'snack': 'SNACK', 'en-cas': 'SNACK',
          };
          const category = categoryMap[paprikaCategory.toLowerCase()] || 'PLAT';

          recipes.push({
            recipe: {
              name: paprika.name || 'Sans nom',
              category,
              cuisine: null,
              instructions,
              prepTime: parseTimeStr(paprika.prep_time),
              cookTime: parseTimeStr(paprika.cook_time),
              servings,
              servingsText: servingsStr || null,
              difficulty: paprika.difficulty || 'MEDIUM',
              tips: paprika.notes ? [paprika.notes] : [],
              source: 'IMPORTED',
              sourceUrl: paprika.source_url || null,
              isFavorite: (paprika.rating || 0) > 3,
              imageUrl: null, // photo_data handling deferred
            },
            ingredients: ingredientLines,
            confidence: 'MEDIUM',
            parseMethod: 'PAPRIKA',
          });
        } catch (e) {
          console.error(`Error parsing paprika recipe ${entry.entryName}:`, e.message);
        }
      }
    }

    res.json(recipes);
  } catch (error) {
    console.error('Import Paprika error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'import Paprika' });
  }
});

// ==================== SHOPPING LIST ROUTES ====================

// Get shopping list
app.get('/api/shopping-list', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM shopping_list_items WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.userId]
    );
    res.json(result.rows.map(formatShoppingListItem));
  } catch (error) {
    console.error('Get shopping list error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Add items to shopping list (batch)
app.post('/api/shopping-list', authenticateToken, async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !items.length) {
      return res.status(400).json({ error: 'Items requis' });
    }

    const results = [];
    for (const item of items) {
      const result = await pool.query(
        `INSERT INTO shopping_list_items (user_id, name, quantity, unit, linked_recipe_id, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
        [req.user.userId, item.name, item.quantity || 1, item.unit || null, item.linkedRecipeId || null]
      );
      results.push(formatShoppingListItem(result.rows[0]));
    }

    res.status(201).json(results);
  } catch (error) {
    console.error('Add shopping list error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Update shopping list item
app.put('/api/shopping-list/:id', authenticateToken, async (req, res) => {
  try {
    const { isChecked, name, quantity, unit } = req.body;

    const result = await pool.query(
      `UPDATE shopping_list_items SET
        is_checked = COALESCE($1, is_checked),
        name = COALESCE($2, name),
        quantity = COALESCE($3, quantity),
        unit = COALESCE($4, unit)
      WHERE id = $5 AND user_id = $6
      RETURNING *`,
      [isChecked, name, quantity, unit, req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item non trouvé' });
    }

    res.json(formatShoppingListItem(result.rows[0]));
  } catch (error) {
    console.error('Update shopping list error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Delete shopping list item (or clear all)
app.delete('/api/shopping-list/:id?', authenticateToken, async (req, res) => {
  try {
    if (req.params.id) {
      // Delete single item
      const result = await pool.query(
        'DELETE FROM shopping_list_items WHERE id = $1 AND user_id = $2 RETURNING id',
        [req.params.id, req.user.userId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Item non trouvé' });
      }
    } else {
      // Clear all (or by recipe)
      const { recipeId } = req.query;
      if (recipeId) {
        await pool.query(
          'DELETE FROM shopping_list_items WHERE user_id = $1 AND linked_recipe_id = $2',
          [req.user.userId, recipeId]
        );
      } else {
        await pool.query('DELETE FROM shopping_list_items WHERE user_id = $1', [req.user.userId]);
      }
    }

    res.status(204).send();
  } catch (error) {
    console.error('Delete shopping list error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== HEALTH CHECK ====================

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// ==================== HELPERS ====================

function formatIngredient(row) {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    origin: row.origin,
    producer: row.producer,
    category: row.category,
    format: row.format,
    flavorProfile: row.flavor_profile,
    aromaProfile: parseJson(row.aroma_profile, []),
    heatLevel: row.heat_level,
    description: row.description,
    producerHistory: row.producer_history,
    suggestedUses: parseJson(row.suggested_uses, []),
    pairings: parseJson(row.pairings, []),
    substitutes: parseJson(row.substitutes, []),
    shelfLife: row.shelf_life,
    storageInstructions: row.storage_instructions,
    enrichedByAI: row.enriched_by_ai,
    aiConfidence: row.ai_confidence,
    isFavorite: row.is_favorite,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function formatStockItem(row) {
  return {
    id: row.id,
    ingredientId: row.ingredient_id,
    location: parseJson(row.location, row.location),
    addedByUserId: row.added_by_user_id,
    purchaseDate: row.purchase_date,
    expiryDate: row.expiry_date,
    openedDate: row.opened_date,
    isFinished: row.is_finished,
    finishedDate: row.finished_date,
    quantity: row.quantity,
    notes: row.notes
  };
}

function formatStorageUnit(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    width: row.width,
    height: row.height,
    temperature: row.temperature,
    humidity: row.humidity,
    icon: row.icon
  };
}

function formatHistoryEvent(row) {
  return {
    id: row.id,
    date: row.date,
    type: row.type,
    description: row.description,
    ingredientId: row.ingredient_id,
    ingredientName: row.ingredient_name,
    userId: row.user_id
  };
}

function formatRecipe(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    cuisine: row.cuisine,
    instructions: parseJson(row.instructions, []),
    prepTime: row.prep_time,
    cookTime: row.cook_time,
    servings: row.servings,
    servingsText: row.servings_text,
    difficulty: row.difficulty,
    winePairings: parseJson(row.wine_pairings, []),
    tips: parseJson(row.tips, []),
    variations: parseJson(row.variations, []),
    source: row.source,
    sourceUrl: row.source_url,
    isFavorite: row.is_favorite,
    imageUrl: row.image_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatRecipeIngredient(row) {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    ingredientId: row.ingredient_id,
    name: row.name,
    amount: row.amount ? parseFloat(row.amount) : null,
    unit: row.unit,
    optional: row.is_optional,
    sortOrder: row.sort_order,
  };
}

function formatShoppingListItem(row) {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity ? parseFloat(row.quantity) : 1,
    unit: row.unit,
    isChecked: row.is_checked,
    linkedRecipeId: row.linked_recipe_id,
    createdAt: row.created_at,
  };
}

// Parse ingredient text line (French format)
function parseIngredientLine(line) {
  if (!line || !line.trim()) return { name: '', amount: null, unit: null, optional: false };

  const cleaned = line.trim();

  // Handle fractions
  const fractionMap = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 0.333, '⅔': 0.667 };

  const parseFraction = (str) => {
    if (!str) return null;
    str = str.trim();
    // Unicode fractions
    if (fractionMap[str]) return fractionMap[str];
    // "1/2" format
    if (str.includes('/')) {
      const [num, den] = str.split('/');
      return parseFloat(num) / parseFloat(den);
    }
    // "1,5" or "1.5"
    const val = parseFloat(str.replace(',', '.'));
    return isNaN(val) ? null : val;
  };

  // Regex for French ingredient lines
  // "250 g de lentilles corail", "1 c.s. d'huile d'olive", "½ bouquet de coriandre"
  const match = cleaned.match(
    /^([\d½¼¾⅓⅔.,/\s]+)?\s*(g|kg|ml|cl|dl|l|c\.s\.|c\.c\.|c\.à\.s\.|c\.à\.c\.|bouquet|cm|pincée|pincee|gousse|gousses|branche|branches|feuille|feuilles|tranche|tranches|botte|bottes|sachet|sachets|cuillère|cuillères|verre|verres|tasse|tasses|poignée|poignees)?\s*(?:de |d'|d'|du |des |la |le |l'|l')?\s*(.+)/i
  );

  if (match && match[3]) {
    return {
      amount: parseFraction(match[1]),
      unit: match[2] || null,
      name: match[3].trim(),
      optional: /optionnel|facultatif|\?/i.test(cleaned),
    };
  }

  return { amount: null, unit: null, name: cleaned, optional: /optionnel|facultatif|\?/i.test(cleaned) };
}

function parseJson(value, defaultValue) {
  if (!value) return defaultValue;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return defaultValue;
  }
}

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`🍳 KitchenFlow Backend running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
});
