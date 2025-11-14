import { FastifyPluginAsync } from "fastify";
import { adminGuard } from "../../../middleware/authGuard";

const adminPlayerGameLevelsRoutes: FastifyPluginAsync = async (fastify) => {

  fastify.get("/", { preHandler: [adminGuard] }, async (req, res) => {
    const playerGameLevels = await fastify.models.PlayerGameLevel.find()
      .populate('game')
      .populate('user', 'id username email discordId avatarUrl');
    return playerGameLevels;
  });
}

export default adminPlayerGameLevelsRoutes;