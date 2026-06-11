export interface Player {
  id: string;
  name: string;
  skillLevel8: number; // 2-7
  skillLevel9: number; // 2-9;
  skillLevel10: number; // 2-9;
  createdAt: string;
  isBye?: boolean; // True if it's a spacer 'BYE' player
}

export type GameType = '8-Ball' | '9-Ball' | '10-Ball';
export type TournamentStatus = 'draft' | 'active' | 'completed';
export type MatchStatus = 'scheduled' | 'playing' | 'completed';
export type RoundType = 'group_winners' | 'group_losers' | 'knockout';

export interface CalcuttaBid {
  playerId: string;
  bidAmount: number;
  buyerName: string;
  split?: boolean;
}

export interface Tournament {
  id: string;
  name: string;
  gameType: GameType;
  status: TournamentStatus;
  createdAt: string;
  winnerId?: string;
  entryFee?: number;
  payoutPercentages?: number[];
  hasCalcutta?: boolean;
  calcuttaMinStartBet?: number;
  calcuttaMinIncrement?: number;
  calcuttaPayoutPercentages?: number[];
  calcuttaBids?: CalcuttaBid[];
  entryFeePaidIds?: string[];
  calcuttaBidsPaidIds?: string[];
  playerPayoutPaidIds?: string[];
  ownerPayoutPaidIds?: string[];
}

export interface Group {
  id: string;
  tournamentId: string;
  name: string; // e.g., "Group A"
  playerIds: string[]; // 8 players (including BYEs)
  status: 'active' | 'completed';
}

export interface MatchStats {
  breakAndRun?: boolean;
  tableRun?: boolean;
}

export interface Match {
  id: string;
  tournamentId: string;
  groupId?: string; // Empty if it is a final Knockout match
  roundType: RoundType;
  roundNumber: number; // 1-indexed round in that tree section
  matchNumber: number; // 1-indexed match within that round
  player1Id: string; // Can be a player ID or 'BYE'
  player2Id: string; // Can be a player ID or 'BYE'
  player1Score: number;
  player2Score: number;
  player1Target: number; // Number of racks player needs to win
  player2Target: number; // Number of racks player needs to win
  player1SpottedBalls: number[]; // Spotted ball numbers (e.g. [7, 8]) for 9/10-ball
  player2SpottedBalls: number[]; // Spotted ball numbers for 9/10-ball
  status: MatchStatus;
  winnerId?: string;
  player1Stats?: MatchStats;
  player2Stats?: MatchStats;
  createdAt: string;
}

export interface TournamentDetails {
  tournament: Tournament;
  players: Player[];
  groups: Group[];
  matches: Match[];
}
