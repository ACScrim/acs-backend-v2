import {log} from "../utils/utils";
import {FastifyInstance} from "fastify";
import {ITournament, ITournamentPlayer} from "../models/Tournament";
import {IGame} from "../models/Game";
import {IUser} from "../models/User";

export const startTournamentFinishedCleanerCron = async (fastify: FastifyInstance) => {
  /**
   * Cron job qui s'exécute tous les jours à 3h pour nettoyer les tournois finis
   */
  fastify.cron.schedule('0 3 * * 1', async () => {
    try {
      const lastTournament = await fastify.models.Tournament.findOne({ finished: true }).sort({ date: -1 }).populate('game').populate('players.user') as ITournament & { game: IGame, players: (ITournamentPlayer & { user: IUser; })[] };
      if (!lastTournament) {
        log(fastify, 'Aucun tournoi fini trouvé pour le nettoyage.', 'info');
        return;
      }

      if (lastTournament.mvpVoteOpen) {
        const mvp = lastTournament.players.reduce((prev, current) => ((prev?.mvpVotes.length ?? 0) > current.mvpVotes.length) ? prev : current, null as ITournamentPlayer | null);
        if (mvp) await fastify.discordService.announceMvpWinner(lastTournament, mvp.id);
        lastTournament.mvpVoteOpen = false;
        await lastTournament.save();
        log(fastify, `Fermeture automatique du vote mvp du tournoi : ${lastTournament.name}.`, 'info');
      }
      await fastify.discordService.closeTournament(lastTournament);

      log(fastify, `Nettoyage du tournoi : ${lastTournament.name}.`, 'info');
    } catch (error) {
      console.error('Erreur lors de l\'exécution du cron de nettoyage des tournois finis:', error);
    }
  });
}