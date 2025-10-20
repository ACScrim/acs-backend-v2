import { FastifyPluginAsync } from "fastify";
import { authGuard } from "../../middleware/authGuard";

const proposalRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (req, res) => {
    return (await fastify.models.GameProposal.find()
      // @ts-ignore
      .populateData()
      .sort({ createdAt: -1 }));
  })

  fastify.post('/', { preHandler: [authGuard] }, async (req, res) => {
    const { vote, id } = req.body as { vote: boolean; id: string };
    const userId = req.session.userId as string;

    const user = await fastify.models.User.findById(userId);
    if (!user) {
      return res.status(404).send({ error: 'User not found' });
    }
    const proposal = await fastify.models.GameProposal.findById(id);
    if (!proposal) {
      return res.status(404).send({ error: 'Proposal not found' });
    }

    const existingVoteIndex = proposal.votes.findIndex((vote: any) => vote.user.toString() === userId);
    if (!vote && existingVoteIndex !== -1) {
      proposal.votes.splice(existingVoteIndex, 1);
    } else {
      proposal.votes.push({ user: userId, createdAt: new Date(), updatedAt: new Date() });
    }

    await proposal.save();
    await proposal.populateData();
    // log(req, `User ${user.username} voted on proposal ${proposal.id} with vote: ${vote}`);
    return res.send(proposal);
  })
}

export default proposalRoutes;