import {FastifyPluginAsync} from "fastify";
import {adminGuard} from "../../../middleware/authGuard";
import {ICard} from "../../../models/Card";
import {IUser} from "../../../models/User";
import {uploadCardImage} from "../../../services/cloudinaryService";
import {log, AppError} from "../../../utils/utils";

const cardsAdminRoutes: FastifyPluginAsync = async (fastify) => {

  fastify.get('/', { preHandler: [adminGuard] }, async () => {
    const cards = await fastify.models.Card.find().populate('frontAsset borderAsset createdBy category');
    return cards;
  });

  fastify.post('/:id/approve', { preHandler: [adminGuard] }, async (req) => {
    const cardId = (req.params as any).id as string;
    const card = await fastify.models.Card.findById(cardId);
    if (!card) {
      throw new AppError(404, 'Carte non trouvée.');
    }

    const creator = await fastify.models.User.findById(card.createdBy) as IUser;
    if (creator.discordId) {
      await fastify.discordService.sendPrivateMessageCardApproval(
        creator.discordId,
        card as ICard
      );
    }

    card.status = 'waiting';
    await card.save();

    return fastify.models.Card.findById(card.id).populate('frontAsset borderAsset createdBy');
  });

  fastify.post('/:id/reject', { preHandler: [adminGuard] }, async (req) => {
    const cardId = (req.params as any).id as string;
    const card = await fastify.models.Card.findById(cardId);
    if (!card) {
      throw new AppError(404, 'Carte non trouvée.');
    }

    const creator = await fastify.models.User.findById(card.createdBy) as IUser;

    if (creator.discordId) {
      await fastify.discordService.sendPrivateMessageCardRejected(
        creator.discordId,
        card as ICard
      );
    }

    card.status = 'inactive';
    await card.save();

    return fastify.models.Card.findById(card.id).populate('frontAsset borderAsset createdBy');
  });

  fastify.patch('/:id', { preHandler: [adminGuard] }, async (req) => {
    try {
      const {id} = req.params as { id: string };
      const body = req.body as Partial<ICard> & { imageBase64?: string; imageMimeType?: string; imageUrl?: string };

      const card = await fastify.models.Card.findById(id);
      if (!card) {
        throw new AppError(404, 'Carte non trouvée.');
      }

      let imageUrl = body.imageUrl ?? card.imageUrl;

      // Upload new image to Cloudinary if provided as base64
      // Skip upload if imageUrl is provided (Discord avatars)
      if (body.imageBase64 && body.imageBase64 !== card.imageUrl && !body.imageUrl) {
        try {
          const result = await uploadCardImage(body.imageBase64, `card-update-${Date.now()}`);
          imageUrl = result.imageUrl;
        } catch (uploadError) {
          log(fastify, `Erreur lors de l'upload Cloudinary: ${uploadError}`, 'error');
          throw new AppError(400, 'Erreur lors de l\'upload de l\'image.');
        }
      }

      // Update card
      const updatedCard = await fastify.models.Card.findByIdAndUpdate(
        id,
        {
          ...body,
          imageUrl,
          // Ensure base64 fields are not stored
          imageBase64: undefined,
          imageMimeType: undefined,
        },
        {new: true}
      ).populate('frontAsset').populate('borderAsset');

      log(fastify, `Mise à jour d'une carte par ${req.session.userId}: ${id}`, 'info');

      return updatedCard;
    } catch (error) {
      log(fastify, `Erreur lors de la mise à jour de la carte : ${error}`, 'error');
      throw error instanceof AppError ? error : new AppError(500, 'Erreur lors de la mise à jour de la carte');
    }
  });
}

export default cardsAdminRoutes;