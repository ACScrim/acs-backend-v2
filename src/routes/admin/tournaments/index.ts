import { FastifyPluginAsync } from "fastify";
import { adminGuard } from "../../../middleware/authGuard";
import { ITournament, ITournamentPlayer } from "@models/Tournament";

const adminTournamentRoutes: FastifyPluginAsync = async (fastify) => {

  /*********************************************
   * GET
  *********************************************/
  fastify.get('/', { preHandler: [adminGuard] }, async (request, reply) => {
    const tournaments = await fastify.models.Tournament.find()
      .populate('game')
      .populate('teams.users')
      .populate('players.user')
      .sort({ createdAt: -1 });

    return tournaments;
  });

  fastify.get('/:id', { preHandler: [adminGuard] }, async (request, reply) => {
    const tournament = await fastify.models.Tournament.findById((request.params as any).id)
      .populate('game')
      .populate('teams.users')
      .populate('players.user');

    if (!tournament) {
      return reply.notFound();
    }

    return tournament;
  });

  /*********************************************
   * POST
  *********************************************/

  fastify.post('/', { preHandler: [adminGuard] }, async (request, reply) => {
    const tournamentData = request.body as {
      name: string;
      gameId: string;
      date: Date;
      discordChannelName?: string;
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
    });
    await tournament.save();
    return await fastify.models.Tournament.findById(tournament._id)
      .populate('game')
      .populate('teams.users')
      .populate('players.user');
  });

  fastify.post('/:id/teams', { preHandler: [adminGuard] }, async (request, reply) => {
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
  });

  fastify.post('/:id/publish-teams', { preHandler: [adminGuard] }, async (request, reply) => {
    const tournament = await fastify.models.Tournament.findById((request.params as any).id);
    if (!tournament) {
      return reply.notFound();
    }
    const { teamsPublished } = request.body as { teamsPublished: boolean };
    tournament.teamsPublished = teamsPublished;
    await tournament.save();
    return await fastify.models.Tournament.findById((request.params as any).id)
      .populate('game')
      .populate('teams.users')
      .populate('players.user');
  });

  fastify.post('/:id/players', { preHandler: [adminGuard] }, async (request, reply) => {
    const tournament = await fastify.models.Tournament.findById((request.params as any).id) as ITournament;
    if (!tournament) {
      return reply.notFound();
    }
    const { userId } = request.body as { userId: string };
    const lastTournament = await fastify.models.Tournament.findOne({ 'players.user': userId, gameId: tournament.gameId }).sort({ date: -1 }); 
    const lastPlayerParticipation = lastTournament?.players.find((p: ITournamentPlayer) => (p.user as any).toString() === userId);
    tournament.players.push({ user: userId, inWaitlist: false, hasCheckin: false, isMvp: false, registrationDate: new Date(), isCaster: false, mvpVotes: [], tier: lastPlayerParticipation?.tier || 0, description: lastPlayerParticipation?.description || '' } as any);
    await tournament.save();
    return await fastify.models.Tournament.findById((request.params as any).id)
      .populate('game')
      .populate('teams.users')
      .populate('players.user');
  });

  /*********************************************
   * PATCH
  *********************************************/

  fastify.patch('/:id/players/:playerId', { preHandler: [adminGuard] }, async (request, reply) => {
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
  });

  fastify.patch('/:id/teams', { preHandler: [adminGuard] }, async (request, reply) => {
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
  });

  fastify.patch('/:id', { preHandler: [adminGuard] }, async (request, reply) => {
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
  });

  /*********************************************
   * DELETE
  *********************************************/

  fastify.delete('/:id/players/:playerId', { preHandler: [adminGuard] }, async (request, reply) => {
    const tournament = await fastify.models.Tournament.findById((request.params as any).id) as ITournament;
    if (!tournament) {
      return reply.notFound();
    }
    const playerId = (request.params as any).playerId;
    tournament.players = tournament.players.filter(p => (p.id || (p._id as any)).toString() !== playerId);
    await tournament.save();
    return await fastify.models.Tournament.findById((request.params as any).id)
      .populate('game')
      .populate('teams.users')
      .populate('players.user');
  });

  fastify.delete('/:id', { preHandler: [adminGuard] }, async (request, reply) => {
    const tournament = await fastify.models.Tournament.findById((request.params as any).id);
    if (!tournament) {
      return reply.notFound();
    }
    await fastify.models.Tournament.deleteOne({ _id: tournament._id });
    return await fastify.models.Tournament.findById((request.params as any).id)
      .populate('game')
      .populate('teams.users')
      .populate('players.user');
  });
};

export default adminTournamentRoutes;