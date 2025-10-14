import { FastifyPluginAsync } from "fastify";

const statsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/home", async (req, res) => {
    const tournaments = await fastify.models.Tournament.countDocuments({
      finished: true
    });
    const users = await fastify.models.User.countDocuments();
    const uniqueGames = await fastify.models.Tournament.aggregate([
      { $match: { finished: true } },
      { $group: { _id: '$gameId' } },
      { $count: 'totalUniqueGames' }
    ]);

    return {
      tournaments,
      users,
      gamesPlayed: uniqueGames[0]?.totalUniqueGames || 0
    };
  });
}

export default statsRoutes;