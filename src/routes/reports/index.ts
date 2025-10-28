import { IReport } from "@models/Report";
import { FastifyPluginAsync } from "fastify";
import { adminGuard } from "../../middleware/authGuard";

const useReportRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/', { preHandler: [adminGuard] }, async (req, res) => {
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
  })

  fastify.delete('/:reportId', { preHandler: [adminGuard] }, async (req, res) => {
    const { reportId } = req.params as { reportId: string };
    const report = await fastify.models.Report.findById(reportId) as IReport;
    if (!report) {
      return res.status(404).send({ message: 'Report not found' });
    }
    await report.deleteOne();
    return { message: 'Report removed successfully' };
  });
}

export default useReportRoutes;