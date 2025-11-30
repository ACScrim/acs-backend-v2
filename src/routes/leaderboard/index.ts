import {ITeam, ITournament} from "../../models/Tournament";
import {IUser} from "../../models/User";
import {FastifyPluginAsync} from "fastify";
import {log} from "../../utils/utils";

type LeaderboardEntry = {
  ranking: number;
  user: IUser;
  tournamentsCount: number;
  victoriesCount: number;
  top25Count: number;
  points: number;
};

const leaderboardRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Récupère le classement des joueurs basé sur les points gagnés
   * Optionnellement filtré par saison spécifique
   * Points: +3 pour une première place, +1 pour top 25%
   */
  fastify.get('/', async (request, reply) => {
    try {
      const query = request.query as { season?: number };

      const leaderboard: LeaderboardEntry[] = [];
      const seasons = await fastify.models.Season.find().populate({
        path: 'tournaments',
        populate: {
          path: 'teams',
          populate: {
            path: 'users'
          }
        }
      }).populate({
        path: 'tournaments',
        populate: {
          path: 'game'
        }
      })

      seasons.filter(s => query?.season ? s.number == query.season : true).forEach(s => {
        s.tournaments.forEach((tournament: (ITournament & { teams: (ITeam & { users: IUser[] })[] })) => {
          tournament.teams.forEach((team: (ITeam & { users: IUser[] })) => {
            team.users.forEach((user: IUser) => {
              const entry = leaderboard.find(e => e.user === user);
              if (entry) {
                entry.tournamentsCount += 1;
                entry.victoriesCount += team.ranking === 1 ? 1 : 0;
                entry.top25Count += (team.ranking !== 1 && team.ranking <= (tournament.teams.length / 4)) ? 1 : 0;
                entry.points = entry.victoriesCount * 3 + entry.top25Count * 1;
              } else {
                leaderboard.push({
                  ranking: 0,
                  user: user,
                  tournamentsCount: 1,
                  victoriesCount: team.ranking === 1 ? 1 : 0,
                  top25Count: (team.ranking !== 1 && team.ranking <= (tournament.teams.length / 4)) ? 1 : 0,
                  points: team.ranking === 1 ? 3 : (team.ranking !== 1 && team.ranking <= (tournament.teams.length / 4)) ? 1 : 0
                });
              }
            });
          });
        });
      });

      return leaderboard.sort((a, b) => b.points - a.points).map((entry, index) => {
        entry.ranking = index + 1;
        return entry;
      });
    } catch (error) {
      log(fastify, `Erreur lors de la récupération du classement : ${error}`, 'error');
      return reply.status(500).send({ error: 'Erreur lors de la récupération du classement' });
    }
  })
}

export default leaderboardRoutes;