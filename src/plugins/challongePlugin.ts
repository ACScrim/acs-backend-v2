import {FastifyPluginAsync} from "fastify";
import fp from "fastify-plugin";
import ChallongeService from "../services/challongeService";

const challongePlugin: FastifyPluginAsync = async (fastify) => {
  const challongeService = new ChallongeService(fastify);
  fastify.decorate('challongeService', challongeService);
}

export default fp(challongePlugin, {name: 'challonge-plugin'});