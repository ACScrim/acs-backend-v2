import { FastifyPluginAsync } from 'fastify';
import fp from "fastify-plugin";
import cron from 'node-cron';
import {log} from "../utils/utils";

const cronPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('cron', cron);

  /**
   * Cron job qui s'exécute chaque minute pour vérifier les rappels de tournoi
   * Envoie les rappels Discord et les messages privés aux joueurs qui n'ont pas checkin
   */
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();

      // Récupérer les tournois avec discordReminderDate dépassée et rappel non envoyé
      const tournamentsForDiscordReminder = await fastify.models.Tournament.find({
        discordReminderDate: { $lte: now },
        reminderSent: false,
        finished: false
      }).populate('game').populate('players.user');

      console.log(tournamentsForDiscordReminder);

      for (const tournament of tournamentsForDiscordReminder) {
        try {
          await fastify.discordService.sendTournamentReminder(tournament);
          tournament.reminderSent = true;
          await tournament.save();
        } catch (error) {
          console.error(`Erreur lors de l'envoi du rappel Discord pour ${tournament.name}:`, error);
        }
      }

      // Récupérer les tournois avec privateReminderDate dépassée et rappels privés non envoyés
      const tournamentsForPrivateReminder = await fastify.models.Tournament.find({
        privateReminderDate: { $lte: now },
        reminderSentPlayers: false,
        finished: false
      }).populate('game').populate('players.user');

      for (const tournament of tournamentsForPrivateReminder) {
        try {
          // Récupérer les joueurs qui n'ont pas checkin
          const playersWithoutCheckin = tournament.players
            .filter((p: any) => !p.hasCheckin && !p.inWaitlist)
            .map((p: any) => p.user);

          if (playersWithoutCheckin.length > 0) {
            log(fastify, `Rappel tournoi privé (mode dev) pour le tournoi ${tournament.name} envoyé à ${playersWithoutCheckin.map((p: any) => p.username).join(', ')}`, 'info');
            await fastify.discordService.sendPrivateReminders(tournament, playersWithoutCheckin);
          }

          tournament.reminderSentPlayers = true;
          await tournament.save();
        } catch (error) {
          console.error(`Erreur lors de l'envoi des rappels privés pour ${tournament.name}:`, error);
        }
      }
    } catch (error) {
      console.error('Erreur lors de l\'exécution du cron des rappels:', error);
    }
  });
};

export default fp(cronPlugin, { name: "cron-plugin" });