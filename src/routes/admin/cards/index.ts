import {FastifyPluginAsync} from "fastify";
import {adminGuard} from "../../../middleware/authGuard";
import {ICard} from "../../../models/Card";
import {IUser} from "../../../models/User";

const cardsAdminRoutes: FastifyPluginAsync = async (fastify) => {

  fastify.get('/', { preHandler: [adminGuard] }, async (req, resp) => {
    const cards = await fastify.models.Card.find().populate('frontAsset borderAsset createdBy category');

    return cards;
  });

  fastify.post('/:id/approve', { preHandler: [adminGuard] }, async (req, resp) => {
    const cardId = (req.params as any).id as string;
    const card = await fastify.models.Card.findById(cardId);
    if (!card) {
      resp.status(404);
      return { message: 'Carte non trouvée.' };
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

  fastify.post('/:id/reject', { preHandler: [adminGuard] }, async (req, resp) => {
    const cardId = (req.params as any).id as string;
    const card = await fastify.models.Card.findById(cardId);
    if (!card) {
      resp.status(404);
      return { message: 'Carte non trouvée.' };
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

  fastify.patch('/:id', { preHandler: [adminGuard] }, async (req, resp) => {
    const cardId = (req.params as any).id as string;
    const body = (req.body ?? {}) as Partial<ICard>;

    const card = await fastify.models.Card.findById(cardId);
    if (!card) {
      resp.status(404);
      return { message: 'Carte non trouvée.' };
    }

    // Champs autorisés à la modification côté admin (override status/ownership)
    const allowedFields: Array<keyof ICard> = [
      'title',
      'imageUrl',
      'imageBase64',
      'imageMimeType',
      'frontAssetId',
      'borderAssetId',
      'categoryId',
      'rarity',
      'titlePosX',
      'titlePosY',
      'titleAlign',
      'titleWidth',
      'removeImageBg',
      'holographicEffect',
      'holographicIntensity',
      'titleColor',
      'titleFontSize',
      'imagePosX',
      'imagePosY',
      'imageScale',
      'imageWidth',
      'imageHeight',
      'imageObjectFit',
      'customTexts',
      // Optionnel : permettre aussi le changement de status via cette route
      'status',
    ];

    for (const key of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(body, key) && typeof (body as any)[key] !== 'undefined') {
        if (key === 'categoryId') {
          if ((body as any)[key].length === 0) continue;
        }
        (card as any)[key] = (body as any)[key];
      }
    }

    await card.save();

    return fastify.models.Card.findById(card.id).populate('frontAsset borderAsset createdBy category');
  });
}

export default cardsAdminRoutes;