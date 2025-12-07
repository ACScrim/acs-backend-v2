import {FastifyPluginAsync} from "fastify";
import {authGuard} from "../../middleware/authGuard";

const cardCollectionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/me', { preHandler: [authGuard] }, async (req, resp) => {
    const userId = req.session.userId;
    let collection = await fastify.models.CardCollection.findOne({ userId });
    if (!collection) {
      collection = await fastify.models.CardCollection.create({ userId, cards: [] });
    }

    const mapCardsCount = collection.cards.reduce((acc: Record<string, number>, cardId: string) => {
      acc[cardId] = (acc[cardId] || 0) + 1;
      return acc;
    }, {});
    const cards = [];
    for (const cardId in mapCardsCount) {
      const card = await fastify.models.Card.findById(cardId);
      if (!card) continue;
      cards.push({ id: cardId, previewCardB64: card.previewCardB64, count: mapCardsCount[cardId] });
    }
    return {
      id: collection._id,
      cards,
      userId: collection.userId
    };
  });

  fastify.get('/:id/cards/:cardId', { preHandler: [authGuard] }, async (req, resp) => {
    const { id, cardId } = req.params as { id: string; cardId: string };
    const collection = await fastify.models.CardCollection.findById(id);
    if (!collection) {
      resp.status(404);
      return { error: 'Collection not found' };
    }
    const card = await fastify.models.Card.findById(cardId);
    if (!card) {
      resp.status(404);
      return { error: 'Card not found' };
    }
    if (!collection.cards.includes(card._id)) {
      resp.status(403);
      return { error: 'Card does not belong to this collection' };
    }
    await card.populate('frontAsset borderAsset');
    return card;
  })
}

export default cardCollectionRoutes;