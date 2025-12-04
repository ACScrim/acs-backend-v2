import {FastifyPluginAsync} from "fastify";
import {adminGuard} from "../../../middleware/authGuard";

const cardsAdminRoutes: FastifyPluginAsync = async (fastify) => {

  fastify.get('/', { preHandler: [adminGuard] }, async (req, resp) => {
    const cards = await fastify.models.Card.find().populate('frontAsset borderAsset createdBy');

    return cards;
  });

}

export default cardsAdminRoutes;