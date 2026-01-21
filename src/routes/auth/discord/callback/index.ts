import { DiscordUser } from "../../../../types";
import { FastifyPluginAsync } from "fastify";
import { log, AppError } from "../../../../utils/utils";

const DISCORD_SERVER_ID = process.env.DISCORD_GUILD_ID || '1330973733929615420';
const DISCORD_INVITE_URL = process.env.DISCORD_INVITE_URL || 'https://discord.gg/ksCGJztmBd';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';


const authDiscordCallbackRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Callback OAuth2 Discord - Traite la réponse d'authentification Discord
   * Crée ou met à jour l'utilisateur, établit la session authentifiée
   * Si l'utilisateur n'est pas membre du serveur, enregistre le token temporaire
   */
  fastify.get('/', async (req, res) => {
    try {
      const { code } = req.query as { code?: string };
      if (!code) {
        throw new AppError(400, 'Missing authorization code');
      }

      // @ts-ignore
      const oauth = await fastify.discordOAuth2.getAccessTokenFromAuthorizationCodeFlow(req, res);

      const access_token = oauth?.token?.access_token;
      if (!access_token) {
        log(
          fastify,
          `Discord OAuth2 callback: access_token manquant (hasToken=${Boolean(oauth?.token)}, url=${req.url})`,
          "error"
        );
        throw new AppError(500, "Authentication failed");
      }

      const memberResponse = await fetch(`https://discord.com/api/v10/users/@me/guilds/${DISCORD_SERVER_ID}/member`, {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      });

      if (!memberResponse.ok || memberResponse.status >= 400) {
        // Fallback mobile : on génère un token court, signé, pour permettre la vérification
        // même si la session cookie est perdue (F5, ITP, webview, etc.).
        const vmToken = fastify.jwt.sign(
          { purpose: 'discord_verify_membership', access_token },
          { expiresIn: '10m' }
        );

        // On garde aussi la session si elle existe, pour compat.
        req.session.discord_temp_token = access_token;
        await req.session.save();

        return res.redirect(
          `${FRONTEND_URL}/verify-membership?invite=${encodeURIComponent(DISCORD_INVITE_URL)}&vmToken=${encodeURIComponent(vmToken)}`
        );
      }

      const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      });
      const discordUser = await userResponse.json() as DiscordUser;

      // IMPORTANT: ne pas dépendre du client bot Discord ici (ça peut échouer/être lent,
      // et ce n'est pas requis pour créer la session app).

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
      } else {
        await fastify.models.User.create({
          email: discordUser.email,
          username: discordUser.global_name || discordUser.username,
          discordId: discordUser.id,
          avatarUrl: discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : undefined,
        });
      }
      user = await fastify.models.User.findOne({ discordId: discordUser.id }).exec();
      req.session.userId = user._id.toString();
      req.session.authenticated = true;
      await req.session.save();

      // Sur mobile/PWA, la session peut ne pas être visible immédiatement côté front.
      // On redirige vers la page de vérification qui fera un check et redirigera ensuite.
      const vmToken = fastify.jwt.sign(
        { purpose: 'discord_verify_membership', access_token },
        { expiresIn: '10m' }
      );
      return res.redirect(
        `${FRONTEND_URL}/verify-membership?invite=${encodeURIComponent(DISCORD_INVITE_URL)}&vmToken=${encodeURIComponent(vmToken)}`
      );
    } catch (error) {
      log(fastify, `Erreur lors de l'authentification Discord : ${error}`, 'error');
      throw error instanceof AppError ? error : new AppError(500, 'Authentication failed');
    }
  })
}

export default authDiscordCallbackRoutes;

