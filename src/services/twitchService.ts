import {log} from "../utils/utils";
import {FastifyInstance, FastifyRequest} from "fastify";
import {URLSearchParams} from "node:url";
import {IUser} from "../models/User";

class TwitchService {

  private readonly fastify: FastifyInstance;
  private readonly twitchClientId: string = process.env.TWITCH_CLIENT_ID || '';
  private readonly twitchClientSecret: string = process.env.TWITCH_CLIENT_SECRET || '';
  private readonly BASE_URL = process.env.BASE_URL || ''; // e.g., https://yourdomain.com
  private readonly TWITCH_CALLBACK_PATH = '/api/twitch/twitch-webhook'; // Path where twitch routes are mounted + /twitch-webhook
  private readonly EVENTSUB_SECRET = process.env.EVENTSUB_SECRET || '';

  private twitchAccessToken: string | null = null;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
    if (!this.twitchClientId || !this.twitchClientSecret) {
      log(this.fastify, `[TwitchService] Les identifiants Twitch ne sont pas configurés correctement. ${this.twitchClientId} | ${this.twitchClientSecret}`, 'error');
    }
  }

  private async getTwitchAccessToken() {
    const url = 'https://id.twitch.tv/oauth2/token';
    const params = new URLSearchParams();
    params.append('client_id', this.twitchClientId)
    params.append('client_secret', this.twitchClientSecret)
    params.append('grant_type', 'client_credentials');

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: params.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      if (!response.ok) {
        log(this.fastify, `[TwitchService] Échec de la récupération du token d'accès Twitch. Statut HTTP : ${response.status}`, 'error');
        return false;
      }
      const data = await response.json() as any;
      this.twitchAccessToken = data.access_token;
      return true;
    } catch (error) {
      log(this.fastify, `[TwitchService] Erreur lors de la récupération du token d'accès Twitch : ${error}`, 'error');
      this.twitchAccessToken = null;
      return false;
    }
  }

  private async getStreamerId(streamerUsername: string): Promise<string | null> {
    if (!this.twitchAccessToken) {
      log(this.fastify, "[TwitchService] Pas de token d'accès Twitch. Tentative de récupération...", 'error');
      if (!(await this.getTwitchAccessToken())) {
        return null;
      }
    }
    const url = `https://api.twitch.tv/helix/users?login=${streamerUsername}`;
    const headers = { "Client-ID": this.twitchClientId, "Authorization": `Bearer ${this.twitchAccessToken}` };
    try {
      const response = await fetch(url, { method: 'GET', headers });
      const data = await response.json() as any;
      if (data.data && data.data.length > 0) {
        return data.data[0].id;
      } else {
        log(this.fastify, `[TwitchService] Aucun utilisateur Twitch trouvé pour le nom: ${streamerUsername}`, 'error');
        return null;
      }
    } catch (error: any) {
      log(this.fastify, `[TwitchService] Erreur lors de la récupération de l'ID du streamer ${streamerUsername}: ${error.message}`, 'error');
      if (error.response?.status === 401) {
        log(this.fastify, "[TwitchService] Token Twitch invalide ou expiré. Tentative de rafraîchissement.", 'info');
        if (await this.getTwitchAccessToken()) {
          // Retry once after refreshing token
          try {
            const retryResponse = await fetch(url, { headers: { "Client-ID": this.twitchClientId, "Authorization": `Bearer ${this.twitchAccessToken}` } });
            const data = await retryResponse.json() as any;
            if (data.data && data.data.length > 0) {
              return data.data[0].id;
            }
          } catch (retryError: any) {
            log(this.fastify, `Erreur lors de la nouvelle tentative de récupération de l'ID du streamer ${streamerUsername}: ${retryError.message}`, 'error');
          }
        }
      }
      return null;
    }
  }

  private async createEventSubSubscription(streamerId: string, streamerUsername: string, userId: string): Promise<boolean> {
    if (!this.twitchAccessToken || !streamerId) {
      log(this.fastify, `[TwitchService] Impossible de créer l'abonnement EventSub pour ${streamerUsername} (${userId}) : informations manquantes.`, 'error');
      return false;
    }

    const url = "https://api.twitch.tv/helix/eventsub/subscriptions";
    const headers = {
      "Client-ID": this.twitchClientId,
      "Authorization": `Bearer ${this.twitchAccessToken}`,
      "Content-Type": "application/json"
    };
    const callbackUrl = `${this.BASE_URL}${this.TWITCH_CALLBACK_PATH}`;
    const data = {
      type: "stream.online",
      version: "1",
      condition: {
        broadcaster_user_id: streamerId
      },
      transport: {
        method: "webhook",
        callback: callbackUrl,
        secret: this.EVENTSUB_SECRET
      }
    };

    try {
      const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(data) });
      const user = await this.fastify.models.User.findById(userId) as IUser;
      if (user) {
        const data = await response.json() as any;
        user.twitchSubscriptionId = data?.data[0]?.id || null;
        await user.save();
        return true;
      } else {
        log(this.fastify, `[TwitchService] Utilisateur introuvable lors de la création de l'abonnement EventSub pour ${streamerUsername} (${userId}).`, 'error');
        return false;
      }
    }
    catch (error: any) {
      log(this.fastify, `[TwitchService] Erreur lors de la création de l'abonnement EventSub pour ${streamerUsername} (${userId}) : ${error.message}`, 'error');
      return false;
    }
  }

  public async deleteOneEventSubSubscription(subscriptionId: string): Promise<boolean> {
    if (!this.twitchAccessToken) {
      if (!(await this.getTwitchAccessToken())) {
        return false;
      }
    }
    if (!subscriptionId) {
      log(this.fastify, `[TwitchService] ID d'abonnement Twitch invalide pour la suppression : ${subscriptionId}`, 'error');
      return false;
    }

    try {
      await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${subscriptionId}`, {
        method: 'DELETE',
        headers: {
          "Client-ID": this.twitchClientId,
          "Authorization": `Bearer ${this.twitchAccessToken}`
        }
      });
      return true;
    }
    catch (error: any) {
      log(this.fastify, `[TwitchService] Erreur lors de la suppression de l'abonnement EventSub ${subscriptionId} : ${error.message}`, 'error');
      return false;
    }
  }

  public async addOneTwitchEventSubscription(streamerUsername: string, userId: string, oldSubscriptionId?: string): Promise<boolean> {
    if (!streamerUsername || streamerUsername.trim() === '') {
      log(this.fastify, `[TwitchService] Nom d'utilisateur Twitch invalide pour l'abonnement : ${userId} -> ${streamerUsername}`, 'error');
      return false;
    }

    if (!await this.getTwitchAccessToken()) {
      log(this.fastify, `[TwitchService] Impossible d'obtenir un token d'accès Twitch pour l'abonnement : ${userId} -> ${streamerUsername}`, 'error');
      return false;
    }

    if (oldSubscriptionId && oldSubscriptionId.trim() !== '') {
      await this.deleteOneEventSubSubscription(oldSubscriptionId);
    }

    const streamerId = await this.getStreamerId(streamerUsername);
    if (!streamerId) {
      log(this.fastify, `[TwitchService] Impossible d'obtenir l'ID du streamer Twitch pour l'abonnement : ${userId} -> ${streamerUsername}`, 'error');
      return false;
    }

    return await this.createEventSubSubscription(streamerId, streamerUsername, userId);
  }

  public verifyTwitchSignature(req: FastifyRequest) {
    const messageId = req.headers['Twitch-Eventsub-Message-Id'] as string;
    const timestamp = req.headers['Twitch-Eventsub-Message-Timestamp'] as string;
    const signature = req.headers['Twitch-Eventsub-Message-Signature'] as string;
    const body = req.raw

    if (!messageId || !timestamp || !signature || !body) {
      log(this.fastify, '[TwitchService] En-têtes de signature Twitch manquants ou corps brut manquant.', 'error');
      return false;
    }

    const hmacMessage = messageId + timestamp + body;
    const hmac = require("crypto").createHmac("sha256", this.EVENTSUB_SECRET).update(hmacMessage).digest("hex");
    const expectedSignature = `sha256=${hmac}`;

    try {
      const sigBuffer = Buffer.from(signature);
      const expectedSigBuffer = Buffer.from(expectedSignature);
      if (sigBuffer.length !== expectedSigBuffer.length) {
        return false;
      }
      return require("crypto").timingSafeEqual(sigBuffer, expectedSigBuffer);
    } catch (error: any) {
      log(this.fastify, `[TwitchService] Erreur lors de la vérification de la signature Twitch : ${error.message}`, 'error');
      return false;
    }
  }

  public async getStreamInfoByUserId(streamerId: string): Promise<any | null> {
    if (!this.twitchAccessToken) {
      if (!(await this.getTwitchAccessToken())) {
        return null;
      }
    }
    const url = `https://api.twitch.tv/helix/streams?user_id=${streamerId}`;
    const headers = { "Client-ID": this.twitchClientId, "Authorization": `Bearer ${this.twitchAccessToken}` };
    try {
      const response = await fetch(url, {method: 'GET', headers});
      const data = await response.json() as any;
      if (data.data && data.data.length > 0) {
        const streamData = data.data[0];
        return {
          title: streamData.title,
          game_name: streamData.game_name,
          thumbnail_url: streamData.thumbnail_url,
        }
      } else {
        return null;
      }
    } catch (error: any) {
      log(this.fastify, `[TwitchService] Erreur lors de la récupération des informations de stream pour l'ID ${streamerId}: ${error.message}`, 'error');
      return null;
    }
  }
}

export default TwitchService;