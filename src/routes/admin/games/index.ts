import { FastifyPluginAsync } from "fastify";
import { adminGuard } from "../../../middleware/authGuard";

const adminGamesRoutes: FastifyPluginAsync = async (fastify) => {
  /*********************************************
   * GET
  *********************************************/
  fastify.get('/', { preHandler: [adminGuard] }, async (request, reply) => {
    const games = await fastify.models.Game.find().sort({ createdAt: -1 });
    return games;
  });

};
export default adminGamesRoutes;