import { FastifyPluginAsync } from "fastify";
import { adminGuard } from "../../../middleware/authGuard";
import { ISeason } from "../../../models/Season";
import { log } from "../../../utils/utils";

const adminSeasonsRoutes: FastifyPluginAsync = async (fastify) => {
  /*********************************************
   * GET
  *********************************************/

  /**
   * Récupère la liste de toutes les saisons avec leurs tournois et gagnant associés
   * Triée par numéro de saison croissant
   */
  fastify.get('/', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      const seasons = await fastify.models.Season.find()
        .populate('tournaments')
        .populate('winner')
        .sort({ number: 1 });
      return seasons;
    } catch (error) {
      log(fastify, `Erreur lors de la récupération de la liste des saisons : ${error}`, 'error');
      return reply.status(500).send({ error: 'Erreur lors de la récupération des saisons' });
    }
  });

  /**
   * Récupère les détails d'une saison spécifique par son ID
   * Inclut les tournois et le gagnant associés
   */
  fastify.get('/:id', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      const season = await fastify.models.Season.findById((request.params as any).id)
        .populate('tournaments')
        .populate('winner');
      if (!season) {
        return reply.notFound();
      }
      return season;
    } catch (error) {
      log(fastify, `Erreur lors de la récupération de la saison ${(request.params as any).id} : ${error}`, 'error');
      return reply.status(500).send({ error: 'Erreur lors de la récupération de la saison' });
    }
  });

  /*********************************************
   * POST
  *********************************************/

  /**
   * Crée une nouvelle saison avec un numéro et une liste de tournois
   * Vérifie que le numéro de saison n'existe pas déjà
   */
  fastify.post('/', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      const seasonData = request.body as {
        number: number;
        tournamentIds: string[];
      };

      // Vérifier si la saison existe déjà
      const existingSeason = await fastify.models.Season.findOne({ number: seasonData.number });
      if (existingSeason) {
        return reply.status(400).send({ error: 'Une saison avec ce numéro existe déjà.' });
      }

      const season = new fastify.models.Season({
        number: seasonData.number,
        tournaments: seasonData.tournamentIds || [],
        winner: null
      });

      await season.save();
      await season.populate(['tournaments', 'winner']);
      return season;
    } catch (error) {
      log(fastify, `Erreur lors de la création de la saison : ${error}`, 'error');
      return reply.status(500).send({ error: 'Erreur lors de la création de la saison' });
    }
  });

  /*********************************************
   * PATCH
  *********************************************/

  /**
   * Met à jour les informations d'une saison (numéro, tournois)
   * Valide l'unicité du numéro de saison avant la mise à jour
   */
  fastify.patch('/:id', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      const season = await fastify.models.Season.findById((request.params as any).id) as ISeason;
      if (!season) {
        return reply.notFound();
      }

      const updateData = request.body as {
        number?: number;
        tournamentIds?: string[];
      };

      // Si le numéro change, vérifier qu'il n'existe pas déjà
      if (updateData.number && updateData.number !== season.number) {
        const existingSeason = await fastify.models.Season.findOne({ number: updateData.number });
        if (existingSeason) {
          return reply.status(400).send({ error: 'Une saison avec ce numéro existe déjà.' });
        }
        season.number = updateData.number;
      }

      if (updateData.tournamentIds !== undefined) {
        season.tournaments = updateData.tournamentIds as any[];
      }

      season.updatedAt = new Date();
      await season.save();
      await season.populate(['tournaments', 'winner']);
      return season;
    } catch (error) {
      log(fastify, `Erreur lors de la mise à jour de la saison ${(request.params as any).id} : ${error}`, 'error');
      return reply.status(500).send({ error: 'Erreur lors de la mise à jour de la saison' });
    }
  });

  /*********************************************
   * DELETE
  *********************************************/

  /**
   * Supprime une saison de la base de données
   */
  fastify.delete('/:id', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      const season = await fastify.models.Season.findById((request.params as any).id);
      if (!season) {
        return reply.notFound();
      }

      await fastify.models.Season.deleteOne({ _id: season._id });
      return { success: true, message: 'Saison supprimée avec succès.' };
    } catch (error) {
      log(fastify, `Erreur lors de la suppression de la saison ${(request.params as any).id} : ${error}`, 'error');
      return reply.status(500).send({ error: 'Erreur lors de la suppression de la saison' });
    }
  });
};

export default adminSeasonsRoutes;