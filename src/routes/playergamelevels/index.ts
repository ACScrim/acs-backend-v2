import { FastifyPluginAsync } from "fastify";
import { authGuard } from "../../middleware/authGuard";

const playerGameLevelsRoutes: FastifyPluginAsync = async (fastify) => {

  fastify.get("/", { preHandler: [authGuard] }, async (req, res) => {
    const playerGameLevels = await fastify.models.PlayerGameLevel.find({
      userId: req.session.userId!
    }).populate('game');
    return playerGameLevels;
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

  fastify.post("/set-level", { preHandler: [authGuard] }, async (req, res) => {
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
  });
}

export default playerGameLevelsRoutes;