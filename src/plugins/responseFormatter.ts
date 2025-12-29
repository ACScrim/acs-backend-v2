import {FastifyError, FastifyPluginAsync} from 'fastify';
import fp from 'fastify-plugin';

interface FormatterOptions {
  includeMetadata?: boolean;
}

const responseFormatterPlugin: FastifyPluginAsync<FormatterOptions> = async (fastify, opts) => {
  const includeMetadata = opts.includeMetadata ?? true;

  // Format succès
  fastify.addHook('onSend', async (request, reply, payload) => {
    if (reply.statusCode >= 400) {
      let data = payload;
      if (typeof payload === 'string') {
        try {
          data = JSON.parse(payload);
        } catch {
          data = payload;
        }
      }

      // Évite un double formatage si déjà conforme
      if (data && typeof data === 'object' && (data as any).success === false) {
        return payload;
      }

      const response: any = {
        success: false,
        error: data ?? { message: 'Erreur inconnue' },
      };

      if (includeMetadata) {
        response.meta = {
          timestamp: new Date().toISOString(),
          path: request.url,
          method: request.method,
        };
      }

      return JSON.stringify(response);
    }

    let data = payload;
    if (typeof payload === 'string') {
      try {
        data = JSON.parse(payload);
      } catch {
        data = payload;
      }
    }

    const response: any = {
      success: true,
      data: data,
    };

    if (includeMetadata) {
      response.meta = {
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
      };
    }

    return JSON.stringify(response);
  });

  // Format erreurs
  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode || 500;
    
    const response: any = {
      success: false,
      error: {
        message: error.message,
        code: error.code || 'INTERNAL_ERROR',
      },
    };

    if (includeMetadata) {
      response.meta = {
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
      };
    }

    reply.status(statusCode).send(response);
  });
};

export default fp(responseFormatterPlugin, {
  name: 'response-formatter',
});
