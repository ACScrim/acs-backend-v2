import { FastifyPluginAsync } from "fastify";
import { authGuard } from "../../../middleware/authGuard";
import {AppError, log} from "../../../utils/utils";

const threeBoxesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/today', { preHandler: [authGuard] }, async (request) => {
    const userId = request.session.userId as string;
    if (!userId) throw new AppError(401, "Authentification requise.");

    try {
      const result = await (fastify as any).threeBoxesService.getTodayChoice(userId);
      if (!result) return { played: false };
      return { played: true, choice: result.choice, reward: result.reward, permutation: result.permutation, credited: result.credited };
    } catch (e: any) {
      log(fastify, `Erreur three-boxes today: ${e}`, 'error');
      throw new AppError(500, "Erreur serveur lors de la récupération du jeu du jour.");
    }
  });

  fastify.post('/choose', { preHandler: [authGuard] }, async (request) => {
    const userId = request.session.userId as string;
    if (!userId) throw new AppError(401, "Authentification requise.");

    const { choice } = request.body as { choice?: number };
    if (!choice || ![1,2,3].includes(choice)) {
      throw new AppError(400, "Choix invalide. Choisissez 1, 2 ou 3.");
    }

    try {
      const result = await (fastify as any).threeBoxesService.chooseBox(userId, choice);
      return { success: true, data: { played: true, choice: result.choice, reward: result.reward, permutation: result.permutation, credited: result.credited, date: result.date } };
    } catch (e: any) {
      log(fastify, `Erreur three-boxes choose: ${e}`, 'error');
      throw new AppError(500, "Erreur serveur lors de la sélection de la boîte. Réessayez plus tard.");
    }
  });
}

export default threeBoxesRoutes;
