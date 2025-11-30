import {FastifyPluginAsync} from "fastify";
import {adminGuard} from "../../../middleware/authGuard";
import {IGame} from "../../../models/Game";
import {log} from "../../../utils/utils";

const adminGamesRoutes: FastifyPluginAsync = async (fastify) => {
  /*********************************************
   * GET
  *********************************************/

  /**
   * Récupère la liste de tous les jeux triés par date de création décroissante
   */
  fastify.get('/', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      return await fastify.models.Game.find().sort({createdAt: -1});
    } catch (error) {
      log(fastify, `Erreur lors de la récupération de la liste des jeux : ${error}`, 'error');
      return reply.status(500).send({ error: 'Erreur lors de la récupération des jeux' });
    }
  });

  /**
   * Récupère les détails d'un jeu spécifique par son ID
   */
  fastify.get('/:id', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      const game = await fastify.models.Game.findById((request.params as any).id);
      if (!game) {
        return reply.notFound();
      }
      return game;
    } catch (error) {
      log(fastify, `Erreur lors de la récupération du jeu ${(request.params as any).id} : ${error}`, 'error');
      return reply.status(500).send({ error: 'Erreur lors de la récupération du jeu' });
    }
  });

  /*********************************************
   * POST
  *********************************************/

  /**
   * Crée un nouveau jeu avec validation de la regex du profil de joueur
   */
  fastify.post('/', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      const gameData = request.body as {
        name: string;
        rawgId: number;
        imageUrl: string;
        description?: string;
        roles?: Array<{ name: string; color: string }>;
        gameProfileLinkRegex?: string;
      };

      // Vérifier si le jeu existe déjà
      const existingGame = await fastify.models.Game.findOne({ name: gameData.name });
      if (existingGame) {
        return reply.status(400).send({ error: 'Un jeu avec ce nom existe déjà.' });
      }

      // Valider la regex si fournie
      if (gameData.gameProfileLinkRegex) {
        try {
          new RegExp(gameData.gameProfileLinkRegex);
        } catch (error) {
          return reply.status(400).send({ error: 'La regex fournie est invalide.' });
        }
      }

      const game = new fastify.models.Game({
        name: gameData.name,
        description: gameData.description || '',
        imageUrl: gameData.imageUrl,
        roles: gameData.roles || [],
        gameProfileLinkRegex: gameData.gameProfileLinkRegex || '',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await game.save();
      return game;
    } catch (error) {
      log(fastify, `Erreur lors de la création du jeu : ${error}`, 'error');
      return reply.status(500).send({ error: 'Erreur lors de la création du jeu' });
    }
  });

  /*********************************************
   * PATCH
  *********************************************/

  /**
   * Met à jour les informations d'un jeu (rôles, regex profil, regex pseudo)
   * Valide les regex fournis avant de les enregistrer
   */
  fastify.patch('/:id', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      const game = await fastify.models.Game.findById((request.params as any).id) as IGame;
      if (!game) {
        return reply.notFound();
      }

      // Valider la regex si fournie
      if ((request.body as any).gameProfileLinkRegex) {
        try {
          new RegExp((request.body as any).gameProfileLinkRegex);
        } catch (error) {
          return reply.status(400).send({ error: 'La regex "gameProfileLinkRegex" fournie est invalide.' });
        }
      }

      if ((request.body as any).gameUsernameRegex) {
        try {
          new RegExp((request.body as any).gameUsernameRegex);
        } catch (error) {
          return reply.status(400).send({ error: 'La regex "gameUsernameRegex" fournie est invalide.' });
        }
      }

      const updatableFields = ['roles', 'gameProfileLinkRegex', 'gameUsernameRegex'];
      updatableFields.forEach(field => {
        if ((request.body as any)[field] !== undefined) {
          (game as any)[field] = (request.body as any)[field];
        }
      });

      game.updatedAt = new Date();
      await game.save();
      return game;
    } catch (error) {
      log(fastify, `Erreur lors de la mise à jour du jeu ${(request.params as any).id} : ${error}`, 'error');
      return reply.status(500).send({ error: 'Erreur lors de la mise à jour du jeu' });
    }
  });

  /*********************************************
   * DELETE
  *********************************************/

  /**
   * Supprime un jeu après vérification qu'il n'est pas utilisé dans des tournois
   */
  fastify.delete('/:id', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      const game = await fastify.models.Game.findById((request.params as any).id);
      if (!game) {
        return reply.notFound();
      }

      // Vérifier si le jeu est utilisé dans des tournois
      const tournamentsUsingGame = await fastify.models.Tournament.countDocuments({ gameId: game._id });
      if (tournamentsUsingGame > 0) {
        return reply.status(400).send({
          error: `Ce jeu est utilisé dans ${tournamentsUsingGame} tournoi(s). Impossible de le supprimer.`
        });
      }

      await fastify.models.Game.deleteOne({ _id: game._id });
      return { success: true, message: 'Jeu supprimé avec succès.' };
    } catch (error) {
      log(fastify, `Erreur lors de la suppression du jeu ${(request.params as any).id} : ${error}`, 'error');
      return reply.status(500).send({ error: 'Erreur lors de la suppression du jeu' });
    }
  });
};

export default adminGamesRoutes;