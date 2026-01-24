import {log} from "../utils/utils";
import {FastifyInstance} from "fastify";
import {ITournament} from "../models/Tournament";
import {IGame} from "../models/Game";

export const startTournamentFinishedCleanerCron = async (fastify: FastifyInstance) => {
  /**
   * Cron job qui s'exécute tous les jours à 3h pour nettoyer les tournois finis
   * Supprime les tournois finis depuis plus de 30 jours
   */
  fastify.cron.schedule('0 3 * * MON', async () => {
    try {
      const lastTournament = await fastify.models.Tournament.findOne({ finished: true }).sort({ date: -1 }).populate('game') as ITournament & { game: IGame };
      if (!lastTournament) {
        log(fastify, 'Aucun tournoi fini trouvé pour le nettoyage.', 'info');
        return;
      }

      if (lastTournament.mvpVoteOpen) await fastify.discordService.closeTournament(lastTournament);

      log(fastify, `Nettoyage du tournoi : ${lastTournament.name}.`, 'info');
    } catch (error) {
      console.error('Erreur lors de l\'exécution du cron de nettoyage des tournois finis:', error);
    }
  });
}