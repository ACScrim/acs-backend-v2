import {ITournament, ITournamentPlayer} from "../models/Tournament";
import {
  ActionRowBuilder, BaseGuildVoiceChannel,
  ButtonBuilder,
  ButtonStyle,
  CategoryChannel,
  ChannelType,
  Client,
  Collection,
  ColorResolvable,
  EmbedBuilder,
  EmbedField, GuildBasedChannel,
  MessageActionRowComponentBuilder,
  StringSelectMenuBuilder,
  TextChannel
} from "discord.js";
import {IGame} from "../models/Game";
import {ICard} from "../models/Card";
import {log} from "../utils/utils";
import {FastifyInstance} from "fastify";
import {IUser} from "../models/User";
import { IPlayerGameLevel } from "../models/PlayerGameLevel";

class DiscordService {
  private client: Client;
  private guildId: string;
  private categoryParentId: string;
  private archiveCategoryId: string;
  private fastify: FastifyInstance;

  constructor(client: Client, fastify: FastifyInstance, guildId = process.env.DISCORD_GUILD_ID || '', categoryParentId = process.env.DISCORD_CATEGORY_PARENT_ACS_ID || '', archiveCategoryId = process.env.DISCORD_ARCHIVE_CATEGORY_ID || '') {
    this.client = client;
    this.guildId = guildId;
    this.categoryParentId = categoryParentId;
    this.archiveCategoryId = archiveCategoryId;
    this.fastify = fastify;
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
      description: `Le tournoi aura lieu le **${tournament.date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}**.\n\nPour vous inscrire, rendez-vous sur [acscrim.fr](https://acscrim.fr/tournaments/${tournament.id})`,
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
    const voiceChannels: Collection<string, BaseGuildVoiceChannel> = guild.channels.cache.filter((ch: any) => ch.type === ChannelType.GuildVoice) as Collection<string, BaseGuildVoiceChannel>;
    for (const [channelId, channel] of voiceChannels) {
      if (["to-only", "Général"].includes(channel.name)) continue; // Skip protected channels
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
      const message = await channel.send({ content: "||<@&1460646121343946793>||", embeds: [embedMessage] });
      messageId = message.id;
    }
    await guild.scheduledEvents.create({
      name: tournament.name,
      scheduledStartTime: tournament.date,
      scheduledEndTime: new Date(tournament.date.getTime() + 2 * 60 * 60 * 1000 + 30 * 60 * 1000), // +2h30
      privacyLevel: 2, // Guild Only
      entityType: 3, // External
      channel: tournament.discordChannelName,
      entityMetadata: {
        location: `https://acscrim.fr/tournaments/${tournament.id}`
      },
      description: tournament.name
    });
    // Create tournament role
    await guild.roles.create({
      name: `Tournoi-${tournament.game.name.replaceAll(' ', '-')}`,
      colors: { primaryColor: "Random" },
      hoist: true,
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
        await message.edit({ content: "||<@&1460646121343946793>||", embeds: [embedMessage] });
      }
    }
  }

  public async setTournamentRole(tournament: ITournament & { game: IGame }, userDiscordId: string): Promise<void> {
    const guild = await this.client.guilds.fetch(this.guildId);
    const role = guild.roles.cache.find(role => role.name === `Tournoi-${tournament.game.name.replaceAll(' ', '-')}`);
    if (role) {
      const member = await guild.members.fetch(userDiscordId);
      if (member) {
        await member.roles.add(role);
      }
    }
  }

  public async unsetTournamentRole(tournament: ITournament & { game: IGame }, userDiscordId: string): Promise<void> {
    const guild = await this.client.guilds.fetch(this.guildId);
    const role = guild.roles.cache.find(role => role.name === `Tournoi-${tournament.game.name.replaceAll(' ', '-')}`);
    if (role) {
      const member = await guild.members.fetch(userDiscordId);
      if (member) {
        await member.roles.remove(role);
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

      const button = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`tournament_checkin_${tournament.id}`)
            .setLabel('Confirmer ma présence')
            .setStyle(ButtonStyle.Success)
        );

      const tournamentRole = guild.roles.cache.find(role => role.name === `Tournoi-${tournament.game.name.replaceAll(' ', '-')}`);
      const roleMention = tournamentRole ? `<@&${tournamentRole.id}>` : '';
      await channel.send({ content: `${roleMention}\n\n⏰ **Rappel tournoi : ${tournament.name}** commence bientôt !\n\nN'oubliez pas de faire votre check-in pour ce tournoi !\n\nRendez-vous sur [acscrim.fr](https://acscrim.fr/tournaments/${tournament.id})`, components: [button] });
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

              const button = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId(`tournament_checkin_${tournament.id}`)
                    .setLabel('Confirmer ma présence')
                    .setStyle(ButtonStyle.Success)
                );

              const reminderMessage = `⏰ **Rappel tournoi : ${tournament.name}**\n\n` +
                  `Le tournoi **${tournament.game.name}** commence très bientôt !\n\n` +
                  `📅 **Date :** ${tournament.date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}\n` +
                  `📋 N'oublie pas de faire ton check-in avant le début du tournoi !\n\n` +
                  `[acscrim.fr](https://acscrim.fr/tournaments/${tournament.id})`;

              await discordUser.send({ content: reminderMessage, components: [button] });
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

  /**
   * Envoie une notification privée à un utilisateur lorsqu'il est déplacé de la liste d'attente au tournoi
   */
  public async sendTournamentWaitlistNotification(tournament: ITournament & { game: IGame }, userDiscordId: string): Promise<void> {
    try {
      const discordUser = await this.client.users.fetch(userDiscordId);
      if (discordUser) {
        const notificationMessage = `🎉 **Bonne nouvelle ! Tu as été déplacé de la liste d'attente au tournoi : ${tournament.name}**\n\n` +
            `Une place s'est libérée et tu es maintenant inscrit !\n\n` +
            `📅 **Date :** ${tournament.date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}\n\n` +
            `Assure-toi de faire ton check-in avant le début du tournoi !\n\n` +
            `[acscrim.fr](https://acscrim.fr/tournaments/${tournament.id})`;

        await discordUser.send(notificationMessage);
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi de la notification de liste d\'attente:', error);
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
      log(this.fastify, `[AnnounceTournamentResults] Erreur lors de l'annonce des résultats du tournoi ${tournament.name} sur Discord: ${error}`, 'error');
    }
  }

  public async announceMvpWinner(tournament: ITournament & { game: IGame, players: (ITournamentPlayer & { user: IUser })[] }, mvpPlayerId: string): Promise<void> {
    try {
      const guild = await this.client.guilds.fetch(this.guildId);
      const channel = guild.channels.cache.find((ch: any) => ch.name === tournament.discordChannelName);

      if (!channel || !channel.isTextBased()) {
        console.error('Tournament channel not found');
        return;
      }

      const mvpPlayer = tournament.players.find((p: any) => p._id.toString() == mvpPlayerId.toString()) as ITournamentPlayer & { user: IUser };
      if (!mvpPlayer) {
        console.error('MVP player not found in tournament players');
        return;
      }

      await channel.send(`🏅 **Félicitations à <@${mvpPlayer.user.discordId}> pour avoir été élu MVP du tournoi ${tournament.name} !** 🎉`);

    } catch (error) {
      log(this.fastify, `[AnnounceMvpWinner] Erreur lors de l'annonce du MVP du tournoi ${tournament.name} sur Discord: ${error}`, 'error');
    }
  }

  public async sendPrivateMessageCardApproval(discordId: string, card: ICard) {
    try {
      const discordUser = await this.client.users.fetch(discordId);
      if (discordUser) {
        const approvalMessage = `✅ **Ta carte "${card.title}" a été approuvée !**\n\n` +
            `Félicitations ! Ta carte a été examinée et approuvée par notre équipe. Elle est maintenant en attente de validation finale avant d'être ajoutée à notre collection.\n\n` +
            `Si tu es sûr de vouloir rendre publique votre carte, clique sur le bouton 'Accepter' ci-dessous, sinon clique sur 'Refuser' pour apporter des modifications et demander une nouvelle validation.`;

        const buttons = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`card_approval_accept_${card._id}`)
              .setLabel('Accepter')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`card_approval_reject_${card._id}`)
              .setLabel('Refuser')
              .setStyle(ButtonStyle.Danger)
          );

        await discordUser.send({ content: approvalMessage, components: [buttons] });
      } else {
        log(this.fastify, `[PrivateCardApproval] Utilisateur Discord avec l'ID ${discordId} non trouvé.`, 'error');
      }
    }
    catch (error) {
      log(this.fastify, `[PrivateCardApproval] Erreur lors de l'envoi du message privé à l'utilisateur Discord avec l'ID ${discordId}: ${error}`, 'error');
    }
  }

  public async sendPrivateMessageCardRejected(discordId: string, card: ICard) {
    try {
      const discordUser = await this.client.users.fetch(discordId);
      if (discordUser) {
        const rejectionMessage = `❌ **Ta carte "${card.title}" a été rejetée.**\n\n` +
            `Après examen, nous avons décidé de ne pas approuver ta carte pour le moment. Ta carte est maintenant inactive, si tu veux toujours nous proposer une carte, nous t'invitons à en créer une nouvelle.\n\n` +
            `N'hésite pas à nous contacter si tu as des questions ou besoin d'assistance.`;

        await discordUser.send(rejectionMessage);
      } else {
        log(this.fastify, `[PrivateCardRejection] Utilisateur Discord avec l'ID ${discordId} non trouvé.`, 'error');
      }
    }
    catch (error) {
      log(this.fastify, `[PrivateCardRejection] Erreur lors de l'envoi du message privé à l'utilisateur Discord avec l'ID ${discordId}: ${error}`, 'error');
    }
  }

  public async sendTwitchNotification(streamDetails: { title: string, game_name: string, thumbnail_url: string }, streamerUsername: string): Promise<void> {
    try {
      const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
      if (!webhookUrl) {
        log(this.fastify, '[DiscordService] ❌ DISCORD_WEBHOOK_URL non configuré.', 'error');
        return;
      }

      log(this.fastify, `[DiscordService] 📤 Préparation notification Discord pour ${streamerUsername}`, 'info');
      log(this.fastify, `[DiscordService] Stream: "${streamDetails.title}" - Jeu: ${streamDetails.game_name}`, 'info');

      const embed = new EmbedBuilder()
        .setTitle(`${streamerUsername} est en live sur Twitch !`)
        .setDescription(`**${streamDetails.title}**\n\nRegardez le stream maintenant sur [Twitch](https://www.twitch.tv/${streamerUsername})`)
        .addFields({ name: 'Jeu', value: streamDetails.game_name || 'Inconnu', inline: true })
        .setColor('Random')
        .setImage(streamDetails.thumbnail_url.replace('{width}', '1280').replace('{height}', '720'))
        .setTimestamp(new Date());

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed.toJSON()] })
      });

      if (response.ok) {
        log(this.fastify, `[DiscordService] ✅ Notification Discord envoyée avec succès pour ${streamerUsername}`, 'info');
      } else {
        const errorText = await response.text();
        log(this.fastify, `[DiscordService] ❌ Échec envoi Discord (${response.status}): ${errorText}`, 'error');
      }
    } catch (error) {
      log(this.fastify, `[DiscordService] ❌ Erreur lors de l'envoi de la notification Twitch sur Discord: ${error}`, 'error');
    }
  }

  public async sendAdminMessage(payload: { targetType: 'channel' | 'dm'; discordChannelId?: string; discordUserId?: string; messageType: 'text' | 'embed'; content?: string; embed?: { title?: string; description?: string; color?: string; imageUrl?: string; footer?: string; fields?: Array<{ name: string; value: string; inline?: boolean }> } }) {
    const embed = payload.messageType === 'embed' && payload.embed ? this.buildEmbedMessage({
      title: payload.embed.title,
      description: payload.embed.description,
      color: (payload.embed.color as any) || undefined,
      image: payload.embed.imageUrl,
      fields: payload.embed.fields?.map(f => ({ name: f.name, value: f.value, inline: f.inline ?? false }))
    }) : undefined;

    if (payload.targetType === 'channel') {
      const guild = await this.client.guilds.fetch(this.guildId);
      const channel = await guild.channels.fetch(payload.discordChannelId!);
      if (!channel || !channel.isTextBased()) throw new Error('Channel introuvable ou non textuel');
      const sent = await channel.send({ content: payload.messageType === 'text' ? payload.content : undefined, embeds: embed ? [embed] : [] });
      await (this.fastify as any).models.DiscordMessage.create({
        direction: 'outbound',
        targetType: 'channel',
        messageType: payload.messageType,
        discordChannelId: channel.id,
        content: payload.content,
        embed: payload.embed,
        raw: sent.toJSON()
      });
      return sent.id;
    }

    const user = await this.client.users.fetch(payload.discordUserId!);
    if (process.env.NODE_ENV !== 'production' && user.id !== '286937460628520960') {
      console.log(`(Dev mode) Message privé envoyé à ${user.username}`);
      return 'dev-mode-message-id';
    }
    const sent = await user.send({ content: payload.messageType === 'text' ? payload.content : undefined, embeds: embed ? [embed] : [] });
    await (this.fastify as any).models.DiscordMessage.create({
      direction: 'outbound',
      targetType: 'dm',
      messageType: payload.messageType,
      discordUserId: user.id,
      content: payload.content,
      embed: payload.embed,
      raw: sent.toJSON()
    });
    return sent.id;
  }

  // ─── Draft system ──────────────────────────────────────────────────────────

  public async startDraft(tournamentId: string): Promise<void> {
    const tournament = await this.fastify.models.Tournament.findById(tournamentId);
    if (!tournament) throw new Error('Tournoi introuvable');
    if (!tournament.isDraft) throw new Error('Ce tournoi n\'est pas en mode draft');
    if (tournament.draftStatus !== 'pending') throw new Error('Le draft ne peut pas être démarré dans son état actuel');
    if (tournament.teams.length < 1) throw new Error('Aucune équipe (capitaine) configurée pour ce tournoi');

    // Ordre aléatoire des équipes
    const shuffledTeamIds = [...tournament.teams.map((t: any) => t._id)].sort(() => Math.random() - 0.5);
    tournament.draftOrder = shuffledTeamIds as any;
    tournament.draftCurrentTurnIndex = 0;
    tournament.draftStatus = 'in_progress';
    await tournament.save();

    await this.sendDraftPickToNextCaptain(tournamentId);
  }

  public async sendDraftPickToNextCaptain(tournamentId: string): Promise<void> {
    const tournament = await this.fastify.models.Tournament.findById(tournamentId).populate('players.user');
    if (!tournament || tournament.draftStatus !== 'in_progress') return;

    // Joueurs déjà assignés à une équipe
    const allAssignedUserIds = new Set(
      tournament.teams.flatMap((t: any) => t.users.map((u: any) => u.toString()))
    );

    // Joueurs disponibles : inscrits, hors liste d'attente, pas encore dans une équipe
    const availablePlayers = (tournament.players as any[]).filter(
      (p) => !p.inWaitlist && p.user && !allAssignedUserIds.has(p.user._id.toString())
    );

    if (availablePlayers.length === 0) {
      tournament.draftStatus = 'completed';
      await tournament.save();

      const guild = await this.client.guilds.fetch(this.guildId);
      const channel = guild.channels.cache.find((ch: any) => ch.name === tournament.discordChannelName);
      if (channel && channel.isTextBased()) {
        const teamsDisplay = tournament.teams
          .map((t: any) => `**${t.name}**: ${t.users.length} joueur(s)`)
          .join('\n');
        await channel.send(
          `✅ **Draft terminé !** Toutes les équipes sont formées.\n\n${teamsDisplay}\n\nRendez-vous sur [acscrim.fr](https://acscrim.fr/tournaments/${tournament.id}) pour voir les équipes !`
        );
      }
      return;
    }

    const currentTeamId = tournament.draftOrder[tournament.draftCurrentTurnIndex];
    const currentTeam = (tournament.teams as any[]).find(
      (t: any) => t._id.toString() === currentTeamId.toString()
    );
    if (!currentTeam) return;

    const captain = await this.fastify.models.User.findById(currentTeam.captainId);
    if (!captain?.discordId) return;

    const options = await Promise.all(availablePlayers.slice(0, 25).map(async (p: ITournamentPlayer & { user: IUser }) => {
      const infoParts: string[] = [];
      const playerLevel: IPlayerGameLevel | null = await this.fastify.models.PlayerGameLevel.findOne({ userId: p.user._id, gameId: tournament.gameId }).exec();
      if (p.tier) infoParts.push(`Tier ${p.tier}`);
      if (playerLevel) {
        if (playerLevel.selectedRoles) infoParts.push(`${playerLevel.selectedRoles.join(', ')}`);
        if (playerLevel.rank) infoParts.push(`${playerLevel.rank}`);
      }

      return {
        label: p.user.username,
        value: p.user.id.toString(),
        ...(infoParts.length > 0 ? { description: infoParts.join(' | ').substring(0, 100) } : {})
      };
    }));

    const select = new StringSelectMenuBuilder()
      .setCustomId(`draft_pick_${tournament._id}`)
      .setPlaceholder('Choisissez un joueur')
      .addOptions(options);

    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(select);

    const guild = await this.client.guilds.fetch(this.guildId);
    const channel = guild.channels.cache.find((ch: any) => ch.name === tournament.discordChannelName);
    if (channel && channel.isTextBased()) {
      await channel.send({
        content: `🎯 **Draft — ${tournament.name}** | Tour ${tournament.draftCurrentTurnIndex + 1}\n<@${captain.discordId}> c'est à toi de choisir un joueur pour **${currentTeam.name}** !\nJoueurs disponibles : **${availablePlayers.length}**`,
        components: [row]
      });
    }
  }
}
export default DiscordService;

