import {ITournament, ITournamentPlayer} from "../../models/Tournament";
import { FastifyPluginAsync } from "fastify";
import {adminGuard, authGuard} from "../../middleware/authGuard";
import {IGame} from "../../models/Game";
import { log } from "../../utils/utils";
import {IBet} from "../../models/Bet";
import {IUser} from "../../models/User";

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
  /**
   * Récupère la liste de tous les tournois avec les détails du jeu et des joueurs
   */
  fastify.get("/", { preHandler: [authGuard] }, async (req, res) => {
    try {
      const tournaments = await fastify.models.Tournament.find().populate('game').populate('players.user teams.users clips.addedBy') as (ITournament & { game: IGame })[];

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
      const tournament = await fastify.models.Tournament.findById((req.params as { tournamentId: string }).tournamentId).populate('game').populate('players.user teams.users clips.addedBy') as ITournament & { game: IGame };
      if (!tournament) {
        res.status(404);
        log(fastify, `Tournoi introuvable pour l'identifiant ${(req.params as { tournamentId: string }).tournamentId}`, 'error', 404);
        return { success: false, message: "Tournoi introuvable pour l'identifiant fourni" };
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
      const tournament = await fastify.models.Tournament.findById((req.params as { id: string }).id) as ITournament;
      if (!tournament) {
        res.status(404);
        log(fastify, `Tournoi introuvable pour l'identifiant ${(req.params as { id: string }).id}`, 'error', 404);
        return { success: false, message: "Tournoi introuvable pour l'identifiant fourni" };
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
      const tournament = await fastify.models.Tournament.findById((req.params as { id: string }).id) as ITournament;
      if (!tournament) {
        res.status(404);
        log(fastify, `Tournoi introuvable pour l'identifiant ${(req.params as { id: string }).id}`, 'error', 404);
        return { success: false, message: "Tournoi introuvable pour l'identifiant fourni" };
      }
      const userId = req.session.userId!;
      tournament.players = tournament.players.filter(p => p.user.toString() !== userId);
      await tournament.save();

      const tournamentData = await fastify.models.Tournament.findById(tournament.id).populate('game').populate('players.user teams.users clips.addedBy') as ITournament & { game: any };

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
      const tournament = await fastify.models.Tournament.findById((req.params as { id: string }).id) as ITournament;
      if (!tournament) {
        res.status(404);
        log(fastify, `Tournoi introuvable pour l'identifiant ${(req.params as { id: string }).id}`, 'error', 404);
        return { success: false, message: "Tournoi introuvable pour l'identifiant fourni" };
      }
      const userId = req.session.userId!;
      const player = tournament.players.find(p => p.user.toString() === userId);
      if (player) {
        player.hasCheckin = true;
        await tournament.save();
      }

      const tournamentData = await fastify.models.Tournament.findById(tournament.id).populate('game').populate('players.user teams.users clips.addedBy') as ITournament & { game: any };
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
      const tournament = await fastify.models.Tournament.findById((req.params as { id: string }).id) as ITournament;
      if (!tournament) {
        res.status(404);
        log(fastify, `Tournoi introuvable pour l'identifiant ${(req.params as { id: string }).id}`, 'error', 404);
        return { success: false, message: "Tournoi introuvable pour l'identifiant fourni" };
      }
      const userId = req.session.userId!;
      const player = tournament.players.find(p => p.user.toString() === userId);
      if (player) {
        player.hasCheckin = false;
        await tournament.save();
      }

      const tournamentData = await fastify.models.Tournament.findById(tournament.id).populate('game').populate('players.user teams.users clips.addedBy') as ITournament & { game: any };

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
      const tournament = await fastify.models.Tournament.findById((req.params as { id: string }).id) as ITournament;
      if (!tournament) {
        res.status(404);
        log(fastify, `Tournoi introuvable pour l'identifiant ${(req.params as { id: string }).id}`, 'error', 404);
        return { success: false, message: "Tournoi introuvable pour l'identifiant fourni" };
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
      const tournament = await fastify.models.Tournament.findById((req.params as { id: string }).id) as ITournament;
      if (!tournament) {
        res.status(404);
        log(fastify, `Tournoi introuvable pour l'identifiant ${(req.params as { id: string }).id}`, 'error', 404);
        return { success: false, message: "Tournoi introuvable pour l'identifiant fourni" };
      }
      const userId = req.session.userId!;
      if (!userId) {
        res.status(401);
        log(fastify, `Vote MVP refusé : utilisateur non authentifié pour le tournoi ${(req.params as { id: string }).id}`, 'error', 401);
        return { success: false, message: "Action non autorisée : utilisateur non authentifié" };
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
    } catch (error) {
      log(fastify, `Erreur lors du vote pour le MVP : ${error}`, 'error');
      return res.status(500).send({ error: 'Erreur lors du vote pour le MVP' });
    }
  });

  fastify.post("/:id/mvps/close", { preHandler: [adminGuard] }, async (req, res) => {
    try {
      const tournament = await fastify.models.Tournament.findById((req.params as { id: string }).id) as ITournament;
      if (!tournament) {
        res.status(404);
        log(fastify, `Tournoi introuvable pour l'identifiant ${(req.params as { id: string }).id}`, 'error', 404);
        return { success: false, message: "Tournoi introuvable pour l'identifiant fourni" };
      }
      tournament.mvpVoteOpen = false;
      let maxVotes = 0;
      let mvpPlayerId: any = null;
      tournament.players.forEach(player => {
        if (player.mvpVotes.length > maxVotes) {
          maxVotes = player.mvpVotes.length;
          mvpPlayerId = player.id;
        }
      });
      tournament.players.forEach(player => {
        player.isMvp = player.id === mvpPlayerId;
      });
      await tournament.save();


      const tournamentData = await fastify.models.Tournament.findById(tournament.id).populate('game').populate('players.user teams.users clips.addedBy') as ITournament & { game: IGame, players: (ITournamentPlayer & { user: IUser})[] };
      await fastify.discordService.announceMvpWinner(tournamentData, mvpPlayerId);
      return populateCurrentPlayerLevel(fastify, tournamentData, req.session.userId!);
    } catch (error) {
      log(fastify, `Erreur lors de la clôture du vote MVP : ${error}`, 'error');
      return res.status(500).send({ error: 'Erreur lors de la clôture du vote MVP' });
    }
  });

  /**
   * Récupère la liste des matchs du challonge associé au tournoi
   */
  fastify.get("/:id/challonge-matches", { preHandler: [authGuard] }, async (req, res) => {
    try {
      const tournament = await fastify.models.Tournament.findById((req.params as { id: string }).id) as ITournament;
      if (!tournament) {
        res.status(404);
        log(fastify, `Tournoi introuvable pour l'identifiant ${(req.params as { id: string }).id}`, 'error', 404);
        return { success: false, message: "Tournoi introuvable pour l'identifiant fourni" };
      }
      if (!tournament.challongeId) {
        return { success: true, data: null };
      }

      const participants = await fastify.challongeService.getTournamentParticipants(tournament.challongeId) as any;
      const matches = await fastify.challongeService.getTournamentMatches(tournament.challongeId) as any;
      const bets = await fastify.models.Bet.find({ tournamentId: tournament.id, userId: req.session.userId }) as IBet[];

      return (matches["data"] ? matches["data"] : matches).map((match: any) => ({
        id: match.id,
        isStarted: match.attributes.timestamps.underway_at !== null,
        isCompleted: match.attributes.state === "complete",
        player1: participants["data"].find((p :any) => p.id == match.attributes.points_by_participant[0].participant_id)?.attributes.name,
        player2: participants["data"].find((p :any) => p.id == match.attributes.points_by_participant[1].participant_id)?.attributes.name,
        bet: bets.find(b => b.challongeMatchId === match.id),
      }));
    } catch (error) {
      log(fastify, `Erreur lors de la récupération des matchs Challonge : ${error}`, 'error');
      return res.status(500).send({ error: 'Erreur lors de la récupération des matchs Challonge' });
    }
  });

  fastify.post("/:id/bets", { preHandler: [authGuard] }, async (req, res) => {
    try {
      const body = req.body as { challongeMatchId: string; predictedWinner: string; amount: number };
      const tournament = await fastify.models.Tournament.findById((req.params as { id: string }).id) as ITournament;
      if (!tournament) {
        res.status(404);
        log(fastify, `Tournoi introuvable pour l'identifiant ${(req.params as { id: string }).id}`, 'error', 404);
        return { success: false, message: "Tournoi introuvable pour l'identifiant fourni" };
      }
      if (!tournament.challongeId) {
        res.status(400);
        log(fastify, `Aucun tournoi Challonge associé au tournoi ${(req.params as { id: string }).id}`, 'error', 400);
        return { success: false, message: "Aucun tournoi Challonge n'est associé à ce tournoi" };
      }

      const matchStarted = await fastify.challongeService.getTournamentMatchStarted(tournament.challongeId, body.challongeMatchId);
      if (matchStarted) {
        res.status(400);
        log(fastify, `Pari refusé : le match ${body.challongeMatchId} du tournoi ${tournament.name} a déjà commencé`, 'error', 400);
        return { success: false, message: "Impossible de placer ou modifier un pari sur un match déjà commencé" };
      }

      const userScrimium = await fastify.models.Scrimium.findOne({ userId: req.session.userId }) as any;
      if (!userScrimium || userScrimium.balance < body.amount) {
        res.status(400);
        log(fastify, `Solde insuffisant pour placer le pari de ${body.amount} sur le match ${body.challongeMatchId}`, 'error', 400);
        return { success: false, message: "Solde insuffisant pour placer ce pari" };
      }

      const existingBet = await fastify.models.Bet.findOne({ tournamentId: tournament.id, userId: req.session.userId, challongeMatchId: body.challongeMatchId }) as IBet;
      if (existingBet) {
        existingBet.predictedWinner = body.predictedWinner;
        existingBet.amount = body.amount;
        await existingBet.save();
        return existingBet;
      } else {
        const newBet = new fastify.models.Bet({
          tournamentId: tournament.id,
          userId: req.session.userId,
          challongeMatchId: body.challongeMatchId,
          predictedWinner: body.predictedWinner,
          amount: body.amount,
          won: false,
          isProcessed: false
        }) as IBet;

        await fastify.models.Scrimium.updateOne(
          { userId: req.session.userId },
          {
            $inc: { balance: -body.amount },
            $push: {
              transactions: {
                amount: body.amount,
                date: new Date(),
                description: `Pari de ${body.amount} sur le match ${body.challongeMatchId} du tournoi ${tournament.name}`
              }
            }
          }
        );

        await newBet.save();
        return newBet;
      }
    } catch (error) {
      log(fastify, `Erreur lors de la création du pari : ${error}`, 'error');
      return res.status(500).send({ error: 'Erreur lors de la création du pari' });
    }
  });

  fastify.post("/:id/bets/validate", { preHandler: [adminGuard] }, async (req, res) => {
    try {
      const tournament = await fastify.models.Tournament.findById((req.params as { id: string; matchId: string }).id) as ITournament;
      if (!tournament) {
        res.status(404);
        log(fastify, `Tournoi introuvable pour l'identifiant ${(req.params as { id: string; matchId: string }).id}`, 'error', 404);
        return { success: false, message: "Tournoi introuvable pour l'identifiant fourni" };
      }
      if (!tournament.challongeId) {
        res.status(400);
        log(fastify, `Aucun tournoi Challonge associé au tournoi ${(req.params as { id: string; matchId: string }).id}`, 'error', 400);
        return { success: false, message: "Aucun tournoi Challonge n'est associé à ce tournoi" };
      }

      const matches: any = await fastify.challongeService.getTournamentMatches(tournament.challongeId);
      const matchesToProcess = (matches["data"] ? matches["data"] : matches).filter((m: any) => m.attributes.state === "complete");
      for (const match of matchesToProcess) {
        const matchId = match.id;
        const winnerParticipantId = match.attributes.winner_id;
        const participants: any = await fastify.challongeService.getTournamentParticipants(tournament.challongeId);
        const winnerParticipant = participants["data"].find((p :any) => p.id == winnerParticipantId);
        if (!winnerParticipant) {
          log(fastify, `Participant vainqueur introuvable pour le match ${matchId}`, 'error');
          continue;
        }
        const winnerName = winnerParticipant.attributes.name;

        const bets = await fastify.models.Bet.find({ tournamentId: tournament.id, challongeMatchId: matchId, isProcessed: false }) as IBet[];
        if (!bets || bets.length === 0) {
          continue;
        }

        for (const bet of bets) {
          if (bet.predictedWinner === winnerName) {
            const winnings = bet.amount * 2; // Example payout calculation
            await fastify.models.Scrimium.updateOne(
              {userId: bet.userId},
              {
                $inc: {balance: winnings},
                $push: {
                  transactions: {
                    amount: winnings,
                    date: new Date(),
                    description: `Gains du pari de ${winnings} sur le match ${bet.challongeMatchId} du tournoi ${tournament.name}`
                  }
                }
              }
            );
            bet.won = true;
          } else {
            bet.won = false;
          }
          bet.isProcessed = true;
          await bet.save();
        }
      }

      return { success: true, message: "Paris validés avec succès" };
    } catch (error) {
      log(fastify, `Erreur lors de la validation des paris : ${error}`, 'error');
      return res.status(500).send({ error: 'Erreur lors de la validation des paris' });
    }
  });

  fastify.delete("/:id/bets/:matchId", { preHandler: [authGuard] }, async (req, res) => {
    try {
      const tournament = await fastify.models.Tournament.findById((req.params as { id: string; matchId: string }).id) as ITournament;
      if (!tournament) {
        res.status(404);
        log(fastify, `Tournoi introuvable pour l'identifiant ${(req.params as { id: string; matchId: string }).id}`, 'error', 404);
        return { success: false, message: "Tournoi introuvable pour l'identifiant fourni" };
      }
      if (!tournament.challongeId) {
        res.status(400);
        log(fastify, `Aucun tournoi Challonge associé au tournoi ${(req.params as { id: string; matchId: string }).id}`, 'error', 400);
        return { success: false, message: "Aucun tournoi Challonge n'est associé à ce tournoi" };
      }

      const matchId = (req.params as { id: string; matchId: string }).matchId;

      const matchStarted = await fastify.challongeService.getTournamentMatchStarted(tournament.challongeId, matchId);
      if (matchStarted) {
        res.status(400);
        log(fastify, `Suppression de pari impossible : le match ${matchId} a déjà commencé`, 'error', 400);
        return { success: false, message: "Impossible de supprimer un pari sur un match déjà commencé" };
      }

      const bet = await fastify.models.Bet.findOne({ tournamentId: tournament.id, userId: req.session.userId, challongeMatchId: matchId }) as IBet;
      if (!bet) {
        res.status(404);
        log(fastify, `Pari introuvable pour le match ${matchId} du tournoi ${tournament.name}`, 'error', 404);
        return { success: false, message: "Pari introuvable pour ce match" };
      }

      await fastify.models.Scrimium.updateOne(
        { userId: req.session.userId },
        {
          $inc: { balance: bet.amount },
          $push: {
            transactions: {
              amount: bet.amount,
              date: new Date(),
              description: `Annulation du pari de ${bet.amount} sur le match ${bet.challongeMatchId} du tournoi ${tournament.name}`
            }
          }
        }
      );

      await bet.deleteOne();
      return { success: true, message: "Pari annulé avec succès" };
    } catch (error) {
      log(fastify, `Erreur lors de l'annulation du pari : ${error}`, 'error');
      return res.status(500).send({ error: 'Erreur lors de l\'annulation du pari' });
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
