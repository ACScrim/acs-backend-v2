import {FastifyInstance, FastifyPluginAsync} from "fastify";
import {authGuard} from "../../../middleware/authGuard";
import {ITournament} from "../../../models/Tournament";
import {IGame} from "../../../models/Game";
import {IUser} from "../../../models/User";
import * as crypto from "node:crypto";
import {IAcsdle, IAcsdleCompletion, IAcsdleUser} from "../../../models/Acsdle";

const buildAcsdleUser = async (fastify: FastifyInstance, user: IUser): Promise<IAcsdleUser> => {
  const userId = user._id?.toString() ?? user.id;
  const tournamentsPlayed = await fastify.models.Tournament.find({ 'players.user': userId, 'finished': true }) as ITournament[];
  const victories = tournamentsPlayed.filter(t => t.teams.some(team => team.ranking === 1 && (team.users as any).includes(userId))).length;
  const top25Finishes = tournamentsPlayed.filter(t => t.teams.some(team => team.ranking <= (t.teams.length / 4) && (team.users as any).includes(userId))).length;
  const gameCounts = tournamentsPlayed.reduce((acc, t) => {
    const id = t.gameId.toString();
    acc[id] = (acc[id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const mostPlayedGameIds = (() => {
    const entries = Object.entries(gameCounts);
    if (entries.length === 0) return [];
    entries.sort((a, b) => b[1] - a[1]);
    const highestCount = entries[0][1];
    return entries.filter(([_, count]) => count === highestCount).map(([id, _]) => id);
  })();

  let mostPlayedGames = ["N/A"];
  if (mostPlayedGameIds && mostPlayedGameIds.length > 0) {
    const games = await fastify.models.Game.find<IGame>({ _id: { $in: mostPlayedGameIds } });
    mostPlayedGames = games.map(g => g.name);
  }

  return {
    id: userId,
    username: user.username,
    createdAt: user.createdAt,
    tournamentsPlayed: tournamentsPlayed.length,
    victories,
    top25Finishes,
    mostPlayedGames
  };
};

const encryptJSON = (obj: any, secret: string) => {
  const iv = crypto.randomBytes(12); // 96 bits recommended for GCM
  const key = crypto.createHash("sha256").update(secret).digest(); // 32 bytes
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(obj), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    payload: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64")
  };
};

const acsdleRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/users", { preHandler: [authGuard] }, async (request, reply) => {
    const acsdleUsers: IAcsdleUser[] = [];
    const users = await fastify.models.User.find() as IUser[];
    for (const user of users.values()) {
      acsdleUsers.push(await buildAcsdleUser(fastify, user));
    }
    return acsdleUsers.filter(u => u.tournamentsPlayed > 0);
  });

  fastify.get("/daily", { preHandler: [authGuard] }, async (request, reply) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayAcsdleUserId = (await fastify.models.Acsdle.findOne<IAcsdle>({ date: today }))?.userId.toString();
    let acsdleUser: IAcsdleUser

    if (!todayAcsdleUserId) {
      do {
        const randomUser = await fastify.models.User.aggregate([{$sample: {size: 1}}]) as IUser[];
        if (randomUser.length === 0) {
          return reply.status(404).send({error: "No users found"});
        }
      acsdleUser = await buildAcsdleUser(fastify, randomUser[0]);
      } while (acsdleUser.tournamentsPlayed === 0);
      await fastify.models.Acsdle.create({ userId: acsdleUser.id, date: today, completions: [] });
    } else {
      const user = (await fastify.models.User.findById(todayAcsdleUserId)) as IUser;
      acsdleUser = await buildAcsdleUser(fastify, user);
    }

    const secret = process.env.ACSDLE_CRYPTO_KEY;
    if (!secret) {
      // Ne pas renvoyer le payload en clair si la clé manque ; renvoyer erreur contrôlée
      return reply.status(500).send({ error: "Encryption key not configured" });
    }

    return encryptJSON(acsdleUser, secret);
  });

  fastify.get('/today-history', { preHandler: [authGuard] }, async (request, reply) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const acsdle = await fastify.models.Acsdle.findOne<IAcsdle>({ date: today });

    if (!acsdle) {
      return reply.status(404).send({ error: "Acsdle for today not found" });
    }

    const completion = acsdle.completions.find(c => c.userId.toString() === request.session.userId?.toString());
    if (!completion) return [];
    return completion.attempts;
  });

  fastify.post('/today-history', { preHandler: [authGuard] }, async (request, reply) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const acsdle = await fastify.models.Acsdle.findOne<IAcsdle>({ date: today });

    if (!acsdle) {
      return reply.status(404).send({ error: "Acsdle for today not found" });
    }

    const { user } = request.body as { user: IAcsdleUser };
    const completion = acsdle.completions.find(c => c.userId.toString() === request.session.userId?.toString());

    if (completion) {
      acsdle.completions.map(c => {
        if (c.userId.toString() === request.session.userId?.toString()) {
          c.attempts.push(user);
          c.won = user.id.toString() === acsdle.userId.toString();
        }
        return c;
      })
    } else {
      acsdle.completions.push({
        userId: request.session.userId as any,
        attempts: [user],
        won: user.id.toString() === acsdle.userId.toString(),
      });
    }

    await acsdle.save();

    if (!completion) return [];
    return completion.attempts;
  });

  fastify.get('/history', { preHandler: [authGuard] }, async (request, reply) => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const acsdles = await fastify.models.Acsdle.find<IAcsdle>({ 'completions.userId': request.session.userId, date: { $gte: sevenDaysAgo } });

    const completions: IAcsdleCompletion[] = acsdles.map(a => {
      const completion = a.completions.find(c => c.userId.toString() === request.session.userId?.toString());
      return {
        userId: a.userId.toString() as any,
        attempts: completion ? completion.attempts : [],
        won: completion ? completion.won : false,
        completedAt: completion ? completion.completedAt : undefined
      } as IAcsdleCompletion;
    });

    return completions;
  })
}

export default acsdleRoutes;