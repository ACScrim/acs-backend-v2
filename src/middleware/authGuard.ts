import { FastifyReply, FastifyRequest } from "fastify";

export async function authGuard(req: FastifyRequest, res: FastifyReply) {
  if (!req.session.userId) {
    return res.status(401).send({ error: 'Unauthorized' });
  }
}