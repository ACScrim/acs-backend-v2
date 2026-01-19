import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

/**
 * Plugin pour capturer le corps brut des requêtes JSON
 * Nécessaire pour la vérification de signature Twitch EventSub
 */
const rawBodyPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    try {
      // Stocker le corps brut dans la requête
      (req as any).rawBody = body.toString('utf8');

      // Parser le JSON pour req.body
      const json = JSON.parse(body.toString('utf8'));
      done(null, json);
    } catch (err: any) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });
};

export default fp(rawBodyPlugin, { name: 'raw-body-plugin' });
