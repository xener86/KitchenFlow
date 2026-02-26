import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const migrations = [
  // Users table
  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  // Ingredients table
  `CREATE TABLE IF NOT EXISTS ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(255),
    origin VARCHAR(255),
    producer VARCHAR(255),
    category VARCHAR(50) NOT NULL DEFAULT 'OTHER',
    format VARCHAR(100),
    flavor_profile TEXT,
    aroma_profile JSONB DEFAULT '[]',
    heat_level INTEGER,
    description TEXT,
    producer_history TEXT,
    suggested_uses JSONB DEFAULT '[]',
    pairings JSONB DEFAULT '[]',
    substitutes JSONB DEFAULT '[]',
    shelf_life VARCHAR(100),
    storage_instructions TEXT,
    enriched_by_ai BOOLEAN DEFAULT FALSE,
    ai_confidence VARCHAR(20),
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  // Stock items table
  `CREATE TABLE IF NOT EXISTS stock_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    location JSONB,
    added_by_user_id UUID NOT NULL,
    purchase_date DATE,
    expiry_date DATE,
    opened_date DATE,
    is_finished BOOLEAN DEFAULT FALSE,
    finished_date DATE,
    quantity INTEGER DEFAULT 100,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  // Storage units table
  `CREATE TABLE IF NOT EXISTS storage_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'PANTRY',
    width INTEGER DEFAULT 1,
    height INTEGER DEFAULT 1,
    temperature DECIMAL,
    humidity DECIMAL,
    icon VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  // History events table
  `CREATE TABLE IF NOT EXISTS history_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    type VARCHAR(20) NOT NULL,
    description TEXT,
    ingredient_id UUID,
    ingredient_name VARCHAR(255)
  )`,

  // Recipes table (Phase 2)
  `CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    category VARCHAR(50) DEFAULT 'PLAT',
    cuisine VARCHAR(100),
    instructions JSONB DEFAULT '[]',
    prep_time INTEGER DEFAULT 0,
    cook_time INTEGER DEFAULT 0,
    servings INTEGER DEFAULT 4,
    servings_text VARCHAR(100),
    difficulty VARCHAR(20) DEFAULT 'MEDIUM',
    wine_pairings JSONB DEFAULT '[]',
    tips JSONB DEFAULT '[]',
    variations JSONB DEFAULT '[]',
    source VARCHAR(20) DEFAULT 'MANUAL',
    source_url TEXT,
    is_favorite BOOLEAN DEFAULT FALSE,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  // Recipe ingredients table (Phase 2)
  `CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    amount DECIMAL,
    unit VARCHAR(50),
    is_optional BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0
  )`,

  // Shopping list items table (Phase 2)
  `CREATE TABLE IF NOT EXISTS shopping_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    quantity DECIMAL DEFAULT 1,
    unit VARCHAR(50),
    is_checked BOOLEAN DEFAULT FALSE,
    linked_recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  // Indexes (Phase 1)
  `CREATE INDEX IF NOT EXISTS idx_ingredients_user_id ON ingredients(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ingredients_category ON ingredients(category)`,
  `CREATE INDEX IF NOT EXISTS idx_stock_items_ingredient_id ON stock_items(ingredient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_stock_items_expiry_date ON stock_items(expiry_date)`,
  `CREATE INDEX IF NOT EXISTS idx_storage_units_user_id ON storage_units(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_history_events_user_id ON history_events(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_history_events_date ON history_events(date DESC)`,

  // Indexes (Phase 2)
  `CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(user_id, category)`,
  `CREATE INDEX IF NOT EXISTS idx_recipes_favorite ON recipes(user_id, is_favorite)`,
  `CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id)`,
  `CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient_id ON recipe_ingredients(ingredient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_shopping_list_user_id ON shopping_list_items(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_shopping_list_recipe_id ON shopping_list_items(linked_recipe_id)`
];

async function runMigrations() {
  console.log('🚀 Running KitchenFlow database migrations...\n');

  for (const migration of migrations) {
    try {
      await pool.query(migration);
      // Extract table/index name for logging
      const match = migration.match(/(?:TABLE|INDEX)\s+(?:IF NOT EXISTS\s+)?(\w+)/i);
      const name = match ? match[1] : 'unknown';
      console.log(`✅ ${name}`);
    } catch (error) {
      console.error(`❌ Migration failed:`, error.message);
      console.error('SQL:', migration.substring(0, 100) + '...');
    }
  }

  console.log('\n✨ Migrations completed!');
  await pool.end();
}

runMigrations().catch(console.error);
