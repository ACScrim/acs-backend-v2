import { IReport } from "../../../models/Report";
import { IUser } from "../../../models/User";
import { FastifyPluginAsync } from "fastify";
import { log } from "../../../utils/utils";

const adminUsersRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Récupère la liste de tous les utilisateurs avec leurs rapports signalements associés
   */
  fastify.get("/", { preHandler: [] }, async (req, res) => {
    try {
      const users = await fastify.models.User.find() as IUser[];
      const reports = await fastify.models.Report.find() as IReport[];

      const usersWithReports = users.map(user => ({
        ...user.toJSON(),
        reports: reports.filter(report => report.user.toString() === (user._id as any).toString())
      }));

      return usersWithReports;
    } catch (error) {
      log(fastify, `Erreur lors de la récupération de la liste des utilisateurs : ${error}`, 'error');
      return res.status(500).send({ error: 'Erreur lors de la récupération des utilisateurs' });
    }
  });

  /**
   * Met à jour le rôle d'un utilisateur (superadmin, admin, user)
   */
  fastify.patch<{ Params: { userId: string }, Body: { role: "superadmin" | "admin" | "user" } }>("/:userId/role", { preHandler: [] }, async (req, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      const user = await fastify.models.User.findById(userId) as IUser;
      if (!user) {
        log(fastify, `Utilisateur introuvable pour la mise à jour du rôle (${userId})`, 'error', 404);
        return res.status(404).send({ message: "Utilisateur introuvable pour la mise à jour du rôle" });
      }
      user.role = role;
      await user.save();
      return res.send({ message: "Rôle utilisateur mis à jour avec succès" });
    } catch (error) {
      log(fastify, `Erreur lors de la mise à jour du rôle de l'utilisateur ${(req.params as any).userId} : ${error}`, 'error');
      return res.status(500).send({ error: 'Erreur lors de la mise à jour du rôle' });
    }
  });
};

export default adminUsersRoutes;
