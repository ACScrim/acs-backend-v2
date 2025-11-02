import { FastifyPluginAsync } from "fastify";
import { authGuard } from "../../middleware/authGuard";

const playerGameLevelsRoutes: FastifyPluginAsync = async (fastify) => {

  fastify.get("/", { preHandler: [authGuard] }, async (req, res) => {
    const playerGameLevels = await fastify.models.PlayerGameLevel.find({
      userId: req.session.userId!
    }).populate('game');
    return playerGameLevels;
  });

  fastify.post("/set-level", { preHandler: [authGuard] }, async (req, res) => {
    const body = req.body as { gameId: string; level: string, gameUsername?: string, isRanked?: boolean, rank?: string, comment?: string, selectedRoles?: string[] };
  
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
        selectedRoles: body.selectedRoles || []
      });
    } else {
      playerGameLevel.level = body.level;
      playerGameLevel.gameUsername = body.gameUsername || "";
      playerGameLevel.isRanked = body.isRanked || false;
      playerGameLevel.rank = body.rank || "";
      playerGameLevel.comment = body.comment || "";
      playerGameLevel.selectedRoles = body.selectedRoles || [];
    }
    await playerGameLevel.save();

    return playerGameLevel;
  });
}

export default playerGameLevelsRoutes;