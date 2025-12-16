import {FastifyPluginAsync} from "fastify";
import {authGuard} from "../../middleware/authGuard";
import {ICard} from "../../models/Card";
import {ICardCollection} from "../../models/ICardCollection";

const cardCollectionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/me', { preHandler: [authGuard] }, async (req, resp) => {
    const userId = req.session.userId;
    let collection = await fastify.models.CardCollection.findOne({ userId });
    if (!collection) {
      collection = await fastify.models.CardCollection.create({ userId, cards: [] });
    }

    const cards = [];
    for (const cardId of collection.cards) {
      const card = await fastify.models.Card.findById(cardId.toString());
      if (!card) continue;
      cards.push(card.id);
    }
    return {
      id: collection._id,
      cardIds: cards,
      cards: [],
      userId: collection.userId
    };
  });

  fastify.get('/:id/cards/:cardId', { preHandler: [authGuard] }, async (req, resp) => {
    const { id, cardId } = req.params as { id: string; cardId: string };
    const collection = await fastify.models.CardCollection.findById(id) as ICardCollection;
    if (!collection) {
      resp.status(404);
      return { error: 'Collection not found' };
    }
    const card = await fastify.models.Card.findById(cardId) as ICard;
    const count = collection.cards.filter(card => card.toString() === cardId).length;
    if (!card) {
      resp.status(404);
      return { error: 'Card not found' };
    }
    if (!collection.cards.includes(card.id.toString())) {
      resp.status(403);
      return { error: 'Card does not belong to this collection' };
    }
    await card.populate('frontAsset borderAsset');

    return {
      ...card.toJSON(),
      count
    };
  })
}

export default cardCollectionRoutes;