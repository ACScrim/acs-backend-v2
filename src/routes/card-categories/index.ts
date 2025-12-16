import { FastifyInstance } from 'fastify';
import { authGuard } from '../../middleware/authGuard';
import type { ICardCategory } from '../../models/CardCategory';

export default async function cardCategoryRoutes(fastify: FastifyInstance) {
  // Créer une nouvelle catégorie
  fastify.post<{ Body: { name: string; description?: string } }>('/', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const userId = request.session.userId;
      if (!userId) {
        return reply.status(401).send({ error: 'Non authentifié' });
      }

      const { name, description } = request.body;

      if (!name || name.trim().length === 0) {
        return reply.status(400).send({ error: 'Le nom de la catégorie est requis' });
      }

      const category = await fastify.models.CardCategory.create({
        name: name.trim(),
        description: description?.trim() || undefined,
        createdBy: userId,
      });

      return category;
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Erreur lors de la création de la catégorie' });
    }
  });

  // Récupérer toutes les catégories de l'utilisateur
  fastify.get('/', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const userId = request.session.userId;
      if (!userId) {
        return reply.status(401).send({ error: 'Non authentifié' });
      }

      const categories = await fastify.models.CardCategory.find({ createdBy: userId })
        .sort({ createdAt: -1 });

      return categories;
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Erreur lors de la récupération des catégories' });
    }
  });

  // Récupérer une catégorie par ID
  fastify.get<{ Params: { id: string } }>('/:id', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const userId = request.session.userId;
      if (!userId) {
        return reply.status(401).send({ error: 'Non authentifié' });
      }

      const { id } = request.params;

      const category = await fastify.models.CardCategory.findOne({
        _id: id,
        createdBy: userId,
      });

      if (!category) {
        return reply.status(404).send({ error: 'Catégorie non trouvée' });
      }

      return category;
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Erreur lors de la récupération de la catégorie' });
    }
  });

  // Mettre à jour une catégorie
  fastify.put<{ Params: { id: string }; Body: { name?: string; description?: string } }>(
    '/:id',
    { preHandler: [authGuard] },
    async (request, reply) => {
      try {
        const userId = request.session.userId;
        if (!userId) {
          return reply.status(401).send({ error: 'Non authentifié' });
        }

        const { id } = request.params;
        const { name, description } = request.body;

        const category = await fastify.models.CardCategory.findOne({
          _id: id,
          createdBy: userId,
        });

        if (!category) {
          return reply.status(404).send({ error: 'Catégorie non trouvée' });
        }

        if (name !== undefined) {
          category.name = name.trim();
        }
        if (description !== undefined) {
          category.description = description.trim() || undefined;
        }

        await category.save();

        return category;
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Erreur lors de la mise à jour de la catégorie' });
      }
    }
  );

  // Supprimer une catégorie
  fastify.delete<{ Params: { id: string } }>('/:id', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const userId = request.session.userId;
      if (!userId) {
        return reply.status(401).send({ error: 'Non authentifié' });
      }

      const { id } = request.params;

      const category = await fastify.models.CardCategory.findOneAndDelete({
        _id: id,
        createdBy: userId,
      });

      if (!category) {
        return reply.status(404).send({ error: 'Catégorie non trouvée' });
      }

      // Dissocier la catégorie de toutes les cartes
      await fastify.models.Card.updateMany(
        { categoryId: id },
        { $unset: { categoryId: 1 } }
      );

      return reply.send({ message: 'Catégorie supprimée' });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Erreur lors de la suppression de la catégorie' });
    }
  });
}

