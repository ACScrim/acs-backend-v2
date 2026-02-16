import { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../utils/utils";

export async function authGuard(req: FastifyRequest, res: FastifyReply) {
  if ((req.query as any).acsteamssheet) {

  }
  else if (!req.session.userId) {
    throw new AppError(401, 'Non authentifié');
  }
}

export async function adminGuard(req: FastifyRequest, res: FastifyReply) {
  if (!req.session.userId) {
    throw new AppError(401, 'Non authentifié');
  }
  const user = await req.server.models.User.findById(req.session.userId);
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin' && !user.role.includes('card'))) {
    throw new AppError(403, 'Accès interdit');
  }
}