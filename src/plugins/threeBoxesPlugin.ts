import { FastifyPluginAsync } from "fastify";
import fp from 'fastify-plugin';
import ThreeBoxesService from '../services/threeBoxesService';

const threeBoxesPlugin: FastifyPluginAsync = async (fastify) => {
  const service = new ThreeBoxesService(fastify);
  fastify.decorate('threeBoxesService', service);
}

export default fp(threeBoxesPlugin, { name: 'three-boxes-plugin' });
