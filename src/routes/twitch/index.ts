import {FastifyPluginAsync} from "fastify";
import {log} from "../../utils/utils";

const twitchRoutes: FastifyPluginAsync = async (fastify) => {

  // Log au démarrage pour confirmer l'enregistrement de la route
  fastify.addHook('onReady', () => {
    const baseUrl = process.env.BASE_URL || 'NON_CONFIGURÉ';
    log(fastify, `[TwitchRoutes] Route webhook enregistrée sur: ${baseUrl}/api/twitch/twitch-webhook`, 'info');
  });

  fastify.post('/twitch-webhook', async (req, res) => {
    log(fastify, `[TwitchWebhook] Requête reçue - Headers: ${JSON.stringify(req.headers)}`, 'info');
    log(fastify, `[TwitchWebhook] Body: ${JSON.stringify(req.body)}`, 'info');

    // if (!fastify.twitchService.verifyTwitchSignature(req)) {
    //   log(fastify, 'Signature Twitch invalide pour la requête webhook.', 'error');
    //   return res.status(403).send('Accès refusé : signature Twitch invalide');
    // }

    const messageType = req.headers['twitch-eventsub-message-type'];
    console.log(messageType);

    switch (messageType) {
      case 'webhook_callback_verification':
        const challengeBody = req.body as any;
        return res.status(200).type('text/plain').send(challengeBody.challenge);
      case 'notification':
        const notificationBody = req.body as any;
        if (notificationBody.subscription.type === 'stream.online') {
          const eventData = notificationBody.event;
          const streamerUsername = eventData.broadcaster_user_name;
          const streamerId = eventData.broadcaster_user_id;

          const streamDetails = await fastify.twitchService.getStreamInfoByUserId(streamerId);
          if (streamDetails) {
            await fastify.discordService.sendTwitchNotification(streamDetails, streamerUsername);
          }
        }
        return res.status(200).send('Notification received');
      case 'revocation':
        log(fastify, `Abonnement Twitch révoqué : ${JSON.stringify(req.body)}`, 'info');
        return res.status(200).send('Revocation received');
      default:
        log(fastify, `Type de message Twitch inconnu : ${messageType}`, 'error');
        return res.status(400).send('Requête invalide : type de message Twitch inconnu');
    }
  })
}

export default twitchRoutes;
