import { FastifyPluginAsync } from "fastify";

const usersRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (req, res) => {
    return fastify.models.User.find();
  })

  fastify.get("/me", async (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).send({ error: "Unauthorized" });
    }
    const user = await fastify.models.User.findById(userId);
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }
    return user;
  })
};

export default usersRoute;