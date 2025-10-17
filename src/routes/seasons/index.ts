import { FastifyPluginAsync } from "fastify";

const seasonsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (req, res) => {
    return fastify.models.Season.find({}).sort({ number: -1 });
  })
}

export default seasonsRoutes;