import { ITournament } from "@models/Tournament";
import { ChannelType, Client, ColorResolvable, EmbedBuilder } from "discord.js";
import { FastifyInstance } from "fastify";

interface EmbedData {
  title?: string;
  description?: string;
  color?: ColorResolvable;
}

class DiscordService {
  private static DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID || '';
  private static CATEGORY_PARENT_ACS_ID = process.env.DISCORD_CATEGORY_PARENT_ACS_ID || '';
  private static instance: DiscordService;
  private fastify: FastifyInstance;

  private constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  public static getInstance(fastify: FastifyInstance): DiscordService {
    if (!DiscordService.instance) {
      DiscordService.instance = new DiscordService(fastify);
    }
    return DiscordService.instance;
  }

  private buildEmbedMessage(data: EmbedData): EmbedBuilder {
    const embed = new EmbedBuilder()
    embed.setColor(data.color || 0x0099ff);
    embed.setTitle(data.title || 'Nouveau tournoi créé !')
    embed.setDescription(data.description || 'Un nouveau tournoi a été créé. Rejoignez le canal dédié pour plus de détails et pour vous inscrire !')
    embed.setTimestamp(new Date());
    return embed;
  }

  private async findOrCreateChannel(channelName: string): Promise<string> {
    const guild = await this.fastify.discord.guilds.fetch(DiscordService.DISCORD_GUILD_ID);
    
    // Chercher le canal par nom
    let channel = guild.channels.cache.find(
      (ch: any) => ch.name === channelName && ch.type === ChannelType.GuildText
    );
    
    // Si le canal n'existe pas, le créer
    if (!channel) {
      channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: DiscordService.CATEGORY_PARENT_ACS_ID,
        reason: 'Création du channel pour le tournoi ACSV2'
      });
    }
    
    return channel.id;
  }

  public async sendTournamentCreationMessage(tournament: ITournament): Promise<void> {
    const channelId = await this.findOrCreateChannel(tournament.discordChannelName);
    const guild = await this.fastify.discord.guilds.fetch(DiscordService.DISCORD_GUILD_ID);
    const channel = guild.channels.cache.get(channelId);
    if (channel && channel.isTextBased()) {
      const embedMessage = this.buildEmbedMessage({});
      await channel.send({ embeds: [embedMessage] });
    }
  }
}
export default DiscordService;