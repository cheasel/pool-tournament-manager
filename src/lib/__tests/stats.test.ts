import { describe, it, expect } from 'vitest';
import { Player, Tournament, Group, Match, TournamentDetails } from '../../types';
import { getPlayerStats } from '../stats';

describe('Player Statistics Aggregator', () => {
  const playerA: Player = {
    id: 'player_a',
    name: 'Player A',
    skillLevel8: 9,
    skillLevel9: 9,
    skillLevel10: 9,
    createdAt: ''
  };

  const playerB: Player = {
    id: 'player_b',
    name: 'Player B',
    skillLevel8: 5,
    skillLevel9: 5,
    skillLevel10: 5,
    createdAt: ''
  };

  const mockTournaments: TournamentDetails[] = [
    {
      tournament: {
        id: 't1',
        name: 'Tournament 1',
        gameType: '9-Ball',
        status: 'completed',
        createdAt: '2026-01-01T12:00:00Z',
        entryFee: 100,
        payoutPercentages: [100],
        hasCalcutta: true,
        calcuttaPayoutPercentages: [100],
        calcuttaBids: [
          { playerId: 'player_a', bidAmount: 150, buyerName: 'Player A', split: false }, // Player A bought themselves
          { playerId: 'player_b', bidAmount: 100, buyerName: 'Owner X', split: false }
        ]
      },
      players: [playerA, playerB],
      groups: [],
      matches: [
        {
          id: 't1_m1',
          tournamentId: 't1',
          roundType: 'knockout',
          roundNumber: 1,
          matchNumber: 1,
          player1Id: 'player_a',
          player2Id: 'player_b',
          player1Score: 9,
          player2Score: 4,
          player1Target: 9,
          player2Target: 5,
          player1SpottedBalls: [],
          player2SpottedBalls: [],
          status: 'completed',
          winnerId: 'player_a',
          player1Stats: { breakAndRun: true },
          player2Stats: { tableRun: false },
          createdAt: ''
        }
      ]
    }
  ];

  it('should successfully calculate career matches, racks, win rates, and runs for player_a', () => {
    const stats = getPlayerStats(playerA, mockTournaments);
    expect(stats.tournamentsPlayed).toBe(1);
    
    // Match wins
    expect(stats.matches.played).toBe(1);
    expect(stats.matches.won).toBe(1);
    expect(stats.matches.lost).toBe(0);
    expect(stats.matches.winRate).toBe(100);

    // Racks
    expect(stats.racks.won).toBe(9);
    expect(stats.racks.lost).toBe(4);
    expect(stats.racks.winRate).toBe(69.2); // 9 / 13 = 69.23%

    // Runs
    expect(stats.runs.breakAndRun).toBe(1);
    expect(stats.runs.tableRun).toBe(0);
  });

  it('should successfully calculate career stats for player_b', () => {
    const stats = getPlayerStats(playerB, mockTournaments);
    expect(stats.tournamentsPlayed).toBe(1);
    expect(stats.matches.played).toBe(1);
    expect(stats.matches.won).toBe(0);
    expect(stats.matches.lost).toBe(1);
    expect(stats.matches.winRate).toBe(0);

    expect(stats.racks.won).toBe(4);
    expect(stats.racks.lost).toBe(9);
    expect(stats.racks.winRate).toBe(30.8);
  });

  it('should calculate earnings, podiums, and Calcutta shares accurately', () => {
    const stats = getPlayerStats(playerA, mockTournaments);
    
    // Player A won the match and the tournament (rank: 1)
    // 2 players at 100 entrance fee = 200 total entry pool. 100% payout to 1st = 200 player payout.
    expect(stats.earnings.playerPayout).toBe(200);

    // Calcutta bids: A bid 150, B bid 100 -> 250 Calcutta pool.
    // Payout: 100% to 1st Calcutta = 250.
    // Player A bought themselves, so their Calcutta owner payout is 250 (which goes to Owner Calcutta share).
    // Plus Player Calcutta share is 0 since split is false.
    // Total Calcutta payout is 250.
    expect(stats.earnings.calcuttaPayout).toBe(250);
    expect(stats.earnings.totalEarnings).toBe(450);

    // Ranks/Podiums
    expect(stats.podiums.first).toBe(1);
    expect(stats.podiums.second).toBe(0);
  });

  it('should separate metrics correctly in game type breakdowns', () => {
    const stats = getPlayerStats(playerA, mockTournaments);
    
    // 9-Ball breakdown
    expect(stats.gameBreakdown['9-Ball'].matches.played).toBe(1);
    expect(stats.gameBreakdown['9-Ball'].matches.won).toBe(1);
    expect(stats.gameBreakdown['9-Ball'].runs.breakAndRun).toBe(1);

    // 8-Ball breakdown (empty)
    expect(stats.gameBreakdown['8-Ball'].matches.played).toBe(0);
    expect(stats.gameBreakdown['8-Ball'].matches.won).toBe(0);
  });

  it('should successfully calculate multiple runs in a match when statistics values are integers', () => {
    const mockTournamentsWithMultiRuns: TournamentDetails[] = [
      {
        ...mockTournaments[0],
        matches: [
          {
            ...mockTournaments[0].matches[0],
            player1Stats: { breakAndRun: 3, tableRun: 2 },
            player2Stats: { breakAndRun: 1, tableRun: 4 }
          }
        ]
      }
    ];

    const statsA = getPlayerStats(playerA, mockTournamentsWithMultiRuns);
    expect(statsA.runs.breakAndRun).toBe(3);
    expect(statsA.runs.tableRun).toBe(2);

    const statsB = getPlayerStats(playerB, mockTournamentsWithMultiRuns);
    expect(statsB.runs.breakAndRun).toBe(1);
    expect(statsB.runs.tableRun).toBe(4);
  });
});
