import { FastifyPluginAsync } from 'fastify';
import fp from "fastify-plugin";
import cron from 'node-cron';

const cronPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('cron', cron);
};

export default fp(cronPlugin, { name: "cron-plugin" });