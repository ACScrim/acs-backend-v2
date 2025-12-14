export interface DiscordUser {
  id: string,
  username: string,
  avatar: string | null,
  global_name: string | null,
  email: string,
}

export interface ChallongeError {
  errors: [
    {
      status: number,
      detail: string,
      source: {
        pointer: string
      }
    }
  ]
}

export interface ChallongeOptions {
  tournamentType: 'single elimination' | 'double elimination' | 'round robin' | 'swiss' | 'free for all';
  groupStageEnabled: boolean;
  groupStage?: {
    type?: 'round robin' | 'single elimination' | 'double elimination';
    groupSize?: number;
    participantCountToAdvancePerGroup?: number;
    rrIterations?: number;
    rankedBy?: '' | 'match wins' | 'game wins' | 'game win percentage' | 'points scored' | 'points difference';
  };
  doubleElimination?: {
    splitParticipants?: boolean;
    grandFinalsModifier?: '' | 'skip' | 'single match';
  };
  roundRobin?: {
    iterations?: number;
    ranking?: '' | 'match wins' | 'game wins' | 'game win percentage' | 'points scored' | 'points difference';
    ptsForGameWin?: number;
    ptsForGameTie?: number;
    ptsForMatchWin?: number;
    ptsForMatchTie?: number;
  };
  swiss?: {
    rounds?: number;
    ptsForGameWin?: number;
    ptsForGameTie?: number;
    ptsForMatchWin?: number;
    ptsForMatchTie?: number;
  };
  freeForAll?: {
    maxParticipants?: number;
  };
}