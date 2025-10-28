import { FastifyReply, FastifyRequest } from "fastify";

export async function authGuard(req: FastifyRequest, res: FastifyReply) {
  if (!req.session.userId) {
    return res.status(401).send({ error: 'Unauthorized' });
  }
}

export async function adminGuard(req: FastifyRequest, res: FastifyReply) {
  if (!req.session.userId) {
    return res.status(401).send({ error: 'Unauthorized' });
  }
  const user = await req.server.models.User.findById(req.session.userId);
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return res.status(403).send({ error: 'Forbidden' });
  }
}