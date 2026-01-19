/**
 * KitchenFlow MCP Server
 *
 * Model Context Protocol server for Claude to interact with KitchenFlow.
 * Can be run standalone or integrated with the main backend.
 *
 * Usage:
 *   Standalone: node src/mcp-server.js
 *   Integrated: imported and started alongside Express server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Create MCP Server
const server = new Server(
  {
    name: 'kitchenflow-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// ==================== TOOLS ====================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_ingredients',
        description: 'Liste tous les ingrédients dans l\'inventaire KitchenFlow. Peut filtrer par catégorie ou recherche.',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Filtrer par catégorie (SPICE, OIL, SAUCE, HERB, etc.)',
            },
            search: {
              type: 'string',
              description: 'Recherche par nom ou marque',
            },
            userId: {
              type: 'string',
              description: 'ID de l\'utilisateur (requis)',
            },
          },
          required: ['userId'],
        },
      },
      {
        name: 'get_ingredient',
        description: 'Récupère les détails complets d\'un ingrédient par son ID',
        inputSchema: {
          type: 'object',
          properties: {
            ingredientId: {
              type: 'string',
              description: 'ID de l\'ingrédient',
            },
          },
          required: ['ingredientId'],
        },
      },
      {
        name: 'add_ingredient',
        description: 'Ajoute un nouvel ingrédient à l\'inventaire',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'ID de l\'utilisateur' },
            name: { type: 'string', description: 'Nom de l\'ingrédient' },
            brand: { type: 'string', description: 'Marque' },
            origin: { type: 'string', description: 'Origine/Pays' },
            category: { type: 'string', description: 'Catégorie (SPICE, OIL, SAUCE, etc.)' },
            format: { type: 'string', description: 'Format (100g, 500ml, etc.)' },
            description: { type: 'string', description: 'Description' },
            quantity: { type: 'number', description: 'Quantité en stock', default: 1 },
          },
          required: ['userId', 'name', 'category'],
        },
      },
      {
        name: 'search_expiring',
        description: 'Recherche les ingrédients qui vont bientôt expirer',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'ID de l\'utilisateur' },
            daysUntilExpiry: { type: 'number', description: 'Nombre de jours avant expiration', default: 30 },
          },
          required: ['userId'],
        },
      },
      {
        name: 'get_inventory_stats',
        description: 'Obtient des statistiques sur l\'inventaire (nombre total, par catégorie, expirations)',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'ID de l\'utilisateur' },
          },
          required: ['userId'],
        },
      },
      {
        name: 'suggest_recipes',
        description: 'Suggère des recettes basées sur les ingrédients disponibles (nécessite intégration IA)',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'ID de l\'utilisateur' },
            ingredients: {
              type: 'array',
              items: { type: 'string' },
              description: 'Liste d\'ingrédients spécifiques (optionnel, sinon utilise l\'inventaire)',
            },
            cuisine: { type: 'string', description: 'Type de cuisine souhaitée (français, asiatique, etc.)' },
          },
          required: ['userId'],
        },
      },
      {
        name: 'mark_as_used',
        description: 'Marque un élément de stock comme utilisé/consommé',
        inputSchema: {
          type: 'object',
          properties: {
            stockItemId: { type: 'string', description: 'ID de l\'élément de stock' },
          },
          required: ['stockItemId'],
        },
      },
      {
        name: 'get_storage_map',
        description: 'Récupère la carte des rangements avec leur contenu',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'ID de l\'utilisateur' },
          },
          required: ['userId'],
        },
      },
    ],
  };
});

// Tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_ingredients': {
        let query = 'SELECT * FROM ingredients WHERE user_id = $1';
        const params = [args.userId];

        if (args.category) {
          query += ' AND category = $2';
          params.push(args.category);
        }

        if (args.search) {
          query += ` AND (name ILIKE $${params.length + 1} OR brand ILIKE $${params.length + 1})`;
          params.push(`%${args.search}%`);
        }

        query += ' ORDER BY name';

        const result = await pool.query(query, params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.rows.map(formatIngredientForMCP), null, 2),
            },
          ],
        };
      }

      case 'get_ingredient': {
        const result = await pool.query(
          'SELECT * FROM ingredients WHERE id = $1',
          [args.ingredientId]
        );

        if (result.rows.length === 0) {
          return { content: [{ type: 'text', text: 'Ingrédient non trouvé' }] };
        }

        // Get stock info
        const stockResult = await pool.query(
          'SELECT * FROM stock_items WHERE ingredient_id = $1 AND is_finished = false',
          [args.ingredientId]
        );

        const ingredient = formatIngredientForMCP(result.rows[0]);
        ingredient.stockItems = stockResult.rows;
        ingredient.stockCount = stockResult.rows.length;

        return {
          content: [{ type: 'text', text: JSON.stringify(ingredient, null, 2) }],
        };
      }

      case 'add_ingredient': {
        const result = await pool.query(
          `INSERT INTO ingredients (user_id, name, brand, origin, category, format, description, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
           RETURNING *`,
          [args.userId, args.name, args.brand, args.origin, args.category || 'OTHER', args.format, args.description]
        );

        const ingredient = result.rows[0];

        // Add stock items if quantity specified
        if (args.quantity && args.quantity > 0) {
          for (let i = 0; i < args.quantity; i++) {
            await pool.query(
              `INSERT INTO stock_items (ingredient_id, added_by_user_id, created_at)
               VALUES ($1, $2, NOW())`,
              [ingredient.id, args.userId]
            );
          }
        }

        return {
          content: [{
            type: 'text',
            text: `✅ Ingrédient "${args.name}" ajouté avec ${args.quantity || 1} unité(s) en stock.`
          }],
        };
      }

      case 'search_expiring': {
        const days = args.daysUntilExpiry || 30;
        const result = await pool.query(
          `SELECT i.name, i.brand, i.category, s.expiry_date, s.id as stock_id
           FROM stock_items s
           JOIN ingredients i ON s.ingredient_id = i.id
           WHERE i.user_id = $1
             AND s.is_finished = false
             AND s.expiry_date IS NOT NULL
             AND s.expiry_date <= CURRENT_DATE + INTERVAL '${days} days'
           ORDER BY s.expiry_date ASC`,
          [args.userId]
        );

        if (result.rows.length === 0) {
          return {
            content: [{ type: 'text', text: `Aucun produit n'expire dans les ${days} prochains jours.` }],
          };
        }

        const formatted = result.rows.map(row => {
          const daysLeft = Math.ceil((new Date(row.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
          return `- ${row.name}${row.brand ? ` (${row.brand})` : ''}: expire dans ${daysLeft} jour(s) (${row.expiry_date})`;
        });

        return {
          content: [{
            type: 'text',
            text: `⚠️ ${result.rows.length} produit(s) expirent bientôt:\n\n${formatted.join('\n')}`
          }],
        };
      }

      case 'get_inventory_stats': {
        const [total, byCategory, expiring, favorites] = await Promise.all([
          pool.query('SELECT COUNT(*) FROM ingredients WHERE user_id = $1', [args.userId]),
          pool.query(
            'SELECT category, COUNT(*) as count FROM ingredients WHERE user_id = $1 GROUP BY category ORDER BY count DESC',
            [args.userId]
          ),
          pool.query(
            `SELECT COUNT(DISTINCT i.id) FROM ingredients i
             JOIN stock_items s ON i.id = s.ingredient_id
             WHERE i.user_id = $1 AND s.is_finished = false
               AND s.expiry_date IS NOT NULL
               AND s.expiry_date <= CURRENT_DATE + INTERVAL '30 days'`,
            [args.userId]
          ),
          pool.query('SELECT COUNT(*) FROM ingredients WHERE user_id = $1 AND is_favorite = true', [args.userId]),
        ]);

        const stats = {
          totalIngredients: parseInt(total.rows[0].count),
          byCategory: byCategory.rows.reduce((acc, row) => {
            acc[row.category] = parseInt(row.count);
            return acc;
          }, {}),
          expiringSoon: parseInt(expiring.rows[0].count),
          favorites: parseInt(favorites.rows[0].count),
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }],
        };
      }

      case 'suggest_recipes': {
        // Get user's ingredients
        let ingredientList = args.ingredients;
        if (!ingredientList || ingredientList.length === 0) {
          const result = await pool.query(
            `SELECT DISTINCT i.name FROM ingredients i
             JOIN stock_items s ON i.id = s.ingredient_id
             WHERE i.user_id = $1 AND s.is_finished = false`,
            [args.userId]
          );
          ingredientList = result.rows.map(r => r.name);
        }

        // This would integrate with AI service in production
        return {
          content: [{
            type: 'text',
            text: `🍳 Ingrédients disponibles: ${ingredientList.join(', ')}\n\n` +
              `Pour des suggestions de recettes, utilisez le Chef IA dans l'application KitchenFlow ` +
              `ou fournissez ces ingrédients à un modèle IA pour générer des recettes.`
          }],
        };
      }

      case 'mark_as_used': {
        const result = await pool.query(
          `UPDATE stock_items SET is_finished = true, finished_date = CURRENT_DATE
           WHERE id = $1 RETURNING *`,
          [args.stockItemId]
        );

        if (result.rows.length === 0) {
          return { content: [{ type: 'text', text: 'Élément de stock non trouvé' }] };
        }

        return {
          content: [{ type: 'text', text: '✅ Élément marqué comme utilisé.' }],
        };
      }

      case 'get_storage_map': {
        const [units, items] = await Promise.all([
          pool.query('SELECT * FROM storage_units WHERE user_id = $1 ORDER BY name', [args.userId]),
          pool.query(
            `SELECT s.location, i.name, i.category FROM stock_items s
             JOIN ingredients i ON s.ingredient_id = i.id
             WHERE i.user_id = $1 AND s.is_finished = false`,
            [args.userId]
          ),
        ]);

        const storageMap = units.rows.map(unit => ({
          id: unit.id,
          name: unit.name,
          type: unit.type,
          dimensions: `${unit.width}x${unit.height}`,
          temperature: unit.temperature,
          items: items.rows.filter(item => {
            try {
              const loc = typeof item.location === 'string' ? JSON.parse(item.location) : item.location;
              return loc?.unitId === unit.id;
            } catch {
              return item.location === unit.name;
            }
          }).map(i => i.name),
        }));

        return {
          content: [{ type: 'text', text: JSON.stringify(storageMap, null, 2) }],
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Outil inconnu: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    console.error(`MCP Tool Error (${name}):`, error);
    return {
      content: [{ type: 'text', text: `Erreur: ${error.message}` }],
      isError: true,
    };
  }
});

// ==================== RESOURCES ====================

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'kitchenflow://inventory',
        name: 'Inventaire KitchenFlow',
        description: 'Liste complète des ingrédients dans l\'inventaire',
        mimeType: 'application/json',
      },
      {
        uri: 'kitchenflow://expiring',
        name: 'Produits expirant bientôt',
        description: 'Produits qui expirent dans les 30 prochains jours',
        mimeType: 'application/json',
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  // Note: In production, you'd need to handle user authentication
  // For now, we'll return a message about needing user context

  return {
    contents: [
      {
        uri,
        mimeType: 'text/plain',
        text: 'Pour accéder aux données, utilisez les outils avec un userId valide.',
      },
    ],
  };
});

// ==================== HELPERS ====================

function formatIngredientForMCP(row) {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    origin: row.origin,
    category: row.category,
    format: row.format,
    description: row.description,
    isFavorite: row.is_favorite,
    enrichedByAI: row.enriched_by_ai,
  };
}

// ==================== START SERVER ====================

async function main() {
  // Test database connection
  try {
    await pool.query('SELECT 1');
    console.error('✅ Database connected');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🍳 KitchenFlow MCP Server running on stdio');
}

main().catch(console.error);

export { server, pool };
