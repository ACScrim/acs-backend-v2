import {FastifyPluginAsync} from "fastify";
import mongoose from "mongoose";

const healthRoute: FastifyPluginAsync = async (fastify) => {
  /**
   * Endpoint de healthcheck pour vérifier que l'API est opérationnelle
   */
  fastify.get("/health", async () => {
    const mongooseState = mongoose.connection?.readyState;
    const mongooseStatus = mongooseState === 1 ? 'connected' : 'disconnected';
    
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      mongodb: mongooseStatus,
      environment: process.env.NODE_ENV || 'development'
    };
  });
};

export default healthRoute;
