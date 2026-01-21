import { FastifyPluginAsync } from "fastify";
import { adminGuard } from "../../../middleware/authGuard";
import { log, AppError } from "../../../utils/utils";

const adminPlayerGameLevelsRoutes: FastifyPluginAsync = async (fastify) => {

  /**
   * Récupère la liste de tous les niveaux de jeu des joueurs
   * Inclut les informations du jeu et les détails basiques de l'utilisateur
   */
  fastify.get("/", { preHandler: [adminGuard] }, async () => {
    try {
      const playerGameLevels = await fastify.models.PlayerGameLevel.find()
        .populate('game')
        .populate('user', 'id username email discordId avatarUrl');
      return playerGameLevels;
    } catch (error) {
      log(fastify, `Erreur lors de la récupération de la liste des niveaux de joueurs : ${error}`, 'error');
      throw error instanceof AppError ? error : new AppError(500, 'Erreur lors de la récupération des niveaux de joueurs');
    }
  });
}

export default adminPlayerGameLevelsRoutes;