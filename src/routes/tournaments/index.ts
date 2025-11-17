import { ITournament } from "@models/Tournament";
import { FastifyPluginAsync } from "fastify";
import { authGuard } from "../../middleware/authGuard";
import {IGame} from "@models/Game";

const populateCurrentPlayerLevel = async (fastify: any, tournament: ITournament & { game: any }, currentUserId: string) => {
    if (tournament.game) {
        (tournament.game as any)._currentUserId = currentUserId;
        await fastify.models.Game.populate(
            tournament.game,
            {path: 'currentPlayerLevel'}
        );
        return tournament;
    }
}

const populateCurrentPlayerLevelArray = async (fastify: any, tournaments: (ITournament & { game: any })[], currentUserId: string) => {
    tournaments.forEach((tournament: any) => {
        if (tournament.game) {
            (tournament.game as any)._currentUserId = currentUserId;
        }
    });

    await fastify.models.Game.populate(
        tournaments.map((t: any) => t.game),
        {path: 'currentPlayerLevel'}
    );

    return tournaments;
};

const tournamentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (req, res) => {
    const tournaments = await fastify.models.Tournament.find().populate('game').populate('players.user teams.users clips.addedBy') as (ITournament & { game: IGame })[];

    return populateCurrentPlayerLevelArray(fastify, tournaments, req.session.userId!);
  });

  fastify.post("/:id/register", { preHandler: [authGuard] }, async (req, res) => {
    const body = req.body as { registrationType: "caster" | "player" };
    const tournament = await fastify.models.Tournament.findById((req.params as { id: string }).id) as ITournament;
    if (!tournament) {
      res.status(404);
      return { success: false, message: "Tournament not found" };
    } 
    const userId = req.session.userId!;
    const shouldRegisterInWaitlist = tournament.playerCap <= 0 ? false : tournament.players.length >= tournament.playerCap;
    tournament.players.push({
      user: userId,
      inWaitlist: shouldRegisterInWaitlist,
      isCaster: body.registrationType === "caster",
      hasCheckin: false,
      isMvp: false,
      mvpVotes: [],
      registrationDate: new Date()
    } as any);

    await tournament.save();

    const tournamentData = await fastify.models.Tournament.findById(tournament.id).populate('game').populate('players.user teams.users clips.addedBy') as ITournament & { game: any };
    return populateCurrentPlayerLevel(fastify, tournamentData, req.session.userId!);
  });

  fastify.post("/:id/unregister", { preHandler: [authGuard] }, async (req, res) => {
    const tournament = await fastify.models.Tournament.findById((req.params as { id: string }).id) as ITournament;
    if (!tournament) {
      res.status(404);
      return { success: false, message: "Tournament not found" };
    }
    const userId = req.session.userId!;
    tournament.players = tournament.players.filter(p => p.user.toString() !== userId);
    await tournament.save();
    const tournamentData = await fastify.models.Tournament.findById(tournament.id).populate('game').populate('players.user teams.users clips.addedBy') as ITournament & { game: any };
    return populateCurrentPlayerLevel(fastify, tournamentData, req.session.userId!);
  });

  fastify.post("/:id/clips", { preHandler: [authGuard] }, async (req, res) => {
    const body = req.body as { clipUrl: string };
    const tournament = await fastify.models.Tournament.findById((req.params as { id: string }).id) as ITournament;
    if (!tournament) {
      res.status(404);
      return { success: false, message: "Tournament not found" };
    }
    const formattedClipUrl = formatClipUrl(body.clipUrl);
    if (!formattedClipUrl) {
      return res.status(400).send({ message: "URL de clip non prise en charge. Seules les URL YouTube sont acceptées." });
    }
    tournament.clips.push({
      url: formattedClipUrl,
      addedBy: req.session.userId,
      addedAt: new Date()
    } as any);
    await tournament.save();
    const tournamentData = await fastify.models.Tournament.findById(tournament.id).populate('game').populate('players.user teams.users clips.addedBy') as ITournament & { game: any };
    return populateCurrentPlayerLevel(fastify, tournamentData, req.session.userId!);
  });

  fastify.post("/:id/mvps/vote", { preHandler: [authGuard] }, async (req, res) => {
    const body = req.body as { playerId: string };
    const tournament = await fastify.models.Tournament.findById((req.params as { id: string }).id) as ITournament;
    if (!tournament) {
      res.status(404);
      return { success: false, message: "Tournament not found" };
    }
    const userId = req.session.userId!;
    if (!userId) {
      res.status(401);
      return { success: false, message: "Unauthorized" };
    }
    if (tournament.mvpVoteOpen) {
      tournament.players.forEach(player => {
        if (player.id === body.playerId) {
          if (!player.mvpVotes.includes(userId as any)) {
            player.mvpVotes.push(userId as any);
          }
        } else {
          player.mvpVotes = player.mvpVotes.filter(voterId => voterId.toString() !== userId);
        }
      });
      await tournament.save();
    }
    const tournamentData = await fastify.models.Tournament.findById(tournament.id).populate('game').populate('players.user teams.users clips.addedBy') as ITournament & { game: any };
    return populateCurrentPlayerLevel(fastify, tournamentData, req.session.userId!);
  });
}

function formatClipUrl(url: string): string | null {
  if (url.includes("youtube.com")) {
    if (url.includes("watch?v=")) {
      url = url.replace("watch?v=", "embed/");
    }
    return url.replace("youtube.com", "www.youtube-nocookie.com")
  }
  if (url.includes("youtu.be")) {
    const videoId = url.split("/").pop();
    return `https://www.youtube-nocookie.com/embed/${videoId}`;
  }
  if (url.includes("twitch.tv")) {
    if (url.includes("/clip/")) {
      const clipId = url.split("/clip/").pop()?.split("?")[0];
      return `https://clips.twitch.tv/embed?clip=${clipId}&parent=${process.env.FRONTEND_URL?.replace("https://", "").replace("http://", "").split(":")[0]}`;
    }
  }
  return null;
}

export default tournamentRoutes;