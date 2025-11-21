import { DiscordUser } from "@app-types/index";
import { FastifyPluginAsync } from "fastify";
import { log } from "../../../../utils/utils";

const DISCORD_SERVER_ID = process.env.DISCORD_SERVER_ID || '1330973733929615420';
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
        return res.status(400).send({ error: 'Missing authorization code' });
      }

      // @ts-ignore
      const { token: { access_token } } = await fastify.discordOAuth2.getAccessTokenFromAuthorizationCodeFlow(req);

      const memberResponse = await fetch(`https://discord.com/api/v10/users/@me/guilds/${DISCORD_SERVER_ID}/member`, {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      });

      if (!memberResponse.ok) {
        req.session.discord_temp_token = access_token;
        await req.session.save();

        return res.redirect(`${FRONTEND_URL}/discord/join?invite=${encodeURIComponent(DISCORD_INVITE_URL)}`);
      }

      const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      });
      const discordUser = await userResponse.json() as DiscordUser;
      const discordMember = await fastify.discord.users.fetch(discordUser.id);

      let user = await fastify.models.User.findOne({ discordId: discordUser.id }).exec();
      if (user) {
        await fastify.models.User.updateOne(
          { discordId: discordUser.id },
          {
            email: discordUser.email,
            username: discordMember.displayName || discordMember.globalName || discordUser.username,
            avatarUrl: discordMember.avatarURL({ size: 64, extension: 'webp' }) || undefined,
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

      return res.redirect(`${FRONTEND_URL}`);
    } catch (error) {
      log(fastify, `Erreur lors de l'authentification Discord : ${error}`, 'error');
      return res.status(500).send({ error: 'Authentication failed' });
    }
  })
}

export default authDiscordCallbackRoutes;

