import { FastifyPluginAsync } from "fastify";
import { authGuard } from "../../middleware/authGuard";
import { release } from "os";

const RAWG_API_KEY = process.env.RAWG_API_KEY;
const URL_API = 'https://rawg.io/api/games';

const proposalRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (req, res) => {
    return (await fastify.models.GameProposal.find()
      // @ts-ignore
      .populateData()
      .sort({ createdAt: -1 }));
  })

  fastify.get('/rawg-games', async (req, res) => {
    if (!RAWG_API_KEY) {
      return res.status(500).send({ error: 'RAWG API key is not configured' });
    }
    const { q } = req.query as { q: string };
    const response = await fetch(`${URL_API}?key=${RAWG_API_KEY}&page_size=10&search=${q}&stores=1,2,3,4,11,6`);
    if (!response.ok) {
      return res.status(500).send({ error: `RAWG API Error: ${response.statusText} (${response.status})` });
    }
    const data = await response.json() as any;
    return res.send(data.results.map((entry: any) => ({
      id: entry.id,
      name: entry.name,
      background_image: entry.background_image,
      release_date: entry.released,
    })));
  })

  fastify.post('/vote', { preHandler: [authGuard] }, async (req, res) => {
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
    return proposal;
  })

  fastify.post('/', { preHandler: [authGuard] }, async (req, res) => {
    const { game, description } = req.body as { game: any; description: string };
    const userId = req.session.userId as string;

    const alreadyProposed = await fastify.models.GameProposal.findOne({ rawgId: game.id });
    if (alreadyProposed) {
      return res.status(400).send({ error: 'Ce jeu a déjà été proposé.' });
    }

    const proposal = new fastify.models.GameProposal({
      name: game.name,
      description: description,
      rawgId: game.id,
      imageUrl: game.background_image,
      proposedBy: userId,
      votes: [],
      status: 'approved'
    });

    if (!(await fastify.models.Game.findOne({ name: game.name }))) {
      const acsGame = new fastify.models.Game({
        name: game.name,
        imageUrl: game.background_image,
        roles: []
      });
      await acsGame.save();
    }

    await proposal.save();
    await proposal.populateData();

    return proposal;
  });
}

export default proposalRoutes;