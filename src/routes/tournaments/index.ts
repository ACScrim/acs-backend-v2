import { FastifyPluginAsync } from "fastify";

const tournamentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (req, res) => {
    return fastify.models.Tournament.find().populate('game').populate('players.user', 'username avatarUrl');
  });
}

export default tournamentRoutes;