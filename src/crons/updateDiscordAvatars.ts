import { log } from "../utils/utils";
import { FastifyInstance } from "fastify";

export const startUpdateDiscordAvatarsCron = async (fastify: FastifyInstance) => {
  // Tous les jours à 3h du matin
  fastify.cron.schedule('0 3 * * *', async () => {
    log(fastify, "Running updateDiscordAvatars cron job...");

    try {
      const users = await fastify.models.User.find({ discordId: { $exists: true, $ne: null } });
      for (const user of users) {
        try {
          const discordUser = await fastify.discord.users.fetch(user.discordId!);
          if (discordUser && discordUser.avatarURL()) {
            user.avatarUrl = discordUser.avatarURL({ extension: 'webp', size: 64 })!;
            await user.save();
          }
        } catch (error) {
          log(fastify, `Failed to fetch Discord user for ${user.username}: ${error}`, 'error');
        }
      }
    } catch (error) {
      log(fastify, `Error in updateDiscordAvatars cron job: ${error}`, 'error');
    }
  });
}