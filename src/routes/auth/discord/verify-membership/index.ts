import { DiscordUser } from "@app-types/index";
import { FastifyPluginAsync } from "fastify";
import { log } from "../../../../utils/utils";

const DISCORD_SERVER_ID = process.env.DISCORD_SERVER_ID || '1330973733929615420';

const authDiscordVerifyMembershipRoute: FastifyPluginAsync = async (fastify) => {
  /**
   * Vérifie l'appartenance au serveur Discord et crée/met à jour l'utilisateur
   * Utilisé après la redirection d'invitation Discord
   */
  fastify.post('/', async (req, res) => {
    try {
      // @ts-ignore
      const tempToken = req.session.discord_temp_token;

      if (!tempToken) {
        return res.status(401).send({ error: 'No temporary token found' });
      }

      // Vérifier l'appartenance au serveur
      const memberResponse = await fetch(`https://discord.com/api/v10/users/@me/guilds/${DISCORD_SERVER_ID}/member`, {
        headers: {
          Authorization: `Bearer ${tempToken}`
        }
      });

      if (!memberResponse.ok) {
        return res.status(403).send({ error: 'Not a member of the required server' });
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

      // Nettoyer le token temporaire de la session
      delete req.session.discord_temp_token;

      // Créer la session authentifiée
      req.session.userId = user._id.toString();
      req.session.authenticated = true;
      await req.session.save();

      return { success: true };
    } catch (error) {
      log(fastify, `Erreur lors de la vérification d'appartenance Discord : ${error}`, 'error');
      return res.status(500).send({ error: 'Verification failed' });
    }
  });
};

export default authDiscordVerifyMembershipRoute;

