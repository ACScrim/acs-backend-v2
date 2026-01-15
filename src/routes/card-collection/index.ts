import {FastifyPluginAsync} from "fastify";
import {authGuard} from "../../middleware/authGuard";
import {ICard} from "../../models/Card";
import {ICardCollection} from "../../models/CardCollection";
import { log } from "../../utils/utils";
import mongoose from "mongoose";

const cardCollectionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/me', { preHandler: [authGuard] }, async (req, resp) => {
    const userId = req.session.userId;
    let collection = await fastify.models.CardCollection.findOne({ userId }) as ICardCollection;
    if (!collection) {
      collection = await fastify.models.CardCollection.create({ userId, cards: [] }) as ICardCollection;
    }

    const cards = [] as string[];
    for (const c of collection.cards) {
      const card = await fastify.models.Card.findOne({ _id: c.cardId.toString(), status: 'active' });
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
    await card.populate('frontAsset borderAsset category');

    return {
      ...card.toJSON(),
      count
    };
  });

  fastify.get('/me/categories-overview', { preHandler: [authGuard] }, async (req, resp) => {
    const userId = req.session.userId;
    let collection = await fastify.models.CardCollection.findOne({ userId })
      .populate({
        path: 'cards.cardId',
        model: 'Card',
        match: { status: 'active' },
        populate: [
          { path: 'frontAsset' },
          { path: 'borderAsset' },
          { path: 'category' }
        ]
      }) as ICardCollection;

    if (!collection) {
      collection = await fastify.models.CardCollection.create({ userId, cards: [] }) as ICardCollection;
    }

    // Grouper les cartes par catégorie
    const categoriesMap = new Map<string, any>();

    // Récupérer TOUTES les cartes actives du système
    const allCards = await fastify.models.Card.find({ status: 'active' })
      .populate('frontAsset')
      .populate('borderAsset')
      .populate('category');

    // Organiser par catégorie
    for (const card of allCards) {
      const categoryId = card.category?._id?.toString() || '__uncategorized__';
      const categoryName = card.category?.name || 'Sans catégorie';

      if (!categoriesMap.has(categoryId)) {
        categoriesMap.set(categoryId, {
          categoryId,
          categoryName,
          totalCards: 0,
          ownedCards: [],
        });
      }

      const category = categoriesMap.get(categoryId);
      category.totalCards++;

      // Vérifier si l'utilisateur possède cette carte
      // @ts-ignore
      const userCard = collection.cards.find(c => c.cardId.id.toString() === card._id.toString());
      if (userCard) {
        category.ownedCards.push({
          count: userCard.count,
          card
        });
      }
    }

    // Convertir en tableau trié
    const categories = Array.from(categoriesMap.values()).sort((a, b) => {
      if (a.categoryName === 'Sans catégorie') return 1;
      if (b.categoryName === 'Sans catégorie') return -1;
      return a.categoryName.localeCompare(b.categoryName);
    });

    return {
      categories,
      collectionId: collection._id
    };
  });
}

export default cardCollectionRoutes;
