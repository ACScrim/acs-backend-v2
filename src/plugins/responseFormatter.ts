import {FastifyError, FastifyPluginAsync} from 'fastify';
import fp from 'fastify-plugin';

interface FormatterOptions {
  includeMetadata?: boolean;
  unknownErrorMessage?: string;
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

const isValidMeta = (meta: unknown): meta is Meta => {
  if (!meta || typeof meta !== 'object') return false;
  const m = meta as Record<string, unknown>;
  return typeof m.timestamp === 'string' && typeof m.path === 'string' && typeof m.method === 'string';
};

const isFormattedResponse = (payload: unknown): payload is FormattedResponse => {
  if (!payload || typeof payload !== 'object') return false;
  const candidate = payload as Record<string, unknown>;
  if (candidate.success === true) {
    if (!('data' in candidate)) return false;
    if ('meta' in candidate && candidate.meta !== undefined && !isValidMeta(candidate.meta)) return false;
    return true;
  }
  if (candidate.success === false) {
    if (!('error' in candidate)) return false;
    if ('meta' in candidate && candidate.meta !== undefined && !isValidMeta(candidate.meta)) return false;
    return true;
  }
  return false;
};

const responseFormatterPlugin: FastifyPluginAsync<FormatterOptions> = async (fastify, opts) => {
  const includeMetadata = opts.includeMetadata ?? true;
  const UNKNOWN_ERROR_MESSAGE = opts.unknownErrorMessage ?? 'Erreur inconnue';

  const parsePayload = (payload: unknown) => {
    if (typeof payload === 'string') {
      try {
        return JSON.parse(payload);
      } catch {
        return payload;
      }
    }
    return payload;
  };

  const normalizeError = (data: unknown): { message: string; detail?: unknown } => {
    if (data && typeof data === 'object' && 'message' in (data as Record<string, unknown>)) {
      const msg = (data as Record<string, unknown>).message;
      if (typeof msg === 'string') {
        return { message: msg, detail: data };
      }
    }
    return { message: UNKNOWN_ERROR_MESSAGE, detail: data };
  };

  // Format succès
  fastify.addHook('onSend', async (request, reply, payload) => {
    if (reply.statusCode >= 400) {
      const data = parsePayload(payload);

      // Évite un double formatage si déjà conforme
      if (isFormattedResponse(data) && data.success === false) {
        return payload;
      }

      const response: ErrorResponse = {
        success: false,
        error: normalizeError(data),
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

    const data = parsePayload(payload);

    // Évite un double formatage si déjà conforme
    if (isFormattedResponse(data) && data.success === true) {
      return payload;
    }

    const response: SuccessResponse = {
      success: true,
      data,
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
