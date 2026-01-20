import {log} from "../utils/utils";
import {FastifyInstance, FastifyRequest} from "fastify";
import {URLSearchParams} from "node:url";
import {IUser} from "../models/User";

class TwitchService {

  private readonly fastify: FastifyInstance;
  private readonly twitchClientId: string = process.env.TWITCH_CLIENT_ID || '';
  private readonly twitchClientSecret: string = process.env.TWITCH_CLIENT_SECRET || '';
  private readonly BASE_URL = process.env.BASE_URL || '';
  private readonly TWITCH_CALLBACK_PATH = '/api/twitch/webhook';
  private readonly EVENTSUB_SECRET = process.env.EVENTSUB_SECRET || '';

  private twitchAccessToken: string | null = null;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
    if (!this.twitchClientId || !this.twitchClientSecret) {
      log(this.fastify, `[TwitchService] ❌ Identifiants Twitch manquants`, 'error');
    }
    if (!this.BASE_URL) {
      log(this.fastify, `[TwitchService] ❌ BASE_URL non configuré`, 'error');
    }
    if (!this.EVENTSUB_SECRET) {
      log(this.fastify, `[TwitchService] ❌ EVENTSUB_SECRET non configuré`, 'error');
    }
  }

  private async getTwitchAccessToken(): Promise<boolean> {
    const url = 'https://id.twitch.tv/oauth2/token';
    const params = new URLSearchParams();
    params.append('client_id', this.twitchClientId);
    params.append('client_secret', this.twitchClientSecret);
    params.append('grant_type', 'client_credentials');

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: params.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      if (!response.ok) {
        log(this.fastify, `[TwitchService] Échec récupération token (${response.status})`, 'error');
        return false;
      }

      const data = await response.json() as any;
      this.twitchAccessToken = data.access_token;
      return true;
    } catch (error: any) {
      log(this.fastify, `[TwitchService] Erreur récupération token: ${error.message}`, 'error');
      this.twitchAccessToken = null;
      return false;
    }
  }

  /**
   * Vérification de la signature HMAC des webhooks Twitch
   */
  public verifyTwitchSignature(req: FastifyRequest): boolean {
    const messageId = req.headers['twitch-eventsub-message-id'] as string;
    const timestamp = req.headers['twitch-eventsub-message-timestamp'] as string;
    const signature = req.headers['twitch-eventsub-message-signature'] as string;
    const body = (req as any).rawBody as string;

    if (!messageId || !timestamp || !signature || !body) {
      log(this.fastify, `[TwitchService] ❌ Headers manquants pour vérification signature`, 'error');
      return false;
    }

    const hmacMessage = messageId + timestamp + body;
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', this.EVENTSUB_SECRET).update(hmacMessage).digest('hex');
    const expectedSignature = `sha256=${hmac}`;

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error: any) {
      log(this.fastify, `[TwitchService] ❌ Erreur vérification signature: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Création d'une souscription EventSub webhook
   */
  private async createEventSubSubscription(streamerId: string, streamerUsername: string, userId: string): Promise<boolean> {
    if (!await this.getTwitchAccessToken()) {
      return false;
    }

    const callbackUrl = `${this.BASE_URL}${this.TWITCH_CALLBACK_PATH}`;

    try {
      const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
        method: 'POST',
        headers: {
          'Client-ID': this.twitchClientId,
          'Authorization': `Bearer ${this.twitchAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'stream.online',
          version: '1',
          condition: {
            broadcaster_user_id: streamerId
          },
          transport: {
            method: 'webhook',
            callback: callbackUrl,
            secret: this.EVENTSUB_SECRET
          }
        })
      });

      const data = await response.json() as any;

      if (response.ok) {
        const subscriptionId = data.data?.[0]?.id;

        // Sauvegarder le subscription ID dans l'utilisateur
        const user = await this.fastify.models.User.findById(userId) as IUser;
        if (user) {
          user.twitchSubscriptionId = subscriptionId;
          await user.save();
        }

        return true;
      } else {
        log(this.fastify, `[TwitchService] ❌ Erreur création souscription pour ${streamerUsername}: ${data.message || JSON.stringify(data)}`, 'error');
        return false;
      }
    } catch (error: any) {
      log(this.fastify, `[TwitchService] ❌ Erreur création souscription: ${error.message}`, 'error');
      return false;
    }
  }

  private async getStreamerId(streamerUsername: string): Promise<string | null> {
    if (!this.twitchAccessToken) {
      if (!await this.getTwitchAccessToken()) {
        return null;
      }
    }

    try {
      const response = await fetch(`https://api.twitch.tv/helix/users?login=${streamerUsername}`, {
        method: 'GET',
        headers: {
          'Client-ID': this.twitchClientId,
          'Authorization': `Bearer ${this.twitchAccessToken}`
        }
      });

      const data = await response.json() as any;

      if (data.data && data.data.length > 0) {
        return data.data[0].id;
      }

      log(this.fastify, `[TwitchService] ❌ Utilisateur Twitch introuvable: ${streamerUsername}`, 'error');
      return null;
    } catch (error: any) {
      log(this.fastify, `[TwitchService] ❌ Erreur récupération ID streamer ${streamerUsername}: ${error.message}`, 'error');
      return null;
    }
  }

  /**
   * Ajout d'une souscription pour un utilisateur
   */
  public async addOneTwitchEventSubscription(streamerUsername: string, userId: string, oldSubscriptionId?: string): Promise<boolean> {
    if (!streamerUsername || !streamerUsername.trim()) {
      log(this.fastify, `[TwitchService] ❌ Username Twitch invalide`, 'error');
      return false;
    }

    // Supprimer l'ancienne souscription si elle existe
    if (oldSubscriptionId) {
      await this.deleteOneEventSubSubscription(oldSubscriptionId);
    }

    const streamerId = await this.getStreamerId(streamerUsername);
    if (!streamerId) {
      return false;
    }

    // Supprimer les souscriptions existantes pour ce broadcaster
    await this.deleteSubscriptionsByBroadcasterId(streamerId);

    return await this.createEventSubSubscription(streamerId, streamerUsername, userId);
  }

  public async deleteSubscriptionsByBroadcasterId(streamerId: string): Promise<boolean> {
    if (!streamerId || !await this.getTwitchAccessToken()) {
      return false;
    }

    try {
      const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
        method: 'GET',
        headers: {
          'Client-ID': this.twitchClientId,
          'Authorization': `Bearer ${this.twitchAccessToken}`
        }
      });

      if (!response.ok) {
        return false;
      }

      const body = await response.json() as any;
      const subs = (body?.data || []).filter((s: any) => s?.condition?.broadcaster_user_id === streamerId);

      for (const s of subs) {
        await this.deleteOneEventSubSubscription(s.id);
      }

      return true;
    } catch (error: any) {
      log(this.fastify, `[TwitchService] ❌ Erreur suppression souscriptions: ${error.message}`, 'error');
      return false;
    }
  }

  public async deleteOneEventSubSubscription(subscriptionId: string): Promise<boolean> {
    if (!subscriptionId || !await this.getTwitchAccessToken()) {
      return false;
    }

    try {
      await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${subscriptionId}`, {
        method: 'DELETE',
        headers: {
          'Client-ID': this.twitchClientId,
          'Authorization': `Bearer ${this.twitchAccessToken}`
        }
      });
      return true;
    } catch (error: any) {
      log(this.fastify, `[TwitchService] ❌ Erreur suppression souscription: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Liste toutes les souscriptions EventSub actives
   */
  public async listAllSubscriptions(): Promise<any> {
    if (!await this.getTwitchAccessToken()) {
      return { error: 'Impossible de récupérer le token' };
    }

    try {
      const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
        method: 'GET',
        headers: {
          'Client-ID': this.twitchClientId,
          'Authorization': `Bearer ${this.twitchAccessToken}`
        }
      });

      const data = await response.json() as any;

      if (response.ok) {
        return {
          total: data.total,
          total_cost: data.total_cost,
          max_total_cost: data.max_total_cost,
          subscriptions: data.data.map((sub: any) => ({
            id: sub.id,
            type: sub.type,
            status: sub.status,
            broadcaster_user_id: sub.condition?.broadcaster_user_id,
            callback: sub.transport?.callback,
            created_at: sub.created_at
          }))
        };
      } else {
        return { error: data.message || 'Erreur récupération souscriptions' };
      }
    } catch (error: any) {
      return { error: error.message };
    }
  }

  /**
   * Supprime TOUTES les souscriptions EventSub
   */
  public async deleteAllSubscriptions(): Promise<{ deleted: number; errors: number }> {
    if (!await this.getTwitchAccessToken()) {
      return { deleted: 0, errors: 1 };
    }

    try {
      const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
        method: 'GET',
        headers: {
          'Client-ID': this.twitchClientId,
          'Authorization': `Bearer ${this.twitchAccessToken}`
        }
      });

      const data = await response.json() as any;

      if (!response.ok) {
        return { deleted: 0, errors: 1 };
      }

      let deleted = 0;
      let errors = 0;

      for (const sub of data.data || []) {
        const success = await this.deleteOneEventSubSubscription(sub.id);
        if (success) {
          deleted++;
        } else {
          errors++;
        }
      }

      return { deleted, errors };
    } catch (error: any) {
      log(this.fastify, `[TwitchService] ❌ Erreur suppression toutes souscriptions: ${error.message}`, 'error');
      return { deleted: 0, errors: 1 };
    }
  }

  public async getStreamInfoByUserId(streamerId: string, retryCount = 0): Promise<any | null> {
    if (!this.twitchAccessToken && !await this.getTwitchAccessToken()) {
      return null;
    }

    try {
      const response = await fetch(`https://api.twitch.tv/helix/streams?user_id=${streamerId}`, {
        method: 'GET',
        headers: {
          'Client-ID': this.twitchClientId,
          'Authorization': `Bearer ${this.twitchAccessToken}`
        }
      });

      const data = await response.json() as any;

      if (data.data && data.data.length > 0) {
        const streamData = data.data[0];
        return {
          title: streamData.title,
          game_name: streamData.game_name,
          thumbnail_url: streamData.thumbnail_url,
        };
      }

      // Retry avec délai si pas encore disponible
      const maxRetries = 6;
      const retryDelay = 3000;

      if (retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.getStreamInfoByUserId(streamerId, retryCount + 1);
      }

      log(this.fastify, `[TwitchService] ❌ Stream introuvable après ${maxRetries} tentatives`, 'error');
      return null;
    } catch (error: any) {
      log(this.fastify, `[TwitchService] ❌ Erreur récupération stream info: ${error.message}`, 'error');
      return null;
    }
  }
}

export default TwitchService;