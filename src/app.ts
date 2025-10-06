import { join } from 'node:path'
import AutoLoad, { AutoloadPluginOptions } from '@fastify/autoload'
import { FastifyPluginAsync, FastifyServerOptions } from 'fastify'
import oauthPlugin from '@fastify/oauth2'
import fastifyJwt from '@fastify/jwt'
import fastifyCookie from '@fastify/cookie'
import fastifySession from '@fastify/session'
import MongoStore from 'connect-mongo'

export interface AppOptions extends FastifyServerOptions, Partial<AutoloadPluginOptions> {
}
// Pass --options via CLI arguments in command to enable these options.
const options: AppOptions = {
}

const app: FastifyPluginAsync<AppOptions> = async (
  fastify,
  opts
): Promise<void> => {
  // Place here your custom code!

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

  console.log(fastify.printRoutes())
}

export default app
export { app, options }
