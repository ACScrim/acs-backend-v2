import {FastifyPluginAsync} from "fastify";
import TwitchService from "../services/twitchService";
import fp from "fastify-plugin";

const twitchPlugin: FastifyPluginAsync = async (fastify) => {
  const twitchService = new TwitchService(fastify);
  fastify.decorate('twitchService', twitchService);
}

export default fp(twitchPlugin, {name: 'twitch-plugin'});