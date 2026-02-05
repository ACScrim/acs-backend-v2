import { FastifyPluginAsync } from "fastify";
import { adminGuard } from "../../../middleware/authGuard";
import { log, AppError } from "../../../utils/utils";
import { IInactivePlayerList, IInactivePlayerListUser } from "../../../models/InactivePlayerList";
import { ITournament } from "../../../models/Tournament";

const inactivePlayersRoutes: FastifyPluginAsync = async (fastify) => {
  // Récupérer toutes les listes
  fastify.get('/', { preHandler: [adminGuard] }, async () => {
    try {
      return await fastify.models.InactivePlayerList.find()
        .populate('game', 'name imageUrl')
        .sort({ createdAt: -1 });
    } catch (error) {
      log(fastify, `Erreur lors de la récupération des listes de joueurs inactifs: ${error}`, 'error');
      throw new AppError(500, 'Erreur lors de la récupération des listes');
    }
  });

  // Récupérer une liste spécifique
  fastify.get('/:id', { preHandler: [adminGuard] }, async (request) => {
    try {
      const { id } = request.params as { id: string };
      const list = await fastify.models.InactivePlayerList.findById(id)
        .populate('game', 'name imageUrl');

      if (!list) {
        throw new AppError(404, 'Liste introuvable');
      }

      return list;
    } catch (error) {
      log(fastify, `Erreur lors de la récupération de la liste: ${error}`, 'error');
      throw error;
    }
  });

  // Analyser les joueurs inactifs et créer des listes
  fastify.post('/analyze', { preHandler: [adminGuard] }, async (request) => {
    try {
      const { inactivityMonths = 3, batchSize = 5, gameId } = request.body as {
        inactivityMonths?: number;
        batchSize?: number;
        gameId?: string;
      };

      // Date limite (il y a X mois)
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - inactivityMonths);

      // Récupérer tous les utilisateurs
      const allUsers = await fastify.models.User.find({ discordId: { $exists: true, $ne: null } });

      // Récupérer tous les tournois récents (tous les jeux confondus)
      const recentTournaments = await fastify.models.Tournament.find({
        date: { $gte: cutoffDate }
      }).select('players date gameId');

      // Créer un Set des IDs des utilisateurs actifs (ayant joué récemment, tous jeux confondus)
      const activeUserIds = new Set<string>();
      recentTournaments.forEach((tournament: ITournament) => {
        tournament.players.forEach((player) => {
          activeUserIds.add(player.user.toString());
        });
      });

      // Récupérer toutes les listes non archivées (pending ou sent)
      const existingListsQuery: any = { status: { $in: ['pending', 'sent'] } };
      if (gameId) {
        existingListsQuery.gameId = gameId;
      }
      const existingLists = await fastify.models.InactivePlayerList.find(existingListsQuery);

      // Créer un Set des IDs des utilisateurs déjà dans des listes actives
      const usersInActiveLists = new Set<string>();
      existingLists.forEach((list) => {
        list.users.forEach((user: any) => {
          usersInActiveLists.add(user.userId.toString());
        });
      });

      // Trouver les joueurs inactifs
      const inactiveUsers: IInactivePlayerListUser[] = [];
      for (const user of allUsers) {
        const userId = user._id.toString();

        // Ignorer si l'utilisateur est actif OU déjà dans une liste active
        if (!activeUserIds.has(userId) && !usersInActiveLists.has(userId)) {
          // Si un jeu est spécifié, vérifier si l'utilisateur a déjà joué à ce jeu
          if (gameId) {
            const hasPlayedGame = await fastify.models.Tournament.findOne({
              'players.user': user._id,
              gameId: gameId
            });

            // Si l'utilisateur n'a jamais joué à ce jeu, on l'ignore
            if (!hasPlayedGame) {
              continue;
            }
          }

          // Trouver le dernier tournoi du joueur (tous jeux confondus)
          const lastTournament = await fastify.models.Tournament.findOne({
            'players.user': user._id
          }).sort({ date: -1 }).select('date');

          inactiveUsers.push({
            userId: user._id,
            username: user.username,
            discordId: user.discordId,
            lastTournamentDate: lastTournament?.date,
            messageSent: false
          });
        }
      }

      if (inactiveUsers.length === 0) {
        return { success: true, message: 'Aucun joueur inactif trouvé', lists: [] };
      }

      // Récupérer le nom du jeu si un gameId est fourni
      let gameName = '';
      if (gameId) {
        const game = await fastify.models.Game.findById(gameId);
        gameName = game ? ` - ${game.name}` : '';
      }

      // Diviser en groupes (batches)
      const lists: IInactivePlayerList[] = [];
      for (let i = 0; i < inactiveUsers.length; i += batchSize) {
        const batch = inactiveUsers.slice(i, i + batchSize);
        const listNumber = Math.floor(i / batchSize) + 1;

        const newList = new fastify.models.InactivePlayerList({
          name: `Joueurs inactifs${gameName} - Lot ${listNumber} (${new Date().toLocaleDateString('fr-FR')})`,
          batchSize,
          users: batch,
          status: 'pending',
          gameId: gameId || undefined
        });

        await newList.save();
        lists.push(newList);
      }

      log(fastify, `${inactiveUsers.length} joueurs inactifs trouvés${gameName}, ${lists.length} listes créées`, 'info');

      return {
        success: true,
        inactiveCount: inactiveUsers.length,
        listsCreated: lists.length,
        lists
      };
    } catch (error) {
      log(fastify, `Erreur lors de l'analyse des joueurs inactifs: ${error}`, 'error');
      throw new AppError(500, 'Erreur lors de l\'analyse');
    }
  });

  // Ajouter un utilisateur à une liste
  fastify.post('/:id/users', { preHandler: [adminGuard] }, async (request) => {
    try {
      const { id } = request.params as { id: string };
      const { userId } = request.body as { userId: string };

      const list = await fastify.models.InactivePlayerList.findById(id);
      if (!list) {
        throw new AppError(404, 'Liste introuvable');
      }

      const user = await fastify.models.User.findById(userId);
      if (!user) {
        throw new AppError(404, 'Utilisateur introuvable');
      }

      // Vérifier si l'utilisateur est déjà dans la liste
      const exists = list.users.some((u: any) => u.userId.toString() === userId);
      if (exists) {
        throw new AppError(400, 'Utilisateur déjà dans cette liste');
      }

      // Vérifier si l'utilisateur est déjà dans une autre liste non archivée
      const otherActiveLists = await fastify.models.InactivePlayerList.findOne({
        _id: { $ne: id },
        status: { $in: ['pending', 'sent'] },
        'users.userId': userId
      });

      if (otherActiveLists) {
        throw new AppError(400, 'Cet utilisateur est déjà dans une autre liste active. Veuillez archiver ou traiter l\'autre liste d\'abord.');
      }

      // Trouver le dernier tournoi du joueur
      const lastTournament = await fastify.models.Tournament.findOne({
        'players.user': userId
      }).sort({ date: -1 }).select('date');

      list.users.push({
        userId: user._id,
        username: user.username,
        discordId: user.discordId,
        lastTournamentDate: lastTournament?.date,
        messageSent: false
      });

      await list.save();
      return list;
    } catch (error) {
      log(fastify, `Erreur lors de l'ajout d'un utilisateur: ${error}`, 'error');
      throw error;
    }
  });

  // Supprimer un utilisateur d'une liste
  fastify.delete('/:id/users/:userId', { preHandler: [adminGuard] }, async (request) => {
    try {
      const { id, userId } = request.params as { id: string; userId: string };

      const list = await fastify.models.InactivePlayerList.findById(id);
      if (!list) {
        throw new AppError(404, 'Liste introuvable');
      }

      list.users = list.users.filter((u: any) => u.userId.toString() !== userId);
      await list.save();

      return list;
    } catch (error) {
      log(fastify, `Erreur lors de la suppression d'un utilisateur: ${error}`, 'error');
      throw error;
    }
  });

  // Envoyer un message à tous les utilisateurs d'une liste
  fastify.post('/:id/send', { preHandler: [adminGuard] }, async (request) => {
    try {
      const { id } = request.params as { id: string };
      const { messageContent, messageType = 'text' } = request.body as {
        messageContent?: string;
        messageType?: 'text' | 'embed';
      };

      const list = await fastify.models.InactivePlayerList.findById(id);
      if (!list) {
        throw new AppError(404, 'Liste introuvable');
      }

      if (!messageContent && messageType === 'text') {
        throw new AppError(400, 'Le contenu du message est requis');
      }

      // Stocker le message dans la liste
      list.messageContent = messageContent;

      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[]
      };

      // Envoyer le message à chaque utilisateur
      for (const user of list.users) {
        if (!user.discordId) {
          results.failed++;
          results.errors.push(`${user.username}: pas de Discord ID`);
          continue;
        }

        try {
          // Limiter le débit pour éviter les limites Discord
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 seconde entre chaque message

          await fastify.discordService.sendAdminMessage({
            targetType: 'dm',
            discordUserId: user.discordId,
            messageType: messageType,
            content: messageContent
          });

          user.messageSent = true;
          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push(`${user.username}: ${error.message}`);
          log(fastify, `Erreur envoi message à ${user.username}: ${error}`, 'error');
        }
      }

      list.status = 'sent';
      await list.save();

      log(fastify, `Messages envoyés: ${results.success} succès, ${results.failed} échecs`, 'info');

      return {
        success: true,
        results
      };
    } catch (error) {
      log(fastify, `Erreur lors de l'envoi des messages: ${error}`, 'error');
      throw error;
    }
  });

  // Mettre à jour une liste
  fastify.patch('/:id', { preHandler: [adminGuard] }, async (request) => {
    try {
      const { id } = request.params as { id: string };
      const { name, status, messageContent } = request.body as {
        name?: string;
        status?: 'pending' | 'sent' | 'archived';
        messageContent?: string;
      };

      const list = await fastify.models.InactivePlayerList.findById(id);
      if (!list) {
        throw new AppError(404, 'Liste introuvable');
      }

      if (name !== undefined) list.name = name;
      if (status !== undefined) list.status = status;
      if (messageContent !== undefined) list.messageContent = messageContent;

      await list.save();
      return list;
    } catch (error) {
      log(fastify, `Erreur lors de la mise à jour de la liste: ${error}`, 'error');
      throw error;
    }
  });

  // Supprimer une liste
  fastify.delete('/:id', { preHandler: [adminGuard] }, async (request) => {
    try {
      const { id } = request.params as { id: string };

      const list = await fastify.models.InactivePlayerList.findByIdAndDelete(id);
      if (!list) {
        throw new AppError(404, 'Liste introuvable');
      }

      return { success: true, message: 'Liste supprimée' };
    } catch (error) {
      log(fastify, `Erreur lors de la suppression de la liste: ${error}`, 'error');
      throw error;
    }
  });
};

export default inactivePlayersRoutes;
