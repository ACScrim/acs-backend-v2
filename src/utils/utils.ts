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
      // @ts-ignore
      user: req.user || req.session?.userId || 'anonymous'
    });
  }
  req.log.level = 'silent';
}

export const fetchImageAsBase64 = async (url: string): Promise<{ base64: string; mimeType: string }> => {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const mimeType = res.headers.get('content-type') ?? 'application/octet-stream';

  return { base64, mimeType };
};

export const isRankingCountedAsPodium = (rank: number, totalTeams: number): boolean => {
  if (rank === 1) return false;
  if (totalTeams >= 4) {
    return rank <= 3;
  }
  else if (totalTeams === 3) {
    return rank <= 2;
  }
  return false;
}