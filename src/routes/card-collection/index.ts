import {FastifyPluginAsync} from "fastify";
import {authGuard} from "../../middleware/authGuard";
import {ICard} from "../../models/Card";
import {ICardCollection} from "../../models/CardCollection";
import { log } from "../../utils/utils";

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
      log(fastify, `Collection introuvable pour l'identifiant ${id}`, 'error', 404);
      return { error: 'Collection introuvable pour cet identifiant' };
    }
    const card = await fastify.models.Card.findById(cardId) as ICard;
    const count = collection.cards.find(card => card.cardId.toString() === cardId)?.count || 0;
    if (!card) {
      resp.status(404);
      log(fastify, `Carte introuvable dans la collection ${id} pour l'identifiant ${cardId}`, 'error', 404);
      return { error: 'Carte introuvable pour cet identifiant' };
    }
    if (!collection.cards.find(c => c.cardId.toString() === card.id.toString())) {
      resp.status(403);
      log(fastify, `Tentative d'accès à une carte n'appartenant pas à la collection ${id}`, 'error', 403);
      return { error: 'Cette carte n’appartient pas à cette collection' };
    }
    await card.populate('frontAsset borderAsset');

    return {
      ...card.toJSON(),
      count
    };
  })
}

export default cardCollectionRoutes;
