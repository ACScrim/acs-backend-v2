import {FastifyPluginAsync} from 'fastify';
import fp from "fastify-plugin";
import {
  ApplicationCommandOptionType,
  AutocompleteInteraction,
  ButtonInteraction,
  ChannelType,
  ChatInputCommandInteraction,
  Client,
  IntentsBitField,
  Partials,
  REST,
  Routes,
  StringSelectMenuInteraction
} from 'discord.js';
import DiscordService from "../services/discordService";
import {ITournamentPlayer} from "../models/Tournament";
import {IUser} from "../models/User";
import mongoose from "mongoose";

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

    // Enregistrement des commandes slash
    try {
      const clientId = process.env.DISCORD_CLIENT_ID;
      const guildId = process.env.DISCORD_GUILD_ID;
      const token = process.env.DISCORD_TOKEN;
      if (clientId && guildId && token) {
        const rest = new REST().setToken(token);
        const draftCommands = [
          {
            name: 'draftaddcap',
            description: 'Ajouter un capitaine à un tournoi draft',
            options: [
              {
                name: 'tournament_id',
                description: 'ID du tournoi',
                type: ApplicationCommandOptionType.String,
                required: true,
                autocomplete: true
              },

              {
                name: 'user_discord',
                description: 'Utilisateur Discord à désigner comme capitaine',
                type: ApplicationCommandOptionType.User,
                required: true
              },
              {
                name: 'team_name',
                description: 'Nom de l\'équipe (optionnel)',
                type: ApplicationCommandOptionType.String,
                required: false
              }
            ]
          },
          {
            name: 'draftstart',
            description: 'Démarrer le draft d\'un tournoi',
            options: [
              {
                name: 'tournament_id',
                description: 'ID du tournoi',
                type: ApplicationCommandOptionType.String,
                required: true,
                autocomplete: true
              }
            ]
          }
        ];
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: draftCommands });
      }
    } catch (err) {
      fastify.log.error({ err }, 'Erreur lors de l\'enregistrement des commandes slash Discord');
    }
  });

  /**
   * Gestionnaire pour les interactions Discord (clics sur les boutons)
   * Traite les votes sur les propositions de jeux
   */
  discordClient.on('interactionCreate', async (interaction) => {
    try {
      // ── Autocomplete sur tournament_id ────────────────────────────────────
      if (interaction.isAutocomplete()) {
        const autoInteraction = interaction as AutocompleteInteraction;
        const focusedOption = autoInteraction.options.getFocused(true);
        if (focusedOption.name === 'tournament_id') {
          const search = focusedOption.value.trim();
          const filter = search
            ? { name: { $regex: search, $options: 'i' }, finished: false }
            : { finished: false };
          const tournaments = await fastify.models.Tournament.find(filter)
            .sort({ date: -1 })
            .limit(25)
            .select('_id name date');
          const choices = tournaments.map((t: any) => ({
            name: `${t.name} (${new Date(t.date).toLocaleDateString('fr-FR')})`.substring(0, 100),
            value: t._id.toString()
          }));
          await autoInteraction.respond(choices);
        }
        return;
      }

      // ── Commandes slash ────────────────────────────────────────────────────
      if (interaction.isChatInputCommand()) {
        const cmd = interaction as ChatInputCommandInteraction;

        if (cmd.commandName === 'draftaddcap') {
          await cmd.deferReply({ flags: [64] });

          // Vérification des permissions admin ACS
          const adminUser = await fastify.models.User.findOne({ discordId: cmd.user.id });
          if (!adminUser || !['admin', 'superadmin'].includes(adminUser.role)) {
            await cmd.editReply('❌ Vous n\'avez pas les permissions pour exécuter cette commande.');
            return;
          }

          const tournamentId = cmd.options.getString('tournament_id', true).trim();
          const discordUser = cmd.options.getUser('user_discord', true);
          const teamName = cmd.options.getString('team_name');

          if (!mongoose.isValidObjectId(tournamentId)) {
            await cmd.editReply('❌ ID de tournoi invalide.');
            return;
          }

          const tournament = await fastify.models.Tournament.findById(tournamentId);
          if (!tournament) {
            await cmd.editReply('❌ Tournoi introuvable.');
            return;
          }
          if (!tournament.isDraft) {
            await cmd.editReply('❌ Ce tournoi n\'est pas en mode draft.');
            return;
          }
          if (tournament.draftStatus !== 'pending') {
            await cmd.editReply('❌ Le draft a déjà commencé ou est terminé.');
            return;
          }

          const acsUser = await fastify.models.User.findOne({ discordId: discordUser.id });
          if (!acsUser) {
            await cmd.editReply(`❌ <@${discordUser.id}> n'est pas lié à un compte ACS.`);
            return;
          }

          const alreadyCaptain = (tournament.teams as any[]).some(
            (t: any) => t.captainId?.toString() === (acsUser._id as any).toString()
          );
          if (alreadyCaptain) {
            await cmd.editReply(`❌ <@${discordUser.id}> est déjà capitaine d'une équipe.`);
            return;
          }

          // Ajouter aux joueurs du tournoi si absent
          const isPlayer = tournament.players.some(
            (p: any) => p.user.toString() === (acsUser._id as any).toString()
          );
          if (!isPlayer) {
            // tournament.players.push({
            //   user: acsUser._id,
            //   inWaitlist: false,
            //   registrationDate: new Date(),
            //   hasCheckin: false,
            //   isCaster: false,
            //   isMvp: false,
            //   mvpVotes: []
            // } as any);
            await cmd.editReply(`❌ <@${discordUser.id}> doit d'abord s'inscrire au tournoi avant de pouvoir être désigné comme capitaine.`);
            return;
          }

          const finalTeamName = teamName?.trim() || `Équipe ${tournament.teams.length + 1}`;
          tournament.teams.push({
            name: finalTeamName,
            captainId: acsUser._id,
            users: [acsUser._id],
            score: 0,
            ranking: 0
          } as any);

          await tournament.save();
          await cmd.editReply(`✅ <@${discordUser.id}> est maintenant capitaine de **${finalTeamName}** pour le tournoi **${tournament.name}** !`);
          return;
        }

        if (cmd.commandName === 'draftstart') {
          await cmd.deferReply({ flags: [64] });

          const adminUser = await fastify.models.User.findOne({ discordId: cmd.user.id });
          if (!adminUser || !['admin', 'superadmin'].includes(adminUser.role)) {
            await cmd.editReply('❌ Vous n\'avez pas les permissions pour exécuter cette commande.');
            return;
          }

          const tournamentId = cmd.options.getString('tournament_id', true).trim();
          if (!mongoose.isValidObjectId(tournamentId)) {
            await cmd.editReply('❌ ID de tournoi invalide.');
            return;
          }

          try {
            await fastify.discordService.startDraft(tournamentId);
            await cmd.editReply('✅ Le draft a démarré ! Les capitaines vont être notifiés dans le canal du tournoi.');
          } catch (err: any) {
            await cmd.editReply(`❌ ${err.message}`);
          }
          return;
        }

        return;
      }

      // ── Sélection d'un joueur pendant le draft ─────────────────────────────
      if (interaction.isStringSelectMenu() && interaction.customId.startsWith('draft_pick_')) {
        const selectInteraction = interaction as StringSelectMenuInteraction;
        const parts = selectInteraction.customId.split('_');
        const tournamentId = parts.slice(2).join('_');

        const tournament = await fastify.models.Tournament.findById(tournamentId);
        if (!tournament) {
          await selectInteraction.reply({ content: '❌ Tournoi introuvable.', flags: [64] });
          return;
        }
        if (tournament.draftStatus !== 'in_progress') {
          await selectInteraction.reply({ content: '❌ Le draft n\'est pas en cours.', flags: [64] });
          return;
        }

        const currentTeamId = tournament.draftOrder[tournament.draftCurrentTurnIndex];
        const currentTeam = (tournament.teams as any[]).find(
          (t: any) => t._id.toString() === currentTeamId.toString()
        );
        if (!currentTeam) {
          await selectInteraction.reply({ content: '❌ Équipe introuvable.', flags: [64] });
          return;
        }

        // Vérifier que c'est bien le capitaine concerné
        const captain = await fastify.models.User.findById(currentTeam.captainId);
        if (!captain || captain.discordId !== selectInteraction.user.id) {
          await selectInteraction.reply({ content: '❌ Ce n\'est pas ton tour de choisir.', flags: [64] });
          return;
        }

        const selectedPlayerId = selectInteraction.values[0];
        if (!mongoose.isValidObjectId(selectedPlayerId)) {
          await selectInteraction.reply({ content: '❌ Joueur invalide.', flags: [64] });
          return;
        }

        // Vérifier que le joueur n'est pas déjà assigné
        const alreadyAssigned = tournament.teams.some(
          (t: any) => t.users.some((u: any) => u.toString() === selectedPlayerId)
        );
        if (alreadyAssigned) {
          await selectInteraction.reply({ content: '❌ Ce joueur a déjà été assigné à une équipe.', flags: [64] });
          return;
        }

        // Assigner le joueur à l'équipe
        currentTeam.users.push(new mongoose.Types.ObjectId(selectedPlayerId));

        // Passer au tour suivant
        tournament.draftCurrentTurnIndex = (tournament.draftCurrentTurnIndex + 1) % tournament.draftOrder.length;
        await tournament.save();

        const selectedUser = await fastify.models.User.findById(selectedPlayerId);
        await selectInteraction.update({
          content: `✅ **${captain.username}** a choisi **${selectedUser?.username ?? 'Joueur inconnu'}** pour **${currentTeam.name}** !`,
          components: []
        });

        // Envoyer la prochaine sélection
        await fastify.discordService.sendDraftPickToNextCaptain(tournamentId);
        return;
      }

      // ── Interactions existantes ────────────────────────────────────────────
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