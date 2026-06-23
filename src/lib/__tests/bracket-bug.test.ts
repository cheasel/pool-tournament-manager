import { describe, it, expect } from 'vitest';
import { Player, GroupQualifiers } from '../../types';
import { seedSingleElimination, advanceKnockoutMatches } from '../bracket';

describe('Knockout 32-player bug replication', () => {
  it('seeds and advances a 32-player single elimination bracket', () => {
    const tournamentId = 'test_32_tourney';
    const gameType = '9-Ball';

    // Create 32 players (16 winners, 16 losers) from 8 groups
    const playersMap: Record<string, Player> = {};
    const qualifiersList: GroupQualifiers[] = [];

    for (let g = 0; g < 8; g++) {
      const groupId = `group_${g + 1}`;
      const winners: string[] = [`w_${g}_1`, `w_${g}_2`];
      const losers: string[] = [`l_${g}_1`, `l_${g}_2`];

      winners.forEach(id => {
        playersMap[id] = {
          id,
          name: `Winner ${id}`,
          skillLevel8: 5,
          skillLevel9: 5,
          skillLevel10: 5,
          createdAt: '',
        };
      });

      losers.forEach(id => {
        playersMap[id] = {
          id,
          name: `Loser ${id}`,
          skillLevel8: 5,
          skillLevel9: 5,
          skillLevel10: 5,
          createdAt: '',
        };
      });

      qualifiersList.push({
        groupId,
        winners,
        losers,
      });
    }

    const matches = seedSingleElimination(tournamentId, qualifiersList, playersMap, gameType);

    // We expect 31 matches total (16 + 8 + 4 + 2 + 1)
    console.log(`Total matches generated: ${matches.length}`);
    expect(matches.length).toBe(31);

    const r1 = matches.filter(m => m.roundNumber === 1);
    const r2 = matches.filter(m => m.roundNumber === 2);
    const r3 = matches.filter(m => m.roundNumber === 3);

    console.log('Round 1 Match Details:');
    r1.forEach(m => {
      console.log(`Match #${m.matchNumber}: ${m.player1Id} vs ${m.player2Id}`);
    });

    console.log('\nRound 2 Match Details (initial):');
    r2.forEach(m => {
      console.log(`Match #${m.matchNumber}: ${m.player1Id} vs ${m.player2Id}`);
    });

    // Complete all Round 1 matches
    r1.forEach(m => {
      m.status = 'completed';
      // Let player 1 win
      m.winnerId = m.player1Id;
      m.player1Score = m.player1Target;
      m.player2Score = 0;
    });

    // Advance knockout matches
    advanceKnockoutMatches(matches, playersMap, gameType);

    console.log('\nRound 2 Match Details (after R1 completion):');
    r2.forEach(m => {
      console.log(`Match #${m.matchNumber}: ${m.player1Id} vs ${m.player2Id}`);
    });

    console.log('\nRound 3 Match Details (after R1 completion):');
    r3.forEach(m => {
      console.log(`Match #${m.matchNumber}: ${m.player1Id} vs ${m.player2Id}`);
    });
  });

  it('replicates the player swap issue and checks if matches disappear', () => {
    const tournamentId = 'swap_test_32';
    const gameType = '9-Ball';

    // Create 32 players (16 winners, 16 losers) from 8 groups
    const playersMap: Record<string, Player> = {};
    const qualifiersList: GroupQualifiers[] = [];

    for (let g = 0; g < 8; g++) {
      const groupId = `group_${g + 1}`;
      const winners: string[] = [`w_${g}_1`, `w_${g}_2`];
      const losers: string[] = [`l_${g}_1`, `l_${g}_2`];

      winners.forEach(id => {
        playersMap[id] = {
          id,
          name: `Winner ${id}`,
          skillLevel8: 5,
          skillLevel9: 5,
          skillLevel10: 5,
          createdAt: '',
        };
      });

      losers.forEach(id => {
        playersMap[id] = {
          id,
          name: `Loser ${id}`,
          skillLevel8: 5,
          skillLevel9: 5,
          skillLevel10: 5,
          createdAt: '',
        };
      });

      qualifiersList.push({
        groupId,
        winners,
        losers,
      });
    }

    let matches = seedSingleElimination(tournamentId, qualifiersList, playersMap, gameType);
    expect(matches.length).toBe(31);

    // Swap two players in Round 1: winner w_0_1 and loser l_1_1
    // This is similar to what a user might do
    const playerA = 'w_0_1';
    const playerB = 'l_1_1';

    // Find the matches containing them in Round 1
    const m1 = matches.find(m => m.roundNumber === 1 && (m.player1Id === playerA || m.player2Id === playerA))!;
    const m2 = matches.find(m => m.roundNumber === 1 && (m.player1Id === playerB || m.player2Id === playerB))!;

    // Perform the swap manually using the logic inside swapKnockoutPlayers
    if (m1.player1Id === playerA) m1.player1Id = playerB;
    else m1.player2Id = playerB;

    if (m2.player1Id === playerB) m2.player1Id = playerA;
    else m2.player2Id = playerA;

    // Reset subsequent rounds
    matches.forEach(m => {
      if (m.roundNumber > 1) {
        m.player1Id = '';
        m.player2Id = '';
        m.player1Score = 0;
        m.player2Score = 0;
        m.status = 'scheduled';
        m.winnerId = undefined;
      }
    });

    // Advance matches
    advanceKnockoutMatches(matches, playersMap, gameType);

    // Verify all 31 matches are still present and Round 2 has 8 matches
    const r2 = matches.filter(m => m.roundNumber === 2);
    expect(matches.length).toBe(31);
    expect(r2.length).toBe(8);
  });

  it('verifies that correcting a Round 1 score after subsequent rounds are completed causes corruption', () => {
    const tournamentId = 'correction_test_32';
    const gameType = '9-Ball';

    // Create 32 players (16 winners, 16 losers) from 8 groups
    const playersMap: Record<string, Player> = {};
    const qualifiersList: GroupQualifiers[] = [];

    for (let g = 0; g < 8; g++) {
      const groupId = `group_${g + 1}`;
      const winners: string[] = [`w_${g}_1`, `w_${g}_2`];
      const losers: string[] = [`l_${g}_1`, `l_${g}_2`];

      winners.forEach(id => {
        playersMap[id] = {
          id,
          name: `Winner ${id}`,
          skillLevel8: 5,
          skillLevel9: 5,
          skillLevel10: 5,
          createdAt: '',
        };
      });

      losers.forEach(id => {
        playersMap[id] = {
          id,
          name: `Loser ${id}`,
          skillLevel8: 5,
          skillLevel9: 5,
          skillLevel10: 5,
          createdAt: '',
        };
      });

      qualifiersList.push({
        groupId,
        winners,
        losers,
      });
    }

    let matches = seedSingleElimination(tournamentId, qualifiersList, playersMap, gameType);

    const r1 = matches.filter(m => m.roundNumber === 1);
    const r2 = matches.filter(m => m.roundNumber === 2);
    const r3 = matches.filter(m => m.roundNumber === 3);

    // Complete all Round 1 matches: player 1 wins
    r1.forEach(m => {
      m.status = 'completed';
      m.winnerId = m.player1Id;
      m.player1Score = m.player1Target;
      m.player2Score = 0;
    });

    advanceKnockoutMatches(matches, playersMap, gameType);

    // Now Round 2 matches are populated with Round 1 winners.
    // Let's complete Round 2 matches: player 1 wins
    r2.forEach(m => {
      m.status = 'completed';
      m.winnerId = m.player1Id;
      m.player1Score = m.player1Target;
      m.player2Score = 0;
    });

    advanceKnockoutMatches(matches, playersMap, gameType);

    // Now Round 3 matches are populated with Round 2 winners.
    // Let's print one of them
    console.log(`Before correction: Round 3 Match 1: ${r3[0].player1Id} vs ${r3[0].player2Id}`);

    // Now let's correct/change the score of Match 1 in Round 1
    // Changing the winner from w_0_1 to l_1_1
    const match1 = r1.find(m => m.matchNumber === 1)!;
    match1.winnerId = match1.player2Id; // change winner to l_1_1
    match1.player1Score = 0;
    match1.player2Score = match1.player2Target;

    // Run advancement again
    advanceKnockoutMatches(matches, playersMap, gameType);

    console.log(`After correction: Round 3 Match 1: ${r3[0].player1Id} vs ${r3[0].player2Id}`);
    console.log(`After correction: Round 2 Match 1: ${r2[0].player1Id} vs ${r2[0].player2Id} (winner: ${r2[0].winnerId})`);
  });
});
