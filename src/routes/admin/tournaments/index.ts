import {ITournament, ITournamentPlayer} from "@models/Tournament";
import {FastifyPluginAsync} from "fastify";
import {adminGuard} from "../../../middleware/authGuard";
import {IGame} from "@models/Game";
import {log} from "../../../utils/utils";

const adminTournamentRoutes: FastifyPluginAsync = async (fastify) => {
  /*********************************************
   * GET
  *********************************************/

  /**
   * Récupère la liste de tous les tournois avec leurs détails associés
   * (jeu, équipes avec leurs utilisateurs, joueurs avec leurs utilisateurs)
   * Trié par date de création décroissante (les plus récents d'abord)
   */
  fastify.get('/', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      const tournaments = await fastify.models.Tournament.find()
        .populate('game')
        .populate('teams.users')
        .populate('players.user')
        .sort({ createdAt: -1 });
      return tournaments;
    } catch (error) {
      log(fastify, `Erreur lors de la récupération de la liste des tournois : ${error}`, 'error');
      return reply.status(500).send({ error: 'Erreur lors de la récupération des tournois' });
    }
  });

  /**
   * Récupère les détails d'un tournoi spécifique par son ID
   * Inclut le jeu associé, les équipes avec leurs utilisateurs, et les joueurs
   */
  fastify.get('/:id', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      const tournament = await fastify.models.Tournament.findById((request.params as any).id)
        .populate('game')
        .populate('teams.users')
        .populate('players.user');

      if (!tournament) {
        return reply.notFound();
      }

      return tournament;
    } catch (error) {
      log(fastify, `Erreur lors de la récupération du tournoi ${(request.params as any).id} : ${error}`, 'error');
      return reply.status(500).send({ error: 'Erreur lors de la récupération du tournoi' });
    }
  });

  /*********************************************
   * POST
  *********************************************/

  /**
   * Crée un nouveau tournoi avec les informations fournies
   * Initialise également le canal Discord associé via discordService
   * Un cron job automatique enverra des rappels aux dates discordReminderDate et privateReminderDate
   *
   * discordReminderDate: Envoie un message de rappel sur le canal Discord du tournoi
   * privateReminderDate: Envoie des messages privés Discord aux joueurs qui n'ont pas checkin
   *
   * Retourne le tournoi créé avec tous ses détails
   */
  fastify.post('/', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      const tournamentData = request.body as {
        name: string;
        gameId: string;
        date: Date;
        discordChannelName: string;
        playerCap?: number;
        description?: string;
        discordReminderDate?: Date;
        privateReminderDate?: Date;
      };
      const tournament = new fastify.models.Tournament({
        name: tournamentData.name,
        gameId: tournamentData.gameId,
        date: tournamentData.date,
        discordChannelName: tournamentData.discordChannelName || '',
        playerCap: tournamentData.playerCap || 0,
        description: tournamentData.description || '',
      }) as ITournament;
      await tournament.save();
      tournament.messageId = await fastify.discordService.createTournament(await fastify.models.Tournament.findById(tournament.id).populate('game') as ITournament & { game: IGame });
      await tournament.save();
      return await fastify.models.Tournament.findById(tournament._id)
        .populate('game')
        .populate('teams.users')
        .populate('players.user');
    } catch (error) {
      log(fastify, `Erreur lors de la création du tournoi : ${error}`, 'error');
      return reply.status(500).send({ error: 'Erreur lors de la création du tournoi' });
    }
  });

  /**
   * Ajoute ou met à jour les équipes d'un tournoi
   * Remplace complètement la liste des équipes existantes
   */
  fastify.post('/:id/teams', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      const tournament = await fastify.models.Tournament.findById((request.params as any).id);
      if (!tournament) {
        return reply.notFound();
      }

      const { teams } = request.body as { teams: Array<{ name: string; users: string[] }> };
      tournament.teams = teams;
      await tournament.save();

      return await fastify.models.Tournament.findById((request.params as any).id)
        .populate('game')
        .populate('teams.users')
        .populate('players.user');
    } catch (error) {
      log(fastify, `Erreur lors de la mise à jour des équipes du tournoi ${(request.params as any).id} : ${error}`, 'error');
      return reply.status(500).send({ error: 'Erreur lors de la mise à jour des équipes' });
    }
  });

  /**
   * Publie ou masque les équipes du tournoi
   * Contrôle la visibilité des équipes pour les utilisateurs
   */
  fastify.post('/:id/publish-teams', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      const tournament = await fastify.models.Tournament.findById((request.params as any).id);
      if (!tournament) {
        return reply.notFound();
      }
      const { teamsPublished } = request.body as { teamsPublished: boolean };
      tournament.teamsPublished = teamsPublished;
      await tournament.save();
      if (teamsPublished) void fastify.discordService.createTournamentVoiceChannels(tournament);
      return await fastify.models.Tournament.findById((request.params as any).id)
        .populate('game')
        .populate('teams.users')
        .populate('players.user');
    } catch (error) {
      log(fastify, `Erreur lors de la publication des équipes du tournoi ${(request.params as any).id} : ${error}`, 'error');
      return reply.status(500).send({ error: 'Erreur lors de la publication des équipes' });
    }
  });

  /**
   * Ajoute un joueur au tournoi
   * Récupère les informations du dernier tournoi du joueur pour le même jeu
   * pour initialiser ses tier et description
   */
  fastify.post('/:id/players', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      let tournament = await fastify.models.Tournament.findById((request.params as any).id).populate('game players.user') as ITournament & { game: IGame };
      if (!tournament) {
        return reply.notFound();
      }
      const { userId } = request.body as { userId: string };
      const lastTournament = await fastify.models.Tournament.findOne({ 'players.user': userId, gameId: tournament.gameId }).sort({ date: -1 });
      const lastPlayerParticipation = lastTournament?.players.find((p: ITournamentPlayer) => (p.user as any).toString() === userId);
      tournament.players.push({ user: userId, inWaitlist: false, hasCheckin: false, isMvp: false, registrationDate: new Date(), isCaster: false, mvpVotes: [], tier: lastPlayerParticipation?.tier || 0, description: lastPlayerParticipation?.description || '' } as any);
      await tournament.save();
      tournament = await fastify.models.Tournament.findById((request.params as any).id)
        .populate('game')
        .populate('teams.users')
        .populate('players.user');
      await fastify.discordService.updateTournamentMessage(tournament);
      return tournament;
    } catch (error) {
      log(fastify, `Erreur lors de l'ajout d'un joueur au tournoi ${(request.params as any).id} : ${error}`, 'error');
      return reply.status(500).send({ error: 'Erreur lors de l\'ajout du joueur' });
    }
  });

  /*********************************************
   * PATCH
  *********************************************/

  /**
   * Met à jour les informations d'un joueur spécifique dans un tournoi
   * Permet de modifier le tier, la description et le statut de check-in
   */
  fastify.patch('/:id/players/:playerId', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      const tournament = await fastify.models.Tournament.findById((request.params as any).id) as ITournament;
      if (!tournament) {
        return reply.notFound();
      }
      const playerId = (request.params as any).playerId;
      const { tier, description, hasCheckin } = request.body as { tier?: string; description?: string; hasCheckin?: boolean };
      const player = tournament.players.find(p => p.id.toString() === playerId);
      if (!player) {
        return reply.notFound();
      }
      if (tier !== undefined) player.tier = tier;
      if (description !== undefined) player.description = description;
      if (hasCheckin !== undefined) player.hasCheckin = hasCheckin;
      await tournament.save();
      return await fastify.models.Tournament.findById((request.params as any).id)
        .populate('game')
        .populate('teams.users')
        .populate('players.user');
    } catch (error) {
      log(fastify, `Erreur lors de la mise à jour du joueur ${(request.params as any).playerId} du tournoi ${(request.params as any).id} : ${error}`, 'error');
      return reply.status(500).send({ error: 'Erreur lors de la mise à jour du joueur' });
    }
  });

  /**
   * Met à jour les informations d'une équipe spécifique
   * Permet de modifier le nom, le score et le classement
   */
  fastify.patch('/:id/teams', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      const tournament = await fastify.models.Tournament.findById((request.params as any).id) as ITournament;
      if (!tournament) {
        return reply.notFound();
      }

      const oldName = (request.body as any).oldName as string;
      const { name, score, ranking } = request.body as { name: string; score?: number; ranking?: number };
      const team = tournament.teams.find(t => t.name === oldName);
      if (!team) {
        return reply.notFound();
      }
      if (name !== undefined) team.name = name;
      if (score !== undefined) team.score = score;
      if (ranking !== undefined) team.ranking = ranking;

      await tournament.save();
      return await fastify.models.Tournament.findById((request.params as any).id)
        .populate('game')
        .populate('teams.users')
        .populate('players.user');
    } catch (error) {
      log(fastify, `Erreur lors de la mise à jour de l'équipe du tournoi ${(request.params as any).id} : ${error}`, 'error');
      return reply.status(500).send({ error: 'Erreur lors de la mise à jour de l\'équipe' });
    }
  });

  /**
   * Met à jour les informations générales du tournoi
   * Permet de modifier les champs suivants: nom, jeu, date, canal Discord,
   * limite de joueurs, description, dates de rappel, statut du vote MVP, etc.
   */
  fastify.patch('/:id', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      const tournament = await fastify.models.Tournament.findById((request.params as any).id) as ITournament;
      if (!tournament) {
        return reply.notFound();
      }
      const updatableFields = ['name', 'gameId', 'date', 'discordChannelName', 'playerCap', 'description', 'discordReminderDate', 'privateReminderDate', 'reminderSent', 'reminderSentPlayers', 'messageId', 'mvpVoteOpen'];
      updatableFields.forEach(field => {
        if ((request.body as any)[field] !== undefined) {
          (tournament as any)[field] = (request.body as any)[field];
        }
      });
      await tournament.save();
      return await fastify.models.Tournament.findById((request.params as any).id)
        .populate('game')
        .populate('teams.users')
        .populate('players.user');
    } catch (error) {
      log(fastify, `Erreur lors de la mise à jour du tournoi ${(request.params as any).id} : ${error}`, 'error');
      return reply.status(500).send({ error: 'Erreur lors de la mise à jour du tournoi' });
    }
  });

  /*********************************************
   * DELETE
  *********************************************/

  /**
   * Supprime un joueur spécifique du tournoi
   * Retire le joueur de la liste sans affecter les autres données du tournoi
   */
  fastify.delete('/:id/players/:playerId', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      let tournament = await fastify.models.Tournament.findById((request.params as any).id).populate('game') as ITournament & { game: IGame };
      if (!tournament) {
        return reply.notFound();
      }
      const playerId = (request.params as any).playerId;
      tournament.players = tournament.players.filter(p => (p.id || (p._id as any)).toString() !== playerId);
      await tournament.save();
      tournament = await fastify.models.Tournament.findById((request.params as any).id)
        .populate('game')
        .populate('teams.users')
        .populate('players.user');
      await fastify.discordService.updateTournamentMessage(tournament);
      return tournament;
    } catch (error) {
      log(fastify, `Erreur lors de la suppression du joueur ${(request.params as any).playerId} du tournoi ${(request.params as any).id} : ${error}`, 'error');
      return reply.status(500).send({ error: 'Erreur lors de la suppression du joueur' });
    }
  });

  /**
   * Supprime complètement un tournoi
   * Supprime le tournoi de la base de données et ferme le canal Discord associé
   * Utilise le discordService pour nettoyer les ressources Discord
   */
  fastify.delete('/:id', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      const tournament = await fastify.models.Tournament.findById((request.params as any).id).populate('game');
      if (!tournament) {
        return reply.notFound();
      }
      await fastify.models.Tournament.deleteOne({ _id: tournament._id });
      await fastify.discordService.closeTournament(tournament);
      return await fastify.models.Tournament.findById((request.params as any).id)
        .populate('game')
        .populate('teams.users')
        .populate('players.user');
    } catch (error) {
      log(fastify, `Erreur lors de la suppression du tournoi ${(request.params as any).id} : ${error}`, 'error');
      return reply.status(500).send({ error: 'Erreur lors de la suppression du tournoi' });
    }
  });
};

export default adminTournamentRoutes;