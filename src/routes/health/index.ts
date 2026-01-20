import {FastifyPluginAsync} from "fastify";
import mongoose from "mongoose";

const healthRoute: FastifyPluginAsync = async (fastify) => {
  /**
   * Endpoint de healthcheck pour vérifier que l'API est opérationnelle
   */
  fastify.get("/health", async () => {
    const mongooseState = mongoose.connection?.readyState;
    
    // États MongoDB: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
    let mongooseStatus = 'unknown';
    switch (mongooseState) {
      case 0:
        mongooseStatus = 'disconnected';
        break;
      case 1:
        mongooseStatus = 'connected';
        break;
      case 2:
        mongooseStatus = 'connecting';
        break;
      case 3:
        mongooseStatus = 'disconnecting';
        break;
    }
    
    return {
      status: mongooseState === 1 ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      mongodb: mongooseStatus,
      environment: process.env.NODE_ENV || 'development'
    };
  });
};

export default healthRoute;
