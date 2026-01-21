import { DiscordUser } from "../../../../types";
import { FastifyPluginAsync } from "fastify";
import { log, AppError } from "../../../../utils/utils";

const DISCORD_SERVER_ID = process.env.DISCORD_GUILD_ID || '1330973733929615420';

const authDiscordVerifyMembershipRoute: FastifyPluginAsync = async (fastify) => {
  /**
   * Vérifie l'appartenance au serveur Discord et crée/met à jour l'utilisateur
   * Utilisé après la redirection d'invitation Discord
   */
  fastify.post('/', async (req, res) => {
    try {
      const userId = req.session.userId;
      if (userId) {
        return res.status(200).send({ message: 'User already authenticated' });
      }

      const body = (req.body || {}) as { vmToken?: string };

      let tempToken: string | undefined;

      // 1) Nouveau chemin recommandé : token de vérification signé (ne dépend pas des cookies)
      if (body.vmToken) {
        try {
          const payload = fastify.jwt.verify(body.vmToken) as any;
          if (payload?.purpose === 'discord_verify_membership' && typeof payload?.access_token === 'string') {
            tempToken = payload.access_token;
          }
        } catch {
          throw new AppError(401, 'Invalid or expired verification token');
        }
      }

      // 2) Fallback : session (ancien comportement)
      if (!tempToken) {
        // @ts-ignore
        tempToken = req.session.discord_temp_token;
      }

      if (!tempToken) {
        throw new AppError(401, 'No temporary token found');
      }

      // Vérifier l'appartenance au serveur
      const memberResponse = await fetch(`https://discord.com/api/v10/users/@me/guilds/${DISCORD_SERVER_ID}/member`, {
        headers: {
          Authorization: `Bearer ${tempToken}`
        }
      });

      if (!memberResponse.ok) {
        throw new AppError(403, 'Not a member of the required server');
      }

      // Récupérer les infos utilisateur
      const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
        headers: {
          Authorization: `Bearer ${tempToken}`
        }
      });
      const discordUser = await userResponse.json() as DiscordUser;

      // Créer ou mettre à jour l'utilisateur
      let user = await fastify.models.User.findOne({ discordId: discordUser.id }).exec();
      if (user) {
        await fastify.models.User.updateOne(
          { discordId: discordUser.id },
          {
            email: discordUser.email,
            username: discordUser.global_name || discordUser.username,
            avatarUrl: discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : undefined,
          }
        );
        // Récupérer l'utilisateur mis à jour
        user = await fastify.models.User.findOne({ discordId: discordUser.id }).exec();
      } else {
        user = await fastify.models.User.create({
          email: discordUser.email,
          username: discordUser.global_name || discordUser.username,
          discordId: discordUser.id,
          avatarUrl: discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : undefined,
        });
      }

      // Nettoyer le token temporaire de la session (si présent)
      // @ts-ignore
      delete req.session.discord_temp_token;

      // Créer la session authentifiée
      req.session.userId = user._id.toString();
      req.session.authenticated = true;
      await req.session.save();

      return { success: true };
    } catch (error) {
      log(fastify, `Erreur lors de la vérification d'appartenance Discord : ${error}`, 'error');
      throw error instanceof AppError ? error : new AppError(500, 'Verification failed');
    }
  });
};

export default authDiscordVerifyMembershipRoute;

