import { describe, it, expect } from 'vitest';
import { Player, Group, Match } from '../../types';
import { calculateMatchHandicap } from '../handicap';
import {
  initializeGroupMatches,
  advanceDoubleEliminationMatch,
  getGroupQualifiers,
  seedSingleElimination,
} from '../bracket';
import { getDatabaseAdapter } from '../db';

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

  const p3: Player = {
    id: 'p3',
    name: 'Player 3',
    skillLevel8: 3,
    skillLevel9: 3,
    skillLevel10: 3,
    createdAt: '',
  };

  it('calculates 8-Ball targets correctly based on custom difference formula', () => {
    const setup1 = calculateMatchHandicap(p7, p5, '8-Ball');
    expect(setup1.player1Target).toBe(6);
    expect(setup1.player2Target).toBe(4);
    expect(setup1.player1SpottedBalls).toEqual([]);

    const setup2 = calculateMatchHandicap(p5, p3, '8-Ball');
    expect(setup2.player1Target).toBe(6);
    expect(setup2.player2Target).toBe(4);
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
    expect(setupDiff2.player1Target).toBe(6);
    expect(setupDiff2.player2Target).toBe(4);
    expect(setupDiff2.player2SpottedBalls).toEqual([8]);

    // Diff 4 -> spot 6,7,8
    const setupDiff4 = calculateMatchHandicap(p7, p3, '9-Ball');
    expect(setupDiff4.player1Target).toBe(7);
    expect(setupDiff4.player2Target).toBe(3);
    expect(setupDiff4.player2SpottedBalls).toEqual([6, 7, 8]);
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
    expect(matches[0].player2Id).toBe('p2');
    expect(matches[0].status).toBe('scheduled');
  });

  it('auto-resolves BYE matches during initialization', () => {
    const playersWithBye = [...mockPlayers];
    playersWithBye[1] = {
      ...playersWithBye[1],
      isBye: true,
      name: 'BYE',
    };

    const mapWithBye = playersWithBye.reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {} as Record<string, Player>);

    const matches = initializeGroupMatches('t1', mockGroup, mapWithBye, '8-Ball');
    // Match 1 is p1 vs p2 (BYE). It should auto-resolve with p1 winning.
    const m1 = matches.find(m => m.matchNumber === 1);
    expect(m1?.status).toBe('completed');
    expect(m1?.winnerId).toBe('p1');

    // And player 1 should be advanced to Match 9 (slot 1)
    const m9 = matches.find(m => m.matchNumber === 9);
    expect(m9?.player1Id).toBe('p1');
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

    const m9 = matches.find(m => m.matchNumber === 9)!;
    const m7 = matches.find(m => m.matchNumber === 7)!;

    // Winner of M1 goes to M9 slot 1, Loser of M1 goes to M7 slot 1
    expect(m9.player1Id).toBe('p1');
    expect(m7.player1Id).toBe('p2');
  });

  it('identifies group qualifiers correctly', () => {
    const matches = initializeGroupMatches('t1', mockGroup, playersMap, '8-Ball');
    
    // Complete matches to simulate qualifiers
    // Match 9 winner (qualifier 1)
    const m9 = matches.find(m => m.matchNumber === 9)!;
    m9.status = 'completed';
    m9.winnerId = 'p1';
    m9.player1Id = 'p1';
    m9.player2Id = 'p2';

    // Match 10 winner (qualifier 2)
    const m10 = matches.find(m => m.matchNumber === 10)!;
    m10.status = 'completed';
    m10.winnerId = 'p3';
    m10.player1Id = 'p3';
    m10.player2Id = 'p4';

    // Match 5 winner (qualifier 3)
    const m5 = matches.find(m => m.matchNumber === 5)!;
    m5.status = 'completed';
    m5.winnerId = 'p5';
    m5.player1Id = 'p5';
    m5.player2Id = 'p7';

    // Match 6 winner (qualifier 4)
    const m6 = matches.find(m => m.matchNumber === 6)!;
    m6.status = 'completed';
    m6.winnerId = 'p6';
    m6.player1Id = 'p6';
    m6.player2Id = 'p8';

    const qualifiers = getGroupQualifiers(mockGroup, matches);
    expect(qualifiers.winners).toContain('p1');
    expect(qualifiers.winners).toContain('p3');
    expect(qualifiers.losers).toContain('p5');
    expect(qualifiers.losers).toContain('p6');
  });

  it('seeds players such that BYEs do not play each other in Round 1 matches and sets pricing', async () => {
    const db = getDatabaseAdapter();
    
    // Use real seeded player IDs that the DB adapter knows about.
    // 6 real players + 2 BYEs will be added automatically to make 8.
    const playersRoster = ['efren', 'svb', 'filler', 'gorst', 'shaw', 'strickland'];
    
    const tournament = await db.createTournament(
      'Test Seeding Tournament',
      '8-Ball',
      playersRoster,
      50,
      [60, 40]
    );

    expect(tournament.entryFee).toBe(50);
    expect(tournament.payoutPercentages).toEqual([60, 40]);

    // Retrieve tournament details to inspect matches
    const details = await db.getTournamentDetails(tournament.id);
    expect(details).not.toBeNull();
    if (details) {
      const groupAMatches = details.matches.filter(m => m.groupId === details.groups[0].id);
      expect(groupAMatches.length).toBe(10);

      // Check first round matches (Matches 1-4)
      const r1Matches = groupAMatches.filter(m => m.matchNumber >= 1 && m.matchNumber <= 4);
      expect(r1Matches.length).toBe(4);

      // Verify no match has two BYE players
      r1Matches.forEach(m => {
        const p1IsBye = m.player1Id.includes('BYE');
        const p2IsBye = m.player2Id.includes('BYE');
        // Both p1 and p2 should NOT be BYE
        expect(p1IsBye && p2IsBye).toBe(false);
      });
    }
  });

  it('saves and retrieves Calcutta settings correctly', async () => {
    const db = getDatabaseAdapter();
    const playersRoster = ['efren', 'svb', 'filler', 'gorst', 'shaw', 'strickland'];
    
    const tournament = await db.createTournament(
      'Test Calcutta Tournament',
      '9-Ball',
      playersRoster,
      100,
      [50, 30, 20],
      true,      // hasCalcutta
      20,        // calcuttaMinStartBet
      10,        // calcuttaMinIncrement
      [70, 30]   // calcuttaPayoutPercentages
    );

    expect(tournament.hasCalcutta).toBe(true);
    expect(tournament.calcuttaMinStartBet).toBe(20);
    expect(tournament.calcuttaMinIncrement).toBe(10);
    expect(tournament.calcuttaPayoutPercentages).toEqual([70, 30]);

    // Retrieve and verify details mapping
    const details = await db.getTournamentDetails(tournament.id);
    expect(details).not.toBeNull();
    if (details) {
      expect(details.tournament.hasCalcutta).toBe(true);
      expect(details.tournament.calcuttaMinStartBet).toBe(20);
      expect(details.tournament.calcuttaMinIncrement).toBe(10);
      expect(details.tournament.calcuttaPayoutPercentages).toEqual([70, 30]);
    }
  });

  it('starts a Calcutta tournament as draft, saves bids, and advances to active', async () => {
    const db = getDatabaseAdapter();
    const playersRoster = ['efren', 'svb', 'filler', 'gorst', 'shaw', 'strickland'];
    
    // Create Calcutta tournament
    const tournament = await db.createTournament(
      'Calcutta Auction Draft Tourney',
      '8-Ball',
      playersRoster,
      50,
      [60, 40],
      true,     // hasCalcutta
      10,       // minStartBet
      5,        // minIncrement
      [50, 30, 20]
    );

    // Initial status should be 'draft' when hasCalcutta is true
    expect(tournament.status).toBe('draft');

    const bids = playersRoster.map((pid, idx) => ({
      playerId: pid,
      bidAmount: 10 + idx * 5,
      buyerName: `Buyer_${pid}`,
    }));

    // Start tournament and save bids
    const details = await db.startTournament(tournament.id, bids);
    expect(details.tournament.status).toBe('active');
    expect(details.tournament.calcuttaBids).toHaveLength(6);
    expect(details.tournament.calcuttaBids?.[0].buyerName).toBe('Buyer_efren');
    expect(details.tournament.calcuttaBids?.[0].bidAmount).toBe(10);
    expect(details.tournament.calcuttaBids?.[5].buyerName).toBe('Buyer_strickland');
    expect(details.tournament.calcuttaBids?.[5].bidAmount).toBe(35);
  });

  it('saves and retrieves tournament payments tracking lists correctly', async () => {
    const db = getDatabaseAdapter();
    const playersRoster = ['efren', 'svb', 'filler', 'gorst', 'shaw', 'strickland'];
    const tournament = await db.createTournament(
      'Payment Test Tournament',
      '8-Ball',
      playersRoster,
      50,
      [60, 40]
    );

    // Initial payments lists should be empty or undefined
    let details = await db.getTournamentDetails(tournament.id);
    expect(details?.tournament.entryFeePaidIds).toBeFalsy();

    // Update payments
    const entryFeePaid = ['efren', 'svb'];
    const calcuttaPaid = ['filler'];
    const playerPayoutPaid = ['efren'];
    const ownerPayoutPaid = ['svb'];

    details = await db.updateTournamentPayments(
      tournament.id,
      entryFeePaid,
      calcuttaPaid,
      playerPayoutPaid,
      ownerPayoutPaid
    );

    // Verify values returned
    expect(details.tournament.entryFeePaidIds).toEqual(entryFeePaid);
    expect(details.tournament.calcuttaBidsPaidIds).toEqual(calcuttaPaid);
    expect(details.tournament.playerPayoutPaidIds).toEqual(playerPayoutPaid);
    expect(details.tournament.ownerPayoutPaidIds).toEqual(ownerPayoutPaid);

    // Re-retrieve to verify persistence
    const reFetched = await db.getTournamentDetails(tournament.id);
    expect(reFetched?.tournament.entryFeePaidIds).toEqual(entryFeePaid);
    expect(reFetched?.tournament.calcuttaBidsPaidIds).toEqual(calcuttaPaid);
    expect(reFetched?.tournament.playerPayoutPaidIds).toEqual(playerPayoutPaid);
    expect(reFetched?.tournament.ownerPayoutPaidIds).toEqual(ownerPayoutPaid);
  });

  it('saves creatorEmail on creation and deletes tournament with its groups and matches successfully', async () => {
    const db = getDatabaseAdapter();
    const playersRoster = ['efren', 'svb', 'filler', 'gorst', 'shaw', 'strickland', 'albin', 'bustamante'];
    
    // Create with creatorEmail
    const creator = 'creator@admin.com';
    const tournament = await db.createTournament(
      'Deletion Test Tourney',
      '8-Ball',
      playersRoster,
      50,
      [60, 40],
      false,
      undefined,
      undefined,
      undefined,
      creator
    );

    expect(tournament.creatorEmail).toBe(creator);

    // Verify it exists in details
    let details = await db.getTournamentDetails(tournament.id);
    expect(details).toBeTruthy();
    expect(details?.tournament.id).toBe(tournament.id);
    expect(details?.tournament.creatorEmail).toBe(creator);
    expect(details?.groups.length).toBeGreaterThan(0);
    expect(details?.matches.length).toBeGreaterThan(0);

    // Delete tournament
    await db.deleteTournament(tournament.id);

    // Verify it is gone
    const list = await db.getTournaments();
    expect(list.some(t => t.id === tournament.id)).toBe(false);

    const reFetched = await db.getTournamentDetails(tournament.id);
    expect(reFetched).toBeNull();
  });

  it('swaps two players in different groups and regenerates their group matches successfully', async () => {
    const db = getDatabaseAdapter();
    // 16 players to form exactly 2 groups of 8
    const playersRoster = [
      'efren', 'svb', 'filler', 'gorst', 'shaw', 'strickland', 'albin', 'bustamante',
      'ko_pin_yi', 'pagulayan', 'john_doe', 'jane_smith', 'dave_c', 'sarah_j', 'mike_t', 'amy_w'
    ];

    const tournament = await db.createTournament(
      'Swap Test Tourney',
      '8-Ball',
      playersRoster,
      50,
      [60, 40],
      false
    );

    const details = await db.getTournamentDetails(tournament.id);
    expect(details).toBeTruthy();
    expect(details?.groups.length).toBe(2);

    const groupA = details!.groups[0];
    const groupB = details!.groups[1];

    const playerA = groupA.playerIds[0];
    const playerB = groupB.playerIds[0];

    // Swap playerA (Group A) and playerB (Group B)
    const updatedDetails = await db.swapTournamentPlayers(tournament.id, playerA, playerB);

    expect(updatedDetails).toBeTruthy();
    // Group A should now have playerB and not playerA
    const updatedGroupA = updatedDetails.groups.find(g => g.id === groupA.id);
    expect(updatedGroupA?.playerIds.includes(playerB)).toBe(true);
    expect(updatedGroupA?.playerIds.includes(playerA)).toBe(false);

    // Group B should now have playerA and not playerB
    const updatedGroupB = updatedDetails.groups.find(g => g.id === groupB.id);
    expect(updatedGroupB?.playerIds.includes(playerA)).toBe(true);
    expect(updatedGroupB?.playerIds.includes(playerB)).toBe(false);

    // Clean up
    await db.deleteTournament(tournament.id);
  });

  it('creates a new player and deletes them successfully', async () => {
    const db = getDatabaseAdapter();
    const playerName = 'Temporary Test Player';
    
    // Create new player
    const player = await db.createPlayer({
      name: playerName,
      skillLevel8: 5,
      skillLevel9: 5,
      skillLevel10: 5,
    });

    expect(player).toBeTruthy();
    expect(player.name).toBe(playerName);

    // Verify player is in database list
    let list = await db.getPlayers();
    expect(list.some(p => p.id === player.id)).toBe(true);

    // Delete player
    await db.deletePlayer(player.id);

    // Verify player is removed from list
    list = await db.getPlayers();
    expect(list.some(p => p.id === player.id)).toBe(false);
  });

  it('creates a new player and updates their details successfully', async () => {
    const db = getDatabaseAdapter();
    const player = await db.createPlayer({
      name: 'Old Name',
      skillLevel8: 10,
      skillLevel9: 10,
      skillLevel10: 10,
    });

    expect(player.name).toBe('Old Name');

    // Update details
    const updated = await db.updatePlayer(player.id, {
      name: 'New Name',
      skillLevel8: 12,
      skillLevel9: 13,
      skillLevel10: 14,
    });

    expect(updated.name).toBe('New Name');
    expect(updated.skillLevel8).toBe(12);
    expect(updated.skillLevel9).toBe(13);
    expect(updated.skillLevel10).toBe(14);

    // Verify it changed in database listing
    const list = await db.getPlayers();
    const found = list.find(p => p.id === player.id);
    expect(found?.name).toBe('New Name');

    // Clean up
    await db.deletePlayer(player.id);
  });

  it('records handicap change history when player handicaps are updated', async () => {
    const db = getDatabaseAdapter();
    const player = await db.createPlayer({
      name: 'History Test Player',
      skillLevel8: 10,
      skillLevel9: 10,
      skillLevel10: 10,
    });

    // 1. Update ONLY the name (no handicap change)
    await db.updatePlayer(player.id, {
      name: 'History Test Player Renamed',
      skillLevel8: 10,
      skillLevel9: 10,
      skillLevel10: 10,
    }, 'admin@rackmaster.com');

    // Verify no history is recorded yet
    let history = await db.getHandicapHistory(player.id);
    expect(history.length).toBe(0);

    // 2. Update handicaps (should record history)
    await db.updatePlayer(player.id, {
      name: 'History Test Player Renamed',
      skillLevel8: 12,
      skillLevel9: 10,
      skillLevel10: 15,
    }, 'admin@rackmaster.com');

    history = await db.getHandicapHistory(player.id);
    expect(history.length).toBe(1);

    const entry = history[0];
    expect(entry.playerId).toBe(player.id);
    expect(entry.oldSkillLevel8).toBe(10);
    expect(entry.oldSkillLevel9).toBe(10);
    expect(entry.oldSkillLevel10).toBe(10);
    expect(entry.newSkillLevel8).toBe(12);
    expect(entry.newSkillLevel9).toBe(10);
    expect(entry.newSkillLevel10).toBe(15);
    expect(entry.changedBy).toBe('admin@rackmaster.com');
    expect(entry.changedAt).toBeTruthy();

    // Clean up
    await db.deletePlayer(player.id);
  });
});

