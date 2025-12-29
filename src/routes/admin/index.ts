import {FastifyPluginAsync} from "fastify";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import {Tail} from "tail";
import {log} from "../../utils/utils";

const adminRootRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/logs/history", async (request, reply) => {
    const logPath = path.join(__dirname, "../../../../logs/backend.log");

    try {
      const stream = fs.createReadStream(logPath, { encoding: "utf8" });
      const rl = readline.createInterface({ input: stream });

      const lines: string[] = [];
      for await (const line of rl) {
        lines.push(line);
      }

     return lines.slice(-50);
    } catch (error) {
      log(fastify, `Erreur lors de la récupération des logs : ${error}`, 'error');
      reply.code(404).send({ error: "Fichier de logs introuvable sur le serveur" });
    }
  });

  /**
   * Récupère et diffuse le flux des logs du backend en temps réel
   * Surveille les nouvelles lignes avec SSE (Server-Sent Events)
   */
  fastify.get("/logs", async (request, reply) => {
    const logPath = path.join(__dirname, "../../../../logs/backend.log");

    try {
      reply.sse({ event: "log-start", data: "Starting log stream\n" });

      const tail = new Tail(logPath);

      tail.on("line", (line: any) => {
        reply.sse({ data: line + "\n" });
      });

      tail.on("error", (error: any) => {
        console.error("Tail error:", error);
      });

      request.socket.on("close", () => {
        tail.unwatch();
      });
    } catch (error) {
      log(fastify, `Erreur lors de la récupération des logs : ${error}`, 'error');
      reply.code(404).send({ error: "Fichier de logs introuvable sur le serveur" });
    }
  });
};

export default adminRootRoutes;
