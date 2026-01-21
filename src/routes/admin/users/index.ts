import { FastifyPluginAsync } from "fastify";
import { log, AppError } from "../../../utils/utils";
import { adminGuard } from "../../../middleware/authGuard";

const adminUsersRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Récupère la liste de tous les utilisateurs avec leurs rapports signalements associés
   */
  fastify.get("/", { preHandler: [] }, async () => {
    try {
      // NOTE: collection mongo = "reports" (Mongoose pluralise le modèle Report)
      // et "users" côté User.
      return await fastify.models.User.aggregate([
        // Optionnel: limiter les champs user si besoin (ça aide beaucoup sur de gros volumes)
        // { $project: { email: 1, username: 1, role: 1, discordId: 1, avatarUrl: 1, createdAt: 1, updatedAt: 1 }},
        {
          $lookup: {
            from: 'reports',
            localField: '_id',
            foreignField: 'user',
            as: 'reports'
          }
        },
        // Optionnel: trier les reports par date décroissante
        { $addFields: { reports: { $sortArray: { input: '$reports', sortBy: { createdAt: -1 } } } } },
        // Assurer un `id` comme avec toJSON Mongoose
        { $addFields: { id: '$_id' } },
        { $project: { _id: 0, __v: 0, 'reports.__v': 0, 'reports._id': 0 } }
      ]).exec();
    } catch (error) {
      log(fastify, `Erreur lors de la récupération de la liste des utilisateurs : ${error}`, 'error');
      throw error instanceof AppError ? error : new AppError(500, 'Erreur lors de la récupération des utilisateurs');
    }
  });

  /**
   * Met à jour le rôle d'un utilisateur (superadmin, admin, user)
   */
  fastify.patch<{ Params: { userId: string }, Body: { role: "superadmin" | "admin" | "user" } }>("/:userId/role", { preHandler: [adminGuard] }, async (req, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      const user = await fastify.models.User.findById(userId);
      if (!user) {
        log(fastify, `Utilisateur introuvable pour la mise à jour du rôle (${userId})`, 'error');
        throw new AppError(404, "Utilisateur introuvable pour la mise à jour du rôle");
      }
      (user as any).role = role;
      await (user as any).save();
      return res.send({ message: "Rôle utilisateur mis à jour avec succès" });
    } catch (error) {
      log(fastify, `Erreur lors de la mise à jour du rôle de l'utilisateur ${(req.params as any).userId} : ${error}`, 'error');
      throw error instanceof AppError ? error : new AppError(500, 'Erreur lors de la mise à jour du rôle');
    }
  });
};

export default adminUsersRoutes;
