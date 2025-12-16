import {FastifyPluginAsync} from "fastify";
import {authGuard} from "../../middleware/authGuard";
import {IScrimium} from "../../models/Scrimium";
import mongoose from "mongoose";
import {ICardCollection} from "../../models/CardCollection";

const boostersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/shop", { preHandler: [authGuard] }, async (req, res) => {
    return fastify.models.BoosterShopItem.find();
  });

  fastify.post("/buy", { preHandler: [authGuard] }, async (req, res) => {
    const userScrimium = await fastify.models.Scrimium.findOne({ userId: req.session.userId }) as IScrimium;
    const { boosterId } = req.body as { boosterId: string };
    const boosterItem = await fastify.models.BoosterShopItem.findById(boosterId);

    if (!boosterItem) {
      return res.status(404).send({ error: "Le booster n'existe pas." });
    }

    if (userScrimium.balance < boosterItem.price) {
      return res.status(400).send({ error: "Pas assez de scrimium." });
    }

    const cards: string[] = [];
    let remainingCards = boosterItem.cardsCount;

    if (boosterItem.legendaryCardGuarantee > 0) {
      const legendaryCards = await fastify.models.Card.aggregate([
        { $match: { rarity: 'legendary' } },
        { $sample: { size: boosterItem.legendaryCardGuarantee } }
      ]);
      cards.push(...legendaryCards.map(card => card._id.toString()));
      remainingCards -= boosterItem.legendaryCardGuarantee;
    }
    if (boosterItem.epicCardGuarantee > 0 && remainingCards > 0) {
      const epicCards = await fastify.models.Card.aggregate([
        { $match: { rarity: 'epic' } },
        { $sample: { size: boosterItem.epicCardGuarantee } }
      ]);
      cards.push(...epicCards.map(card => card._id.toString()));
      remainingCards -= boosterItem.epicCardGuarantee;
    }
    while (remainingCards > 0) {
      const [randomCard] = await fastify.models.Card.aggregate([
        { $sample: { size: 1 } }
      ]);
      if (randomCard) {
        cards.push(randomCard._id.toString());
        remainingCards--;
      } else {
        break; // Évite boucle infinie si aucune carte n'existe
      }
    }

    const booster = new fastify.models.Booster({
      userId: req.session.userId,
      cards,
      boosterId
    });

    await booster.save();

    const cardsToPush: ICardCollection['cards'] = [];
    for (const cardId of cards) {
      const existingCard = cardsToPush.find(c => c.cardId.toString() === cardId);
      if (existingCard) {
        existingCard.count += 1;
      } else {
        // @ts-ignore
        cardsToPush.push({ cardId: cardId.toString(), count: 1 });
      }
    }

    const cardCollection = await fastify.models.CardCollection.findOne({ userId: req.session.userId }) as ICardCollection;
    if (cardCollection) {
      for (const cardEntry of cardsToPush) {
        const existingCard = cardCollection.cards.find(c => c.cardId.toString() === cardEntry.cardId.toString());
        if (existingCard) {
          existingCard.count += cardEntry.count;
        } else {
          cardCollection.cards.push(cardEntry);
        }
      }
      await cardCollection.save();
    } else {
      await fastify.models.CardCollection.create({
        userId: req.session.userId,
        cards: cardsToPush
      });
    }

    await booster.populate({ path: 'cards', populate: [{ path: 'frontAsset' }, { path: 'borderAsset' }] });
    await booster.populate('booster');

    userScrimium.balance -= boosterItem.price;
    await userScrimium.save();

    return booster;
  })
}

export default boostersRoutes;