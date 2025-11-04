import { FastifyPluginAsync } from "fastify";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { Tail } from "tail";

const adminRootRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/logs", async (request, reply) => {
    const logPath = path.join(__dirname, "../../../../logs/backend.log");
    
    try {
      // Lire les lignes existantes
      const stream = fs.createReadStream(logPath, { encoding: "utf8" });
      const rl = readline.createInterface({ input: stream });
      
      reply.sse({ event: "log-start", data: "Starting log stream\n" });
      for await (const line of rl) {
        reply.sse({ data: line + "\n" });
      }
      
      // Surveiller les nouvelles lignes avec tail
      const tail = new Tail(logPath);
      
      tail.on("line", (line: any) => {
        reply.sse({ data: line + "\n" });
      });
      
      tail.on("error", (error: any) => {
        console.error("Tail error:", error);
      });
      
      // Fermer le tail quand le client se déconnecte
      request.socket.on("close", () => {
        tail.unwatch();
      });
      
    } catch (error) {
      reply.code(404).send({ error: "Log file not found" });
    }
  });
};

export default adminRootRoutes;