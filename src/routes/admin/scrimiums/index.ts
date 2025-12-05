import {FastifyPluginAsync} from "fastify";
import {adminGuard} from "../../../middleware/authGuard";

const scrimiumRoutes: FastifyPluginAsync = async (fastify) => {

  fastify.get("/", { preHandler: [adminGuard] }, async (req, resp) => {
    return fastify.models.Scrimium.find().populate('user');
  });

  fastify.post("/:userId", { preHandler: [adminGuard] }, async (req, resp) => {
    const { action, amount } = req.body as { action: 'add' | 'remove', amount: number }

    const { userId } = req.params as { userId: string }

    const scrimium = await fastify.models.Scrimium.findOne({ userId: userId }).populate('user');

    switch(action) {
      case "add":
        scrimium.balance +=  amount;
        break;
      case "remove":
        scrimium.balance -= amount;
        break;
    }

    scrimium.transactions.push({
      amount: amount * (action === 'remove' ? -1 : 1),
      date: new Date(),
      description: "admin"
    });

    await scrimium.save();

    return scrimium;
  })
}

export default scrimiumRoutes;