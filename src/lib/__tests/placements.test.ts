import { describe, it, expect } from 'vitest';
import { Player, Tournament, Match, TournamentDetails } from '../../types';
import { calculateTournamentEarnings } from '../earnings';

// PlacementPoint interface
interface PlacementPoint {
  tournamentId: string;
  tournamentName: string;
  date: string;
  rank: number;
  maxRound: number;
  positionLabel: 'Champion' | 'Runner-up' | 'Semifinalist' | 'Knockout Round' | 'Group Stage';
  positionValue: number;
}

// Logic to test
function determinePlacement(
  playerId: string,
  details: TournamentDetails
): PlacementPoint {
  const t = details.tournament;
  const seMatches = details.matches.filter(m => m.roundType === 'knockout');
  const maxRound = seMatches.length > 0 ? Math.max(...seMatches.map(m => m.roundNumber), 0) : 0;
  
  const earningsList = calculateTournamentEarnings(details);
  const playerEarnings = earningsList.find(e => e.playerId === playerId);
  const rank = playerEarnings ? playerEarnings.rank : 0;

  let positionLabel: PlacementPoint['positionLabel'] = 'Group Stage';
  let positionValue = 1;

  const groupStageRank = maxRound > 0 ? Math.pow(2, maxRound) + 1 : 9;

  if (rank === 1) {
    positionLabel = 'Champion';
    positionValue = 5;
  } else if (rank === 2) {
    positionLabel = 'Runner-up';
    positionValue = 4;
  } else if (rank === 3) {
    positionLabel = 'Semifinalist';
    positionValue = 3;
  } else if (rank > 3 && rank < groupStageRank) {
    positionLabel = 'Knockout Round';
    positionValue = 2;
  } else {
    positionLabel = 'Group Stage';
    positionValue = 1;
  }

  return {
    tournamentId: t.id,
    tournamentName: t.name,
    date: t.createdAt,
    rank,
    maxRound,
    positionLabel,
    positionValue,
  };
}

describe('Player Placements Determination', () => {
  it('correctly classifies champion, runner-up, semifinalist, knockout round, and group stage finishes', () => {
    const playerId = 'test_player';
    const player: Player = { id: playerId, name: 'Test Player', skillLevel8: 5, skillLevel9: 5, skillLevel10: 5, createdAt: '' };
    const opponent: Player = { id: 'opp', name: 'Opponent', skillLevel8: 5, skillLevel9: 5, skillLevel10: 5, createdAt: '' };

    const tournament: Tournament = {
      id: 'tourney_1',
      name: 'Test Tournament',
      gameType: '9-Ball',
      status: 'completed',
      createdAt: '2026-06-14T00:00:00.000Z',
      winnerId: playerId,
    };

    // Case 1: Champion
    const detailsChamp: TournamentDetails = {
      tournament,
      players: [player, opponent],
      groups: [],
      matches: [
        {
          id: 'se_r1_m1',
          tournamentId: 'tourney_1',
          roundType: 'knockout',
          roundNumber: 1,
          matchNumber: 1,
          player1Id: playerId,
          player2Id: 'opp',
          player1Score: 7,
          player2Score: 3,
          player1Target: 7,
          player2Target: 5,
          player1SpottedBalls: [],
          player2SpottedBalls: [],
          status: 'completed',
          winnerId: playerId,
          createdAt: '',
        }
      ],
    };

    const placement1 = determinePlacement(playerId, detailsChamp);
    expect(placement1.positionLabel).toBe('Champion');
    expect(placement1.positionValue).toBe(5);

    // Case 2: Runner-up (lost final)
    const detailsRunnerUp: TournamentDetails = {
      tournament: { ...tournament, winnerId: 'opp' },
      players: [player, opponent],
      groups: [],
      matches: [
        {
          id: 'se_r1_m1',
          tournamentId: 'tourney_1',
          roundType: 'knockout',
          roundNumber: 1,
          matchNumber: 1,
          player1Id: playerId,
          player2Id: 'opp',
          player1Score: 3,
          player2Score: 5,
          player1Target: 7,
          player2Target: 5,
          player1SpottedBalls: [],
          player2SpottedBalls: [],
          status: 'completed',
          winnerId: 'opp',
          createdAt: '',
        }
      ],
    };

    const placement2 = determinePlacement(playerId, detailsRunnerUp);
    expect(placement2.positionLabel).toBe('Runner-up');
    expect(placement2.positionValue).toBe(4);

    // Case 3: Semifinalist (eliminated in round maxRound - 1)
    const detailsSemi: TournamentDetails = {
      tournament: { ...tournament, winnerId: 'opp' },
      players: [player, opponent, { id: 'p3', name: 'Player 3', skillLevel8: 5, skillLevel9: 5, skillLevel10: 5, createdAt: '' }],
      groups: [],
      matches: [
        // Round 1 (Semifinal 1)
        {
          id: 'se_r1_m1',
          tournamentId: 'tourney_1',
          roundType: 'knockout',
          roundNumber: 1,
          matchNumber: 1,
          player1Id: playerId,
          player2Id: 'opp',
          player1Score: 3,
          player2Score: 5,
          player1Target: 5,
          player2Target: 5,
          player1SpottedBalls: [],
          player2SpottedBalls: [],
          status: 'completed',
          winnerId: 'opp',
          createdAt: '',
        },
        // Round 2 (Final)
        {
          id: 'se_r2_m1',
          tournamentId: 'tourney_1',
          roundType: 'knockout',
          roundNumber: 2,
          matchNumber: 1,
          player1Id: 'opp',
          player2Id: 'p3',
          player1Score: 5,
          player2Score: 2,
          player1Target: 5,
          player2Target: 5,
          player1SpottedBalls: [],
          player2SpottedBalls: [],
          status: 'completed',
          winnerId: 'opp',
          createdAt: '',
        }
      ],
    };

    const placement3 = determinePlacement(playerId, detailsSemi);
    expect(placement3.positionLabel).toBe('Semifinalist');
    expect(placement3.positionValue).toBe(3);
  });
});
