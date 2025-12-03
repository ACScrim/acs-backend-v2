import {FastifyPluginAsync} from "fastify";
import {authGuard} from "../../../middleware/authGuard";
import {ICard} from "../../../models/Card";
import {ICardAsset} from "../../../models/CardAsset";
import {IUser} from "../../../models/User";

const cardCreatorRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET
   */
  fastify.get("/cards", { preHandler: [authGuard] }, async (req, resp) => {
    const cards = await fastify.models.Card.find({ createdBy: req.session.userId })
      .populate('frontAsset')
      .populate('borderAsset')
      .select('-status');
    return cards;
  })

  fastify.get("/assets", { preHandler: [authGuard] }, async (req, resp) => {
    const assets = await fastify.models.CardAsset.find({ createdBy: req.session.userId })
      .populate('createdBy', 'id username avatarUrl');

    return assets;
  });

  fastify.get("/assets/backgrounds", { preHandler: [authGuard] }, async (req, resp) => {
    const assets = await fastify.models.CardAsset.find({
      createdBy: req.session.userId,
      category: 'background'
    }).populate('createdBy', 'id username avatarUrl');

    return assets;
  });

  fastify.get("/assets/borders", { preHandler: [authGuard] }, async (req, resp) => {
    const assets = await fastify.models.CardAsset.find({
      createdBy: req.session.userId,
      category: 'border'
    }).populate('createdBy', 'id username avatarUrl');

    return assets;
  });

  /**
   * POST
   */
  fastify.post("/asset", { preHandler: [authGuard] }, async (req, resp) => {
    const body = req.body as Omit<ICardAsset, 'createdBy'>;

    const newAsset = await fastify.models.CardAsset.create({
      ...body,
      createdBy: req.session.userId,
    });

    await newAsset.save();

    return fastify.models.CardAsset.findById(newAsset.id).populate('createdBy', 'id username avatarUrl');
  });

  fastify.post("/card", { preHandler: [authGuard] }, async (req, resp) => {
    const body = req.body as Omit<ICard, 'createdBy'>;

    const user = await fastify.models.User.findById(req.session.userId) as IUser;

    const newCard = await fastify.models.Card.create({
      ...body,
      createdBy: req.session.userId,
      status: user.role.includes('admin') ? 'active' : 'pending'
    });

    await newCard.save();

    return fastify.models.Card.findById(newCard.id)
      .populate('frontAssetId')
      .populate('borderAssetId')
      .select('-status');
  });
}

export default cardCreatorRoutes;