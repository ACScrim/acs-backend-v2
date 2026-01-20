import { FastifyPluginAsync } from 'fastify';
import fp from "fastify-plugin";
import mongoose from 'mongoose';
import User from '../models/User';
import Badge from '../models/Badge';
import Season from '../models/Season';
import GameRole from '../models/GameRole';
import Game from '../models/Game';
import GameProposal from '../models/GameProposal';
import PlayerGameLevel from '../models/PlayerGameLevel';
import Tournament from '../models/Tournament';
import Report from '../models/Report';
import QuizQuestion from "../models/QuizQuestion";
import QuizAnswer from "../models/QuizAnswer";
import Card from "../models/Card";
import CardAsset from "../models/CardAsset";
import CardCategory from "../models/CardCategory";
import Scrimium from "../models/Scrimium";
import Booster from "../models/Booster";
import CardCollection from "../models/CardCollection";
import BoosterShopItem from "../models/BoosterShopItem";
import Acsdle from "../models/Acsdle";
import DiscordMessage from "../models/DiscordMessage";
import Bet from "../models/Bet";

const mongoosePlugin: FastifyPluginAsync = async (fastify) => {
  const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/acs-v2";

  await mongoose.connect(uri);

  // Créer les indexes pour améliorer les performances
  try {
    // User indexes (critiques)
    await User.collection.createIndex({ email: 1 }, { unique: true });
    await User.collection.createIndex({ discordId: 1 }, { sparse: true });
    await User.collection.createIndex({ twitchUsername: 1 }, { sparse: true });
    
    // Tournament indexes
    await Tournament.collection.createIndex({ date: -1 });
    await Tournament.collection.createIndex({ finished: 1 });
    await Tournament.collection.createIndex({ 'players.user': 1 });
    
    // GameProposal indexes
    await GameProposal.collection.createIndex({ rawgId: 1 }, { sparse: true });
    await GameProposal.collection.createIndex({ createdAt: -1 });
    
    // Season indexes
    await Season.collection.createIndex({ number: 1 });
    await Season.collection.createIndex({ tournaments: 1 });
    
    // Scrimium indexes (critique)
    await Scrimium.collection.createIndex({ userId: 1 }, { unique: true });
    
    // CardCollection indexes
    await CardCollection.collection.createIndex({ userId: 1 });
    await CardCollection.collection.createIndex({ cardId: 1 });
    await CardCollection.collection.createIndex({ userId: 1, cardId: 1 }, { unique: true });
    
    // QuizAnswer indexes
    await QuizAnswer.collection.createIndex({ userId: 1 });
    await QuizAnswer.collection.createIndex({ questionId: 1 });
    await QuizAnswer.collection.createIndex({ createdAt: -1 });
    
    fastify.log.info('MongoDB indexes créés avec succès');
  } catch (error) {
    // Log l'erreur avec détails
    fastify.log.error({ error }, 'Erreur lors de la création des indexes MongoDB');
    
    // En production, les indexes critiques sont essentiels
    if (process.env.NODE_ENV === 'production') {
      fastify.log.fatal('Échec de création des indexes critiques en production');
      throw new Error('MongoDB indexes creation failed in production');
    }
  }

  fastify.decorate('models', {
    User: User,
    Badge: Badge,
    Season: Season,
    GameRole: GameRole,
    Game: Game,
    GameProposal: GameProposal,
    PlayerGameLevel: PlayerGameLevel,
    Tournament: Tournament,
    Report: Report,
    QuizQuestion: QuizQuestion,
    QuizAnswer: QuizAnswer,
    Card: Card,
    CardAsset: CardAsset,
    CardCategory: CardCategory,
    Scrimium: Scrimium,
    Booster: Booster,
    CardCollection: CardCollection,
    BoosterShopItem: BoosterShopItem,
    Acsdle: Acsdle,
    DiscordMessage: DiscordMessage,
    Bet: Bet
  });

  fastify.addHook('onClose', async () => {
    await mongoose.connection.close();
  });
};

export default fp(mongoosePlugin, { name: "mongoose-plugin" });