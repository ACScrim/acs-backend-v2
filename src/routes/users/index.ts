import { FastifyPluginAsync } from "fastify";
import { authGuard } from "../../middleware/authGuard";

const usersRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (req, res) => {
    return fastify.models.User.find();
  })

  fastify.get("/me", { preHandler: [authGuard] }, async (req, res) => {
    const userId = req.session.userId as string;
    const user = await fastify.models.User.findById(userId);
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }
    return user;
  })
};

export default usersRoute;