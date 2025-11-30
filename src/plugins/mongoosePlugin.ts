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

const mongoosePlugin: FastifyPluginAsync = async (fastify) => {
  const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/acs-v2";

  await mongoose.connect(uri);

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
    QuizAnswer: QuizAnswer
  });

  fastify.addHook('onClose', async () => {
    await mongoose.connection.close();
  });
};

export default fp(mongoosePlugin, { name: "mongoose-plugin" });