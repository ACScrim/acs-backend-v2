import { FastifyPluginAsync } from "fastify";

const tournamentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (req, res) => {
    return fastify.models.Tournament.find().populate('game');
  });
}

export default tournamentRoutes;