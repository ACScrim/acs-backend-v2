import 'fastify'
import type { Model } from 'mongoose'
import User from '../models/User'
import Badge from '../models/Badge'
import Season from '../models/Season'
import GameRole from '../models/GameRole'
import Game from '../models/Game'
import GameProposal from '../models/GameProposal'
import PlayerGameLevel from '../models/PlayerGameLevel'
import Tournament from '../models/Tournament'
import Report from '../models/Report'
import QuizQuestion from '../models/QuizQuestion'
import QuizAnswer from '../models/QuizAnswer'
import { Client } from 'discord.js';
import DiscordService from "../services/discordService";
import Card from "../models/Card";
import CardAsset from "../models/CardAsset";
import CardCategory from "../models/CardCategory";
import TwitchService from "../services/twitchService";
import Scrimium from "../models/Scrimium";
import Booster from "../models/Booster";
import CardCollection from "../models/CardCollection";
import BoosterShopItem from "../models/BoosterShopItem";
import Acsdle from "../models/Acsdle";
import ChallongeService from "../services/challongeService";
import ScrimiumRewardService from "../services/scrimiumRewardService";

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
      CardAsset: Model<CardAsset>,
      CardCategory: Model<CardCategory>,
      Scrimium: Model<Scrimium>,
      Booster: Model<Booster>,
      CardCollection: Model<CardCollection>,
      BoosterShopItem: Model<BoosterShopItem>,
      Acsdle: Model<Acsdle>
    },
    cron: typeof import('node-cron').nodeCron,
    discord: Client,
    discordService: DiscordService,
    twitchService: TwitchService,
    challongeService: ChallongeService,
    scrimiumRewardService: ScrimiumRewardService
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