import { describe, it, expect } from 'vitest';
import { Player, Match } from '../../types';

interface PlayerStats {
  player: Player;
  tournamentsPlayed: number;
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
  racksWon: number;
  racksLost: number;
  breakAndRuns: number;
  tableRuns: number;
  mismatchScore: number;
  mismatchStatus: 'high' | 'warn' | 'none';
  mismatchReason: string;
}

// Replicate the exact classification logic from analysis/page.tsx
function analyzePlayerStats(player: Player, matches: Match[]): PlayerStats {
  const playerMatches = matches.filter(m => 
    m.status === 'completed' && 
    (m.player1Id === player.id || m.player2Id === player.id)
  );

  let wins = 0;
  let losses = 0;
  let racksWon = 0;
  let racksLost = 0;
  let breakAndRuns = 0;
  let tableRuns = 0;

  playerMatches.forEach(m => {
    const isPlayer1 = m.player1Id === player.id;
    const score = isPlayer1 ? m.player1Score : m.player2Score;
    const oppScore = isPlayer1 ? m.player2Score : m.player1Score;
    const stats = isPlayer1 ? m.player1Stats : m.player2Stats;

    racksWon += score;
    racksLost += oppScore;

    if (m.winnerId === player.id) {
      wins++;
    } else {
      losses++;
    }

    if (stats?.breakAndRun) {
      breakAndRuns += typeof stats.breakAndRun === 'number' ? stats.breakAndRun : (stats.breakAndRun ? 1 : 0);
    }
    if (stats?.tableRun) {
      tableRuns += typeof stats.tableRun === 'number' ? stats.tableRun : (stats.tableRun ? 1 : 0);
    }
  });

  const tournamentIds = new Set(playerMatches.map(m => m.tournamentId));
  const tournamentsPlayed = tournamentIds.size;

  const totalMatches = wins + losses;
  const winRate = totalMatches > 0 ? wins / totalMatches : 0;

  let mismatchScore = 0;
  let mismatchStatus: 'high' | 'warn' | 'none' = 'none';
  let mismatchReason = '';

  const avgSkill = (player.skillLevel8 + player.skillLevel9 + player.skillLevel10) / 3;

  if (totalMatches >= 5) {
    if (winRate > 0.70) {
      mismatchStatus = 'high';
      mismatchScore += (winRate - 0.70) * 100;
      mismatchReason = `High win rate of ${(winRate * 100).toFixed(0)}% over ${totalMatches} matches. `;
    } else if (winRate < 0.30) {
      mismatchStatus = 'warn';
      mismatchScore += (0.30 - winRate) * 50;
      mismatchReason = `Low win rate of ${(winRate * 100).toFixed(0)}% over ${totalMatches} matches. `;
    }
  }

  if (avgSkill < 10 && (breakAndRuns > 0 || tableRuns > 0)) {
    mismatchStatus = 'high';
    mismatchScore += (breakAndRuns * 15) + (tableRuns * 15);
    const runsText = [];
    if (breakAndRuns > 0) runsText.push(`${breakAndRuns} Break-and-run(s)`);
    if (tableRuns > 0) runsText.push(`${tableRuns} Table-run(s)`);
    mismatchReason += `Low handicap (${avgSkill.toFixed(0)}) player scoring ${runsText.join(' and ')}. `;
  }

  return {
    player,
    tournamentsPlayed,
    totalMatches,
    wins,
    losses,
    winRate,
    racksWon,
    racksLost,
    breakAndRuns,
    tableRuns,
    mismatchScore: Math.round(mismatchScore),
    mismatchStatus,
    mismatchReason: mismatchReason || 'No significant mismatch detected.'
  };
}

describe('Super Admin Handicap Mismatch Analysis Logic', () => {
  const normalPlayer: Player = {
    id: 'normal_p',
    name: 'Normal Player',
    skillLevel8: 12,
    skillLevel9: 12,
    skillLevel10: 12,
    createdAt: ''
  };

  const lowHandicapPlayer: Player = {
    id: 'low_p',
    name: 'Low Player',
    skillLevel8: 6,
    skillLevel9: 6,
    skillLevel10: 6,
    createdAt: ''
  };

  it('should not flag a normal player with standard 50% win rate and no runs', () => {
    const mockMatches: Match[] = Array.from({ length: 6 }, (_, i) => ({
      id: `m_${i}`,
      tournamentId: 't1',
      roundType: 'knockout',
      roundNumber: 1,
      matchNumber: i,
      player1Id: 'normal_p',
      player2Id: 'other_p',
      player1Score: 5,
      player2Score: 5,
      player1Target: 5,
      player2Target: 5,
      player1SpottedBalls: [],
      player2SpottedBalls: [],
      status: 'completed',
      winnerId: i % 2 === 0 ? 'normal_p' : 'other_p',
      createdAt: ''
    }));

    const analysis = analyzePlayerStats(normalPlayer, mockMatches);
    expect(analysis.totalMatches).toBe(6);
    expect(analysis.wins).toBe(3);
    expect(analysis.winRate).toBe(0.5);
    expect(analysis.mismatchStatus).toBe('none');
    expect(analysis.mismatchScore).toBe(0);
  });

  it('should flag a player with >70% win rate after 5+ matches as a high alert mismatch', () => {
    const mockMatches: Match[] = Array.from({ length: 5 }, (_, i) => ({
      id: `m_${i}`,
      tournamentId: 't1',
      roundType: 'knockout',
      roundNumber: 1,
      matchNumber: i,
      player1Id: 'normal_p',
      player2Id: 'other_p',
      player1Score: 5,
      player2Score: 2,
      player1Target: 5,
      player2Target: 5,
      player1SpottedBalls: [],
      player2SpottedBalls: [],
      status: 'completed',
      winnerId: 'normal_p', // 100% win rate
      createdAt: ''
    }));

    const analysis = analyzePlayerStats(normalPlayer, mockMatches);
    expect(analysis.winRate).toBe(1.0);
    expect(analysis.mismatchStatus).toBe('high');
    expect(analysis.mismatchScore).toBe(30); // (1.0 - 0.70) * 100 = 30
    expect(analysis.mismatchReason).toContain('High win rate');
  });

  it('should flag a player with <30% win rate after 5+ matches as a minor warn alert', () => {
    const mockMatches: Match[] = Array.from({ length: 5 }, (_, i) => ({
      id: `m_${i}`,
      tournamentId: 't1',
      roundType: 'knockout',
      roundNumber: 1,
      matchNumber: i,
      player1Id: 'normal_p',
      player2Id: 'other_p',
      player1Score: 1,
      player2Score: 5,
      player1Target: 5,
      player2Target: 5,
      player1SpottedBalls: [],
      player2SpottedBalls: [],
      status: 'completed',
      winnerId: 'other_p', // 0% win rate
      createdAt: ''
    }));

    const analysis = analyzePlayerStats(normalPlayer, mockMatches);
    expect(analysis.winRate).toBe(0.0);
    expect(analysis.mismatchStatus).toBe('warn');
    expect(analysis.mismatchScore).toBe(15); // (0.30 - 0.0) * 50 = 15
    expect(analysis.mismatchReason).toContain('Low win rate');
  });

  it('should flag a low handicap player with any break-and-run as high mismatch alert', () => {
    const mockMatches: Match[] = [
      {
        id: 'm_1',
        tournamentId: 't1',
        roundType: 'knockout',
        roundNumber: 1,
        matchNumber: 1,
        player1Id: 'low_p',
        player2Id: 'other_p',
        player1Score: 3,
        player2Score: 3,
        player1Target: 3,
        player2Target: 5,
        player1SpottedBalls: [],
        player2SpottedBalls: [],
        status: 'completed',
        winnerId: 'other_p',
        player1Stats: { breakAndRun: true }, // recorded a break-and-run!
        createdAt: ''
      }
    ];

    const analysis = analyzePlayerStats(lowHandicapPlayer, mockMatches);
    expect(analysis.totalMatches).toBe(1); // less than 5 matches, but flagged due to run
    expect(analysis.mismatchStatus).toBe('high');
    expect(analysis.mismatchScore).toBe(15); // 15 points per breakAndRun
    expect(analysis.mismatchReason).toContain('scoring 1 Break-and-run(s)');
  });

  it('correctly filters matches to only include those after the latest handicap change', () => {
    const player: Player = {
      id: 'test_player',
      name: 'Test Player',
      skillLevel8: 5,
      skillLevel9: 5,
      skillLevel10: 5,
      createdAt: ''
    };

    const mockMatches: Match[] = [
      {
        id: 'match_before',
        tournamentId: 't1',
        roundType: 'knockout',
        roundNumber: 1,
        matchNumber: 1,
        player1Id: 'test_player',
        player2Id: 'other_p',
        player1Score: 5,
        player2Score: 2,
        player1Target: 5,
        player2Target: 5,
        player1SpottedBalls: [],
        player2SpottedBalls: [],
        status: 'completed',
        winnerId: 'test_player',
        createdAt: '2026-06-10T12:00:00.000Z'
      },
      {
        id: 'match_after',
        tournamentId: 't1',
        roundType: 'knockout',
        roundNumber: 1,
        matchNumber: 2,
        player1Id: 'test_player',
        player2Id: 'other_p',
        player1Score: 5,
        player2Score: 1,
        player1Target: 5,
        player2Target: 5,
        player1SpottedBalls: [],
        player2SpottedBalls: [],
        status: 'completed',
        winnerId: 'test_player',
        createdAt: '2026-06-25T12:00:00.000Z'
      }
    ];

    const history = [
      {
        id: 'hist_1',
        playerId: 'test_player',
        changedAt: '2026-06-20T12:00:00.000Z',
        oldSkillLevel8: 4,
        oldSkillLevel9: 4,
        oldSkillLevel10: 4,
        newSkillLevel8: 5,
        newSkillLevel9: 5,
        newSkillLevel10: 5
      }
    ];

    // Simulating calculatePlayerStats filter logic
    function getFilteredPlayerMatches(
      player: Player,
      matches: Match[],
      showOnlyAfterLastChange: boolean,
      handicapHistory: any[]
    ): Match[] {
      let playerMatches = matches.filter(m =>
        m.status === 'completed' &&
        (m.player1Id === player.id || m.player2Id === player.id)
      );

      if (showOnlyAfterLastChange) {
        const playerHistory = handicapHistory.filter(h => h.playerId === player.id);
        if (playerHistory.length > 0) {
          const latestChangeTime = Math.max(...playerHistory.map(h => new Date(h.changedAt).getTime()));
          playerMatches = playerMatches.filter(m => new Date(m.createdAt).getTime() > latestChangeTime);
        }
      }
      return playerMatches;
    }

    // Case 1: Filter disabled -> returns both matches
    const allMatches = getFilteredPlayerMatches(player, mockMatches, false, history);
    expect(allMatches.length).toBe(2);

    // Case 2: Filter enabled -> returns only match_after (created on 2026-06-25, which is > change date 2026-06-20)
    const filteredMatches = getFilteredPlayerMatches(player, mockMatches, true, history);
    expect(filteredMatches.length).toBe(1);
    expect(filteredMatches[0].id).toBe('match_after');
  });

  it('correctly calculates tournamentsPlayed based on unique tournamentIds in matches', () => {
    const player: Player = {
      id: 'p_1',
      name: 'Player 1',
      skillLevel8: 5,
      skillLevel9: 5,
      skillLevel10: 5,
      createdAt: ''
    };

    const mockMatches: Match[] = [
      {
        id: 'm_1',
        tournamentId: 't1',
        roundType: 'knockout',
        roundNumber: 1,
        matchNumber: 1,
        player1Id: 'p_1',
        player2Id: 'other_p',
        player1Score: 5,
        player2Score: 2,
        player1Target: 5,
        player2Target: 5,
        player1SpottedBalls: [],
        player2SpottedBalls: [],
        status: 'completed',
        winnerId: 'p_1',
        createdAt: ''
      },
      {
        id: 'm_2',
        tournamentId: 't1',
        roundType: 'knockout',
        roundNumber: 2,
        matchNumber: 1,
        player1Id: 'p_1',
        player2Id: 'other_p_2',
        player1Score: 5,
        player2Score: 3,
        player1Target: 5,
        player2Target: 5,
        player1SpottedBalls: [],
        player2SpottedBalls: [],
        status: 'completed',
        winnerId: 'p_1',
        createdAt: ''
      },
      {
        id: 'm_3',
        tournamentId: 't2',
        roundType: 'knockout',
        roundNumber: 1,
        matchNumber: 1,
        player1Id: 'p_1',
        player2Id: 'other_p_3',
        player1Score: 4,
        player2Score: 5,
        player1Target: 5,
        player2Target: 5,
        player1SpottedBalls: [],
        player2SpottedBalls: [],
        status: 'completed',
        winnerId: 'other_p_3',
        createdAt: ''
      }
    ];

    const analysis = analyzePlayerStats(player, mockMatches);
    expect(analysis.totalMatches).toBe(3);
    expect(analysis.tournamentsPlayed).toBe(2);
  });
});
