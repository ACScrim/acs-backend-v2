import { FastifyPluginAsync } from "fastify";
import { authGuard } from "../../middleware/authGuard";
import { ITournament } from "../../models/Tournament";
import { IGame } from "../../models/Game";
import { log } from "../../utils/utils";

const badgesRoute: FastifyPluginAsync = async (fastify) => {
  /**
   * Récupère tous les badges de l'utilisateur connecté
   * Un badge est créé basé sur le ranking de l'équipe dans un tournoi
   */
  fastify.get("/", { preHandler: [authGuard] }, async (req, res) => {
    try {
      const userId = req.session.userId as string;

      // Récupère tous les tournois terminés
      const tournaments = await fastify.models.Tournament.find({ finished: true })
        .populate('game')
        .populate('teams.users') as (ITournament & { game: IGame })[];

      // Génère les badges basés sur les tournois et le ranking
      const badges = tournaments
        .filter(t => {
          // Vérifier que l'utilisateur est dans ce tournoi
          const userTeam = t.teams.find(team =>
            team.users.some((u: any) => u._id.toString() === userId)
          );
          return userTeam !== undefined;
        })
        .map(t => {
          const userTeam = t.teams.find(team =>
            team.users.some((u: any) => u._id.toString() === userId)
          );

          // Déterminer le type de badge basé sur le ranking
          let type: 'victory' | 'top25' | 'participation' | 'mvp' = 'participation';
          if (userTeam?.ranking === 1) {
            type = 'victory';
          } else if (userTeam && (userTeam.ranking ?? 999) <= Math.ceil(t.teams.length * 0.25)) {
            type = 'top25';
          }

          return {
            id: `${t.id}-${userId}`,
            tournamentId: t.id.toString(),
            tournament: t,
            type,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt
          };
        });

      // Trier par date décroissante
      badges.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return badges;
    } catch (error) {
      log(fastify, `Erreur lors de la récupération des badges : ${error}`, 'error');
      return res.status(500).send({ success: false, error: 'Erreur lors de la récupération des badges' });
    }
  });
};

export default badgesRoute;

