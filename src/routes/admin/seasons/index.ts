import { FastifyPluginAsync } from "fastify";
import { adminGuard } from "../../../middleware/authGuard";
import { ISeason } from "@models/Season";

const adminSeasonsRoutes: FastifyPluginAsync = async (fastify) => {
  /*********************************************
   * GET
  *********************************************/
  fastify.get('/', { preHandler: [adminGuard] }, async (request, reply) => {
    const seasons = await fastify.models.Season.find()
      .populate('tournaments')
      .populate('winner')
      .sort({ number: 1 });
    return seasons;
  });

  fastify.get('/:id', { preHandler: [adminGuard] }, async (request, reply) => {
    const season = await fastify.models.Season.findById((request.params as any).id)
      .populate('tournaments')
      .populate('winner');
    if (!season) {
      return reply.notFound();
    }
    return season;
  });

  /*********************************************
   * POST
  *********************************************/
  fastify.post('/', { preHandler: [adminGuard] }, async (request, reply) => {
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
  });

  /*********************************************
   * PATCH
  *********************************************/
  fastify.patch('/:id', { preHandler: [adminGuard] }, async (request, reply) => {
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
  });

  /*********************************************
   * DELETE
  *********************************************/
  fastify.delete('/:id', { preHandler: [adminGuard] }, async (request, reply) => {
    const season = await fastify.models.Season.findById((request.params as any).id);
    if (!season) {
      return reply.notFound();
    }

    await fastify.models.Season.deleteOne({ _id: season._id });
    return { success: true, message: 'Saison supprimée avec succès.' };
  });
};

export default adminSeasonsRoutes;
