import {ITournament, ITournamentPlayer} from "@models/Tournament";
import {
  CategoryChannel,
  ChannelType,
  Client,
  ColorResolvable,
  EmbedBuilder,
  EmbedField,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Collection, StringSelectMenuBuilder, MessageActionRowComponentBuilder
} from "discord.js";
import {IGame} from "@models/Game";
import {IUser} from "@models/User";

interface EmbedData {
  title?: string;
  description?: string;
  color?: ColorResolvable;
}

class DiscordService {
  private client: Client;
  private guildId: string;
  private categoryParentId: string;
  private archiveCategoryId: string;

  constructor(client: Client, guildId = process.env.DISCORD_GUILD_ID || '', categoryParentId = process.env.DISCORD_CATEGORY_PARENT_ACS_ID || '', archiveCategoryId = process.env.DISCORD_ARCHIVE_CATEGORY_ID || '') {
    this.client = client;
    this.guildId = guildId;
    this.categoryParentId = categoryParentId;
    this.archiveCategoryId = archiveCategoryId;
  }

  private buildEmbedMessage(data: { title?: string; description?: string; color?: ColorResolvable, image?: string, fields?: EmbedField[] } = {}) {
    const embed = new EmbedBuilder();
    embed.setColor(data.color || 0x0099ff);
    embed.setTitle(data.title || 'Nouveau tournoi créé !');
    embed.setDescription(data.description || 'Un nouveau tournoi a été créé. Rejoignez le canal dédié pour plus de détails et pour vous inscrire !');
    embed.setFields(data.fields || []);
    embed.setTimestamp(new Date());
    embed.setFooter({ text: 'ACS' });
    if (data.image) embed.setImage(data.image);
    return embed;
  }

  private buildTournamentMessage(tournament: ITournament & { game: IGame }): EmbedBuilder {
    const fields: EmbedField[] = [
      { name: 'Jeu', value: tournament.game.name, inline: false },
      { name: 'Participants', value: tournament.players.map((p: any) => p.user.username).join(', ') || 'Aucun participant pour le moment.', inline: false }
    ];
    if (tournament.reminderSent) {
      fields.push(
        { name: 'Participants confirmés', value: tournament.players.filter((p: any) => p.hasCheckin).length.toString(), inline: true },
        { name: 'En attente de check-in', value: tournament.players.filter((p: any) => !p.hasCheckin && !p.inWaitlist).length.toString(), inline: true }
      )
    }

    return this.buildEmbedMessage({
      title: `:pencil: Inscriptions: ${tournament.name}`,
      description: `Le tournoi aura lieu le **${tournament.date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}**.\n\nPour vous inscrire, rendez-vous sur [acsrim.fr](https://acsrim.fr/tournaments/${tournament.id})`,
      color: "Random",
      fields
    });
  }

  private async findOrCreateTextChannel(channelName: string): Promise<string> {
    const guild = await this.client.guilds.fetch(this.guildId);
    let channel = guild.channels.cache.find((ch: any) => ch.name === channelName && ch.type === ChannelType.GuildText);
    if (!channel) {
      channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: this.categoryParentId,
        reason: 'Création du channel pour le tournoi ACSV2'
      });
    }
    return channel.id;
  }

  private async findOrCreateVoiceChannel(channelName: string): Promise<string> {
    const guild = await this.client.guilds.fetch(this.guildId);
    let channel = guild.channels.cache.find((ch: any) => ch.name === channelName && ch.type === ChannelType.GuildVoice);
    if (!channel) {
      channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildVoice,
        parent: process.env.DISCORD_VOICE_CATEGORY_ID,
        reason: 'Création du channel pour le tournoi ACSV2'
      });
    }
    return channel.id;
  }

  private async deleteAllVoiceChannels(): Promise<void> {
    const guild = await this.client.guilds.fetch(this.guildId);
    const voiceChannels: Collection<string, any> = guild.channels.cache.filter((ch: any) => ch.type === ChannelType.GuildVoice);
    for (const [channelId, channel] of voiceChannels) {
      if (channel.members.size === 0) {
        await channel.delete();
      }
    }
  }

  private async deleteMessage(channelId: string, messageId: string): Promise<void> {
    const guild = await this.client.guilds.fetch(this.guildId);
    const channel = guild.channels.cache.get(channelId);
    if (channel && channel.isTextBased()) {
      const message = await channel.messages.fetch(messageId);
      if (message) {
        await message.delete();
      }
    }
  }

  public async deleteProposalMessage(messageId: string): Promise<void> {
    try {
      const proposalChannelId = process.env.DISCORD_PROPOSAL_CHANNEL_ID;
      if (!proposalChannelId) {
        console.error('DISCORD_PROPOSAL_CHANNEL_ID not configured');
        return;
      }
      return await this.deleteMessage(proposalChannelId, messageId);
    } catch (error: unknown) {
      throw new Error('Erreur lors de la suppression du message de proposition sur Discord: ' + error);
    }
  };

  public async createTournament(tournament: ITournament & { game: IGame }): Promise<string | undefined> {
    // Find channel
    const channelId = await this.findOrCreateTextChannel(tournament.discordChannelName);
    const guild = await this.client.guilds.fetch(this.guildId);
    const channel = guild.channels.cache.get(channelId);
    let messageId: string | undefined = undefined;
    // Send message
    if (channel && channel.isTextBased()) {
      const embedMessage = this.buildTournamentMessage(tournament);
      const message = await channel.send({ embeds: [embedMessage] });
      messageId = message.id;
    }
    // Create tournament role
    await guild.roles.create({
      name: `Tournoi-${tournament.game.name.replaceAll(' ', '-')}`,
      colors: { primaryColor: "Random" }
    });
    return messageId;
  }

  public async updateTournamentMessage(tournament: ITournament & { game: IGame }): Promise<void> {
    const guild = await this.client.guilds.fetch(this.guildId);
    const channel = guild.channels.cache.find((ch: any) => ch.name === tournament.discordChannelName);
    if (channel && channel.isTextBased() && tournament.messageId) {
      const message = await channel.messages.fetch(tournament.messageId);
      if (message) {
        const embedMessage = this.buildTournamentMessage(tournament);
        await message.edit({ embeds: [embedMessage] });
      }
    }
  }

  public async closeTournament(tournament: ITournament & { game: IGame }): Promise<void> {
    const guild = await this.client.guilds.fetch(this.guildId);
    const channel = guild.channels.cache.find((ch: any) => ch.name === tournament.discordChannelName);
    if (channel) {
      const categoryChannel = guild.channels.cache.get(this.archiveCategoryId);
        if (categoryChannel && categoryChannel instanceof CategoryChannel && channel instanceof TextChannel) {
            await channel.setParent(categoryChannel);
        }
    }
    const role = guild.roles.cache.find(role => role.name === `Tournoi-${tournament.game.name.replaceAll(' ', '-')}`)
    if (role) {
      await guild.roles.delete(role);
    }
  }

  public async createTournamentVoiceChannels(tournament: ITournament): Promise<void> {

    const channelsNames: string[] = tournament.teams.map(team => team.name);
    channelsNames.push("Général");
    await this.deleteAllVoiceChannels();
    for (const channelName of channelsNames) {
      await this.findOrCreateVoiceChannel(channelName);
    }
  }

  /**
   * Construit un message embed pour une proposition de jeu
   */
  private buildProposalMessage(proposal: any): EmbedBuilder {
    return this.buildEmbedMessage({
      title: `🎮 Nouvelle proposition de jeu`,
      description: `**${proposal.name}**\n\n${proposal.description}`,
      color: "Random",
      image: proposal.imageUrl,
      fields: [
        { name: '👤 Proposé par', value: proposal.proposedBy?.username || 'Utilisateur inconnu', inline: true },
        { name: '👍 Votes', value: proposal.votes?.length?.toString() || '0', inline: true }
      ]
    });
  }

  /**
   * Crée les boutons de vote pour une proposition
   */
  private createVoteButtons(proposalId: string): ActionRowBuilder<ButtonBuilder> {
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`proposal_vote_yes_${proposalId}`)
          .setLabel('👍 Voter pour')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`proposal_vote_no_${proposalId}`)
          .setLabel('👎 Retirer mon vote')
          .setStyle(ButtonStyle.Danger)
      );
    return row;
  }

  /**
   * Envoie une nouvelle proposition de jeu sur le canal Discord
   */
  public async postProposal(proposal: any): Promise<string | undefined> {
    try {
      const proposalChannelId = process.env.DISCORD_PROPOSAL_CHANNEL_ID;
      if (!proposalChannelId) {
        console.error('DISCORD_PROPOSAL_CHANNEL_ID not configured');
        return undefined;
      }

      const guild = await this.client.guilds.fetch(this.guildId);
      const channel = guild.channels.cache.get(proposalChannelId);

      if (!channel || !channel.isTextBased()) {
        console.error('Proposal channel not found or is not text-based');
        return undefined;
      }

      const embedMessage = this.buildProposalMessage(proposal);
      const buttons = this.createVoteButtons(proposal._id.toString());

      const message = await channel.send({
        embeds: [embedMessage],
        components: [buttons]
      });

      return message.id;
    } catch (error) {
      console.error('Erreur lors de l\'envoi de la proposition sur Discord:', error);
      return undefined;
    }
  }

  /**
   * Met à jour le message d'une proposition sur Discord
   */
  public async updateProposalMessage(proposal: any): Promise<void> {
    try {
      const proposalChannelId = process.env.DISCORD_PROPOSAL_CHANNEL_ID;
      if (!proposalChannelId || !proposal.discordMessageId) {
        return;
      }

      const guild = await this.client.guilds.fetch(this.guildId);
      const channel = guild.channels.cache.get(proposalChannelId);

      if (!channel || !channel.isTextBased()) {
        return;
      }

      const message = await channel.messages.fetch(proposal.discordMessageId);
      if (message) {
        const embedMessage = this.buildProposalMessage(proposal);
        const buttons = this.createVoteButtons(proposal._id.toString());

        await message.edit({
          embeds: [embedMessage],
          components: [buttons]
        });
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour du message de proposition:', error);
    }
  }

  /**
   * Envoie un message de rappel du tournoi sur le canal Discord du tournoi
   */
  public async sendTournamentReminder(tournament: ITournament & { game: IGame }): Promise<void> {
    try {
      const guild = await this.client.guilds.fetch(this.guildId);
      const channel = guild.channels.cache.find((ch: any) => ch.name === tournament.discordChannelName);

      if (!channel || !channel.isTextBased()) {
        console.error('Tournament channel not found');
        return;
      }
      const tournamentRole = guild.roles.cache.find(role => role.name === `Tournoi-${tournament.game.name.replaceAll(' ', '-')}`);
      const roleMention = tournamentRole ? `<@&${tournamentRole.id}>` : '';
      await channel.send(`${roleMention}\n\n⏰ **Rappel tournoi : ${tournament.name}** commence bientôt !\n\nN'oubliez pas de faire votre check-in pour ce tournoi !\n\nRendez-vous sur [acsrim.fr](https://acsrim.fr/tournaments/${tournament.id}`);
    } catch (error) {
      console.error('Erreur lors de l\'envoi du rappel Discord:', error);
    }
  }

  /**
   * Envoie un message privé de rappel à chaque joueur qui n'a pas checkin
   */
  public async sendPrivateReminders(tournament: ITournament & { game: IGame }, users: any[]): Promise<void> {
    try {
      for (const user of users) {
        try {
          const discordUser = await this.client.users.fetch(user.discordId);
          if (discordUser) {
            if (process.env.NODE_ENV !== 'production' && discordUser.id !== '286937460628520960') {
              console.log(`(Dev mode) Rappel tournoi privé pour le tournoi ${tournament.name} envoyé à ${discordUser.username}`);
            } else if (process.env.NODE_ENV === 'production' || discordUser.id === '286937460628520960') {
              const reminderMessage = `⏰ **Rappel tournoi : ${tournament.name}**\n\n` +
                  `Le tournoi **${tournament.game.name}** commence très bientôt !\n\n` +
                  `📅 **Date :** ${tournament.date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}\n` +
                  `📋 N'oublie pas de faire ton check-in avant le début du tournoi !\n\n` +
                  `[acscrim.fr](https://acsrim.fr/tournaments/${tournament.id})`;

              await discordUser.send(reminderMessage);
            }
          }
        } catch (userError) {
          console.error(`Erreur lors de l'envoi du message privé à ${user.username}:`, userError);
        }
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi des rappels privés:', error);
    }
  }

  public async announceTournamentResults(tournament: ITournament & { game: IGame }): Promise<void> {
    try {
      const guild = await this.client.guilds.fetch(this.guildId);
      const channel = guild.channels.cache.find((ch: any) => ch.name === tournament.discordChannelName);

      if (!channel || !channel.isTextBased()) {
        console.error('Tournament channel not found');
        return;
      }

      const sortedTeams = [...tournament.teams].sort((a, b) => a.ranking - b.ranking);
      const podium = sortedTeams.slice(0, 3);
      const podiumLines = podium
        .map((team, index) => {
          const medals = ['🥇', '🥈', '🥉'];
          const medal = medals[index] || '🏅';
          return `${medal} **${team.name}** — ${team.score} pts`;
        })
        .join('\n');

      const fullRanking = sortedTeams
        .map(team => `${team.ranking}. ${team.name} — ${team.score} pts`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setTitle(`Résultats — ${tournament.name}`)
        .setDescription(`Le tournoi est terminé, voici le classement !\n\n${podiumLines}`)
        .addFields({ name: 'Classement complet', value: fullRanking || 'Aucun résultat disponible.' })
        .setColor('Random')
        .setTimestamp(new Date());

      await channel.send({
        content: `🏆 **Le tournoi ${tournament.name} est terminé !**`,
        embeds: [embed]
      });

      await channel.send({
        content: `Le vote MVP est ouvert ! Votez pour le joueur qui vous a le plus impressionné durant ce tournoi sur [acscrim.fr](https://acscrim.fr/tournaments/${tournament.id}) ou ci-dessous !`,
        components: [
          new ActionRowBuilder<MessageActionRowComponentBuilder>()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`mvp_vote_${tournament.id}`)
              .setPlaceholder('Sélectionnez le joueur MVP')
              .addOptions(
                tournament.players
                  .filter(p => !p.inWaitlist)
                  .map((p: any) => ({
                    label: `${podium[0].users.find((u: any) => u.username === p.user.username) ? '🏆' : ''} ${p.user.username}`,
                    description: `Votez pour ${p.user.username} comme MVP`,
                    value: p.user.id
                  }))
              )
          )
        ]
      })
    } catch (error) {
      console.error('Erreur lors de l\'annonce des résultats du tournoi sur Discord:', error);
    }
  }
}
export default DiscordService;

