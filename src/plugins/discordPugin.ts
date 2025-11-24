import { FastifyPluginAsync } from 'fastify';
import fp from "fastify-plugin";
import { Client, IntentsBitField, InteractionType } from 'discord.js';
import DiscordService from "../services/discordService";

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

  const discordService = new DiscordService(discordClient);
  fastify.decorate('discordService', discordService);

  /**
   * Gestionnaire pour les interactions Discord (clics sur les boutons)
   * Traite les votes sur les propositions de jeux
   */
  discordClient.on('interactionCreate', async (interaction) => {
    try {
      // Vérifier que c'est une interaction de bouton
      if (!interaction.isButton()) {
        return;
      }

      // Vérifier si c'est un bouton de vote pour une proposition
      if (interaction.customId.startsWith('proposal_vote_')) {
        const parts = interaction.customId.split('_');
        const voteType = parts[2]; // 'yes' ou 'no'
        const proposalId = parts.slice(3).join('_');

        // Récupérer la proposition
        const proposal = await fastify.models.GameProposal.findById(proposalId).populate('proposedBy');
        if (!proposal) {
          await interaction.reply({ content: '❌ Proposition introuvable', ephemeral: true });
          return;
        }

        // Récupérer l'utilisateur Discord
        const userId = interaction.user.id;
        const user = await fastify.models.User.findOne({ discordId: userId });

        if (!user) {
          await interaction.reply({
            content: '❌ Vous devez être connecté sur ACS pour voter',
            ephemeral: true
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
          await interaction.reply({
            content: '👎 Ton vote a été retiré',
            ephemeral: true
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
            await interaction.reply({
              content: '👍 Ton vote a été ajouté !',
              ephemeral: true
            });
          } else {
            await interaction.reply({
              content: '✅ Tu as déjà voté pour cette proposition',
              ephemeral: true
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
    } catch (error) {
      console.error('Erreur lors du traitement de l\'interaction Discord:', error);
      try {
        interaction.isButton() && await interaction.reply({
          content: '❌ Une erreur est survenue',
          ephemeral: true
        });
      } catch (replyError) {
        console.error('Erreur lors de la réponse à l\'interaction:', replyError);
      }
    }
  });

  fastify.addHook('onClose', async () => {
    await discordClient.destroy();
  });
};

export default fp(discordPlugin, { name: "discord-plugin" });