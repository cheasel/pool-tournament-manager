import { describe, it, expect } from 'vitest';
import { Player, Group, Match } from '../../types';
import { calculateMatchHandicap } from '../handicap';
import {
  initializeGroupMatches,
  getGroupQualifiers,
  seedSingleElimination,
  advanceDoubleEliminationMatch,
  advanceKnockoutMatches,
} from '../bracket';

describe('Tournament Full Lifecycle Integration Test', () => {
  // 1. Create a roster of 10 real players.
  // We need 16 slots, so the system will pad with 6 BYEs.
  const players: Player[] = Array.from({ length: 10 }, (_, i) => ({
    id: `player_${i + 1}`,
    name: `Player ${i + 1}`,
    skillLevel8: 4 + (i % 3), // SLs: 4, 5, 6, 4, 5, 6...
    skillLevel9: 5 + (i % 3),
    skillLevel10: 5 + (i % 3),
    createdAt: new Date().toISOString(),
  }));

  const playersMap = players.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {} as Record<string, Player>);

  it('runs a full 10-player tournament successfully', () => {
    const tournamentId = 'test_tourney_123';
    const gameType = '9-Ball';

    // 2. Pad with 6 BYE players to make 16 players (multiple of 8)
    const finalPlayersList = [...players];
    for (let i = 0; i < 6; i++) {
      const byeId = `BYE_${i}`;
      const byePlayer: Player = {
        id: byeId,
        name: 'BYE',
        skillLevel8: 3,
        skillLevel9: 3,
        skillLevel10: 3,
        createdAt: new Date().toISOString(),
        isBye: true,
      };
      finalPlayersList.push(byePlayer);
      playersMap[byeId] = byePlayer;
    }

    expect(finalPlayersList.length).toBe(16);

    // 3. Divide into 2 groups of 8 players
    const group1Players = finalPlayersList.slice(0, 8);
    const group2Players = finalPlayersList.slice(8, 16);

    const group1: Group = {
      id: 'group_A',
      tournamentId,
      name: 'Group A',
      playerIds: group1Players.map(p => p.id),
      status: 'active',
    };

    const group2: Group = {
      id: 'group_B',
      tournamentId,
      name: 'Group B',
      playerIds: group2Players.map(p => p.id),
      status: 'active',
    };

    // 4. Initialize group stage matches
    const groupAMatches = initializeGroupMatches(tournamentId, group1, playersMap, gameType);
    const groupBMatches = initializeGroupMatches(tournamentId, group2, playersMap, gameType);

    expect(groupAMatches.length).toBe(10);
    expect(groupBMatches.length).toBe(10);

    // Helper to auto-play remaining matches in a Double Elimination group
    const playGroupMatches = (groupMatches: Match[]) => {
      // Loop until all 10 matches are completed
      let attempts = 0;
      while (groupMatches.some(m => m.status !== 'completed') && attempts < 50) {
        attempts++;
        for (const match of groupMatches) {
          if (match.status !== 'completed' && match.player1Id && match.player2Id) {
            // Player 1 wins
            match.player1Score = match.player1Target;
            match.player2Score = 0;
            match.status = 'completed';
            match.winnerId = match.player1Id;

            advanceDoubleEliminationMatch(match, groupMatches, playersMap, gameType);
          }
        }
      }
    };

    // Play all matches for Group A and Group B
    playGroupMatches(groupAMatches);
    playGroupMatches(groupBMatches);

    // Verify all group matches are done
    expect(groupAMatches.every(m => m.status === 'completed')).toBe(true);
    expect(groupBMatches.every(m => m.status === 'completed')).toBe(true);

    // 5. Extract qualifiers from Group A and Group B
    const allMatches = [...groupAMatches, ...groupBMatches];
    const qualifiersA = getGroupQualifiers(group1, allMatches);
    const qualifiersB = getGroupQualifiers(group2, allMatches);

    expect(qualifiersA.winners.length).toBe(2);
    expect(qualifiersA.losers.length).toBe(2);
    expect(qualifiersB.winners.length).toBe(2);
    expect(qualifiersB.losers.length).toBe(2);

    const qualifiersList = [qualifiersA, qualifiersB];

    // 6. Seed Single Elimination bracket (8 players total)
    const seMatches = seedSingleElimination(tournamentId, qualifiersList, playersMap, gameType);
    
    // Quarterfinals (4 matches), Semifinals (2 matches), Finals (1 match) -> Total 7 matches
    expect(seMatches.length).toBe(7);

    // Verify first round matches are set up
    const qfMatches = seMatches.filter(m => m.roundNumber === 1);
    expect(qfMatches.length).toBe(4);
    qfMatches.forEach(m => {
      expect(m.player1Id).toBeTruthy();
      expect(m.player2Id).toBeTruthy();
      const hasBye = m.player1Id.includes('BYE') || m.player2Id.includes('BYE');
      expect(m.status).toBe(hasBye ? 'completed' : 'scheduled');
    });

    // Helper to auto-play Single Elimination matches
    const playKnockoutRounds = (knockoutMatches: Match[]) => {
      const maxRound = Math.max(...knockoutMatches.map(m => m.roundNumber));
      for (let r = 1; r <= maxRound; r++) {
        const roundMatches = knockoutMatches.filter(m => m.roundNumber === r);
        for (const match of roundMatches) {
          expect(match.player1Id).toBeTruthy();
          expect(match.player2Id).toBeTruthy();

          // Player 1 wins
          match.player1Score = match.player1Target;
          match.player2Score = 0;
          match.status = 'completed';
          match.winnerId = match.player1Id;

          advanceKnockoutMatches(knockoutMatches, playersMap, gameType);
        }
      }
    };

    // Play through the finals
    playKnockoutRounds(seMatches);

    // Verify all SE matches are completed
    expect(seMatches.every(m => m.status === 'completed')).toBe(true);

    // Check that we have a final champion
    const finalMatch = seMatches.find(m => m.roundNumber === 3)!; // Round 3 is the final for 8 players
    expect(finalMatch.winnerId).toBeTruthy();
    expect(finalMatch.winnerId).toBe(finalMatch.player1Id);
  });
});
