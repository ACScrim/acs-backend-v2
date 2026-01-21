import { FastifyPluginAsync } from "fastify";
import { log, AppError } from "../../utils/utils";

const seasonsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Récupère la liste de toutes les saisons triée par numéro décroissant
   */
  fastify.get('/', async () => {
    try {
      return fastify.models.Season.find({}).sort({ number: -1 });
    } catch (error) {
      log(fastify, `Erreur lors de la récupération des saisons : ${error}`, 'error');
      throw error instanceof AppError ? error : new AppError(500, 'Erreur lors de la récupération des saisons');
    }
  })
}

export default seasonsRoutes;
