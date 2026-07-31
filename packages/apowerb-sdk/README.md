# @thaink2/apowerb-sdk

Client JavaScript du backend th2agent : agents, outils, RAG, BI, webhooks, facturation, skills. **139 fonctions**, aucune dépendance, aucun code React ni Next — utilisable dans un navigateur comme dans Node.

## Pourquoi ce paquet

Cette couche vivait dans `src/lib/api.js` de l'application Next, avec `const BASE = ""` codé en dur : toutes les requêtes partaient en relatif vers `/api/...`, ce qui suppose d'être servi par l'app qui proxie ces routes. La partie la plus réutilisable du dépôt était donc prisonnière du front.

## Usage

Sans configuration, le comportement est celui d'origine — requêtes relatives, jeton lu dans `localStorage` — donc l'application Next ne change pas d'un octet :

```js
import { listAgents } from "@thaink2/apowerb-sdk";

const agents = await listAgents(); // GET /api/agents
```

Ailleurs, on pointe le backend de son choix :

```js
import { configureClient, listAgents } from "@thaink2/apowerb-sdk";

configureClient({
  baseUrl: "https://agent.thaink2.com",
  storage: { getToken: () => process.env.TH2AGENT_TOKEN },
});

const agents = await listAgents(); // GET https://agent.thaink2.com/api/agents
```

## Configuration

`configureClient(options)` — les clés omises gardent leur valeur courante.

| Option | Défaut | Rôle |
|---|---|---|
| `baseUrl` | `""` | Racine du backend. Vide = requêtes relatives. Un slash final est toléré. |
| `storage` | `authStorage` (localStorage) | Doit exposer `getToken()`, idéalement `setToken()` et `clear()`. |
| `onUnauthorized` | évènement `auth:unauthorized` sur `window` | Appelé sur un 401 définitif. Sans DOM, ne fait rien. |

`getClientConfig()` retourne la configuration courante, `resetClientConfig()` rétablit les défauts (utile entre deux tests).

## Ce que le client gère pour vous

- injection de l'en-tête `Authorization` ;
- rafraîchissement du jeton sur 401, avec verrou pour éviter les rafraîchissements concurrents, puis rejeu de la requête ;
- réponses non-JSON des reverse proxies (502/503/504) converties en `Error` propres portant `status` ;
- upload de fichiers, y compris en morceaux.

## Format

ESM pur, publié tel quel — pas d'étape de build. Les fichiers ne contiennent ni JSX ni syntaxe propriétaire, donc Node comme n'importe quel bundler les consomment directement.
