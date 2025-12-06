import {FastifyPluginAsync} from "fastify";
import {authGuard} from "../../../middleware/authGuard";
import {ICard} from "../../../models/Card";
import {ICardAsset} from "../../../models/CardAsset";
import {IUser} from "../../../models/User";
import {log} from "../../../utils/utils";

const cardCreatorRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET
   */
  fastify.get("/cards", { preHandler: [authGuard] }, async (req, resp) => {
    const cards = await fastify.models.Card.find({ createdBy: req.session.userId })
      .select('id previewCardB64 status')
    return cards;
  })

  fastify.get("/cards/:cardId", { preHandler: [authGuard] }, async (req, resp) => {
    const { cardId } = req.params as { cardId: string };

    const card = await fastify.models.Card.findById(cardId)
      .populate('frontAsset')
      .populate('borderAsset');

    if (!card) {
      resp.status(404);
      return { message: 'Carte non trouvée.' };
    }

    if (card.createdBy.toString() !== req.session.userId) {
      resp.status(403);
      return { message: 'Vous n\'êtes pas autorisé à accéder à cette carte.' };
    }

    return card;
  });

  fastify.get("/assets", { preHandler: [authGuard] }, async (req, resp) => {
    const assets = await fastify.models.CardAsset.find({ createdBy: req.session.userId })
      .populate('createdBy', 'id username avatarUrl');

    return assets;
  });

  fastify.get("/discord-avatars", { preHandler: [authGuard] }, async (req, resp) => {
    const users = await fastify.models.User.find().select('id username avatarUrl');
    return users
  })

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
    try {
      const body = req.body as Omit<ICard, 'createdBy'>;

      // Log received data to debug
      req.log.info({
        title: body.title,
        hasImageBase64: !!body.imageBase64,
        imageMimeType: body.imageMimeType,
        imagePosX: body.imagePosX,
        imagePosY: body.imagePosY,
        imageScale: body.imageScale,
      }, 'Card creation request received');

      const user = await fastify.models.User.findById(req.session.userId) as IUser;

      const newCard = await fastify.models.Card.create({
        ...body,
        createdBy: req.session.userId,
        status: user.role.includes('admin') ? 'active' : 'pending'
      });

      await newCard.save();

      const savedCard = await fastify.models.Card.findById(newCard.id)
        .populate('frontAsset')
        .populate('borderAsset')
        .select('-status');

      // TODO: Envoi message discord nouvelle carte en attente ?

      log(fastify, `Création d'une nouvelle carte par ${user.username}`, 'info');

      return savedCard;
    } catch (error) {
      req.log.error(error, 'Error creating card');
      throw error;
    }
  });

  fastify.delete("/card/:id", { preHandler: [authGuard] }, async (req, res) => {
    const { id } = req.params as { id: string };

    const card = await fastify.models.Card.findById(id);
    if (!card) {
      res.status(404);
      return { message: 'Carte non trouvée.' };
    }

    if (card.createdBy.toString() !== req.session.userId) {
      res.status(403);
      return { message: 'Vous n\'êtes pas autorisé à supprimer cette carte.' };
    }

    await fastify.models.Card.findByIdAndDelete(id);

    log(fastify, `Suppression d'une carte par ${req.session.userId} : ${card.id}`, 'info');

    return { message: 'Carte supprimée avec succès.' };
  });

  fastify.delete("/asset/:id", { preHandler: [authGuard] }, async (req, res) => {
    const { id } = req.params as { id: string };

    const asset = await fastify.models.CardAsset.findById(id);
    if (!asset) {
      res.status(404);
      return { message: 'Asset non trouvé.' };
    }

    const cardsUsingAsset = await fastify.models.Card.find({
      $or: [
        { frontAssetId: id },
        { borderAssetId: id }
      ]
    });

    if (cardsUsingAsset.length > 0) {
      res.status(400);
      return { message: 'Impossible de supprimer cet asset car il est utilisé par une ou plusieurs cartes.' };
    }

    if (asset.createdBy.toString() !== req.session.userId) {
      res.status(403);
      return { message: 'Vous n\'êtes pas autorisé à supprimer cet asset.' };
    }

    log(fastify, `Suppression d'un asset par ${req.session.userId} : ${asset.id}`, 'info');

    await fastify.models.CardAsset.findByIdAndDelete(id);
    return { message: 'Asset supprimé avec succès.' };
  })
}

export default cardCreatorRoutes;