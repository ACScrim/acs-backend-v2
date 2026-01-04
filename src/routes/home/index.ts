import { FastifyPluginAsync } from "fastify";
import { log } from "../../utils/utils";

const statsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Récupère les statistiques globales de la plateforme
   * Nombre de tournois, d'utilisateurs et de jeux uniques joués
   */
  fastify.get("/stats", async (req, res) => {
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

  /**
   * Returns next 3 tournaments
   */
  fastify.get("/next-tournaments", async (req, res) => {
    try {
      const tournaments = await fastify.models.Tournament.find({
        date: { $gte: new Date() }
      })
        .sort({ date: 1 })
        .limit(3)
        .populate('game').populate('players.user teams.users clips.addedBy');

      return tournaments;
    } catch (error) {
      log(fastify, `Erreur lors de la récupération des prochains tournois: ${error}`, "error");
      return res.status(500).send({ error: 'Erreur lors de la récupération des prochains tournois' });
    }
  })

  fastify.get("/last-tournament", async (req, res) => {
    try {
      const tournament = await fastify.models.Tournament.findOne({
        finished: true
      })
        .sort({ date: -1 })
        .populate('game').populate('players.user teams.users clips.addedBy');

      return tournament;
    } catch (error) {
      log(fastify, `Erreur lors de la récupération du dernier tournoi: ${error}`, "error");
      return res.status(500).send({ error: 'Erreur lors de la récupération du dernier tournoi' });
    }
  })
}

export default statsRoutes;

