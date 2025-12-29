import {FastifyError, FastifyPluginAsync} from 'fastify';
import fp from 'fastify-plugin';

interface FormatterOptions {
  includeMetadata?: boolean;
}

interface Meta {
  timestamp: string;
  path: string;
  method: string;
}

interface SuccessResponse {
  success: true;
  data: unknown;
  meta?: Meta;
}

interface ErrorResponse {
  success: false;
  error: unknown;
  meta?: Meta;
}

type FormattedResponse = SuccessResponse | ErrorResponse;

const isFormattedResponse = (payload: unknown): payload is FormattedResponse => {
  if (!payload || typeof payload !== 'object') return false;
  const candidate = payload as Record<string, unknown>;
  return typeof candidate.success === 'boolean' && ('data' in candidate || 'error' in candidate || 'meta' in candidate);
};

const responseFormatterPlugin: FastifyPluginAsync<FormatterOptions> = async (fastify, opts) => {
  const includeMetadata = opts.includeMetadata ?? true;
  const UNKNOWN_ERROR_MESSAGE = 'Erreur inconnue';

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
      if (isFormattedResponse(data) && data.success === false) {
        return payload;
      }

      const response: ErrorResponse = {
        success: false,
        error: data ?? { message: UNKNOWN_ERROR_MESSAGE },
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

    // Évite un double formatage si déjà conforme
    if (isFormattedResponse(data) && data.success === true) {
      return payload;
    }

    const response: SuccessResponse = {
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
    
    const response: ErrorResponse = {
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
