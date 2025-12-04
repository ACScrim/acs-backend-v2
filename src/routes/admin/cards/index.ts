import {FastifyPluginAsync} from "fastify";
import {adminGuard} from "../../../middleware/authGuard";
import {ICard} from "../../../models/Card";
import {IUser} from "../../../models/User";

const cardsAdminRoutes: FastifyPluginAsync = async (fastify) => {

  fastify.get('/', { preHandler: [adminGuard] }, async (req, resp) => {
    const cards = await fastify.models.Card.find().populate('frontAsset borderAsset createdBy');

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

    await fastify.discordService.sendPrivateMessageCardApproval(
      creator.discordId,
      card as ICard
    );

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

    await fastify.discordService.sendPrivateMessageCardRejected(
      creator.discordId,
      card as ICard
    );

    card.status = 'inactive';

    await card.save();

    return fastify.models.Card.findById(card.id).populate('frontAsset borderAsset createdBy');
  })
}

export default cardsAdminRoutes;