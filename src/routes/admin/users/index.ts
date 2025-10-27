import { IReport } from "@models/Report";
import { IUser } from "@models/User";
import { FastifyPluginAsync } from "fastify";

const adminUsersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", { preHandler: [] }, async (req, res) => {
    const users = await fastify.models.User.find() as IUser[];
    const reports = await fastify.models.Report.find() as IReport[];

    const usersWithReports = users.map(user => ({
      ...user.toJSON(),
      reports: reports.filter(report => report.user.toString() === (user._id as any).toString())
    }));

    return usersWithReports;
  })
};

export default adminUsersRoutes;