import {FastifyPluginAsync} from "fastify";
import {authGuard} from "../../middleware/authGuard";
import {IScrimium} from "../../models/Scrimium";
import mongoose from "mongoose";
import {ICardCollection} from "../../models/CardCollection";
import {AppError} from "../../utils/utils";

const boostersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/shop", { preHandler: [authGuard] }, async () => {
    return fastify.models.BoosterShopItem.find();
  });

  fastify.post("/buy", { preHandler: [authGuard] }, async (req) => {
    const userScrimium = await fastify.models.Scrimium.findOne({ userId: req.session.userId }) as IScrimium;
    const { boosterId } = req.body as { boosterId: string };
    const boosterItem = await fastify.models.BoosterShopItem.findById(boosterId);

    if (!boosterItem) {
      throw new AppError(404, "Le booster n'existe pas.");
    }

    if (userScrimium.balance < boosterItem.price) {
      throw new AppError(400, "Pas assez de scrimium.");
    }

    const cards: string[] = [];
    let remainingCards = boosterItem.cardsCount;

    if (boosterItem.legendaryCardGuarantee > 0) {
      const legendaryCards = await fastify.models.Card.aggregate([
        { $match: { rarity: 'legendary', status: 'active' } },
        { $sample: { size: boosterItem.legendaryCardGuarantee } }
      ]);
      cards.push(...legendaryCards.map(card => card._id.toString()));
      remainingCards -= boosterItem.legendaryCardGuarantee;
    }
    if (boosterItem.epicCardGuarantee > 0 && remainingCards > 0) {
      const epicCards = await fastify.models.Card.aggregate([
        { $match: { rarity: 'epic', status: 'active' } },
        { $sample: { size: boosterItem.epicCardGuarantee } }
      ]);
      cards.push(...epicCards.map(card => card._id.toString()));
      remainingCards -= boosterItem.epicCardGuarantee;
    }

    const remainingCardsToFetch: { rarity: string; count: number }[] = [];

    // Déterminer le nombre de cartes non-communes pour ce booster
    // 15% chance d'avoir 1 carte non-commune, 2% chance d'en avoir 2, 83% que des communes
    const guaranteeRoll = Math.random();
    let nonCommonCardCount = 0;
    if (guaranteeRoll < 0.15) {
      nonCommonCardCount = 1;
    } else if (guaranteeRoll < 0.17) {
      nonCommonCardCount = 2;
    }

    // Si nous avons des cartes non-communes à obtenir
    if (nonCommonCardCount > 0) {
      const nonCommonRarities = [
        { rarity: 'legendary', rate: 0.08 },
        { rarity: 'epic', rate: 0.20 },
        { rarity: 'rare', rate: 0.35 },
        { rarity: 'uncommon', rate: 0.37 }
      ];

      for (let i = 0; i < nonCommonCardCount; i++) {
        const random = Math.random();
        let cumulativeRate = 0;

        for (const { rarity, rate } of nonCommonRarities) {
          cumulativeRate += rate;
          if (random <= cumulativeRate) {
            const existing = remainingCardsToFetch.find(r => r.rarity === rarity);
            if (existing) {
              existing.count++;
            } else {
              remainingCardsToFetch.push({ rarity, count: 1 });
            }
            break;
          }
        }
      }
    }

    // Le reste sera des cartes communes
    const commonCardCount = remainingCards - nonCommonCardCount;
    if (commonCardCount > 0) {
      remainingCardsToFetch.push({ rarity: 'common', count: commonCardCount });
    }

    const randomCards = await fastify.models.Card.aggregate([
      {
        $facet: {
          legendary: [
            { $match: { rarity: 'legendary', status: 'active' } },
            { $sample: { size: remainingCardsToFetch.find(r => r.rarity === 'legendary')?.count || 0 } }
          ],
          epic: [
            { $match: { rarity: 'epic', status: 'active' } },
            { $sample: { size: remainingCardsToFetch.find(r => r.rarity === 'epic')?.count || 0 } }
          ],
          rare: [
            { $match: { rarity: 'rare', status: 'active' } },
            { $sample: { size: remainingCardsToFetch.find(r => r.rarity === 'rare')?.count || 0 } }
          ],
          uncommon: [
            { $match: { rarity: 'uncommon', status: 'active' } },
            { $sample: { size: remainingCardsToFetch.find(r => r.rarity === 'uncommon')?.count || 0 } }
          ],
          common: [
            { $match: { rarity: 'common', status: 'active' } },
            { $sample: { size: remainingCardsToFetch.find(r => r.rarity === 'common')?.count || 0 } }
          ]
        }
      }
    ]);

    const allRandomCards = [
      ...randomCards[0].legendary,
      ...randomCards[0].epic,
      ...randomCards[0].rare,
      ...randomCards[0].uncommon,
      ...randomCards[0].common
    ];

    const cardsNeeded = remainingCards - allRandomCards.length;
    if (cardsNeeded > 0) {
      const fallbackCards = await fastify.models.Card.aggregate([
        { $match: { rarity: 'common', status: 'active' } },
        { $sample: { size: cardsNeeded } }
      ]);
      allRandomCards.push(...fallbackCards);
    }

    if (allRandomCards.length > 0) {
      cards.push(...allRandomCards.map(card => card._id.toString()));
    }

    // Récupérer la collection de cartes AVANT la mise à jour pour connaître les possessions actuelles
    const cardCollection = await fastify.models.CardCollection.findOne({ userId: req.session.userId }) as ICardCollection;
    const cardCountMap = new Map<string, number>();
    if (cardCollection) {
      for (const cardEntry of cardCollection.cards) {
        cardCountMap.set(cardEntry.cardId.toString(), cardEntry.count);
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

    await booster.populate({ path: 'cards', populate: [{ path: 'frontAsset' }, { path: 'borderAsset' }, { path: 'category'}] });
    await booster.populate('booster');

    // Enrichir chaque carte avec le nombre de fois déjà possédée et un flag pour les nouvelles cartes
    const enrichedBooster = booster.toJSON() as any;
    enrichedBooster.cards = enrichedBooster.cards.map((card: any) => ({
      ...card,
      ownedCount: cardCountMap.get(card.id.toString()) || 0,
      isNew: !cardCountMap.has(card.id.toString())
    }));

    userScrimium.balance -= boosterItem.price;
    userScrimium.transactions.push({
      amount: -boosterItem.price,
      description: `buy_booster`,
      date: new Date(),
    })
    await userScrimium.save();

    return enrichedBooster;
  })
}

export default boostersRoutes;