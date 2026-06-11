import { describe, it, expect } from 'vitest';
import { Player, Tournament, Group, Match, TournamentDetails, CalcuttaBid } from '../../../types';
import { calculateTournamentEarnings, aggregateGlobalEarnings } from '../earnings';

describe('Earnings Calculation Engine', () => {
  // Setup mock players
  const mockPlayers: Player[] = Array.from({ length: 8 }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    skillLevel8: 5,
    skillLevel9: 5,
    skillLevel10: 5,
    createdAt: '',
  }));

  const mockTournament: Tournament = {
    id: 't1',
    name: 'Mock Championship',
    gameType: '8-Ball',
    status: 'completed',
    createdAt: '',
    entryFee: 100,
    payoutPercentages: [50, 30, 20], // 1st: 50%, 2nd: 30%, 3rd: 20%
    hasCalcutta: true,
    calcuttaPayoutPercentages: [60, 40], // 1st Calcutta: 60%, 2nd Calcutta: 40%
    calcuttaBids: [
      { playerId: 'p1', bidAmount: 100, buyerName: 'Owner A', split: false },
      { playerId: 'p2', bidAmount: 120, buyerName: 'Owner B', split: true },  // 50/50 split
      { playerId: 'p3', bidAmount: 80, buyerName: 'Owner A', split: false },
      { playerId: 'p4', bidAmount: 60, buyerName: 'Owner C', split: false },
      { playerId: 'p5', bidAmount: 50, buyerName: 'Owner D', split: true },
      { playerId: 'p6', bidAmount: 40, buyerName: 'Owner E', split: false },
      { playerId: 'p7', bidAmount: 30, buyerName: 'Owner F', split: false },
      { playerId: 'p8', bidAmount: 20, buyerName: 'Owner G', split: false },
    ],
  };

  const mockGroups: Group[] = [
    {
      id: 'g1',
      tournamentId: 't1',
      name: 'Group A',
      playerIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'],
      status: 'completed',
    },
  ];

  // Mock a knockout stage where:
  // p1 wins tournament
  // p2 is runner up
  // p3, p4 are semifinal losers (tied 3rd/4th)
  // p5, p6, p7, p8 are quarterfinal losers (tied 5th-8th or group stage losers)
  // Wait, let's write completed knockout matches:
  // MaxRound = 2 (se_r1 matches: p1 vs p3, p2 vs p4 -> semifinal matches. se_r2 match: p1 vs p2 -> final match)
  const mockMatches: Match[] = [
    // Semifinals (roundNumber: 1)
    {
      id: 'se_r1_m1',
      tournamentId: 't1',
      roundType: 'knockout',
      roundNumber: 1,
      matchNumber: 1,
      player1Id: 'p1',
      player2Id: 'p3',
      player1Score: 5,
      player2Score: 2,
      player1Target: 5,
      player2Target: 5,
      player1SpottedBalls: [],
      player2SpottedBalls: [],
      status: 'completed',
      winnerId: 'p1',
      createdAt: '',
    },
    {
      id: 'se_r1_m2',
      tournamentId: 't1',
      roundType: 'knockout',
      roundNumber: 1,
      matchNumber: 2,
      player1Id: 'p2',
      player2Id: 'p4',
      player1Score: 5,
      player2Score: 3,
      player1Target: 5,
      player2Target: 5,
      player1SpottedBalls: [],
      player2SpottedBalls: [],
      status: 'completed',
      winnerId: 'p2',
      createdAt: '',
    },
    // Final (roundNumber: 2)
    {
      id: 'se_r2_m1',
      tournamentId: 't1',
      roundType: 'knockout',
      roundNumber: 2,
      matchNumber: 1,
      player1Id: 'p1',
      player2Id: 'p2',
      player1Score: 5,
      player2Score: 4,
      player1Target: 5,
      player2Target: 5,
      player1SpottedBalls: [],
      player2SpottedBalls: [],
      status: 'completed',
      winnerId: 'p1',
      createdAt: '',
    },
  ];

  const mockDetails: TournamentDetails = {
    tournament: mockTournament,
    players: mockPlayers,
    groups: mockGroups,
    matches: mockMatches,
  };

  it('calculates player positions/ranks correctly from completed knockout matches', () => {
    const earnings = calculateTournamentEarnings(mockDetails);
    
    const p1 = earnings.find(e => e.playerId === 'p1')!;
    const p2 = earnings.find(e => e.playerId === 'p2')!;
    const p3 = earnings.find(e => e.playerId === 'p3')!;
    const p4 = earnings.find(e => e.playerId === 'p4')!;

    expect(p1.rank).toBe(1);
    expect(p2.rank).toBe(2);
    // Semifinal losers
    expect(p3.rank).toBe(3);
    expect(p4.rank).toBe(3);
    // Group stage/quarterfinal participants not in knockout (all remaining)
    const p5 = earnings.find(e => e.playerId === 'p5')!;
    expect(p5.rank).toBe(5);
  });

  it('calculates gross and net earnings correctly including entry fee and Calcutta', () => {
    const earnings = calculateTournamentEarnings(mockDetails);
    
    // Total entry pool = 8 players * $100 = $800
    // Total Calcutta pool = 100+120+80+60+50+40+30+20 = $500
    
    // 1st place: p1
    // Player payout: 50% of $800 = $400
    // Calcutta payout: 60% of $500 = $300
    // Owner A (Owner) split: false
    // Owner gets 100% of Calcutta = $300, Player gets 0% of Calcutta = $0
    // Net player: $400 - $100 (entry fee) - $0 (calcutta cost) = $300
    // Net owner: $300 - $100 (bid amount) = $200
    const e1 = earnings.find(e => e.playerId === 'p1')!;
    expect(e1.playerPayout).toBe(400);
    expect(e1.calcuttaPayout).toBe(300);
    expect(e1.playerCalcuttaShare).toBe(0);
    expect(e1.ownerCalcuttaShare).toBe(300);
    expect(e1.netPlayerEarnings).toBe(300);
    expect(e1.netOwnerEarnings).toBe(200);

    // 2nd place: p2 (Split: true, Bid: $120)
    // Player payout: 30% of $800 = $240
    // Calcutta payout: 40% of $500 = $200
    // Split: true -> 50% of Calcutta to Player ($100), 50% to Owner B ($100)
    // Calcutta cost: Player pays 50% of $120 = $60, Owner pays 50% = $60
    // Net player: $240 + $100 - $100 (entry fee) - $60 (calcutta cost) = $180
    // Net owner: $100 - $60 = $40
    const e2 = earnings.find(e => e.playerId === 'p2')!;
    expect(e2.playerPayout).toBe(240);
    expect(e2.calcuttaPayout).toBe(200);
    expect(e2.playerCalcuttaShare).toBe(100);
    expect(e2.ownerCalcuttaShare).toBe(100);
    expect(e2.netPlayerEarnings).toBe(180);
    expect(e2.netOwnerEarnings).toBe(40);
  });

  it('handles tied positions split correctly', () => {
    const earnings = calculateTournamentEarnings(mockDetails);
    
    // Semifinal losers: p3 and p4 (Rank 3)
    // Payout percentages for Rank 3 and 4: payoutPercentages[2] (20%) + payoutPercentages[3] (0%) = 20%
    // Average payout percentage: 10% each
    // Player payout = 10% of $800 = $80 each
    // Calcutta payout percentages for Rank 3 and 4: calcuttaPercentages[2] (0%) + calcuttaPercentages[3] (0%) = 0%
    const e3 = earnings.find(e => e.playerId === 'p3')!;
    const e4 = earnings.find(e => e.playerId === 'p4')!;
    
    expect(e3.playerPayout).toBe(80);
    expect(e4.playerPayout).toBe(80);
    expect(e3.calcuttaPayout).toBe(0);
    expect(e4.calcuttaPayout).toBe(0);
  });

  it('aggregates global earnings correctly', () => {
    const globalStats = aggregateGlobalEarnings([mockDetails]);

    // Top player: p1 (total player earnings = $400 payout + $0 calcutta = $400)
    // Next player: p2 (total player earnings = $240 payout + $100 calcutta = $340)
    expect(globalStats.players[0].playerId).toBe('p1');
    expect(globalStats.players[0].totalEarnings).toBe(400);
    expect(globalStats.players[1].playerId).toBe('p2');
    expect(globalStats.players[1].totalEarnings).toBe(340);

    // Owners: Owner A bought p1 ($300) and p3 ($0). Total owner earnings = $300. Net owner = $300 - $100 (p1 bid) - $80 (p3 bid) = $120.
    // Owner B bought p2. Total owner earnings = $100. Net owner = $40.
    const ownerA = globalStats.owners.find(o => o.ownerName === 'Owner A')!;
    expect(ownerA.ownerCalcuttaShare).toBe(300);
    expect(ownerA.netOwnerEarnings).toBe(120);

    // Combined earnings (Player + Owner)
    // Player 1 (p1) combined: $400 (as player) + $0 (as owner) = $400.
    // Player 2 (p2) combined: $340 (as player) + $0 (as owner) = $340.
    // Owner A combined: $0 (as player) + $300 (as owner) = $300.
    const combP1 = globalStats.combined.find(c => c.name === 'Player 1')!;
    const combOwnerA = globalStats.combined.find(c => c.name === 'Owner A')!;

    expect(combP1.totalEarnings).toBe(400);
    expect(combOwnerA.totalEarnings).toBe(300);
  });
});
