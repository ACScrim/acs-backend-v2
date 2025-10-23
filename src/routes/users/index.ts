import { FastifyPluginAsync } from "fastify";
import { authGuard } from "../../middleware/authGuard";
import { IUser } from "@models/User";
import { ITournament } from "@models/Tournament";
import { IGame } from "@models/Game";
import { ISeason } from "@models/Season";

const usersRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (req, res) => {
    return fastify.models.User.find();
  })

  fastify.get("/me", { preHandler: [authGuard] }, async (req, res) => {
    const userId = req.session.userId as string;
    const user = await fastify.models.User.findById(userId);
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }
    return user;
  })

  fastify.get('/profile/:id', { preHandler: [authGuard] }, async (req, res) => {
    const userId = (req.params as { id: string }).id;
    const currentUserId = req.session.userId as string;

    const user = await fastify.models.User.findById(userId) as IUser;
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    const tournamentHistory = await fastify.models.Tournament.find({
      'players.user': userId
    }).sort({ date: -1 }).populate('game', 'id name imageUrl').populate({
      path: 'players.user',
      select: 'username avatarUrl'
    }) as (ITournament & { game: IGame })[];

    const seasons = await fastify.models.Season.find({ number: { $gt: 0 } }) as ISeason[];
    const filteredTournamentHistory = tournamentHistory.filter(tournament => {
      return seasons.find(season => season.tournaments.includes(tournament._id as any));
    });

    const finalResponse = {
      ...user.toJSON(),
      tournamentHistory,
      lastActivity: filteredTournamentHistory.find(t => t.finished)?.date,
      tournamentStats: {
        firstPlaceCount: filteredTournamentHistory.filter(t => t.teams.find(team => team.ranking === 1 && team.users.includes(userId as any))).length,
        secondPlaceCount: filteredTournamentHistory.filter(t => t.teams.find(team => team.ranking === 2 && team.users.includes(userId as any))).length,
        thirdPlaceCount: filteredTournamentHistory.filter(t => t.teams.find(team => team.ranking === 3 && team.users.includes(userId as any))).length,
        top25Count: filteredTournamentHistory.filter(t => t.teams.find(team => team.ranking !== 1 && team.ranking <= (t.teams.length / 4) && team.users.includes(userId as any))).length,
        tournamentsCount: filteredTournamentHistory.length
      },
      perGameStats: filteredTournamentHistory.reduce((acc, tournament) => {
        const game = tournament.game as IGame;
        let gameStat = acc.find(gs => gs.game.id === game.id);
        if (!gameStat) {
          gameStat = {
            id: game.id,
            game,
            tournamentsCount: 0,
            victoriesCount: 0
          };
          acc.push(gameStat);
        }

        gameStat.tournamentsCount++;
        if (tournament.teams.find(t => t.users.includes(userId as any))?.ranking === 1) {
          gameStat.victoriesCount++;
        }

        return acc;
      }, [] as { id: string, game: IGame; tournamentsCount: number; victoriesCount: number }[])
    }

    return finalResponse;
  });
};

export default usersRoute;