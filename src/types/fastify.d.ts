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
import Report from '@models/Report'
import QuizQuestion from '@models/QuizQuestion'
import QuizAnswer from '@models/QuizAnswer'
import { Client } from 'discord.js';
import DiscordService from "@services/discordService";
import Card from "@models/Card";
import CardAsset from "../models/CardAsset";

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
      Tournament: Model<Tournament>,
      Report: Model<Report>
      QuizQuestion: Model<QuizQuestion>
      QuizAnswer: Model<QuizAnswer>,
      Card: Model<Card>,
      CardAsset: Model<CardAsset>
    },
    cron: typeof import('node-cron').nodeCron,
    discord: Client,
    discordService: DiscordService
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