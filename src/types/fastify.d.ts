import 'fastify'
import type { Model } from 'mongoose'
import User from '@models/User'
import Badge from '@models/Badge'
import Season from '@models/Season'
import GameRole from '@models/GameRole'
import Game from '@models/Game'
import GameProposal from '@models/GameProposal'
import PlayerGameLevel from '@models/PlayerGameLevel'
import Tournament from '@models/Tournament'
import { Client } from 'discord.js';

declare module 'fastify' {
  interface FastifyInstance {
    models: {
      User: Model<User>
      Badge: Model<Badge>
      Season: Model<Season>
      GameRole: Model<GameRole>
      Game: Model<Game>
      GameProposal: Model<GameProposal>
      PlayerGameLevel: Model<PlayerGameLevel>
      Tournament: Model<Tournament>
    },
    cron: typeof import('node-cron').nodeCron,
    discord: Client
  }

  interface Session {
    userId?: string
    authenticated?: boolean
    discord_temp_token?: string
  }

  interface FastifyRequest {
    user?: User
  }
}