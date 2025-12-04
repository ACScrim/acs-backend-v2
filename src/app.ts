import AutoLoad, { AutoloadPluginOptions } from '@fastify/autoload'
import fastifyCookie from '@fastify/cookie'
import fastifyCors from '@fastify/cors'
import fastifyJwt from '@fastify/jwt'
import oauthPlugin from '@fastify/oauth2'
import fastifySession from '@fastify/session'
import MongoStore from 'connect-mongo'
import { FastifyPluginAsync, FastifyServerOptions } from 'fastify'
import FastifySSEPlugin from 'fastify-sse-v2'
import path, { join } from 'node:path'
import { startUpdateDiscordAvatarsCron } from './crons/updateDiscordAvatars'
import {startTournamentRemindersCron} from "./crons/tournamentReminders";
import {startDailyQuizCron} from "./crons/dailyQuiz";

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
  }
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

  // SSE
  fastify.register(FastifySSEPlugin);

  // CORS
  fastify.register(fastifyCors, {
    origin: (origin, cb) => {
      const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173').split(',');
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        // Request from allowed origin
        cb(null, true)
      } else {
        // Request from disallowed origin
        cb(new Error("Not allowed"), false)
      }
    },
    credentials: true,
    methods: ['GET', 'PUT', 'POST', 'DELETE', 'PATCH', 'OPTIONS'],
  })

  // JWT
  fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'supersecret'
  })

  // COOKIE
  fastify.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET || 'supersecret',
    parseOptions: {},
  })

  // SESSION
  fastify.register(fastifySession, {
    cookieName: 'acs.sid',
    secret: process.env.SESSION_SECRET || 'supersecretsupersecretsupersecretsupersecret',
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    },
    saveUninitialized: false,
    rolling: true,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/acs-v2',
      collectionName: 'sessions',
      ttl: 7 * 24 * 60 * 60, // 7 days
      autoRemove: 'native',
      touchAfter: 15 * 60,
      crypto: {
        secret: process.env.JWT_SECRET || 'supersecret'
      }
    })
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
  })

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
    })
}

export default app
export { app, options }

