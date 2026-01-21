import {FastifyPluginAsync} from "fastify";
import {log, AppError} from "../../utils/utils";

const twitchRoutes: FastifyPluginAsync = async (fastify) => {

  // Route pour lister toutes les souscriptions
  fastify.get('/subscriptions', async () => {
    const subs = await fastify.twitchService.listAllSubscriptions();
    return subs;
  });

  // Route pour supprimer toutes les souscriptions
  fastify.delete('/subscriptions', async () => {
    const result = await fastify.twitchService.deleteAllSubscriptions();
    return result;
  });

  // Route webhook Twitch EventSub
  fastify.post('/webhook', async (req, res) => {
    // Vérifier la signature
    if (!fastify.twitchService.verifyTwitchSignature(req)) {
      log(fastify, '[TwitchWebhook] ❌ Signature invalide', 'error');
      throw new AppError(403, 'Signature invalide');
    }

    const messageType = req.headers['twitch-eventsub-message-type'];

    switch (messageType) {
      case 'webhook_callback_verification':
        // Répondre au challenge pour vérifier le webhook
        const challengeBody = req.body as any;
        return res.status(200).type('text/plain').send(challengeBody.challenge);

      case 'notification':
        const notificationBody = req.body as any;

        if (notificationBody.subscription.type === 'stream.online') {
          const event = notificationBody.event;
          const streamerUsername = event.broadcaster_user_name;
          const streamerId = event.broadcaster_user_id;

          // Récupérer les détails du stream et envoyer la notification Discord
          const streamDetails = await fastify.twitchService.getStreamInfoByUserId(streamerId);
          if (streamDetails) {
            await fastify.discordService.sendTwitchNotification(streamDetails, streamerUsername);
          } else {
            log(fastify, `[TwitchWebhook] ❌ Impossible de récupérer les détails du stream`, 'error');
          }
        }

        return res.status(200).send('OK');

      case 'revocation':
        log(fastify, `[TwitchWebhook] ⚠️ Souscription révoquée`, 'error');
        return res.status(200).send('OK');

      default:
        log(fastify, `[TwitchWebhook] ❌ Type de message inconnu: ${messageType}`, 'error');
        throw new AppError(400, 'Type de message inconnu');
    }
  });
}

export default twitchRoutes;
