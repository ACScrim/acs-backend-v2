import { FastifyPluginAsync } from "fastify";
import { authGuard } from "../../middleware/authGuard";
import { ICardTrade } from "../../models/CardTrade";
import { ICardCollection } from "../../models/CardCollection";
import { log } from "../../utils/utils";
import mongoose from "mongoose";

const cardTradesRoutes: FastifyPluginAsync = async (fastify) => {

  // Lister toutes les offres actives
  fastify.get('/', { preHandler: [authGuard] }, async (req, resp) => {
    try {
      const trades = await fastify.models.CardTrade.find({ status: 'active' })
        .populate('offeredBy', 'id username avatarUrl')
        .populate({
          path: 'offeredCards.cardId',
          model: 'Card',
          populate: [
            { path: 'frontAsset' },
            { path: 'borderAsset' },
            { path: 'category' }
          ]
        })
        .sort({ createdAt: -1 });

      return trades;
    } catch (error) {
      log(fastify, `Erreur lors de la récupération des échanges: ${error}`, 'error', 500);
      resp.status(500);
      throw error;
    }
  });

  // Voir mes offres (celles que j'ai créées)
  fastify.get('/me', { preHandler: [authGuard] }, async (req, resp) => {
    try {
      const userId = req.session.userId;
      const trades = await fastify.models.CardTrade.find({ offeredBy: userId })
        .populate('offeredBy', 'id username avatarUrl')
        .populate({
          path: 'offeredCards.cardId',
          model: 'Card',
          populate: [
            { path: 'frontAsset' },
            { path: 'borderAsset' },
            { path: 'category' }
          ]
        })
        .populate({
          path: 'proposals.proposedBy',
          model: 'User',
          select: 'id username avatarUrl'
        })
        .populate({
          path: 'proposals.proposedCards.cardId',
          model: 'Card',
          populate: [
            { path: 'frontAsset' },
            { path: 'borderAsset' },
            { path: 'category' }
          ]
        })
        .sort({ createdAt: -1 });

      return trades;
    } catch (error) {
      log(fastify, `Erreur lors de la récupération de mes échanges: ${error}`, 'error', 500);
      resp.status(500);
      throw error;
    }
  });

  // Voir mes propositions (celles que j'ai faites sur les offres des autres)
  fastify.get('/my-proposals', { preHandler: [authGuard] }, async (req, resp) => {
    try {
      const userId = req.session.userId;
      const trades = await fastify.models.CardTrade.find({
        'proposals.proposedBy': userId,
        status: 'active'
      })
        .populate('offeredBy', 'id username avatarUrl')
        .populate({
          path: 'offeredCards.cardId',
          model: 'Card',
          populate: [
            { path: 'frontAsset' },
            { path: 'borderAsset' },
            { path: 'category' }
          ]
        })
        .populate({
          path: 'proposals.proposedBy',
          model: 'User',
          select: 'id username avatarUrl'
        })
        .populate({
          path: 'proposals.proposedCards.cardId',
          model: 'Card',
          populate: [
            { path: 'frontAsset' },
            { path: 'borderAsset' },
            { path: 'category' }
          ]
        })
        .sort({ createdAt: -1 });

      return trades;
    } catch (error) {
      log(fastify, `Erreur lors de la récupération de mes propositions: ${error}`, 'error', 500);
      resp.status(500);
      throw error;
    }
  });

  // Créer une nouvelle offre d'échange
  fastify.post('/', { preHandler: [authGuard] }, async (req, resp) => {
    try {
      const userId = req.session.userId;
      const { offeredCards } = req.body as {
        offeredCards: { cardId: string; count: number }[]
      };

      // Vérifier qu'il y a entre 1 et 5 cartes
      if (!offeredCards || offeredCards.length === 0 || offeredCards.length > 5) {
        resp.status(400);
        throw new Error('Vous devez offrir entre 1 et 5 cartes');
      }

      // Récupérer la collection de l'utilisateur
      const collection = await fastify.models.CardCollection.findOne({ userId }) as ICardCollection;
      if (!collection) {
        resp.status(404);
        throw new Error('Collection non trouvée');
      }

      // Vérifier que l'utilisateur possède toutes les cartes avec les bonnes quantités
      for (const offeredCard of offeredCards) {
        const userCard = collection.cards.find(c => c.cardId.toString() === offeredCard.cardId);
        if (!userCard || userCard.count < offeredCard.count) {
          resp.status(400);
          throw new Error('Vous ne possédez pas assez d\'exemplaires de cette carte');
        }
      }

      // Créer l'offre
      const trade = new fastify.models.CardTrade({
        offeredBy: userId,
        offeredCards: offeredCards.map(c => ({
          cardId: new mongoose.Types.ObjectId(c.cardId),
          count: c.count
        })),
        status: 'active',
        proposals: []
      });

      await trade.save();
      await trade.populate('offeredBy', 'id username avatarUrl');
      await trade.populate({
        path: 'offeredCards.cardId',
        model: 'Card',
        populate: [
          { path: 'frontAsset' },
          { path: 'borderAsset' },
          { path: 'category' }
        ]
      });

      log(fastify, `Offre d'échange créée par ${userId}`, 'info', 200);
      return trade;
    } catch (error) {
      log(fastify, `Erreur lors de la création de l'offre: ${error}`, 'error', 500);
      resp.status(500);
      throw error;
    }
  });

  // Proposer un échange sur une offre
  fastify.post('/:id/proposals', { preHandler: [authGuard] }, async (req, resp) => {
    try {
      const userId = req.session.userId;
      const { id } = req.params as { id: string };
      const { proposedCards } = req.body as {
        proposedCards: { cardId: string; count: number }[]
      };

      // Vérifier qu'il y a entre 1 et 5 cartes
      if (!proposedCards || proposedCards.length === 0 || proposedCards.length > 5) {
        resp.status(400);
        throw new Error('Vous devez proposer entre 1 et 5 cartes');
      }

      // Récupérer l'offre
      const trade = await fastify.models.CardTrade.findById(id) as ICardTrade;
      if (!trade) {
        resp.status(404);
        throw new Error('Offre d\'échange non trouvée');
      }

      if (trade.status !== 'active') {
        resp.status(400);
        throw new Error('Cette offre n\'est plus active');
      }

      // Vérifier que ce n'est pas sa propre offre
      if (trade.offeredBy.toString() === userId) {
        resp.status(400);
        throw new Error('Vous ne pouvez pas proposer un échange sur votre propre offre');
      }

      // Vérifier que l'utilisateur n'a pas déjà fait une proposition
      const existingProposal = trade.proposals.find(
        p => p.proposedBy.toString() === userId && p.status === 'pending'
      );
      if (existingProposal) {
        resp.status(400);
        throw new Error('Vous avez déjà fait une proposition sur cette offre');
      }

      // Récupérer la collection de l'utilisateur
      const collection = await fastify.models.CardCollection.findOne({ userId }) as ICardCollection;
      if (!collection) {
        resp.status(404);
        throw new Error('Collection non trouvée');
      }

      // Vérifier que l'utilisateur possède toutes les cartes avec les bonnes quantités
      for (const proposedCard of proposedCards) {
        const userCard = collection.cards.find(c => c.cardId.toString() === proposedCard.cardId);
        if (!userCard || userCard.count < proposedCard.count) {
          resp.status(400);
          throw new Error('Vous ne possédez pas assez d\'exemplaires de cette carte');
        }
      }

      // Ajouter la proposition
      trade.proposals.push({
        proposedBy: userId as any,
        proposedCards: proposedCards.map(c => ({
          cardId: c.cardId as any,
          count: c.count
        })),
        status: 'pending',
        createdAt: new Date()
      });

      await trade.save();
      await trade.populate('offeredBy', 'id username avatarUrl');
      await trade.populate({
        path: 'offeredCards.cardId',
        model: 'Card',
        populate: [
          { path: 'frontAsset' },
          { path: 'borderAsset' },
          { path: 'category' }
        ]
      });
      await trade.populate({
        path: 'proposals.proposedBy',
        model: 'User',
        select: 'id username avatarUrl'
      });
      await trade.populate({
        path: 'proposals.proposedCards.cardId',
        model: 'Card',
        populate: [
          { path: 'frontAsset' },
          { path: 'borderAsset' },
          { path: 'category' }
        ]
      });

      log(fastify, `Proposition d'échange ajoutée par ${userId} sur l'offre ${id}`, 'info', 200);
      return trade;
    } catch (error) {
      log(fastify, `Erreur lors de la proposition d'échange: ${error}`, 'error', 500);
      resp.status(500);
      throw error;
    }
  });

  // Accepter une proposition
  fastify.post('/:id/proposals/:proposalId/accept', { preHandler: [authGuard] }, async (req, resp) => {
    try {
      const userId = req.session.userId;
      const { id, proposalId } = req.params as { id: string; proposalId: string };

      // Récupérer l'offre
      const trade = await fastify.models.CardTrade.findById(id) as ICardTrade;
      if (!trade) {
        resp.status(404);
        throw new Error('Offre d\'échange non trouvée');
      }

      // Vérifier que c'est bien le créateur de l'offre
      if (trade.offeredBy.toString() !== userId) {
        resp.status(403);
        throw new Error('Vous n\'êtes pas autorisé à accepter cette proposition');
      }

      if (trade.status !== 'active') {
        resp.status(400);
        throw new Error('Cette offre n\'est plus active');
      }

      // Trouver la proposition
      const proposal = trade.proposals.find(p => p._id?.toString() === proposalId);
      if (!proposal) {
        resp.status(404);
        throw new Error('Proposition non trouvée');
      }

      if (proposal.status !== 'pending') {
        resp.status(400);
        throw new Error('Cette proposition n\'est plus en attente');
      }

      // Récupérer les collections des deux utilisateurs
      const ownerCollection = await fastify.models.CardCollection.findOne({ userId }) as ICardCollection;
      const proposerCollection = await fastify.models.CardCollection.findOne({
        userId: proposal.proposedBy
      }) as ICardCollection;

      if (!ownerCollection || !proposerCollection) {
        resp.status(404);
        throw new Error('Collections non trouvées');
      }

      // Vérifier à nouveau que les deux utilisateurs possèdent les cartes
      for (const offeredCard of trade.offeredCards) {
        const userCard = ownerCollection.cards.find(c => c.cardId.toString() === offeredCard.cardId.toString());
        if (!userCard || userCard.count < offeredCard.count) {
          resp.status(400);
          throw new Error('Vous ne possédez plus assez d\'exemplaires d\'une carte offerte');
        }
      }

      for (const proposedCard of proposal.proposedCards) {
        const userCard = proposerCollection.cards.find(c => c.cardId.toString() === proposedCard.cardId.toString());
        if (!userCard || userCard.count < proposedCard.count) {
          resp.status(400);
          throw new Error('Le proposant ne possède plus assez d\'exemplaires d\'une carte');
        }
      }

      // Effectuer l'échange
      // Retirer les cartes offertes de la collection du propriétaire et ajouter les cartes proposées
      for (const offeredCard of trade.offeredCards) {
        const userCard = ownerCollection.cards.find(c => c.cardId.toString() === offeredCard.cardId.toString());
        if (userCard) {
          userCard.count -= offeredCard.count;
          if (userCard.count <= 0) {
            ownerCollection.cards = ownerCollection.cards.filter(c => c.cardId.toString() !== offeredCard.cardId.toString());
          }
        }
      }

      for (const proposedCard of proposal.proposedCards) {
        const existingCard = ownerCollection.cards.find(c => c.cardId.toString() === proposedCard.cardId.toString());
        if (existingCard) {
          existingCard.count += proposedCard.count;
        } else {
          ownerCollection.cards.push({
            cardId: proposedCard.cardId,
            count: proposedCard.count
          });
        }
      }

      // Retirer les cartes proposées de la collection du proposant et ajouter les cartes offertes
      for (const proposedCard of proposal.proposedCards) {
        const userCard = proposerCollection.cards.find(c => c.cardId.toString() === proposedCard.cardId.toString());
        if (userCard) {
          userCard.count -= proposedCard.count;
          if (userCard.count <= 0) {
            proposerCollection.cards = proposerCollection.cards.filter(c => c.cardId.toString() !== proposedCard.cardId.toString());
          }
        }
      }

      for (const offeredCard of trade.offeredCards) {
        const existingCard = proposerCollection.cards.find(c => c.cardId.toString() === offeredCard.cardId.toString());
        if (existingCard) {
          existingCard.count += offeredCard.count;
        } else {
          proposerCollection.cards.push({
            cardId: offeredCard.cardId,
            count: offeredCard.count
          });
        }
      }

      // Sauvegarder les collections
      await ownerCollection.save();
      await proposerCollection.save();

      // Marquer la proposition comme acceptée et l'offre comme complétée
      proposal.status = 'accepted';
      trade.status = 'completed';

      // Rejeter toutes les autres propositions
      for (const p of trade.proposals) {
        if (p._id?.toString() !== proposalId && p.status === 'pending') {
          p.status = 'rejected';
        }
      }

      await trade.save();
      await trade.populate('offeredBy', 'id username avatarUrl');
      await trade.populate({
        path: 'offeredCards.cardId',
        model: 'Card',
        populate: [
          { path: 'frontAsset' },
          { path: 'borderAsset' },
          { path: 'category' }
        ]
      });
      await trade.populate({
        path: 'proposals.proposedBy',
        model: 'User',
        select: 'id username avatarUrl'
      });
      await trade.populate({
        path: 'proposals.proposedCards.cardId',
        model: 'Card',
        populate: [
          { path: 'frontAsset' },
          { path: 'borderAsset' },
          { path: 'category' }
        ]
      });

      log(fastify, `Échange accepté: offre ${id}, proposition ${proposalId}`, 'info', 200);
      return trade;
    } catch (error) {
      log(fastify, `Erreur lors de l'acceptation de la proposition: ${error}`, 'error', 500);
      resp.status(500);
      throw error;
    }
  });

  // Rejeter une proposition
  fastify.post('/:id/proposals/:proposalId/reject', { preHandler: [authGuard] }, async (req, resp) => {
    try {
      const userId = req.session.userId;
      const { id, proposalId } = req.params as { id: string; proposalId: string };

      // Récupérer l'offre
      const trade = await fastify.models.CardTrade.findById(id) as ICardTrade;
      if (!trade) {
        resp.status(404);
        throw new Error('Offre d\'échange non trouvée');
      }

      // Vérifier que c'est bien le créateur de l'offre
      if (trade.offeredBy.toString() !== userId) {
        resp.status(403);
        throw new Error('Vous n\'êtes pas autorisé à rejeter cette proposition');
      }

      // Trouver la proposition
      const proposal = trade.proposals.find(p => p._id?.toString() === proposalId);
      if (!proposal) {
        resp.status(404);
        throw new Error('Proposition non trouvée');
      }

      if (proposal.status !== 'pending') {
        resp.status(400);
        throw new Error('Cette proposition n\'est plus en attente');
      }

      // Marquer la proposition comme rejetée
      proposal.status = 'rejected';
      await trade.save();
      await trade.populate('offeredBy', 'id username avatarUrl');
      await trade.populate({
        path: 'proposals.proposedCards.cardId',
        model: 'Card',
        populate: [
          { path: 'frontAsset' },
          { path: 'borderAsset' },
          { path: 'category' }
        ]
      });
      await trade.populate({
        path: 'offeredCards.cardId',
        model: 'Card',
        populate: [
          { path: 'frontAsset' },
          { path: 'borderAsset' },
          { path: 'category' }
        ]
      });

      log(fastify, `Proposition rejetée: offre ${id}, proposition ${proposalId}`, 'info', 200);
      return trade;
    } catch (error) {
      log(fastify, `Erreur lors du rejet de la proposition: ${error}`, 'error', 500);
      resp.status(500);
      throw error;
    }
  });

  // Annuler une offre
  fastify.delete('/:id', { preHandler: [authGuard] }, async (req, resp) => {
    try {
      const userId = req.session.userId;
      const { id } = req.params as { id: string };

      // Récupérer l'offre
      const trade = await fastify.models.CardTrade.findById(id) as ICardTrade;
      if (!trade) {
        resp.status(404);
        throw new Error('Offre d\'échange non trouvée');
      }

      // Vérifier que c'est bien le créateur de l'offre
      if (trade.offeredBy.toString() !== userId) {
        resp.status(403);
        throw new Error('Vous n\'êtes pas autorisé à annuler cette offre');
      }

      if (trade.status !== 'active') {
        resp.status(400);
        throw new Error('Cette offre n\'est plus active');
      }

      // Marquer l'offre comme annulée et toutes les propositions comme rejetées
      trade.status = 'cancelled';
      for (const proposal of trade.proposals) {
        if (proposal.status === 'pending') {
          proposal.status = 'rejected';
        }
      }

      await trade.save();

      log(fastify, `Offre d'échange annulée: ${id}`, 'info', 200);
      return trade;
    } catch (error) {
      log(fastify, `Erreur lors de l'annulation de l'offre: ${error}`, 'error', 500);
      resp.status(500);
      throw error;
    }
  });

  // Récupérer les détails d'une offre spécifique
  fastify.get('/:id', { preHandler: [authGuard] }, async (req, resp) => {
    try {
      const { id } = req.params as { id: string };

      const trade = await fastify.models.CardTrade.findById(id)
        .populate('offeredBy', 'id username avatarUrl')
        .populate({
          path: 'offeredCards.cardId',
          model: 'Card',
          populate: [
            { path: 'frontAsset' },
            { path: 'borderAsset' },
            { path: 'category' }
          ]
        })
        .populate({
          path: 'proposals.proposedBy',
          model: 'User',
          select: 'id username avatarUrl'
        })
        .populate({
          path: 'proposals.proposedCards.cardId',
          model: 'Card',
          populate: [
            { path: 'frontAsset' },
            { path: 'borderAsset' },
            { path: 'category' }
          ]
        });

      if (!trade) {
        resp.status(404);
        throw new Error('Offre d\'échange non trouvée');
      }

      return trade;
    } catch (error) {
      log(fastify, `Erreur lors de la récupération de l'offre: ${error}`, 'error', 500);
      resp.status(500);
      throw error;
    }
  });
};

export default cardTradesRoutes;
