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
      const userCard = collection.cards.find(c => (c.cardId?.id || c.cardId?._id || c.cardId)?.toString() === card._id.toString());
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

  // Fusionner des cartes pour obtenir une carte de rareté supérieure
  fastify.post('/fusion', { preHandler: [authGuard] }, async (req, resp) => {
    try {
      const userId = req.session.userId;
      const { cardIds } = req.body as { cardIds: string[] };

      if (!cardIds || !Array.isArray(cardIds) || cardIds.length < 3) {
        resp.status(400);
        throw new Error('Vous devez sélectionner au moins 3 cartes à fusionner');
      }

      if (cardIds.length > 10) {
        resp.status(400);
        throw new Error('Vous ne pouvez pas fusionner plus de 10 cartes à la fois');
      }

      // Récupérer la collection de l'utilisateur
      const collection = await fastify.models.CardCollection.findOne({ userId }) as ICardCollection;
      if (!collection) {
        resp.status(404);
        throw new Error('Collection non trouvée');
      }

      // Vérifier que toutes les cartes existent et sont de la même rareté
      const uniqueCardIds = [...new Set(cardIds)];
      const cards = await fastify.models.Card.find({ _id: { $in: uniqueCardIds }, status: 'active' }) as ICard[];

      if (cards.length !== uniqueCardIds.length) {
        resp.status(400);
        throw new Error('Certaines cartes sont introuvables ou inactives');
      }

      // Créer une map pour retrouver les cartes rapidement
      const cardMap = new Map<string, ICard>();
      cards.forEach(card => cardMap.set((card._id as any).toString(), card));

      // Vérifier que toutes les cartes sélectionnées existent et sont de la même rareté
      const firstCard = cardMap.get(cardIds[0]);
      if (!firstCard) {
        resp.status(400);
        throw new Error('Carte introuvable');
      }

      const firstRarity = firstCard.rarity;
      for (const cardId of cardIds) {
        const card = cardMap.get(cardId);
        if (!card || card.rarity !== firstRarity) {
          resp.status(400);
          throw new Error('Toutes les cartes doivent être de la même rareté pour la fusion');
        }
      }

      // Vérifier que ce n'est pas déjà legendary
      if (firstRarity === 'legendary') {
        resp.status(400);
        throw new Error('Les cartes légendaires ne peuvent pas être fusionnées');
      }

      // Définir le coût de fusion selon la rareté
      const fusionCost: Record<string, number> = {
        common: 5,
        uncommon: 4,
        rare: 3,
        epic: 3
      };

      const requiredCount = fusionCost[firstRarity || 'common'];
      if (cardIds.length < requiredCount) {
        resp.status(400);
        throw new Error(`Vous devez fusionner au moins ${requiredCount} cartes ${firstRarity}`);
      }

      // Vérifier que l'utilisateur possède toutes les cartes en quantité suffisante
      const cardCountMap = new Map<string, number>();
      for (const cardId of cardIds) {
        const count = cardCountMap.get(cardId) || 0;
        cardCountMap.set(cardId, count + 1);
      }

      for (const [cardId, neededCount] of cardCountMap.entries()) {
        const userCard = collection.cards.find(c => c.cardId.toString() === cardId);
        if (!userCard || userCard.count < neededCount) {
          resp.status(400);
          throw new Error('Vous ne possédez pas assez d\'exemplaires de certaines cartes');
        }
      }

      // Déterminer la rareté de la carte résultante
      const rarityUpgrade: Record<string, string> = {
        common: 'uncommon',
        uncommon: 'rare',
        rare: 'epic',
        epic: 'legendary'
      };

      const targetRarity = rarityUpgrade[firstRarity || 'common'];

      // Récupérer une carte aléatoire de la rareté supérieure
      const targetCards = await fastify.models.Card.aggregate([
        { $match: { rarity: targetRarity, status: 'active' } },
        { $sample: { size: 1 } }
      ]);

      if (targetCards.length === 0) {
        resp.status(500);
        throw new Error(`Aucune carte ${targetRarity} disponible pour la fusion`);
      }

      const newCard = targetCards[0];

      // Retirer les cartes sacrifiées
      for (const [cardId, neededCount] of cardCountMap.entries()) {
        const userCard = collection.cards.find(c => c.cardId.toString() === cardId);
        if (userCard) {
          userCard.count -= neededCount;
          if (userCard.count <= 0) {
            collection.cards = collection.cards.filter(c => c.cardId.toString() !== cardId);
          }
        }
      }

      // Ajouter la nouvelle carte
      const existingNewCard = collection.cards.find(c => c.cardId.toString() === newCard._id.toString());
      if (existingNewCard) {
        existingNewCard.count += 1;
      } else {
        collection.cards.push({
          cardId: newCard._id as any,
          count: 1
        });
      }

      await collection.save();

      // Récupérer la carte complète avec les relations
      const fullNewCard = await fastify.models.Card.findById(newCard._id)
        .populate('frontAsset')
        .populate('borderAsset')
        .populate('category');

      log(fastify, `Fusion de cartes réussie pour l'utilisateur ${userId}: ${cardIds.length} cartes ${firstRarity} → 1 carte ${targetRarity}`, 'info', 200);

      return {
        success: true,
        fusedCardIds: cardIds,
        fusedCount: cardIds.length,
        fusedRarity: firstRarity,
        newCard: fullNewCard,
        newRarity: targetRarity
      };
    } catch (error) {
      log(fastify, `Erreur lors de la fusion de cartes: ${error}`, 'error', 500);
      resp.status(500);
      throw error;
    }
  });
}

export default cardCollectionRoutes;
