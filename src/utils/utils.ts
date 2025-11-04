import { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify";

export const log = (req: FastifyRequest | FastifyInstance, message: string, level: 'info' | 'error' = 'info', status?: number) => {
  req.log.level = level;
  if ('server' in req && typeof (req as FastifyInstance).close === 'function') {
    if (level === 'info') {
      req.log.info(message);
    } else {
      req.log.error(message);
    }
  }
  else {
    req = req as FastifyRequest;
    req.log[level]({
      msg: message,
      method: req.method,
      url: req.url,
      body: req.body,
      statusCode: status,
      user: req.user || req.session?.userId || 'anonymous'
    });
  }
  req.log.level = 'silent';
}