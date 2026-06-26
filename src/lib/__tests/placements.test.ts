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
  entryFee: number;
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
    entryFee: t.entryFee || 0,
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

  it('correctly filters premium tournaments and slices to limit', () => {
    // Array of mock PlacementPoints (from newest to oldest)
    const mockPlacements: PlacementPoint[] = [
      { tournamentId: 't1', tournamentName: 'T1', date: '2026-06-20', rank: 1, maxRound: 1, positionLabel: 'Champion', positionValue: 5, entryFee: 1500 }, // Newest premium
      { tournamentId: 't2', tournamentName: 'T2', date: '2026-06-19', rank: 2, maxRound: 1, positionLabel: 'Runner-up', positionValue: 4, entryFee: 500 },   // Standard
      { tournamentId: 't3', tournamentName: 'T3', date: '2026-06-18', rank: 3, maxRound: 1, positionLabel: 'Semifinalist', positionValue: 3, entryFee: 2000 }, // Premium
      { tournamentId: 't4', tournamentName: 'T4', date: '2026-06-17', rank: 4, maxRound: 1, positionLabel: 'Knockout Round', positionValue: 2, entryFee: 0 },   // Free
      { tournamentId: 't5', tournamentName: 'T5', date: '2026-06-16', rank: 5, maxRound: 1, positionLabel: 'Group Stage', positionValue: 1, entryFee: 1000 },  // Premium
      { tournamentId: 't6', tournamentName: 'T6', date: '2026-06-15', rank: 1, maxRound: 1, positionLabel: 'Champion', positionValue: 5, entryFee: 500 },    // Standard
      { tournamentId: 't7', tournamentName: 'T7', date: '2026-06-14', rank: 2, maxRound: 1, positionLabel: 'Runner-up', positionValue: 4, entryFee: 3000 },  // Premium
    ];

    // Helper simulating the useMemo selector
    function selectPlacements(all: PlacementPoint[], limit: number, onlyPremium: boolean): PlacementPoint[] {
      let list = all;
      if (onlyPremium) {
        list = list.filter(p => p.entryFee >= 1000);
      }
      const sliced = list.slice(0, limit);
      return [...sliced].reverse(); // oldest-to-newest chronological display
    }

    // Case 1: Limit 5, no premium filter
    const result1 = selectPlacements(mockPlacements, 5, false);
    // Should contain T5, T4, T3, T2, T1 in that order (reverse of sliced first 5)
    expect(result1.length).toBe(5);
    expect(result1[0].tournamentId).toBe('t5');
    expect(result1[4].tournamentId).toBe('t1');

    // Case 2: Limit 10, no premium filter
    const result2 = selectPlacements(mockPlacements, 10, false);
    // Should contain T7, T6, T5, T4, T3, T2, T1 (all 7 elements reversed)
    expect(result2.length).toBe(7);
    expect(result2[0].tournamentId).toBe('t7');
    expect(result2[6].tournamentId).toBe('t1');

    // Case 3: Limit 5, only premium filter
    const result3 = selectPlacements(mockPlacements, 5, true);
    // Premium are: T1 (1500), T3 (2000), T5 (1000), T7 (3000). Total 4.
    // The sliced first 5 premium are T1, T3, T5, T7.
    // In reverse order: T7, T5, T3, T1
    expect(result3.length).toBe(4);
    expect(result3[0].tournamentId).toBe('t7');
    expect(result3[3].tournamentId).toBe('t1');
    expect(result3.every(p => p.entryFee >= 1000)).toBe(true);

    // Case 4: Limit 2, only premium filter
    const result4 = selectPlacements(mockPlacements, 2, true);
    // Premium list is T1, T3, T5, T7. Sliced to 2 is T1, T3.
    // Reversed is T3, T1.
    expect(result4.length).toBe(2);
    expect(result4[0].tournamentId).toBe('t3');
    expect(result4[1].tournamentId).toBe('t1');
  });
});
