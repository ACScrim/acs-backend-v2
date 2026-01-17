import {FastifyPluginAsync} from "fastify";
import {authGuard} from "../../../middleware/authGuard";
import {ICard} from "../../../models/Card";
import {ICardAsset} from "../../../models/CardAsset";
import {IUser} from "../../../models/User";
import {log} from "../../../utils/utils";
import {uploadCardImage, uploadCardAssetImage, getMainCardImages} from "../../../services/cloudinaryService";

const cardCreatorRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET
   */
  fastify.get("/cards", { preHandler: [authGuard] }, async (req, resp) => {
    const cards = await fastify.models.Card.find({ createdBy: req.session.userId })
      .select('id previewCardB64 status category')
    return cards;
  })

  fastify.get("/cards/:cardId", { preHandler: [authGuard] }, async (req, resp) => {
    const { cardId } = req.params as { cardId: string };

    const card = await fastify.models.Card.findById(cardId)
      .populate('frontAsset')
      .populate('borderAsset')
      .populate('category');

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
    const assets = await fastify.models.CardAsset.find({})
      .populate('createdBy', 'id username avatarUrl');

    return assets;
  });

  fastify.get("/discord-avatars", { preHandler: [authGuard] }, async (req, resp) => {
    const users = await fastify.models.User.find().select('id username avatarUrl') as IUser[];
    return users.filter(user => user.avatarUrl);
  });

  fastify.get("/main-images", { preHandler: [authGuard] }, async (req, resp) => {
    try {
      const images = await getMainCardImages();
      return images;
    } catch (error) {
      resp.status(500);
      return { message: 'Erreur lors de la récupération des images.' };
    }
  });

  fastify.get("/assets/backgrounds", { preHandler: [authGuard] }, async (req, resp) => {
    const assets = await fastify.models.CardAsset.find({
      category: 'background'
    }).populate('createdBy', 'id username avatarUrl');

    return assets;
  });

  fastify.get("/assets/borders", { preHandler: [authGuard] }, async (req, resp) => {
    const assets = await fastify.models.CardAsset.find({
      category: 'border'
    }).populate('createdBy', 'id username avatarUrl');

    return assets;
  });

  /**
   * POST
   */
  fastify.post("/asset", { preHandler: [authGuard] }, async (req, resp) => {
    const body = req.body as Omit<ICardAsset, 'createdBy'> & { imageBase64?: string; imageMimeType?: string };

    let imageUrl: string | undefined;

    // Upload image to Cloudinary if provided
    if (body.imageBase64 && body.type === 'image') {
      try {
        const result = await uploadCardAssetImage(
          body.imageBase64,
          `asset-${Date.now()}`,
          body.category as 'background' | 'border'
        );
        imageUrl = result.imageUrl;
      } catch (uploadError) {
        log(fastify, `Erreur lors de l'upload Cloudinary: ${uploadError}`, 'error');
        resp.status(400);
        return { message: 'Erreur lors de l\'upload de l\'image.' };
      }
    }

    // Check for duplicates - but for image types, we now use imageUrl instead of imageBase64
    const existingAsset = await fastify.models.CardAsset.findOne({
      $or: [
        ...(imageUrl ? [{ imageUrl, type: "image" }] : []),
        { solidColor: body.solidColor, type: "solid", category: body.category },
        { category: body.category, type: "gradient", color1: body.color1, color2: body.color2 }
      ]
    });

    if (existingAsset) return existingAsset;

    const newAsset = await fastify.models.CardAsset.create({
      ...body,
      imageUrl,
      // Remove base64 fields
      imageBase64: undefined,
      imageMimeType: undefined,
      createdBy: req.session.userId,
    });

    await newAsset.save();

    return fastify.models.CardAsset.findById(newAsset.id).populate('createdBy', 'id username avatarUrl');
  });

  fastify.post("/card", { preHandler: [authGuard] }, async (req, resp) => {
    try {
      const body = req.body as Omit<ICard, 'createdBy'> & { imageBase64?: string; imageMimeType?: string; imageUrl?: string };

      const user = await fastify.models.User.findById(req.session.userId) as IUser;

      let imageUrl: string | undefined = body.imageUrl;

      // Upload image to Cloudinary if provided as base64
      // Skip upload if imageUrl is already provided (Discord avatars)
      if (body.imageBase64 && !imageUrl) {
        try {
          const result = await uploadCardImage(body.imageBase64, `card-${Date.now()}`);
          imageUrl = result.imageUrl;
        } catch (uploadError) {
          log(fastify, `Erreur lors de l'upload Cloudinary: ${uploadError}`, 'error');
          resp.status(400);
          return { message: 'Erreur lors de l\'upload de l\'image.' };
        }
      }

      const newCard = await fastify.models.Card.create({
        ...body,
        imageUrl,
        // Remove base64 fields - they should not be stored
        imageBase64: undefined,
        imageMimeType: undefined,
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
      log(fastify, `Erreur lors de la création de la carte : ${error}`, 'error');
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
