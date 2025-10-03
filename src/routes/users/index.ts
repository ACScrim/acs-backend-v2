import { FastifyPluginAsync } from "fastify";

const usersRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (req, res) => {
    return fastify.models.User.find();
  })
};

export default usersRoute;