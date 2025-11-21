import {FastifyPluginAsync} from "fastify";
import {authGuard} from "../../middleware/authGuard";
import {log} from "../../utils/utils";

const RAWG_API_KEY = process.env.RAWG_API_KEY;
const URL_API = 'https://rawg.io/api/games';

const proposalRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Récupère la liste de toutes les propositions de jeux
   */
  fastify.get('/', async (req, res) => {
    try {
      return (await fastify.models.GameProposal.find()
        // @ts-ignore
        .populateData()
        .sort({ createdAt: -1 }));
    } catch (error) {
      log(fastify, `Erreur lors de la récupération des propositions : ${error}`, 'error');
      return res.status(500).send({ error: 'Erreur lors de la récupération des propositions' });
    }
  })

  /**
   * Recherche des jeux sur l'API RAWG.io
   */
  fastify.get('/rawg-games', async (req, res) => {
    try {
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
    } catch (error) {
      log(fastify, `Erreur lors de la recherche RAWG : ${error}`, 'error');
      return res.status(500).send({ error: 'Erreur lors de la recherche RAWG' });
    }
  })

  /**
   * Permet à un utilisateur de voter pour ou contre une proposition de jeu
   * Met à jour le message Discord avec le nouveau nombre de votes
   */
  fastify.post('/vote', { preHandler: [authGuard] }, async (req, res) => {
    try {
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

      // Mettre à jour le message Discord avec le nouveau nombre de votes
      try {
        await fastify.discordService.updateProposalMessage(proposal);
      } catch (discordError) {
        log(fastify, `Erreur lors de la mise à jour du message Discord de la proposition : ${discordError}`, 'error');
        // Ne pas bloquer la réponse si Discord échoue
      }

      return proposal;
    } catch (error) {
      log(fastify, `Erreur lors du vote sur une proposition : ${error}`, 'error');
      return res.status(500).send({ error: 'Erreur lors du vote' });
    }
  })

  /**
   * Crée une nouvelle proposition de jeu et l'ajoute à la base de données
   */
  fastify.post('/', { preHandler: [authGuard] }, async (req, res) => {
    try {
      const { game, description } = req.body as { game: any; description: string };
      const userId = req.session.userId as string;

      const alreadyProposed = await fastify.models.GameProposal.findOne({ rawgId: game.id });
      if (alreadyProposed) {
        log(fastify, `Ce jeu a déjà été proposé : ${game.name}`, 'error');
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

      proposal.discordMessageId = await fastify.discordService.postProposal(proposal);
      await proposal.save();

      return proposal;
    } catch (error) {
      log(fastify, `Erreur lors de la création d'une proposition : ${error}`, 'error');
      return res.status(500).send({ error: 'Erreur lors de la création de la proposition' });
    }
  });
}

export default proposalRoutes;

