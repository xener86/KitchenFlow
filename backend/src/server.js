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
