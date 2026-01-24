import AutoLoad, { AutoloadPluginOptions } from '@fastify/autoload'
import fastifyCookie from '@fastify/cookie'
import fastifyCors from '@fastify/cors'
import fastifyHelmet from '@fastify/helmet'
import fastifyJwt from '@fastify/jwt'
import oauthPlugin from '@fastify/oauth2'
import fastifyRateLimit from '@fastify/rate-limit'
import fastifySession from '@fastify/session'
import { FastifyPluginAsync, FastifyServerOptions } from 'fastify'
import FastifySSEPlugin from 'fastify-sse-v2'
import path, { join } from 'node:path'
import { startUpdateDiscordAvatarsCron } from './crons/updateDiscordAvatars'
import {startTournamentRemindersCron} from "./crons/tournamentReminders";
import {startDailyQuizCron} from "./crons/dailyQuiz";
import {startUpdateAcsersCardCron} from "./crons/updateAcsersCard";
import {log} from "./utils/utils";
import MongoSessionStore from "./utils/MongoStore";
import {readFile} from "node:fs/promises";
import {validateEnvironment} from "./utils/validateEnv";
import {startTournamentFinishedCleanerCron} from "./crons/tournamentFinishedCleaner";

// Valider les variables d'environnement au démarrage
validateEnvironment();

export interface AppOptions extends FastifyServerOptions, Partial<AutoloadPluginOptions> {
}
// Pass --options via CLI arguments in command to enable these options.
const options: AppOptions = {
  bodyLimit: 10 * 1024 * 1024, // 10MB limit for base64 images
  logger: {
    level: "silent",
    file: "logs/backend.log",
    redact: ['req.headers.authorization', 'req.headers.cookie'],
    transport: {
      target: 'pino/file',
      options: {
        destination: path.join(__dirname, '../../logs/backend.log'),
        mkdir: true,
        fsync: true,  // Force l'écriture synchrone immédiate
        append: true
      }
    },
    serializers: {
      res (reply) {
        return {
          method: reply.request?.method,
          url: reply.request?.url,
          statusCode: reply.statusCode,
          body: reply.request?.body,
          headers: typeof reply.getHeaders === 'function' ? reply.getHeaders() : {}
        }
      }
    }
  },
  trustProxy: true
}

const app: FastifyPluginAsync<AppOptions> = async (
  fastify,
  opts
): Promise<void> => {
  // Place here your custom code!

  //fastify.addHook('onResponse', async (request, reply) => {
  //  if (reply.statusCode >= 400) {
  //    request.log.level = 'info';
  //  }
  //});

  // Security headers
  fastify.register(fastifyHelmet, {
    contentSecurityPolicy: false, // Désactivé car peut interférer avec SSE
    crossOriginEmbedderPolicy: false
  });

  // Rate limiting
  fastify.register(fastifyRateLimit, {
    max: 100, // Nombre maximum de requêtes
    timeWindow: '1 minute', // Fenêtre de temps
    cache: 10000, // Taille du cache
    allowList: ['127.0.0.1'], // Whitelist pour localhost
    redis: undefined, // Peut être configuré avec Redis pour production
    skipOnError: true, // Continue même en cas d'erreur
    keyGenerator: (req) => {
      // Utiliser une combinaison IP + userId pour éviter les abus
      // même pour les utilisateurs authentifiés
      const userId = req.session?.userId || 'anonymous';
      return `${req.ip}:${userId}`;
    },
    errorResponseBuilder: () => {
      return {
        code: 429,
        error: 'Trop de requêtes',
        message: 'Vous avez dépassé la limite de requêtes. Veuillez réessayer plus tard.'
      };
    }
  });

  // SSE
  fastify.register(FastifySSEPlugin);

  // CORS
  fastify.register(fastifyCors, {
    origin: (origin, cb) => {
      const rawAllowed = process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173,https://v2.acscrim.fr';
      const allowedOrigins = rawAllowed
        .split(',')
        .map(o => o.trim())
        .filter(Boolean);

      const normalizedOrigin = origin?.endsWith('/') ? origin.slice(0, -1) : origin;
      const isAllowed = !normalizedOrigin || allowedOrigins.includes(normalizedOrigin);

      if (isAllowed) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'PUT', 'POST', 'DELETE', 'PATCH', 'OPTIONS'],
  })

  // JWT
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET est requis');
  }
  fastify.register(fastifyJwt, {
    secret: jwtSecret
  })

  // COOKIE
  const cookieSecret = process.env.COOKIE_SECRET;
  if (!cookieSecret) {
    throw new Error('COOKIE_SECRET est requis');
  }
  fastify.register(fastifyCookie, {
    secret: cookieSecret,
    parseOptions: {},
  })

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI est requis');
  }
  const mongoStore = new MongoSessionStore(
    mongoUri,
    'acs-v2'
  );

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error('SESSION_SECRET est requis');
  }
  fastify.register(fastifySession, {
    cookieName: 'acs.sid',
    secret: sessionSecret,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      domain: process.env.NODE_ENV === 'production' ? '.acscrim.fr' : undefined
    },
    saveUninitialized: true,
    rolling: true,
    store: mongoStore
  })

  // Discord Oauth2
  fastify.register(oauthPlugin, {
    name: 'discordOAuth2',
    scope: ['identify', 'email', 'guilds', 'guilds.members.read'],
    credentials: {
      client: {
        id: process.env.DISCORD_CLIENT_ID || '',
        secret: process.env.DISCORD_CLIENT_SECRET || ''
      },
      auth: oauthPlugin.DISCORD_CONFIGURATION
    },
    startRedirectPath: '/api/auth/discord',
    callbackUri: process.env.BACKEND_URL + '/auth/discord/callback',
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      domain: process.env.NODE_ENV === 'production' ? '.acscrim.fr' : undefined
    }
  });

  fastify.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;

    if (!origin && request.url.startsWith('/api/') && !request.url.includes('twitch') && !request.url.startsWith('/api/auth/')) {
      reply.hijack();
      const html = await readFile(path.join(__dirname, '../../public/index.html'), 'utf-8');
      reply.raw.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      reply.raw.end(html);
    }
  });

  // Do not touch the following lines
  await fastify.register(AutoLoad, {
    dir: join(__dirname, 'plugins'),
    options: opts
  })

  await fastify.register(AutoLoad, {
    dir: join(__dirname, 'routes'),
    options: {
      ...opts,
      prefix: '/api'
    }
  })

  // Start cron jobs

  fastify.ready()
    .then(async () => {
      try {
        // Post game proposal discord message missing
        const proposals = await fastify.models.GameProposal
          .find({
            $or: [
              { discordMessageId: { $exists: false } },
              { discordMessageId: null }
            ]
          })
          .populate('proposedBy');

        for (const proposal of proposals) {
          try {
            proposal.discordMessageId = await fastify.discordService.postProposal(proposal);
            await proposal.save();
          } catch (err) {
            fastify.log.error({ err, proposalId: proposal._id }, 'Échec de l\'envoi de la proposition sur Discord');
          }
        }
      } catch (err) {
        fastify.log.error(err, 'Impossible de récupérer les propositions à poster après le démarrage');
      }

      await startUpdateDiscordAvatarsCron(fastify);
      await startTournamentRemindersCron(fastify);
      await startDailyQuizCron(fastify);
      await startUpdateAcsersCardCron(fastify);
      await startTournamentFinishedCleanerCron(fastify);
    })
}

export default app
export { app, options }
