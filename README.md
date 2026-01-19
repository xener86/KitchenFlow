# KitchenFlow 🍳

Gestion intelligente de cuisine avec IA - Inventaire d'ingrédients et assistant culinaire.

## Fonctionnalités

### Phase 1 (Actuelle)
- ✅ Inventaire d'ingrédients (épices, huiles, sauces, etc.)
- ✅ Gestion des rangements (placard, frigo, tiroir, etc.)
- ✅ Enrichissement IA des produits (description, utilisations, accords)
- ✅ Alertes de péremption
- ✅ Statistiques d'inventaire
- ✅ Serveur MCP pour Claude

### Phase 2 (À venir)
- 📋 Gestionnaire de recettes
- 🍷 Intégration avec VinoFlow (accords mets-vins)
- 🤖 Amélioration de recettes avec l'IA
- 📝 Liste de courses automatique

## Stack Technique

| Composant | Technologie |
|-----------|-------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express, JWT Auth |
| Database | PostgreSQL |
| IA | Gemini, OpenAI, Mistral (multi-provider) |
| MCP | Model Context Protocol pour Claude |

## Installation

### Prérequis
- Node.js 20+
- PostgreSQL 15+
- Clé API Gemini (ou OpenAI/Mistral)

### 1. Cloner le projet
```bash
cd /Users/xavier
git clone <repo-url> kitchenflow
cd kitchenflow
```

### 2. Configuration Backend
```bash
cd backend
cp .env.example .env
# Éditer .env avec vos credentials
npm install
npm run migrate  # Créer les tables
npm run dev      # Démarrer sur port 3111
```

### 3. Configuration Frontend
```bash
cd frontend
npm install
npm run dev      # Démarrer sur port 3011
```

### 4. Accéder à l'application
Ouvrir http://localhost:3011

## Configuration MCP pour Claude

Ajoutez à votre configuration Claude (`~/.config/claude/config.json` ou similaire):

```json
{
  "mcpServers": {
    "kitchenflow": {
      "command": "node",
      "args": ["/Users/xavier/kitchenflow/backend/src/mcp-server.js"],
      "env": {
        "DATABASE_URL": "postgresql://user:password@localhost:5432/kitchenflow"
      }
    }
  }
}
```

### Outils MCP disponibles

| Outil | Description |
|-------|-------------|
| `list_ingredients` | Liste les ingrédients (filtrable par catégorie) |
| `get_ingredient` | Détails d'un ingrédient |
| `add_ingredient` | Ajoute un nouvel ingrédient |
| `search_expiring` | Trouve les produits bientôt périmés |
| `get_inventory_stats` | Statistiques de l'inventaire |
| `suggest_recipes` | Suggère des recettes avec les ingrédients dispo |
| `mark_as_used` | Marque un produit comme consommé |
| `get_storage_map` | Carte des rangements |

## Déploiement Docker

```bash
# Créer le fichier .env à la racine
echo "DB_PASSWORD=votre_mot_de_passe" > .env
echo "JWT_SECRET=votre_secret_jwt" >> .env

# Lancer les services
docker-compose up -d
```

L'application sera accessible sur http://localhost:5011

## Structure du Projet

```
kitchenflow/
├── frontend/
│   ├── components/    # Composants React
│   ├── contexts/      # Contextes (Auth, Theme)
│   ├── hooks/         # Hooks personnalisés
│   ├── pages/         # Pages de l'application
│   ├── services/      # Services API et IA
│   └── types.ts       # Types TypeScript
├── backend/
│   └── src/
│       ├── server.js     # API Express
│       ├── migrate.js    # Migrations PostgreSQL
│       └── mcp-server.js # Serveur MCP
└── docker-compose.yml
```

## Variables d'environnement

### Backend (.env)
```
DATABASE_URL=postgresql://user:password@localhost:5432/kitchenflow
JWT_SECRET=your-secret-key
PORT=3111
```

### Frontend (via Vite)
```
GEMINI_API_KEY=your-gemini-api-key
```

## Licence

MIT
