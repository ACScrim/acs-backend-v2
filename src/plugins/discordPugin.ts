import { FastifyPluginAsync } from 'fastify';
import fp from "fastify-plugin";
import { Client, IntentsBitField } from 'discord.js';

const discordPlugin: FastifyPluginAsync = async (fastify) => {
  const discordClient = new Client({
    intents: [
      IntentsBitField.Flags.Guilds,
      IntentsBitField.Flags.GuildMembers,
      IntentsBitField.Flags.DirectMessages
    ]
  });

  await discordClient.login(process.env.DISCORD_TOKEN);

  fastify.decorate('discord', discordClient);

  fastify.addHook('onClose', async () => {
    await discordClient.destroy();
  });
};

export default fp(discordPlugin, { name: "discord-plugin" });