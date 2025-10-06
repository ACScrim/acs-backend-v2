import { FastifyRequest, FastifyReply } from 'fastify';

export async function authenticate(req: FastifyRequest, res: FastifyReply) {
  try {
    // @ts-ignore
    if (!req.session.authenticated || !req.session.userId) {
      return res.status(401).send({ error: 'Not authenticated' });
    }

    // @ts-ignore
    const user = await req.server.models.User.findById(req.session.userId);
    
    if (!user) {
      // Détruire la session si l'utilisateur n'existe plus
      req.session.destroy((err) => {
        if (err) {
          req.server.log.error(err);
        }
      });
      return res.status(401).send({ error: 'User not found' });
    }

    // Attacher l'utilisateur à la requête
    req.user = user;
  } catch (error) {
    req.server.log.error(error);
    return res.status(401).send({ error: 'Invalid session' });
  }
}