import {FastifyPluginAsync} from "fastify";
import {authGuard} from "../../middleware/authGuard";
import {IUser} from "../../models/User";
import {ITournament} from "../../models/Tournament";
import {IGame} from "../../models/Game";
import {ISeason} from "../../models/Season";
import {log} from "../../utils/utils";

const usersRoute: FastifyPluginAsync = async (fastify) => {
  /**
   * Récupère la liste de tous les utilisateurs
   */
  fastify.get("/", async (req, res) => {
    try {
      return fastify.models.User.find();
    } catch (error) {
      log(fastify, `Erreur lors de la récupération de la liste des utilisateurs : ${error}`, 'error');
      return res.status(500).send({ error: 'Erreur lors de la récupération des utilisateurs' });
    }
  })

  /**
   * Récupère les informations de l'utilisateur connecté
   */
  fastify.get("/me", { preHandler: [authGuard] }, async (req, res) => {
    try {
      const userId = req.session.userId as string;
      const user = await fastify.models.User.findById(userId);
      // @ts-ignore
      const scrimium = await fastify.models.Scrimium.findOrCreateByUserId(userId);
      if (!user) {
        return res.status(404).send({ error: "User not found" });
      }
      user.set('scrimium', scrimium);
      return user;
    } catch (error) {
      log(fastify, `Erreur lors de la récupération du profil utilisateur : ${error}`, 'error');
      return res.status(500).send({ error: 'Erreur lors de la récupération du profil' });
    }
  })

  /**
   * Récupère le profil public d'un utilisateur avec son historique de tournois et statistiques
   */
  fastify.get('/profile/:id', { preHandler: [authGuard] }, async (req, res) => {
    try {
      const userId = (req.params as { id: string }).id;
      const currentUserId = req.session.userId as string;

      const user = await fastify.models.User.findById(userId) as IUser;
      if (!user) {
        return res.status(404).send({ error: "User not found" });
      }

      if (userId === currentUserId) {
        // @ts-ignore
        const scrimium = await fastify.models.Scrimium.findOrCreateByUserId(currentUserId);
        if (!user) {
          return res.status(404).send({ error: "User not found" });
        }
        user.set('scrimium', scrimium)
      }

      const tournamentHistory = await fastify.models.Tournament.find({
        'players.user': userId,
        'finished': true
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
    } catch (error) {
      log(fastify, `Erreur lors de la récupération du profil utilisateur ${(req.params as any).id} : ${error}`, 'error');
      return res.status(500).send({ error: 'Erreur lors de la récupération du profil' });
    }
  });

  fastify.patch(`/me/twitch`, { preHandler: [authGuard] }, async (req, res) => {
    try {
      const currentUserId = req.session.userId as string;

      const { twitchUsername } = req.body as { twitchUsername: string };

      const user = await fastify.models.User.findById(currentUserId) as IUser;
      if (!user) {
        return res.status(404).send({ error: "User not found" });
      }

      if (twitchUsername && twitchUsername.trim().length > 0) {
        await fastify.twitchService.addOneTwitchEventSubscription(twitchUsername, currentUserId, user.twitchSubscriptionId)
        user.twitchUsername = twitchUsername;
      } else {
        if (user.twitchSubscriptionId)
          await fastify.twitchService.deleteOneEventSubSubscription(user.twitchSubscriptionId);
        user.twitchUsername = undefined;
        user.twitchSubscriptionId = undefined;
      }
      await user.save();

      // @ts-ignore
      const scrimium = await fastify.models.Scrimium.findOrCreateByUserId(currentUserId);
      if (!user) {
        return res.status(404).send({ error: "User not found" });
      }
      user.set('scrimium', scrimium)

      return user;
    } catch (error) {
      log(fastify, `Erreur lors de la mise à jour du Twitch de l'utilisateur ${(req.params as any).id} : ${error}`, 'error');
      return res.status(500).send({ error: 'Erreur lors de la mise à jour du Twitch' });
    }
  })
};

export default usersRoute;

