import {FastifyPluginAsync} from "fastify";
import {log} from "../../utils/utils";

const twitchRoutes: FastifyPluginAsync = async (fastify) => {

  // Log au démarrage pour confirmer l'enregistrement de la route
  fastify.addHook('onReady', () => {
    const baseUrl = process.env.BASE_URL || 'NON_CONFIGURÉ';
    log(fastify, `[TwitchRoutes] Route webhook enregistrée sur: ${baseUrl}/api/twitch/twitch-webhook`, 'info');
  });

  // Route webhook Twitch EventSub
  fastify.post('/twitch-webhook', async (req, res) => {
    log(fastify, `[TwitchWebhook] 📨 Requête reçue`, 'info');
    log(fastify, `[TwitchWebhook] Headers: ${JSON.stringify(req.headers)}`, 'info');
    log(fastify, `[TwitchWebhook] Body: ${JSON.stringify(req.body)}`, 'info');

    if (!fastify.twitchService.verifyTwitchSignature(req)) {
      log(fastify, '[TwitchWebhook] ❌ Signature Twitch invalide', 'error');
      return res.status(403).send('Accès refusé : signature Twitch invalide');
    }

    const messageType = req.headers['twitch-eventsub-message-type'];
    log(fastify, `[TwitchWebhook] Type de message: ${messageType}`, 'info');

    switch (messageType) {
      case 'webhook_callback_verification':
        const challengeBody = req.body as any;
        log(fastify, `[TwitchWebhook] ✅ Vérification webhook - Challenge: ${challengeBody.challenge}`, 'info');
        return res.status(200).type('text/plain').send(challengeBody.challenge);

      case 'notification':
        const notificationBody = req.body as any;
        log(fastify, `[TwitchWebhook] 🔔 Notification reçue - Type: ${notificationBody.subscription.type}`, 'info');

        if (notificationBody.subscription.type === 'stream.online') {
          const eventData = notificationBody.event;
          const streamerUsername = eventData.broadcaster_user_name;
          const streamerId = eventData.broadcaster_user_id;

          log(fastify, `[TwitchWebhook] 🎮 Stream online détecté: ${streamerUsername} (ID: ${streamerId})`, 'info');

          const streamDetails = await fastify.twitchService.getStreamInfoByUserId(streamerId);
          if (streamDetails) {
            log(fastify, `[TwitchWebhook] ✅ Détails du stream récupérés, envoi notification Discord`, 'info');
            await fastify.discordService.sendTwitchNotification(streamDetails, streamerUsername);
            log(fastify, `[TwitchWebhook] ✅ Notification Discord envoyée pour ${streamerUsername}`, 'info');
          } else {
            log(fastify, `[TwitchWebhook] ❌ Impossible de récupérer les détails du stream pour ${streamerUsername}`, 'error');
          }
        }
        return res.status(200).send('Notification received');

      case 'revocation':
        log(fastify, `[TwitchWebhook] ⚠️ Abonnement révoqué: ${JSON.stringify(req.body)}`, 'info');
        return res.status(200).send('Revocation received');

      default:
        log(fastify, `[TwitchWebhook] ❓ Type de message inconnu: ${messageType}`, 'error');
        return res.status(400).send('Requête invalide : type de message Twitch inconnu');
    }
  })
}

export default twitchRoutes;
