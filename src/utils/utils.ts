import { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify";

export const log = (req: FastifyRequest | FastifyInstance, message: string, level: 'info' | 'error' = 'info') => {
  req.log.level = level;
  if (level === 'info') {
    req.log.info(message);
  } else {
    req.log.error(message);
  }
  req.log.level = 'silent';
}