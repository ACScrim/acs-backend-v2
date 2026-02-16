import {ITournament} from "../models/Tournament";
import {IGame} from "../models/Game";
import {ChallongeOptions} from "../types";
import {FastifyInstance} from "fastify";

class ChallongeService {

  private readonly fastify: FastifyInstance;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  private async challongeRequest<T>(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', data?: T) {
    if (!process.env.CHALLONGE_API_KEY) {
      throw new Error('Challonge API key is not set');
    }

    if (!process.env.CHALLONGE_API_URL) {
      throw new Error('Challonge API URL is not set');
    }

    const url = `${process.env.CHALLONGE_API_URL}${endpoint}`;
    const apiKey = process.env.CHALLONGE_API_KEY;

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/json',
        'Authorization': apiKey,
        'Authorization-Type': 'v1'
      },
      body: data ? JSON.stringify(data) : undefined,
      redirect: 'follow',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Challonge API error: ${JSON.stringify(errorData)}`);
    }

    return await response.json();
  }

  async createBracket(tournament: ITournament & { game: IGame }, options: ChallongeOptions) {
    const body = {
      data: {
        type: 'Tournaments',
        attributes: {
          name: tournament.name.replace(/[:]/g, ''),
          url: tournament.name.toLowerCase().replace(/\s+/g, '_').replace(/:/g, ''),
          tournament_type: options.tournamentType,
          game_name: tournament.game.name,
          private: true,
          starts_at: new Date(tournament.date).toLocaleDateString(),
          seeding_options: {
            hide_seeds: true
          },
          group_stage_enabled: options.groupStageEnabled,
          group_stage_options: options.groupStageEnabled ? {
            stage_type: options.groupStage?.type,
            group_size: options.groupStage?.groupSize,
            participant_count_to_advance_per_group: options.groupStage?.participantCountToAdvancePerGroup,
            rr_iterations: options.groupStage?.rrIterations,
            ranked_by: options.groupStage?.rankedBy
          } : {},
          double_elimination_options: options.tournamentType === 'double elimination' ? {
            split_participants: options.doubleElimination?.splitParticipants,
            grand_finals_modifier: options.doubleElimination?.grandFinalsModifier
          } : {},
          round_robin_options: options.tournamentType === 'round robin' ? {
            iterations: options.roundRobin?.iterations,
            ranking: options.roundRobin?.ranking,
            pts_for_game_win: options.roundRobin?.ptsForGameWin,
            pts_for_game_tie: options.roundRobin?.ptsForGameTie,
            pts_for_match_win: options.roundRobin?.ptsForMatchWin,
            pts_for_match_tie: options.roundRobin?.ptsForMatchTie
          } : {},
          swiss_options: options.tournamentType === 'swiss' ? {
            rounds: options.swiss?.rounds,
            pts_for_game_win: options.swiss?.ptsForGameWin,
            pts_for_game_tie: options.swiss?.ptsForGameTie,
            pts_for_match_win: options.swiss?.ptsForMatchWin,
            pts_for_match_tie: options.swiss?.ptsForMatchTie,
            pts_for_bye: 1
          } : {},
          free_for_all_options: options.tournamentType === 'free for all' ? {
            max_participants: options.freeForAll?.maxParticipants
          } : {}
        }
      }
    };
    return this.challongeRequest('/tournaments.json', 'POST', body);
  }

  async createParticipants(challongeTournamentId: string, participantNames: string[]) {
    const body = {
      data: {
        type: 'Participants',
        attributes: {
          participants: participantNames.map(name => ({ name }))
        }
      }
    };
    return this.challongeRequest(`/tournaments/${challongeTournamentId}/participants/bulk_add.json`, 'POST', body);
  }

  async getTournamentMatches(challongTournamentId: string) {
    return this.challongeRequest(`/tournaments/${challongTournamentId}/matches.json`, 'GET');
  }

  async getTournamentParticipants(challongTournamentId: string) {
    return this.challongeRequest(`/tournaments/${challongTournamentId}/participants.json`, 'GET');
  }

  async getTournamentMatch(challongTournamentId: string, matchId: string) {
    return this.challongeRequest(`/tournaments/${challongTournamentId}/matches/${matchId}.json`, 'GET');
  }

  async getTournamentMatchStarted(challongTournamentId: string, matchId: string): Promise<boolean> {
    const { data: { attributes: { state, timestamps: { underway_at } } } } = await this.challongeRequest(`/tournaments/${challongTournamentId}/matches/${matchId}.json`, 'GET') as any;
    return state === "complete" || !!underway_at;
  }
}

export default ChallongeService;