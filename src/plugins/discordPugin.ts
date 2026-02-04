import {FastifyPluginAsync} from 'fastify';
import fp from "fastify-plugin";
import {ButtonInteraction, ChannelType, Client, IntentsBitField, Partials, StringSelectMenuInteraction} from 'discord.js';
import DiscordService from "../services/discordService";
import {ITournamentPlayer} from "../models/Tournament";
import {IUser} from "../models/User";

const discordPlugin: FastifyPluginAsync = async (fastify) => {
  const discordClient = new Client({
    intents: [
      IntentsBitField.Flags.Guilds,
      IntentsBitField.Flags.GuildMembers,
      IntentsBitField.Flags.DirectMessages,
      IntentsBitField.Flags.GuildMessages,
      IntentsBitField.Flags.MessageContent
    ],
    partials: [Partials.Channel]
  });

  await discordClient.login(process.env.DISCORD_TOKEN);

  fastify.decorate('discord', discordClient);

  const discordService = new DiscordService(discordClient, fastify);
  fastify.decorate('discordService', discordService);

  discordClient.on('clientReady', async () => {
    try {
      const guildId = process.env.DISCORD_GUILD_ID;
      if (!guildId) return;
      const guild = await discordClient.guilds.fetch(guildId);
      const channels = guild.channels.cache.filter(ch => ch.type === ChannelType.GuildText).map(ch => ({ id: ch.id, name: ch.name }));
      const members = (await guild.members.fetch()).map(m => ({ id: m.user.id, username: m.user.username, avatar: m.user.displayAvatarURL() }));
      (fastify as any).discordMetadata = { channels, members };
    } catch (err) {
      fastify.log.error({ err }, 'Erreur lors du chargement des métadonnées Discord');
    }
  });

  /**
   * Gestionnaire pour les interactions Discord (clics sur les boutons)
   * Traite les votes sur les propositions de jeux
   */
  discordClient.on('interactionCreate', async (interaction) => {
    try {
      // Vérifier si c'est un bouton de vote pour une proposition
      if ((interaction as ButtonInteraction).customId.startsWith('proposal_vote_')) {
        const buttonInteraction = interaction as ButtonInteraction;
        const parts = buttonInteraction.customId.split('_');
        const voteType = parts[2]; // 'yes' ou 'no'
        const proposalId = parts.slice(3).join('_');

        // Récupérer la proposition
        const proposal = await fastify.models.GameProposal.findById(proposalId).populate('proposedBy');
        if (!proposal) {
          await buttonInteraction.reply({ content: '❌ Proposition introuvable', flags: [64] }); // Ephemeral
          return;
        }

        // Récupérer l'utilisateur Discord
        const userId = buttonInteraction.user.id;
        const user = await fastify.models.User.findOne({ discordId: userId });

        if (!user) {
          await buttonInteraction.reply({
            content: '❌ Vous devez être connecté sur ACS pour voter',
            flags: [64] // Ephemeral
          });
          return;
        }

        // Traiter le vote
        const existingVoteIndex = proposal.votes.findIndex((v: any) => v.user.toString() === user._id.toString());

        if (voteType === 'no' && existingVoteIndex !== -1) {
          // Retirer le vote
          proposal.votes.splice(existingVoteIndex, 1);
          await proposal.save();
          await proposal.populateData();
          await buttonInteraction.reply({
            content: '👎 Ton vote a été retiré',
            flags: [64] // Ephemeral
          });
        } else if (voteType === 'yes') {
          // Ajouter le vote s'il n'existe pas
          if (existingVoteIndex === -1) {
            proposal.votes.push({
              user: user._id,
              createdAt: new Date(),
              updatedAt: new Date()
            });
            await proposal.save();
            await proposal.populateData();
            await buttonInteraction.reply({
              content: '👍 Ton vote a été ajouté !',
              flags: [64] // Ephemeral
            });
          } else {
            await buttonInteraction.reply({
              content: '✅ Tu as déjà voté pour cette proposition',
              flags: [64] // Ephemeral
            });
          }
        }

        // Mettre à jour le message Discord
        try {
          await fastify.discordService.updateProposalMessage(proposal);
        } catch (updateError) {
          console.error('Erreur lors de la mise à jour du message:', updateError);
        }
      }
      if ((interaction as StringSelectMenuInteraction).customId.startsWith('mvp_vote_')) {
        const selectMenuInteraction = interaction as StringSelectMenuInteraction;
        const parts = selectMenuInteraction.customId.split('_');
        const tournamentId = parts.pop();
        const playerId = selectMenuInteraction.values[0];

        // Récupérer le tournoi
        const tournament = await fastify.models.Tournament.findById(tournamentId).populate('players.user');
        if (!tournament) {
          await selectMenuInteraction.reply({ content: '❌ Tournoi introuvable', flags: [64] }); // Ephemeral
          return;
        }

        if (!tournament.mvpVoteOpen) {
          await selectMenuInteraction.reply({ content: '❌ Le vote pour le MVP est fermé', flags: [64] }); // Ephemeral
          return;
        }

        // Récupérer l'utilisateur Discord
        const userId = selectMenuInteraction.user.id;
        const user = await fastify.models.User.findOne({ discordId: userId });

        if (!user) {
          await selectMenuInteraction.reply({
            content: '❌ Vous devez être connecté sur ACS pour voter',
            flags: [64] // Ephemeral
          });
          return;
        }

        if (!tournament.players.filter((p: any) => !p.inWaitlist).find((p: any) => p.user._id.toString() === user._id.toString())) {
          await selectMenuInteraction.reply({
            content: '❌ Vous devez être un participant du tournoi pour voter',
            flags: [64] // Ephemeral
          });
          return;
        }

        // Traiter le vote MVP
        tournament.players.forEach((player: ITournamentPlayer & { user: IUser }) => {
          if (player.user.id === playerId) {
            if (!player.mvpVotes.includes(user.id)) {
              player.mvpVotes.push(user.id);
            }
          } else {
            player.mvpVotes = player.mvpVotes.filter(voterId => voterId.toString() !== user.id);
          }
        });

        await tournament.save();

        await selectMenuInteraction.reply({
          content: '✅ Ton vote pour le MVP a été enregistré !',
          flags: [64] // Ephemeral
        });
      }
      if ((interaction as ButtonInteraction).customId.startsWith('card_approval_')) {
        const buttonInteraction = interaction as ButtonInteraction;
        const parts = buttonInteraction.customId.split('_');
        const action = parts[2]; // 'approve' ou 'reject'
        const cardId = parts.slice(3).join('_');

        // Récupérer la carte
        const card = await fastify.models.Card.findById(cardId).populate('createdBy');
        if (!card) {
          await buttonInteraction.reply({ content: '❌ Carte introuvable' }); // Ephemeral
          return;
        }

        if (card.status !== 'waiting') {
          await buttonInteraction.reply({ content: '❌ Cette carte a déjà été traitée.'}); // Ephemeral
          return;
        }

        if (action === 'accept') {
          card.status = 'active';
          await card.save();
          await buttonInteraction.reply({
            content: '✅ La carte a été approuvée et est maintenant active.',
          });
        } else if (action === 'reject') {
          card.status = 'pending';
          await card.save();
          await buttonInteraction.reply({
            content: '❌ La carte a été rejetée. Elle sera réétudiée par l\'équipe dans quelques jours pour te laisser le temps d\'apporter des modifications.',
          });
        }

        await buttonInteraction.message.edit({ content: buttonInteraction.message.content + `\n\n**Validation ${action === 'accept' ? 'acceptée' : 'refusée'}**`, components: [] });
      }
      if ((interaction as ButtonInteraction).customId.startsWith('tournament_checkin_')) {
        const buttonInteraction = interaction as ButtonInteraction;
        const parts = buttonInteraction.customId.split('_');
        const tournamentId = parts[2];

        // Récupérer le tournoi
        const tournament = await fastify.models.Tournament.findById(tournamentId).populate('players.user');
        if (!tournament) {
          await buttonInteraction.reply({ content: '❌ Tournoi introuvable', flags: [64] }); // Ephemeral
          return;
        }

        // Récupérer l'utilisateur Discord
        const userId = buttonInteraction.user.id;
        const user = await fastify.models.User.findOne({ discordId: userId });

        if (!user) {
          await buttonInteraction.reply({
            content: '❌ Vous devez être connecté sur ACS pour vous enregistrer',
            flags: [64] // Ephemeral
          });
          return;
        }

        const player = tournament.players.find((p: any) => p.user._id.toString() === user._id.toString());
        if (!player) {
          await buttonInteraction.reply({
            content: '❌ Vous n\'êtes pas inscrit à ce tournoi',
            flags: [64] // Ephemeral
          });
          return;
        }

        if (player.hasCheckin) {
          await buttonInteraction.reply({
            content: '✅ Vous avez déjà check-in pour ce tournoi',
            flags: [64] // Ephemeral
          });
          return;
        }

        player.hasCheckin = true;
        await tournament.save();

        await buttonInteraction.reply({
          content: '✅ Check-in effectué ! Rendez-vous lundi à 20h30 !',
          flags: [64] // Ephemeral
        });
      }
    } catch (error) {
      console.error('Erreur lors du traitement de l\'interaction Discord:', error);
      try {
        interaction.isButton() && await interaction.reply({
          content: '❌ Une erreur est survenue',
        });
      } catch (replyError) {
        console.error('Erreur lors de la réponse à l\'interaction:', replyError);
      }
    }
  });

  discordClient.on('messageCreate', async (message) => {
    try {
      if (message.author.bot) return;
      if (message.guild) return; // Only DM inbound
      await fastify.models.DiscordMessage.create({
        direction: 'inbound',
        targetType: 'dm',
        messageType: message.embeds?.length ? 'embed' : 'text',
        discordUserId: message.author.id,
        content: message.content,
        raw: message.toJSON()
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erreur lors de la capture d\'un DM Discord');
    }
  });

  fastify.addHook('onClose', async () => {
    await discordClient.destroy();
  });
};

export default fp(discordPlugin, { name: "discord-plugin" });