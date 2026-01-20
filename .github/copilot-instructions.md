# GitHub Copilot Instructions for ACS Backend V2

## Project Overview

This is the backend API for ACS (a gaming community platform) built with Node.js, TypeScript, and Fastify. The application manages:
- User authentication (Discord OAuth2, JWT, sessions)
- Gaming tournaments and competitions
- Card collection system (boosters, categories, assets)
- Scrimium points and rewards system
- Daily quizzes (Acsdle)
- Discord bot integration
- Twitch integration
- Leaderboards and statistics

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Fastify v5
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT, OAuth2 (Discord), cookie-based sessions
- **Key Libraries**:
  - `@fastify/autoload` - Auto-loads plugins and routes
  - `@fastify/jwt` - JWT authentication
  - `@fastify/oauth2` - OAuth2 (Discord)
  - `@fastify/session` - Session management with MongoDB store
  - `@fastify/cors` - CORS handling
  - `fastify-sse-v2` - Server-Sent Events
  - `mongoose` - MongoDB ODM
  - `discord.js` - Discord bot
  - `cloudinary` - Image management
  - `node-cron` - Scheduled tasks

## Architecture

### Directory Structure
```
src/
├── app.ts                    # Main application entry point
├── crons/                    # Scheduled cron jobs
├── middleware/               # Request middleware (auth, authGuard)
├── models/                   # Mongoose schemas and models
├── plugins/                  # Fastify plugins (auto-loaded)
├── routes/                   # API routes (auto-loaded with /api prefix)
├── services/                 # Business logic services
├── types/                    # TypeScript type definitions
└── utils/                    # Utility functions
```

### Plugin System
- Plugins are auto-loaded from `src/plugins/`
- Each plugin exports a default FastifyPluginAsync function
- Plugins extend Fastify with decorators (e.g., `fastify.models`, `fastify.discordService`)

### Route System
- Routes are auto-loaded from `src/routes/` with `/api` prefix
- Each route file exports a default FastifyPluginAsync function
- Routes use `preHandler` hooks for authentication (e.g., `authGuard`)

### Models
- Mongoose models are defined in `src/models/`
- Each model exports an interface (e.g., `IUser`) and default model
- Models include virtuals, custom methods, and JSON transformations
- Common pattern: `toJSON` transformation removes `_id`, `__v`, and sensitive fields

## Development Guidelines

### Code Style
- **Language**: TypeScript (strict mode from `fastify-tsconfig`)
- **Comments**: French comments are used throughout the codebase
- **Imports**: Use ES modules (`import/export`)
- **Error Messages**: French error messages in API responses
- **Logging**: Use `log(fastify, message, level)` utility from `utils/utils.ts`
- **Avoid ts-ignore**: Minimize `@ts-ignore` usage, but it's acceptable for plugin decorators

### Authentication Patterns
- Use `authGuard` middleware for protected routes:
  ```typescript
  fastify.get('/protected', { preHandler: [authGuard] }, async (req, res) => {
    const userId = req.session.userId as string;
    // ...
  })
  ```
- Session data is in `req.session` (authenticated, userId)
- User object is attached to `req.user` after authentication

### Route Handlers
- Always include try-catch blocks
- Return appropriate HTTP status codes (404, 500, etc.)
- Use `log()` for error logging
- Return French error messages:
  ```typescript
  return res.status(404).send({ error: "Utilisateur introuvable pour l'identifiant fourni" });
  ```

### Model Usage
- Access models via `fastify.models.ModelName`
- Use Mongoose query builders and populate for relations
- Populate virtuals when needed (e.g., `user.set('scrimium', scrimium)`)

### Services
- Services are registered as Fastify decorators
- Access via `fastify.serviceName` (e.g., `fastify.discordService`)
- Services handle external integrations (Discord, Twitch, Cloudinary, etc.)

### Environment Variables
- Defined in `.env` file (not committed)
- Common variables:
  - `MONGODB_URI` - MongoDB connection string
  - `JWT_SECRET`, `COOKIE_SECRET`, `SESSION_SECRET` - Security secrets
  - `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` - Discord OAuth
  - `CORS_ALLOWED_ORIGINS` - Comma-separated allowed origins
  - `BACKEND_URL` - Backend base URL
  - `NODE_ENV` - Environment (production/development)

## Common Patterns

### Creating a New Route
```typescript
import { FastifyPluginAsync } from 'fastify';
import { authGuard } from '../../middleware/authGuard';
import { log } from '../../utils/utils';

const myRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [authGuard] }, async (req, res) => {
    try {
      // Route logic
      return { success: true };
    } catch (error) {
      log(fastify, `Error message: ${error}`, 'error');
      return res.status(500).send({ error: 'Error message' });
    }
  });
};

export default myRoute;
```

### Creating a New Model
```typescript
import mongoose, { Document } from 'mongoose';

export interface IMyModel extends Document {
  field1: string;
  field2: number;
  createdAt: Date;
  updatedAt: Date;
}

const MyModelSchema = new mongoose.Schema<IMyModel>({
  field1: { type: String, required: true },
  field2: { type: Number, default: 0 }
}, { timestamps: true });

MyModelSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model<IMyModel>('MyModel', MyModelSchema);
```

### Creating a New Plugin
```typescript
import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

const myPlugin: FastifyPluginAsync = async (fastify) => {
  // Plugin initialization logic
  const myService = {
    doSomething: async () => {
      // Service logic
    }
  };

  fastify.decorate('myService', myService);
};

export default fp(myPlugin);
```

## Testing

- Test command: `npm run test`
- Tests are in `test/` directory
- Uses Node.js built-in test runner with TypeScript support
- Coverage with c8

## Building and Running

- **Development**: `npm run dev` (watches TypeScript, restarts on changes)
- **Build**: `npm run build:ts` (compiles to `dist/`)
- **Production**: `npm start` (builds and starts server)
- **Server Port**: 5000 (configurable in `config.json`)

## Database Migrations

- Migration scripts in `migrations/` directory
- Run with: `npm run migrate-db`
- Uses `ts-node` to execute TypeScript migration files

## Cron Jobs

- Defined in `src/crons/`
- Started in `app.ts` after `fastify.ready()`
- Examples:
  - `updateDiscordAvatars` - Sync Discord avatars
  - `tournamentReminders` - Send tournament reminders
  - `dailyQuiz` - Manage daily quiz (Acsdle)
  - `updateAcsersCard` - Update player cards

## Common Pitfalls

1. **Don't forget to build**: TypeScript must be compiled before running
2. **Session configuration**: Different settings for production vs development (secure cookies, domain)
3. **CORS**: Only configured origins are allowed
4. **Auto-loading**: Routes/plugins must export default FastifyPluginAsync
5. **MongoDB ObjectId**: Cast properly when comparing IDs
6. **Population**: Remember to populate relations when needed
7. **Error handling**: Always wrap async route handlers in try-catch
8. **Logging**: Use custom `log()` utility instead of `console.log` or `fastify.log`

## API Conventions

- **Prefix**: All routes auto-loaded with `/api` prefix
- **Response Format**: JSON
- **Error Format**: `{ error: "Message d'erreur en français" }`
- **Success Format**: Return data directly or `{ success: true, data: ... }`
- **Authentication**: Session-based with MongoDB store
- **File Uploads**: Max body size 10MB (for base64 images)

## Security Notes

- JWT secret must be set in production
- Session secret must be at least 32 characters
- Cookie secret should be strong
- CORS origins must be explicitly whitelisted
- Sensitive fields removed in model `toJSON` transformations
- Auth headers redacted in logs

## Integration Points

- **Discord Bot**: `discordService` for posting messages, managing roles
- **Twitch**: `twitchService` for EventSub subscriptions
- **Cloudinary**: `cloudinaryService` for image uploads
- **Challonge**: `challongeService` for tournament management
