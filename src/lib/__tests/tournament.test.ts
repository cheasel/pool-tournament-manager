import { describe, it, expect } from 'vitest';
import { Player, Group, Match } from '../../types';
import { calculateMatchHandicap } from '../handicap';
import {
  initializeGroupMatches,
  advanceDoubleEliminationMatch,
  getGroupQualifiers,
  seedSingleElimination,
} from '../bracket';

describe('Handicap Logic Tests', () => {
  const p7: Player = {
    id: 'p7',
    name: 'Player 7',
    skillLevel8: 7,
    skillLevel9: 7,
    skillLevel10: 7,
    createdAt: '',
  };

  const p5: Player = {
    id: 'p5',
    name: 'Player 5',
    skillLevel8: 5,
    skillLevel9: 5,
    skillLevel10: 5,
    createdAt: '',
  };

  const p2: Player = {
    id: 'p2',
    name: 'Player 2',
    skillLevel8: 2,
    skillLevel9: 2,
    skillLevel10: 2,
    createdAt: '',
  };

  it('calculates 8-Ball targets correctly based on APA grid', () => {
    const setup1 = calculateMatchHandicap(p7, p5, '8-Ball');
    expect(setup1.player1Target).toBe(5);
    expect(setup1.player2Target).toBe(3);
    expect(setup1.player1SpottedBalls).toEqual([]);

    const setup2 = calculateMatchHandicap(p5, p2, '8-Ball');
    expect(setup2.player1Target).toBe(4);
    expect(setup2.player2Target).toBe(2);
  });

  it('calculates 9-Ball / 10-Ball targets and spotting balls correctly', () => {
    // Diff 0
    const setupEqual = calculateMatchHandicap(p5, p5, '9-Ball');
    expect(setupEqual.player1Target).toBe(5);
    expect(setupEqual.player2Target).toBe(5);
    expect(setupEqual.player1SpottedBalls).toEqual([]);
    expect(setupEqual.player2SpottedBalls).toEqual([]);

    // Diff 2 -> spot 8
    const setupDiff2 = calculateMatchHandicap(p7, p5, '9-Ball');
    expect(setupDiff2.player1Target).toBe(5);
    expect(setupDiff2.player2Target).toBe(3);
    expect(setupDiff2.player2SpottedBalls).toEqual([8]);

    // Diff 5 -> spot 6,7,8
    const setupDiff5 = calculateMatchHandicap(p7, p2, '9-Ball');
    expect(setupDiff5.player1Target).toBe(7);
    expect(setupDiff5.player2Target).toBe(3);
    expect(setupDiff5.player2SpottedBalls).toEqual([6, 7, 8]);
  });
});

describe('Bracket Engine Tests', () => {
  const mockPlayers: Player[] = Array.from({ length: 8 }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    skillLevel8: 5,
    skillLevel9: 5,
    skillLevel10: 5,
    createdAt: '',
  }));

  const playersMap = mockPlayers.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {} as Record<string, Player>);

  const mockGroup: Group = {
    id: 'g1',
    tournamentId: 't1',
    name: 'Group A',
    playerIds: mockPlayers.map(p => p.id),
    status: 'active',
  };

  it('initializes 10 group matches for double elimination of 8', () => {
    const matches = initializeGroupMatches('t1', mockGroup, playersMap, '8-Ball');
    expect(matches.length).toBe(10);
    expect(matches[0].player1Id).toBe('p1');
    expect(matches[0].player2Id).toBe('p8');
    expect(matches[0].status).toBe('scheduled');
  });

  it('auto-resolves BYE matches during initialization', () => {
    const playersWithBye = [...mockPlayers];
    playersWithBye[7] = {
      ...playersWithBye[7],
      isBye: true,
      name: 'BYE',
    };

    const mapWithBye = playersWithBye.reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {} as Record<string, Player>);

    const matches = initializeGroupMatches('t1', mockGroup, mapWithBye, '8-Ball');
    // Match 1 is p1 vs p8 (BYE). It should auto-resolve with p1 winning.
    const m1 = matches.find(m => m.matchNumber === 1);
    expect(m1?.status).toBe('completed');
    expect(m1?.winnerId).toBe('p1');

    // And player 1 should be advanced to Match 5 (slot 1)
    const m5 = matches.find(m => m.matchNumber === 5);
    expect(m5?.player1Id).toBe('p1');
  });

  it('advances players correctly through the Double Elimination tree', () => {
    const matches = initializeGroupMatches('t1', mockGroup, playersMap, '8-Ball');
    
    // Complete Match 1: Player 1 wins
    const m1 = matches.find(m => m.matchNumber === 1)!;
    m1.status = 'completed';
    m1.winnerId = 'p1';
    m1.player1Score = m1.player1Target;
    m1.player2Score = 0;

    advanceDoubleEliminationMatch(m1, matches, playersMap, '8-Ball');

    const m5 = matches.find(m => m.matchNumber === 5)!;
    const m7 = matches.find(m => m.matchNumber === 7)!;

    // Winner of M1 goes to M5 slot 1, Loser of M1 goes to M7 slot 1
    expect(m5.player1Id).toBe('p1');
    expect(m7.player1Id).toBe('p8');
  });

  it('identifies group qualifiers correctly', () => {
    const matches = initializeGroupMatches('t1', mockGroup, playersMap, '8-Ball');
    
    // Complete all matches to simulate qualifiers
    // Winners of Semifinals (Match 5 and 6)
    const m5 = matches.find(m => m.matchNumber === 5)!;
    m5.status = 'completed';
    m5.winnerId = 'p1';
    m5.player1Id = 'p1';
    m5.player2Id = 'p4';

    const m6 = matches.find(m => m.matchNumber === 6)!;
    m6.status = 'completed';
    m6.winnerId = 'p3';
    m6.player1Id = 'p3';
    m6.player2Id = 'p2';

    // Winners of Loser's Round 2 (Match 9 and 10)
    const m9 = matches.find(m => m.matchNumber === 9)!;
    m9.status = 'completed';
    m9.winnerId = 'p5';
    m9.player1Id = 'p4'; // Loser of m5
    m9.player2Id = 'p5';

    const m10 = matches.find(m => m.matchNumber === 10)!;
    m10.status = 'completed';
    m10.winnerId = 'p6';
    m10.player1Id = 'p2'; // Loser of m6
    m10.player2Id = 'p6';

    const qualifiers = getGroupQualifiers(mockGroup, matches);
    expect(qualifiers.winners).toContain('p1');
    expect(qualifiers.winners).toContain('p3');
    expect(qualifiers.losers).toContain('p5');
    expect(qualifiers.losers).toContain('p6');
  });
});
