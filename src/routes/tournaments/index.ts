import { ITournament } from "../../models/Tournament";
import { FastifyPluginAsync } from "fastify";
import { authGuard } from "../../middleware/authGuard";
import {IGame} from "../../models/Game";
import { log } from "../../utils/utils";

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

const TOURNAMENT_POPULATE_PATHS = ['game', 'players.user', 'teams.users', 'clips.addedBy'];
const TOURNAMENT_NOT_FOUND_RESPONSE = { success: false, message: "Tournament not found" };

async function getTournament(fastify: any, tournamentId: string) {
  return await fastify.models.Tournament.findById(tournamentId).exec() as ITournament | null;
}

const getPopulatedTournament = async (fastify: any, tournamentId: string) => {
  return await fastify.models.Tournament.findById(tournamentId).populate(TOURNAMENT_POPULATE_PATHS).exec() as (ITournament & { game: any }) | null;
};

const respondTournamentNotFound = (res: any) => {
  res.status(404);
  return TOURNAMENT_NOT_FOUND_RESPONSE;
};

const tournamentRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Récupère la liste de tous les tournois avec les détails du jeu et des joueurs
    */
  fastify.get("/", { preHandler: [authGuard] }, async (req, res) => {
    try {
      const tournaments = await fastify.models.Tournament.find().populate(TOURNAMENT_POPULATE_PATHS) as (ITournament & { game: IGame })[];

      return populateCurrentPlayerLevelArray(fastify, tournaments, req.session.userId!);
    } catch (error) {
      log(fastify, `Erreur lors de la récupération de la liste des tournois : ${error}`, 'error');
      return res.status(500).send({ error: 'Erreur lors de la récupération des tournois' });
    }
  });

  /**
   * Récupère les détails d'un tournoi spécifique par son ID
   */
  fastify.get("/:tournamentId", { preHandler: [authGuard] }, async (req, res) => {
    try {
      const tournament = await getPopulatedTournament(fastify, (req.params as { tournamentId: string }).tournamentId);
      if (!tournament) {
        return respondTournamentNotFound(res);
      }
      return populateCurrentPlayerLevel(fastify, tournament, req.session.userId!);
    } catch (error) {
      log(fastify, `Erreur lors de la récupération des détails du tournoi : ${error}`, 'error');
    }
  })

  /**
   * Inscrit l'utilisateur connecté à un tournoi (en tant que joueur ou commentateur)
   * Met à jour le message Discord du tournoi pour refléter le nouvel effectif
   */
  fastify.post("/:id/register", { preHandler: [authGuard] }, async (req, res) => {
    try {
      const body = req.body as { registrationType: "caster" | "player" };
      const tournament = await getTournament(fastify, (req.params as { id: string }).id);
      if (!tournament) {
        return respondTournamentNotFound(res);
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

      const tournamentData = await getPopulatedTournament(fastify, tournament.id);
      if (!tournamentData) {
        return respondTournamentNotFound(res);
      }

      // Mettre à jour le message Discord du tournoi
      try {
        await fastify.discordService.updateTournamentMessage(tournamentData);
      } catch (discordError) {
        log(fastify, `Erreur lors de la mise à jour du message Discord du tournoi ${tournament.id} : ${discordError}`, 'error');
      }
      return populateCurrentPlayerLevel(fastify, tournamentData, req.session.userId!);
    } catch (error) {
      log(fastify, `Erreur lors de l'inscription au tournoi : ${error}`, 'error');
      return res.status(500).send({ error: 'Erreur lors de l\'inscription' });
    }
  });

  /**
   * Désinscrit l'utilisateur connecté d'un tournoi
   * Met à jour le message Discord du tournoi pour refléter le nouvel effectif
   */
  fastify.post("/:id/unregister", { preHandler: [authGuard] }, async (req, res) => {
    try {
      const tournament = await getTournament(fastify, (req.params as { id: string }).id);
      if (!tournament) {
        return respondTournamentNotFound(res);
      }
      const userId = req.session.userId!;
      tournament.players = tournament.players.filter(p => p.user.toString() !== userId);
      await tournament.save();

      const tournamentData = await getPopulatedTournament(fastify, tournament.id);
      if (!tournamentData) {
        return respondTournamentNotFound(res);
      }

      // Mettre à jour le message Discord du tournoi
      try {
        await fastify.discordService.updateTournamentMessage(tournamentData);
      } catch (discordError) {
        log(fastify, `Erreur lors de la mise à jour du message Discord du tournoi ${tournament.id} : ${discordError}`, 'error');
      }
      return populateCurrentPlayerLevel(fastify, tournamentData, req.session.userId!);
    } catch (error) {
      log(fastify, `Erreur lors de la désinscription du tournoi : ${error}`, 'error');
      return res.status(500).send({ error: 'Erreur lors de la désinscription' });
    }
  });

  /**
   * Permet à un joueur de faire son check-in pour un tournoi
   */
  fastify.post("/:id/checkin", { preHandler: [authGuard] }, async (req, res) => {
    try {
      const tournament = await getTournament(fastify, (req.params as { id: string }).id);
      if (!tournament) {
        return respondTournamentNotFound(res);
      }
      const userId = req.session.userId!;
      const player = tournament.players.find(p => p.user.toString() === userId);
      if (player) {
        player.hasCheckin = true;
        await tournament.save();
      }

      const tournamentData = await getPopulatedTournament(fastify, tournament.id);
      if (!tournamentData) {
        return respondTournamentNotFound(res);
      }
      await fastify.discordService.updateTournamentMessage(tournamentData);
      return populateCurrentPlayerLevel(fastify, tournamentData, req.session.userId!);
    } catch (error) {
      log(fastify, `Erreur lors du check-in au tournoi : ${error}`, 'error');
      return res.status(500).send({ error: 'Erreur lors du check-in' });
    }
  });

  /**
   * Permet à un joueur de faire son check-out pour un tournoi
   */
  fastify.post("/:id/checkout", { preHandler: [authGuard] }, async (req, res) => {
    try {
      const tournament = await getTournament(fastify, (req.params as { id: string }).id);
      if (!tournament) {
        return respondTournamentNotFound(res);
      }
      const userId = req.session.userId!;
      const player = tournament.players.find(p => p.user.toString() === userId);
      if (player) {
        player.hasCheckin = false;
        await tournament.save();
      }

      const tournamentData = await getPopulatedTournament(fastify, tournament.id);
      if (!tournamentData) {
        return respondTournamentNotFound(res);
      }
      await fastify.discordService.updateTournamentMessage(tournamentData);
      return populateCurrentPlayerLevel(fastify, tournamentData, req.session.userId!);
    } catch (error) {
      log(fastify, `Erreur lors du check-in au tournoi : ${error}`, 'error');
      return res.status(500).send({ error: 'Erreur lors du check-in' });
    }
  });

  /**
   * Ajoute un clip (vidéo YouTube ou Twitch) associé au tournoi
   */
  fastify.post("/:id/clips", { preHandler: [authGuard] }, async (req, res) => {
    try {
      const body = req.body as { clipUrl: string };
      const tournament = await getTournament(fastify, (req.params as { id: string }).id);
      if (!tournament) {
        return respondTournamentNotFound(res);
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
      const tournamentData = await getPopulatedTournament(fastify, tournament.id);
      if (!tournamentData) {
        return respondTournamentNotFound(res);
      }
      return populateCurrentPlayerLevel(fastify, tournamentData, req.session.userId!);
    } catch (error) {
      log(fastify, `Erreur lors de l'ajout d'un clip : ${error}`, 'error');
      return res.status(500).send({ error: 'Erreur lors de l\'ajout du clip' });
    }
  });

  /**
   * Enregistre un vote pour le MVP du tournoi
   */
  fastify.post("/:id/mvps/vote", { preHandler: [authGuard] }, async (req, res) => {
    try {
      const body = req.body as { playerId: string };
      const tournament = await getTournament(fastify, (req.params as { id: string }).id);
      if (!tournament) {
        return respondTournamentNotFound(res);
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
      const tournamentData = await getPopulatedTournament(fastify, tournament.id);
      if (!tournamentData) {
        return respondTournamentNotFound(res);
      }
      return populateCurrentPlayerLevel(fastify, tournamentData, req.session.userId!);
    } catch (error) {
      log(fastify, `Erreur lors du vote pour le MVP : ${error}`, 'error');
      return res.status(500).send({ error: 'Erreur lors du vote pour le MVP' });
    }
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
