import { FastifyPluginAsync } from "fastify";
import { log } from "../../utils/utils";

const seasonsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Récupère la liste de toutes les saisons triée par numéro décroissant
   */
  fastify.get('/', async (req, res) => {
    try {
      return fastify.models.Season.find({}).sort({ number: -1 });
    } catch (error) {
      log(fastify, `Erreur lors de la récupération des saisons : ${error}`, 'error');
      return res.status(500).send({ error: 'Erreur lors de la récupération des saisons' });
    }
  })
}

export default seasonsRoutes;

