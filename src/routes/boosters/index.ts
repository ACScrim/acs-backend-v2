import {FastifyPluginAsync} from "fastify";
import {authGuard} from "../../middleware/authGuard";
import {IScrimium} from "../../models/Scrimium";
import mongoose from "mongoose";

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

    const cardCollection = await fastify.models.CardCollection.findOne({ userId: req.session.userId });
    if (cardCollection) {
      await fastify.models.CardCollection.updateOne(
        { userId: req.session.userId },
        { $addToSet: { cards: { $each: cards } } }
      );
    } else {
      await fastify.models.CardCollection.create({
        userId: req.session.userId,
        cards
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