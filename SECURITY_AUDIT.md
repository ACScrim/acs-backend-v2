# Rapport d'audit de sécurité et optimisations - ACS Backend V2

Date: 2026-01-20

## 1. AUDIT DE SÉCURITÉ

### 🔴 CRITIQUE - Secrets par défaut

**Problème identifié:**
- Les secrets JWT, cookies et sessions utilisaient des valeurs par défaut dangereuses
- Risque d'accès non autorisé en cas de déploiement avec ces valeurs

**Impact:**
- Compromission totale de la sécurité de l'authentification
- Possibilité de forger des tokens JWT valides
- Sessions facilement déchiffrables

**Correction appliquée:**
1. Création d'un système de validation d'environnement (`src/utils/validateEnv.ts`)
   - Vérifie que tous les secrets sont définis
   - Détecte les valeurs par défaut dangereuses
   - Bloque le démarrage en production si configuration invalide
   - Exige minimum 32 caractères pour tous les secrets

2. Modification de `src/app.ts`:
   - Suppression des valeurs par défaut
   - Throw d'erreurs si secrets manquants
   - Validation au démarrage de l'application

3. Création de `.env.example` avec documentation complète

**Recommandation:**
```bash
# Générer des secrets sécurisés
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### 🟠 ÉLEVÉ - Headers de sécurité manquants

**Problème identifié:**
- Aucun header de sécurité (CSP, HSTS, X-Frame-Options, etc.)
- Vulnérable aux attaques XSS, clickjacking, etc.

**Impact:**
- Exposition à diverses attaques web (XSS, clickjacking, MIME sniffing)
- Non-conformité aux bonnes pratiques de sécurité web

**Correction appliquée:**
- Installation de `@fastify/helmet`
- Configuration dans `src/app.ts`:
  ```typescript
  fastify.register(fastifyHelmet, {
    contentSecurityPolicy: false, // Désactivé car peut interférer avec SSE
    crossOriginEmbedderPolicy: false
  });
  ```

---

### 🟠 ÉLEVÉ - Absence de rate limiting

**Problème identifié:**
- Aucune protection contre les attaques par force brute
- Risque de déni de service (DoS)
- Consommation excessive de ressources

**Impact:**
- Vulnérabilité aux attaques par dictionnaire sur l'authentification
- Possibilité d'épuisement des ressources serveur
- Coûts d'infrastructure élevés

**Correction appliquée:**
- Installation de `@fastify/rate-limit`
- Configuration dans `src/app.ts`:
  - Limite: 100 requêtes par minute par IP/utilisateur
  - Whitelist pour localhost (développement)
  - Messages d'erreur en français
  - Utilisation de l'ID de session comme clé si disponible

**Recommandation pour production:**
```typescript
// Utiliser Redis pour le partage entre instances
redis: new Redis(process.env.REDIS_URL)
```

---

### 🟠 ÉLEVÉ - Routes admin non protégées

**Problème identifié:**
- Routes `/api/admin/logs` et `/api/admin/logs/history` sans authentification
- Accès direct aux logs système sans vérification des permissions

**Impact:**
- Fuite d'informations sensibles (logs système, erreurs, données utilisateurs)
- Violation de la confidentialité

**Correction appliquée:**
- Ajout de `adminGuard` sur les routes `/logs` et `/logs/history`
- Code modifié dans `src/routes/admin/index.ts`

---

### 🟡 MOYEN - Validation des entrées insuffisante

**Problème identifié:**
- Utilisation extensive de `as any` et casts TypeScript
- Pas de validation des schémas d'entrée
- Risque d'injection et de données malformées

**Impact:**
- Vulnérabilité aux injections NoSQL
- Erreurs runtime difficiles à déboguer
- Données corrompues en base de données

**Correction appliquée:**
- Création de schémas de validation Fastify:
  - `src/schemas/user.schema.ts` - Validation des routes utilisateurs
  - `src/schemas/card.schema.ts` - Validation des routes cartes
- Validation des ObjectId MongoDB (pattern regex)
- Limites de longueur sur les champs texte
- Validation des types MIME pour les images

**Recommandation:**
Appliquer ces schémas aux routes:
```typescript
fastify.post('/users', {
  schema: createUserSchema,
  preHandler: [authGuard]
}, async (req, res) => { ... })
```

---

### 🟡 MOYEN - Vulnérabilités npm

**Problème identifié:**
- 7 vulnérabilités détectées par `npm audit`:
  - 6 low (discord.js, undici, diff)
  - 1 high (non spécifié)

**Impact:**
- Dépend des vulnérabilités spécifiques
- Risque de compromission selon l'exploitation

**Recommandation:**
```bash
# Analyser en détail
npm audit

# Corriger automatiquement
npm audit fix

# Pour corrections majeures (peut casser des choses)
npm audit fix --force

# Alternative: mettre à jour manuellement
npm update discord.js
```

---

### 🔵 FAIBLE - Limite de bodyLimit globale

**Problème identifié:**
- Limite de 10MB appliquée globalement pour les images base64
- Risque d'upload de fichiers volumineux sur toutes les routes

**Impact:**
- Consommation mémoire élevée
- Potentiel déni de service par upload massif

**Recommandation:**
Appliquer des limites par route:
```typescript
fastify.post('/upload', {
  bodyLimit: 10 * 1024 * 1024, // 10MB seulement pour cette route
}, async (req, res) => { ... })

// Routes normales avec limite plus basse
fastify.post('/api/data', {
  bodyLimit: 1024 * 1024, // 1MB pour les autres routes
}, async (req, res) => { ... })
```

---

## 2. OPTIMISATIONS DE PERFORMANCE

### 🟠 ÉLEVÉ - Indexes MongoDB manquants

**Problème identifié:**
- Aucun index explicite défini
- Requêtes lentes sur collections volumineuses
- Scans de table complets (O(n) au lieu de O(log n))

**Impact:**
- Temps de réponse dégradés avec l'augmentation des données
- Charge CPU élevée sur MongoDB
- Mauvaise expérience utilisateur

**Correction appliquée:**
Ajout d'indexes dans `src/plugins/mongoosePlugin.ts`:

**User:**
- `email` (unique) - Pour les recherches/authentification
- `discordId` (sparse) - Pour OAuth et crons
- `twitchUsername` (sparse) - Pour intégration Twitch

**Tournament:**
- `date` (descending) - Pour trier par date
- `finished` - Pour filtrer tournois terminés
- `players.user` - Pour requêtes utilisateur

**GameProposal:**
- `rawgId` (sparse) - Pour éviter doublons
- `createdAt` (descending) - Pour affichage chronologique

**Season:**
- `number` - Pour filtrage par saison
- `tournaments` - Pour recherches de tournois

**Scrimium:**
- `userId` (unique) - Pour findOrCreateByUserId

**CardCollection:**
- `userId` - Pour collection utilisateur
- `cardId` - Pour recherches de cartes
- `userId + cardId` (unique) - Pour éviter doublons

**QuizAnswer:**
- `userId` - Pour réponses utilisateur
- `questionId` - Pour statistiques questions
- `createdAt` (descending) - Pour tri chronologique

---

### 🟡 MOYEN - Requêtes N+1

**Problème identifié:**
Dans `src/routes/users/index.ts` - Route `/profile/:id`:
```typescript
// Charge tous les tournois
const tournamentHistory = await Tournament.find({...})
  .populate('game')
  .populate('players.user');

// Puis pour chaque tournoi, vérifie si dans une saison (N+1)
const filteredTournamentHistory = tournamentHistory.filter(tournament => {
  return seasons.find(season => season.tournaments.includes(tournament._id));
});
```

**Impact:**
- Charge tous les tournois en mémoire avant filtrage
- Peut charger des centaines de tournois inutilement

**Recommandation:**
Utiliser une agrégation MongoDB:
```typescript
const filteredTournamentHistory = await Tournament.aggregate([
  {
    $match: {
      'players.user': new mongoose.Types.ObjectId(userId),
      'finished': true,
      '_id': { $in: seasons.flatMap(s => s.tournaments) }
    }
  },
  { $sort: { date: -1 } },
  {
    $lookup: {
      from: 'games',
      localField: 'game',
      foreignField: '_id',
      as: 'game'
    }
  }
]);
```

---

### 🟡 MOYEN - Cron inefficace

**Problème identifié:**
`src/crons/updateDiscordAvatars.ts` chargeait tous les utilisateurs Discord d'un coup:
```typescript
const users = await User.find({ discordId: { $exists: true } });
for (const user of users) { ... }
```

**Impact:**
- Charge toute la collection User en mémoire
- Risque de saturation mémoire avec beaucoup d'utilisateurs
- Pas de gestion d'erreur globale

**Correction appliquée:**
- Traitement par lots (batch) de 50 utilisateurs
- Délai de 1 seconde entre les lots
- Compteurs pour totalUpdated et totalErrors
- Logging des statistiques finales

---

### 🔵 FAIBLE - Absence de cache

**Problème identifié:**
- Données fréquemment consultées rechargées à chaque requête
- Exemple: Saisons, catégories de cartes, etc.

**Impact:**
- Charge inutile sur MongoDB
- Temps de réponse plus élevés

**Recommandation:**
Implémenter un cache avec Redis ou en mémoire:
```typescript
// Plugin de cache simple
import { FastifyPluginAsync } from 'fastify';
import NodeCache from 'node-cache';

const cachePlugin: FastifyPluginAsync = async (fastify) => {
  const cache = new NodeCache({ 
    stdTTL: 600, // 10 minutes
    checkperiod: 120 
  });
  
  fastify.decorate('cache', cache);
};

// Utilisation
const seasons = fastify.cache.get('seasons');
if (!seasons) {
  const seasons = await fastify.models.Season.find({...});
  fastify.cache.set('seasons', seasons);
}
```

---

## 3. AMÉLIORATIONS DU CODE

### 🟠 ÉLEVÉ - Usage excessif de @ts-ignore

**Problème identifié:**
- 6+ occurrences de `@ts-ignore` dans le code
- Cache des erreurs TypeScript potentielles
- Perte des bénéfices du typage

**Exemples:**
```typescript
// src/middleware/auth.ts
// @ts-ignore
if (!req.session.authenticated || !req.session.userId) { ... }

// src/routes/users/index.ts
// @ts-ignore
const scrimium = await fastify.models.Scrimium.findOrCreateByUserId(userId);
```

**Recommandation:**
Créer des déclarations de types appropriées:
```typescript
// src/types/fastify.d.ts
import 'fastify';
import { Session } from '@fastify/session';

declare module 'fastify' {
  interface FastifyRequest {
    user?: IUser;
  }
  
  interface Session {
    authenticated?: boolean;
    userId?: string;
  }
}
```

---

### 🟡 MOYEN - Gestion d'erreurs incohérente

**Problème identifié:**
- Mix entre `log(fastify, ...)` et `console.log()`
- Pas de structure d'erreur standardisée
- Niveaux de log parfois inappropriés

**Recommandation:**
1. Utiliser uniquement `log(fastify, ...)` ou `fastify.log`
2. Créer un helper d'erreur standardisé:
```typescript
// src/utils/errors.ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
  }
}

// Middleware d'erreur global
fastify.setErrorHandler((error, request, reply) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: error.message,
      code: error.code
    });
  }
  
  fastify.log.error(error);
  return reply.status(500).send({ error: 'Erreur serveur interne' });
});
```

---

### 🟡 MOYEN - Logging configuration

**Problème identifié:**
- Logger configuré en mode "silent" par défaut
- Redirection vers fichier mais pas de rotation
- Pas de logs structurés

**Recommandation:**
```typescript
// src/app.ts
const options: AppOptions = {
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    file: 'logs/backend.log',
    redact: ['req.headers.authorization', 'req.headers.cookie'],
    transport: process.env.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname'
      }
    } : {
      target: 'pino/file',
      options: {
        destination: 'logs/backend.log',
        mkdir: true
      }
    }
  }
};

// Utiliser pino-roll pour rotation
npm install pino-roll
```

---

### 🔵 FAIBLE - Tests manquants

**Problème identifié:**
- 0 fichiers de test
- Pas de couverture de code
- Risque de régression

**Recommandation:**
Créer une infrastructure de tests:
```typescript
// test/routes/health.test.ts
import { test } from 'node:test';
import { build } from '../helper';

test('GET /api/health', async (t) => {
  const app = await build(t);
  
  const res = await app.inject({
    url: '/api/health',
    method: 'GET'
  });
  
  t.assert.equal(res.statusCode, 200);
  const json = res.json();
  t.assert.equal(json.status, 'ok');
  t.assert.ok(json.mongodb);
});
```

---

## 4. INFRASTRUCTURE ET DÉPLOIEMENT

### 🟡 MOYEN - Workflow GitHub Actions incomplet

**Problème identifié:**
- Pas de build ni de tests dans le workflow CI/CD
- Déploiement direct sans vérification
- Utilise `npm install` au lieu de `npm ci`

**Correction appliquée:**
Amélioration de `.github/workflows/deploy.yml`:
- Ajout de l'étape de build avant déploiement
- Setup Node.js avec cache npm
- Utilisation de `npm ci` (plus rapide et déterministe)
- Tentative d'exécution des tests
- Build TypeScript avant déploiement sur serveur

---

### 🟡 MOYEN - Healthcheck endpoint

**Problème identifié:**
- Pas d'endpoint de healthcheck
- Impossible de monitorer l'état de l'application

**Correction appliquée:**
Création de `src/routes/health/index.ts`:
- Vérifie l'état de MongoDB
- Retourne uptime et timestamp
- Peut être utilisé par les load balancers et monitoring

**Usage:**
```bash
curl http://localhost:5000/api/health
# Réponse:
{
  "status": "ok",
  "timestamp": "2026-01-20T15:41:48.393Z",
  "uptime": 123.456,
  "mongodb": "connected",
  "environment": "production"
}
```

---

### 🔵 FAIBLE - Documentation PM2

**Recommandation:**
Créer un fichier `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'acs-backend-v2',
    script: 'dist/src/app.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    },
    error_file: 'logs/pm2-error.log',
    out_file: 'logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '500M'
  }]
};
```

---

## RÉSUMÉ DES CHANGEMENTS

### Fichiers créés:
1. ✅ `src/utils/validateEnv.ts` - Validation des variables d'environnement
2. ✅ `src/schemas/user.schema.ts` - Schémas de validation utilisateurs
3. ✅ `src/schemas/card.schema.ts` - Schémas de validation cartes
4. ✅ `src/routes/health/index.ts` - Endpoint healthcheck
5. ✅ `.env.example` - Documentation des variables d'environnement

### Fichiers modifiés:
1. ✅ `src/app.ts` - Validation env, helmet, rate limiting, secrets requis
2. ✅ `src/routes/admin/index.ts` - Protection des routes logs
3. ✅ `src/plugins/mongoosePlugin.ts` - Ajout des indexes MongoDB
4. ✅ `src/crons/updateDiscordAvatars.ts` - Traitement par lots
5. ✅ `.github/workflows/deploy.yml` - Build et tests dans CI/CD

### Packages ajoutés:
1. ✅ `@fastify/helmet` - Headers de sécurité
2. ✅ `@fastify/rate-limit` - Protection contre les abus

---

## ACTIONS RECOMMANDÉES

### Immédiat (avant production):
1. ❗ Générer et configurer tous les secrets dans `.env`
2. ❗ Exécuter `npm audit fix` pour corriger les vulnérabilités
3. ❗ Tester le démarrage avec les nouvelles validations
4. ❗ Vérifier que les indexes MongoDB sont créés

### Court terme (1-2 semaines):
1. 🔧 Appliquer les schémas de validation aux routes
2. 🔧 Remplacer tous les `@ts-ignore` par des types appropriés
3. 🔧 Implémenter la gestion d'erreurs standardisée
4. 🔧 Ajouter un cache Redis en production

### Moyen terme (1 mois):
1. 📝 Créer des tests unitaires (couverture > 70%)
2. 📝 Optimiser les requêtes N+1 identifiées
3. 📝 Configurer la rotation des logs
4. 📝 Implémenter le monitoring (ex: Prometheus)

### Long terme (3 mois):
1. 🎯 Migration vers validation stricte TypeScript
2. 🎯 Audit de sécurité complet par un tiers
3. 🎯 Performance testing et optimisation
4. 🎯 Documentation API (Swagger/OpenAPI)
