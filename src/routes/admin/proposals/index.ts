import {FastifyPluginAsync} from "fastify";
import {adminGuard} from "../../../middleware/authGuard";
import {log} from "../../../utils/utils";

const adminProposalsRoutes: FastifyPluginAsync = async (fastify) => {
  /*********************************************
   * GET
  *********************************************/

  /**
   * Récupère la liste de toutes les propositions de jeux triées par date décroissante
   */
  fastify.get('/', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      const proposals = await fastify.models.GameProposal
        .find()
        .populate('proposedBy', 'username avatarUrl')
        .populate('votes.user', 'username avatarUrl')
        .sort({ createdAt: -1 });
      return proposals;
    } catch (error) {
      log(fastify, `Erreur lors de la récupération de la liste des propositions : ${error}`, 'error');
      return reply.status(500).send({ error: 'Erreur lors de la récupération des propositions' });
    }
  });

  /**
   * Récupère les détails d'une proposition spécifique par son ID
   */
  fastify.get('/:id', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      const proposal = await fastify.models.GameProposal
        .findById((request.params as any).id)
        .populate('proposedBy', 'username avatarUrl')
        .populate('votes.user', 'username avatarUrl');

      if (!proposal) {
        return reply.notFound();
      }
      return proposal;
    } catch (error) {
      log(fastify, `Erreur lors de la récupération de la proposition ${(request.params as any).id} : ${error}`, 'error');
      return reply.status(500).send({ error: 'Erreur lors de la récupération de la proposition' });
    }
  });

  /*********************************************
   * DELETE
  *********************************************/

  /**
   * Supprime une proposition de jeu (rejet)
   */
  fastify.delete('/:id', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      const proposal = await fastify.models.GameProposal.findByIdAndDelete((request.params as any).id);

      if (!proposal) {
        return reply.notFound();
      }

      if (proposal.discordMessageId) await fastify.discordService.deleteProposalMessage(proposal.discordMessageId);
      log(fastify, `Proposition "${proposal.name}" supprimée par ${request.session.userId}`, 'info');
      return { message: 'Proposition rejetée avec succès' };
    } catch (error) {
      log(fastify, `Erreur lors du rejet de la proposition : ${error}`, 'error');
      return reply.status(500).send({ error: 'Erreur lors du rejet de la proposition' });
    }
  });
};

export default adminProposalsRoutes;

