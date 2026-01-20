import { log } from "../utils/utils";
import { FastifyInstance } from "fastify";

export const startUpdateDiscordAvatarsCron = async (fastify: FastifyInstance) => {
  // Tous les jours à 3h du matin
  fastify.cron.schedule('0 3 * * *', async () => {
    log(fastify, "Running updateDiscordAvatars cron job...");

    try {
      const batchSize = 50; // Traiter 50 utilisateurs à la fois
      // Délai configurable entre les lots (par défaut 1000ms)
      const batchDelay = Number(process.env.DISCORD_BATCH_DELAY_MS) || 1000;
      let skip = 0;
      let totalUpdated = 0;
      let totalErrors = 0;

      while (true) {
        // Récupérer un lot d'utilisateurs
        const users = await fastify.models.User.find({ 
          discordId: { $exists: true, $ne: null } 
        })
          .limit(batchSize)
          .skip(skip);

        if (users.length === 0) {
          break; // Plus d'utilisateurs à traiter
        }

        // Traiter les utilisateurs du lot
        for (const user of users) {
          try {
            const discordUser = await fastify.discord.users.fetch(user.discordId!);
            if (discordUser && discordUser.avatarURL()) {
              user.avatarUrl = discordUser.avatarURL({ extension: 'webp', size: 64 })!;
              await user.save();
              totalUpdated++;
            }
          } catch (error) {
            log(fastify, `Failed to fetch Discord user for ${user.username}: ${error}`, 'error');
            totalErrors++;
          }
        }

        skip += batchSize;
        
        // Délai entre les lots pour éviter la surcharge
        await new Promise(resolve => setTimeout(resolve, batchDelay));
      }

      log(fastify, `updateDiscordAvatars cron job completed. Updated: ${totalUpdated}, Errors: ${totalErrors}`);
    } catch (error) {
      log(fastify, `Error in updateDiscordAvatars cron job: ${error}`, 'error');
    }
  });
}