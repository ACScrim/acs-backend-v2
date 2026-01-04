import {FastifyPluginAsync} from "fastify";
import {authGuard} from "../../middleware/authGuard";

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/logout", { preHandler: [authGuard] }, async (req, res) => {
    if (req.session) {
      await new Promise<void>((resolve, reject) =>
        req.session!.destroy((err) => (err ? reject(err) : resolve()))
      );
    } else if (typeof (req as any).destroySession === "function") {
      await new Promise<void>((resolve, reject) =>
        (req as any).destroySession((err: Error | undefined) => (err ? reject(err) : resolve()))
      );
    }

    res.clearCookie("acs.sid", {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      expires: new Date(0)
    });

    return res.status(204).send();
  })
}

export default authRoutes;