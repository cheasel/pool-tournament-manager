import { describe, it, expect } from 'vitest';
import { Player, Group, Match } from '../../types';
import {
  initializeGroupMatches,
  getGroupQualifiers,
  seedSingleElimination,
  advanceDoubleEliminationMatch,
  advanceKnockoutMatches,
  resolveByeMatches,
} from '../bracket';

describe('Knockout round BYE progression and disappearance tests', () => {
  it('correctly handles BYE players without them leaking as real players or causing stuck matches', () => {
    // 5 real players and 3 BYEs to simulate the group stage of 8 players
    const tournamentId = 'bye_test_tourney';
    const gameType = '9-Ball';

    const realPlayers: Player[] = Array.from({ length: 5 }, (_, i) => ({
      id: `real_p_${i + 1}`,
      name: `Real Player ${i + 1}`,
      skillLevel8: 5,
      skillLevel9: 5,
      skillLevel10: 5,
      createdAt: '',
    }));

    const groupByes: Player[] = Array.from({ length: 3 }, (_, i) => ({
      id: `BYE_${tournamentId}_${i}`,
      name: `BYE ${i + 1}`,
      skillLevel8: 3,
      skillLevel9: 3,
      skillLevel10: 3,
      createdAt: '',
      isBye: true,
    }));

    const allPlayersList = [...realPlayers, ...groupByes];
    const playersMap = allPlayersList.reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {} as Record<string, Player>);

    const group: Group = {
      id: 'group_1',
      tournamentId,
      name: 'Group 1',
      playerIds: allPlayersList.map(p => p.id),
      status: 'active',
    };

    // Initialize group stage matches
    const matches = initializeGroupMatches(tournamentId, group, playersMap, gameType);

    // Complete the remaining matches (simulate real players matches)
    let attempts = 0;
    while (matches.some(m => m.status !== 'completed') && attempts < 100) {
      attempts++;
      for (const m of matches) {
        if (m.status === 'scheduled' && m.player1Id && m.player2Id) {
          m.status = 'completed';
          m.winnerId = m.player1Id;
          m.player1Score = m.player1Target;
          m.player2Score = 0;
          advanceDoubleEliminationMatch(m, matches, playersMap, gameType);
        }
      }
    }

    expect(matches.every(m => m.status === 'completed')).toBe(true);

    // Extract qualifiers
    const qualifiers = getGroupQualifiers(group, matches);
    expect(qualifiers.winners.length).toBe(2);
    expect(qualifiers.losers.length).toBe(2);

    const qualifiersList = [qualifiers];

    // Seed knockout round
    const seMatches = seedSingleElimination(tournamentId, qualifiersList, playersMap, gameType);

    // Verify seMatches is populated
    expect(seMatches.length).toBeGreaterThan(0);

    // Look at first round matches
    const r1Matches = seMatches.filter(m => m.roundNumber === 1);
    console.log('R1 Matches:', r1Matches.map(m => `${m.player1Id} vs ${m.player2Id} (status: ${m.status}, winner: ${m.winnerId})`));

    // Check if any player ID in knockout round matches is a group BYE player
    const groupByeIds = groupByes.map(b => b.id);
    seMatches.forEach(m => {
      expect(groupByeIds.includes(m.player1Id)).toBe(false);
      expect(groupByeIds.includes(m.player2Id)).toBe(false);
    });
  });

  it('seeding knockout stage ensures BYEs are paired with real players first (no BYE-BYE matches)', () => {
    const tournamentId = 'bye_knockout_test';
    const gameType = '9-Ball';

    // Simulate 6 real qualifiers (2 Winners, 4 Losers) in an 8-player bracket
    const realPlayers: Player[] = Array.from({ length: 6 }, (_, i) => ({
      id: `real_qualifier_${i + 1}`,
      name: `Real Qualifier ${i + 1}`,
      skillLevel8: 5,
      skillLevel9: 5,
      skillLevel10: 5,
      createdAt: '',
    }));

    const playersMap = realPlayers.reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {} as Record<string, Player>);

    const qualifiersList = [
      {
        groupId: 'group_A',
        winners: ['real_qualifier_1', 'real_qualifier_2'],
        losers: ['real_qualifier_3', 'real_qualifier_4'],
      },
      {
        groupId: 'group_B',
        winners: [], // 0 winners (both were group BYEs)
        losers: ['real_qualifier_5', 'real_qualifier_6'],
      }
    ];

    // Seed Single Elimination knockout round
    const seMatches = seedSingleElimination(tournamentId, qualifiersList, playersMap, gameType);

    // Quarterfinals (4 matches), Semifinals (2 matches), Finals (1 match) -> Total 7 matches
    expect(seMatches.length).toBe(7);

    // Verify Round 1 matches
    const r1Matches = seMatches.filter(m => m.roundNumber === 1);
    expect(r1Matches.length).toBe(4);

    // Since we have 6 real players and 2 BYEs, there should be exactly 2 matches with BYEs (completed)
    // and exactly 2 matches with only real players (scheduled)
    const byeMatches = r1Matches.filter(m => m.status === 'completed');
    const scheduledMatches = r1Matches.filter(m => m.status === 'scheduled');

    expect(byeMatches.length).toBe(2);
    expect(scheduledMatches.length).toBe(2);

    // Verify Winners (real_qualifier_1 and real_qualifier_2) got the BYEs
    byeMatches.forEach(m => {
      const p1Bye = m.player1Id.includes('BYE');
      const p2Bye = m.player2Id.includes('BYE');
      expect(p1Bye || p2Bye).toBe(true);
      expect(p1Bye && p2Bye).toBe(false); // No BYE-BYE matches!

      const realPlayer = p1Bye ? m.player2Id : m.player1Id;
      // Should be real_qualifier_1 or real_qualifier_2
      expect(['real_qualifier_1', 'real_qualifier_2'].includes(realPlayer)).toBe(true);
      
      // Auto-completed and winner should be the real player
      expect(m.winnerId).toBe(realPlayer);
    });

    // Semifinals (Round 2)
    const r2Matches = seMatches.filter(m => m.roundNumber === 2);
    expect(r2Matches.length).toBe(2);

    // Verify no BYE exists in Round 2
    r2Matches.forEach(m => {
      expect(m.player1Id ? m.player1Id.includes('BYE') : false).toBe(false);
      expect(m.player2Id ? m.player2Id.includes('BYE') : false).toBe(false);
    });
  });
});
