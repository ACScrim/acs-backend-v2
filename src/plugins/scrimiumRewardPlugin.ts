import {FastifyPluginAsync} from "fastify";
import TwitchService from "../services/twitchService";
import fp from "fastify-plugin";
import ScrimiumRewardService from "../services/scrimiumRewardService";

const scrimiumRewardPlugin: FastifyPluginAsync = async (fastify) => {
  const scrimiumRewardService = new ScrimiumRewardService(fastify);
  fastify.decorate('scrimiumRewardService', scrimiumRewardService);
}

export default fp(scrimiumRewardPlugin, {name: 'scrimiumReward-plugin'});