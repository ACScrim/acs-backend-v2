import {FastifyPluginAsync} from "fastify";
import {authGuard} from "../../middleware/authGuard";
import {ICard} from "../../models/Card";
import {ICardCollection} from "../../models/CardCollection";

const cardCollectionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/me', { preHandler: [authGuard] }, async (req, resp) => {
    const userId = req.session.userId;
    let collection = await fastify.models.CardCollection.findOne({ userId }) as ICardCollection;
    if (!collection) {
      collection = await fastify.models.CardCollection.create({ userId, cards: [] }) as ICardCollection;
    }

    const cards = [] as string[];
    for (const c of collection.cards) {
      const card = await fastify.models.Card.findById(c.cardId.toString());
      if (!card) continue;
      if (cards.includes(card.id)) continue;
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
    const count = collection.cards.find(card => card.cardId.toString() === cardId)?.count || 0;
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