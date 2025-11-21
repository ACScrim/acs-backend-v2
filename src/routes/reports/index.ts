import { IReport } from "@models/Report";
import { FastifyPluginAsync } from "fastify";
import { adminGuard } from "../../middleware/authGuard";
import { log } from "../../utils/utils";

const useReportRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Crée un nouveau signalement contre un utilisateur
   */
  fastify.post('/', { preHandler: [adminGuard] }, async (req, res) => {
    try {
      const { userId, reason } = req.body as { userId: string; reason: string };

      const user = await fastify.models.User.findById(userId);
      if (!user) {
        return res.status(404).send({ message: 'User not found' });
      }
      const newReport = new fastify.models.Report({
        user: user._id,
        reason
      });
      await newReport.save();

      return newReport;
    } catch (error) {
      log(fastify, `Erreur lors de la création d'un signalement : ${error}`, 'error');
      return res.status(500).send({ error: 'Erreur lors de la création du signalement' });
    }
  })

  /**
   * Supprime un signalement spécifique
   */
  fastify.delete('/:reportId', { preHandler: [adminGuard] }, async (req, res) => {
    try {
      const { reportId } = req.params as { reportId: string };
      const report = await fastify.models.Report.findById(reportId) as IReport;
      if (!report) {
        return res.status(404).send({ message: 'Report not found' });
      }
      await report.deleteOne();
      return { message: 'Report removed successfully' };
    } catch (error) {
      log(fastify, `Erreur lors de la suppression d'un signalement : ${error}`, 'error');
      return res.status(500).send({ error: 'Erreur lors de la suppression du signalement' });
    }
  });
}

export default useReportRoutes;

