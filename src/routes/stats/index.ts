import { FastifyPluginAsync } from "fastify";
import { log } from "../../utils/utils";

const statsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Récupère les statistiques globales de la plateforme
   * Nombre de tournois, d'utilisateurs et de jeux uniques joués
   */
  fastify.get("/home", async (req, res) => {
    try {
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
    } catch (error) {
      log(fastify, `Erreur lors de la récupération des statistiques : ${error}`, 'error');
      return res.status(500).send({ error: 'Erreur lors de la récupération des statistiques' });
    }
  });
}

export default statsRoutes;

