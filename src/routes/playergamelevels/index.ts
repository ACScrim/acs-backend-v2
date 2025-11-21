import { FastifyPluginAsync } from "fastify";
import { authGuard } from "../../middleware/authGuard";
import { log } from "../../utils/utils";

const playerGameLevelsRoutes: FastifyPluginAsync = async (fastify) => {

  /**
   * Récupère la liste des niveaux de jeu de l'utilisateur connecté
   */
  fastify.get("/", { preHandler: [authGuard] }, async (req, res) => {
    try {
      const playerGameLevels = await fastify.models.PlayerGameLevel.find({
        userId: req.session.userId!
      }).populate('game');
      return playerGameLevels;
    } catch (error) {
      log(fastify, `Erreur lors de la récupération des niveaux de jeu : ${error}`, 'error');
      return res.status(500).send({ error: 'Erreur lors de la récupération des niveaux' });
    }
  });

  /**
   * Valide le lien profil contre la regex du jeu
   */
  const validateProfileLink = (gameProfileLink: string, gameProfileLinkRegex: string): boolean => {
    if (!gameProfileLinkRegex) {
      // Si pas de regex, le lien n'est pas obligatoire
      return true;
    }

    if (!gameProfileLink) {
      // Si regex existe, le lien devient obligatoire
      return false;
    }

    try {
      // Vérifier que c'est une URL valide
      new URL(gameProfileLink);

      // Valider contre la regex
      const regex = new RegExp(gameProfileLinkRegex);
      return regex.test(gameProfileLink);
    } catch {
      return false;
    }
  };

  /**
   * Valide le pseudo du joueur
   */
  const validateGameUsername = (gameUsername?: string, gameUsernameRegex?: string): boolean => {
    if (!gameUsernameRegex) {
      // Si pas de regex, le pseudo n'est pas obligatoire
      return true;
    }

    if (!gameUsername) {
      // Si regex existe, le pseudo devient obligatoire
      return false;
    }

    try {
      // Valider contre la regex
      const regex = new RegExp(gameUsernameRegex);
      return regex.test(gameUsername);
    } catch {
      return false;
    }
  };

  /**
   * Crée ou met à jour le niveau de jeu d'un joueur
   * Valide le lien profil et le pseudo contre les regex du jeu
   */
  fastify.post("/set-level", { preHandler: [authGuard] }, async (req, res) => {
    try {
      const body = req.body as { gameId: string; level: string, gameUsername?: string, isRanked?: boolean, rank?: string, comment?: string, selectedRoles?: string[], gameProfileLink?: string };

      // Récupérer le jeu pour vérifier la regex
      const game = await fastify.models.Game.findById(body.gameId);
      if (!game) {
        return res.status(404).send({ error: 'Jeu non trouvé.' });
      }

      // Valider le lien profil si regex existe
      if (!validateProfileLink(body.gameProfileLink || '', game.gameProfileLinkRegex || '')) {
        return res.status(400).send({
          error: 'Le lien profil est invalide ou ne respecte pas le format requis pour ce jeu.',
          details: game.gameProfileLinkRegex ? `Format regex: ${game.gameProfileLinkRegex}` : undefined
        });
      }

      if (!validateGameUsername(body.gameUsername, game.gameUsernameRegex)) {
        return res.status(400).send({
          error: 'Le pseudo en jeu est invalide ou ne respecte pas le format requis pour ce jeu.',
          details: game.gameUsernameRegex ? `Format regex: ${game.gameUsernameRegex}` : undefined
        });
      }

      let playerGameLevel = await fastify.models.PlayerGameLevel.findOne({
        userId: req.session.userId!,
        gameId: body.gameId
      });

      if (!playerGameLevel) {
        playerGameLevel = new fastify.models.PlayerGameLevel({
          userId: req.session.userId!,
          gameId: body.gameId,
          level: body.level,
          gameUsername: body.gameUsername || "",
          isRanked: body.isRanked || false,
          rank: body.rank || "",
          comment: body.comment || "",
          selectedRoles: body.selectedRoles || [],
          gameProfileLink: body.gameProfileLink || ""
        });
      } else {
        playerGameLevel.level = body.level;
        playerGameLevel.gameUsername = body.gameUsername || "";
        playerGameLevel.isRanked = body.isRanked || false;
        playerGameLevel.rank = body.rank || "";
        playerGameLevel.comment = body.comment || "";
        playerGameLevel.selectedRoles = body.selectedRoles || [];
        playerGameLevel.gameProfileLink = body.gameProfileLink || "";
      }
      await playerGameLevel.save();

      return playerGameLevel;
    } catch (error) {
      log(fastify, `Erreur lors de la mise à jour du niveau de jeu : ${error}`, 'error');
      return res.status(500).send({ error: 'Erreur lors de la mise à jour du niveau' });
    }
  });

  /**
   * Supprime un niveau de jeu spécifique de l'utilisateur
   */
  fastify.delete('/:levelId', { preHandler: [authGuard] }, async (req, res) => {
    try {
      const { levelId } = req.params as { levelId: string };
      const playerGameLevel = await fastify.models.PlayerGameLevel.findOne({
        _id: levelId,
        userId: req.session.userId!
      });

      if (!playerGameLevel) {
        return res.status(404).send({ error: 'Niveau de jeu introuvable.' });
      }

      await playerGameLevel.deleteOne();
      return { success: true };
    } catch (error) {
      log(fastify, `Erreur lors de la suppression du niveau de jeu : ${error}`, 'error');
      return res.status(500).send({ error: 'Erreur lors de la suppression du niveau' });
    }
  });
}

export default playerGameLevelsRoutes;

