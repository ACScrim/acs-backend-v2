import {FastifyPluginAsync} from "fastify";
import {authGuard} from "../../middleware/authGuard";

const cardCollectionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/me', { preHandler: [authGuard] }, async (req, resp) => {
    const userId = req.session.userId;
    let collection = await fastify.models.CardCollection.findOne({ userId });
    if (!collection) {
      collection = await fastify.models.CardCollection.create({ userId, cards: [] });
    }
    await collection.populate({ path: 'cards', populate: [{ path: 'frontAsset' }, { path: 'borderAsset' } ]});
    return collection;
  })
}

export default cardCollectionRoutes;