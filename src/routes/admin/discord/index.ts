import {FastifyPluginAsync} from "fastify";
import {adminGuard} from "../../../middleware/authGuard";

const adminDiscordRoutes: FastifyPluginAsync = async (fastify) => {
  // Liste des messages privés reçus (inbound DMs)
  fastify.get('/dm', { preHandler: [adminGuard] }, async (request) => {
    const page = parseInt((request.query as any).page || '1', 10);
    const limit = Math.min(parseInt((request.query as any).limit || '20', 10), 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      fastify.models.DiscordMessage.find({ direction: 'inbound', targetType: 'dm' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      fastify.models.DiscordMessage.countDocuments({ direction: 'inbound', targetType: 'dm' })
    ]);

    return { items, total, page, pageSize: limit };
  });

  // Envoi d'un message (texte ou embed) vers un salon ou en DM
  fastify.post('/send', { preHandler: [adminGuard] }, async (request, reply) => {
    const body = request.body as {
      targetType: 'channel' | 'dm';
      discordChannelId?: string;
      discordUserId?: string;
      messageType: 'text' | 'embed';
      content?: string;
      embed?: {
        title?: string;
        description?: string;
        color?: string;
        imageUrl?: string;
        footer?: string;
        fields?: Array<{ name: string; value: string; inline?: boolean }>;
      };
    };

    if (body.targetType === 'channel' && !body.discordChannelId) {
      return reply.status(400).send({ error: 'discordChannelId requis pour un message de type channel' });
    }
    if (body.targetType === 'dm' && !body.discordUserId) {
      return reply.status(400).send({ error: 'discordUserId requis pour un message privé' });
    }

    // Validation contenu
    if (body.messageType === 'text' && !body.content) {
      return reply.status(400).send({ error: 'content requis pour un message texte' });
    }
    if (body.messageType === 'embed' && !body.embed) {
      return reply.status(400).send({ error: 'embed requis pour un message embed' });
    }

    try {
      const messageId = await fastify.discordService.sendAdminMessage({
        targetType: body.targetType,
        discordChannelId: body.discordChannelId,
        discordUserId: body.discordUserId,
        messageType: body.messageType,
        content: body.content,
        embed: body.embed
      });
      return { success: true, messageId };
    } catch (error) {
      fastify.log.error({ err: error }, 'Erreur envoi message Discord');
      return reply.status(500).send({ error: 'Erreur lors de l\'envoi du message Discord' });
    }
  });

  // Liste des utilisateurs ayant des DMs (threads) avec indicateur non lu
  fastify.get('/dm/threads', { preHandler: [adminGuard] }, async () => {
    const pipeline: any[] = [
      { $match: { targetType: 'dm' } },
      { $sort: { createdAt: -1 } },
      { $group: {
        _id: '$discordUserId',
        lastMessageAt: { $first: '$createdAt' },
        lastMessage: { $first: '$$ROOT' },
        unreadCount: { $sum: { $cond: [{ $and: [ { $eq: ['$direction', 'inbound'] }, { $eq: ['$isRead', false] } ] }, 1, 0] } }
      } },
      { $sort: { lastMessageAt: -1 } }
    ];
    const threads = await fastify.models.DiscordMessage.aggregate(pipeline);
    return threads.map(t => ({
      discordUserId: t._id,
      lastMessageAt: t.lastMessageAt,
      unreadCount: t.unreadCount,
      lastMessage: t.lastMessage
    }));
  });

  // Liste des messages d'un utilisateur (in/out)
  fastify.get('/dm/:discordUserId', { preHandler: [adminGuard] }, async (request) => {
    const { discordUserId } = request.params as any;
    const messages = await fastify.models.DiscordMessage.find({ targetType: 'dm', discordUserId })
      .sort({ createdAt: 1 });
    await fastify.models.DiscordMessage.updateMany({ targetType: 'dm', discordUserId, direction: 'inbound', isRead: false }, { $set: { isRead: true } });
    return messages;
  });

  // Métadonnées Discord (channels + membres) pour peupler les listes
  fastify.get('/meta', { preHandler: [adminGuard] }, async () => {
    return (fastify as any).discordMetadata || { channels: [], members: [] };
  });
};

export default adminDiscordRoutes;
