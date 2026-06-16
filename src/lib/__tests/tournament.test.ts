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

  it('swaps knockout players in Round 1 matches and resets progression', async () => {
    const db = getDatabaseAdapter();
    
    // Create 8 players
    const createdPlayers: Player[] = [];
    for (let i = 0; i < 8; i++) {
      const p = await db.createPlayer({
        name: `KO Player ${i + 1}`,
        skillLevel8: 5,
        skillLevel9: 5,
        skillLevel10: 5,
      });
      createdPlayers.push(p);
    }

    // Create tournament
    const tournament = await db.createTournament(
      'Knockout Swap Test Tourney',
      '8-Ball',
      createdPlayers.map(p => p.id)
    );

    // Get tournament details
    let details = await db.getTournamentDetails(tournament.id);
    expect(details).toBeTruthy();

    // Auto-complete all group matches to seed knockout bracket
    const playGroupMatches = async (groupMatches: Match[]) => {
      let attempts = 0;
      let currentMatches = [...groupMatches];
      while (currentMatches.some(m => m.status !== 'completed') && attempts < 50) {
        attempts++;
        for (const match of currentMatches) {
          if (match.status !== 'completed' && match.player1Id && match.player2Id) {
            await db.updateMatchScore(
              tournament.id,
              match.id,
              match.player1Target,
              0,
              { breakAndRun: false, tableRun: false },
              { breakAndRun: false, tableRun: false }
            );
          }
        }
        const updated = await db.getTournamentDetails(tournament.id);
        currentMatches = updated?.matches.filter(m => m.groupId === groupMatches[0].groupId) || [];
      }
    };

    const groupMatches = details!.matches.filter(m => m.groupId === details!.groups[0].id);
    await playGroupMatches(groupMatches);

    // Refresh details to get the seeded knockout matches
    details = await db.getTournamentDetails(tournament.id);
    const knockoutMatches = details!.matches.filter(m => m.roundType === 'knockout');
    expect(knockoutMatches.length).toBeGreaterThan(0);

    const round1Matches = knockoutMatches.filter(m => m.roundNumber === 1);
    expect(round1Matches.length).toBe(2);

    // Pick two players from different Round 1 knockout matches to swap
    const playerA = round1Matches[0].player1Id;
    const playerB = round1Matches[1].player1Id;
    expect(playerA).toBeTruthy();
    expect(playerB).toBeTruthy();

    // Perform swap
    const swappedDetails = await db.swapKnockoutPlayers(tournament.id, playerA, playerB);
    const updatedMatches = swappedDetails.matches.filter(m => m.roundType === 'knockout');
    const updatedRound1 = updatedMatches.filter(m => m.roundNumber === 1);

    // Verify playerA and playerB swapped positions
    const matchContainingPlayerA = updatedRound1.find(m => m.player1Id === playerA || m.player2Id === playerA);
    const matchContainingPlayerB = updatedRound1.find(m => m.player1Id === playerB || m.player2Id === playerB);

    expect(matchContainingPlayerA?.id).toBe(round1Matches[1].id);
    expect(matchContainingPlayerB?.id).toBe(round1Matches[0].id);

    // Verify round 2 is empty/TBD
    const updatedRound2 = updatedMatches.filter(m => m.roundNumber > 1);
    updatedRound2.forEach(m => {
      expect(m.player1Id).toBe('');
      expect(m.player2Id).toBe('');
      expect(m.status).toBe('scheduled');
      expect(m.winnerId).toBeUndefined();
    });

    // Test validation: swapping a completed match should fail
    // Complete match 1
    const m1 = updatedRound1.find(m => m.id === round1Matches[0].id)!;
    await db.updateMatchScore(
      tournament.id,
      m1.id,
      m1.player1Target,
      0,
      { breakAndRun: false, tableRun: false },
      { breakAndRun: false, tableRun: false }
    );

    // Swapping now should throw an error since match 1 is completed
    await expect(
      db.swapKnockoutPlayers(tournament.id, m1.player1Id, playerB)
    ).rejects.toThrow('Cannot swap players in completed matches');

    // Clean up
    await db.deleteTournament(tournament.id);
    for (const p of createdPlayers) {
      await db.deletePlayer(p.id);
    }
  });

  it('saves and retrieves custom handicap races correctly and overrides race calculations by skill level combinations', async () => {
    const db = getDatabaseAdapter();

    // 1. Verify default races are populated for combinations (210 combinations per game type * 3 styles)
    const defaultRaces = await db.getHandicapRaces();
    expect(defaultRaces.length).toBe(3 * 210 * 3);

    // Check a default matchup combination: SL 9 vs SL 5 (Diff 4)
    const default9vs5 = defaultRaces.find(
      r => r.gameType === '9-Ball' && r.higherSkill === 9 && r.lowerSkill === 5 && (r.raceStyle || 'default') === 'default'
    );
    // Standard diff 4 calculation: higher target = 5 + ceil(4/2) = 7, lower target = 5 - floor(4/2) = 3
    expect(default9vs5?.higherTarget).toBe(7);
    expect(default9vs5?.lowerTarget).toBe(3);
    expect(default9vs5?.spottedBalls).toEqual([6, 7, 8]);

    // 2. Modify two different combinations that have the SAME difference (Diff 4) but different skill levels
    const modifiedRaces = defaultRaces.map(r => {
      if (r.gameType === '9-Ball' && r.higherSkill === 9 && r.lowerSkill === 5 && (r.raceStyle || 'default') === 'default') {
        return {
          ...r,
          higherTarget: 8,
          lowerTarget: 4,
          spottedBalls: [7, 8],
        };
      }
      if (r.gameType === '9-Ball' && r.higherSkill === 12 && r.lowerSkill === 8 && (r.raceStyle || 'default') === 'default') {
        return {
          ...r,
          higherTarget: 8,
          lowerTarget: 5,
          spottedBalls: [6, 7, 8],
        };
      }
      return r;
    });

    await db.updateHandicapRaces(modifiedRaces);

    // Verify both combinations updated individually
    const updatedRaces = await db.getHandicapRaces();
    const updated9vs5 = updatedRaces.find(
      r => r.gameType === '9-Ball' && r.higherSkill === 9 && r.lowerSkill === 5 && (r.raceStyle || 'default') === 'default'
    );
    expect(updated9vs5?.higherTarget).toBe(8);
    expect(updated9vs5?.lowerTarget).toBe(4);
    expect(updated9vs5?.spottedBalls).toEqual([7, 8]);

    const updated12vs8 = updatedRaces.find(
      r => r.gameType === '9-Ball' && r.higherSkill === 12 && r.lowerSkill === 8 && (r.raceStyle || 'default') === 'default'
    );
    expect(updated12vs8?.higherTarget).toBe(8);
    expect(updated12vs8?.lowerTarget).toBe(5);
    expect(updated12vs8?.spottedBalls).toEqual([6, 7, 8]);

    // 3. Test that calculateMatchHandicap respects the custom combinations correctly
    const isLocalStorageAvailable = typeof window !== 'undefined' && typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function' && typeof localStorage.removeItem === 'function';

    if (isLocalStorageAvailable) {
      localStorage.setItem('ptm_handicap_races', JSON.stringify(modifiedRaces));
    } else {
      const store: Record<string, string> = {
        ptm_handicap_races: JSON.stringify(modifiedRaces)
      };
      global.window = {
        localStorage: {
          getItem: (key: string) => store[key] || null,
          setItem: (key: string, val: string) => { store[key] = val; },
          removeItem: (key: string) => { delete store[key]; },
        }
      } as any;
      global.localStorage = global.window.localStorage;
    }

    const p12: Player = { id: 'p12', name: 'SL12 Player', skillLevel8: 12, skillLevel9: 12, skillLevel10: 12, createdAt: '' };
    const p9: Player = { id: 'p9', name: 'SL9 Player', skillLevel8: 9, skillLevel9: 9, skillLevel10: 9, createdAt: '' };
    const p8: Player = { id: 'p8', name: 'SL8 Player', skillLevel8: 8, skillLevel9: 8, skillLevel10: 8, createdAt: '' };
    const p5: Player = { id: 'p5', name: 'SL5 Player', skillLevel8: 5, skillLevel9: 5, skillLevel10: 5, createdAt: '' };
    const p10: Player = { id: 'p10', name: 'SL10 Player', skillLevel8: 10, skillLevel9: 10, skillLevel10: 10, createdAt: '' };
    const p6: Player = { id: 'p6', name: 'SL6 Player', skillLevel8: 6, skillLevel9: 6, skillLevel10: 6, createdAt: '' };

    // Matchup 1: SL 9 vs SL 5 (Modified to 8 vs 4, spot 7/8)
    const hc9vs5 = calculateMatchHandicap(p9, p5, '9-Ball');
    expect(hc9vs5.player1Target).toBe(8);
    expect(hc9vs5.player2Target).toBe(4);
    expect(hc9vs5.player2SpottedBalls).toEqual([7, 8]);

    // Matchup 2: SL 12 vs SL 8 (Modified to 8 vs 5, spot 6/7/8)
    const hc12vs8 = calculateMatchHandicap(p12, p8, '9-Ball');
    expect(hc12vs8.player1Target).toBe(8);
    expect(hc12vs8.player2Target).toBe(5);
    expect(hc12vs8.player2SpottedBalls).toEqual([6, 7, 8]);

    // Matchup 3: SL 10 vs SL 6 (Unmodified Diff 4, should fall back to standard formula: 7 vs 3)
    const hc10vs6 = calculateMatchHandicap(p10, p6, '9-Ball');
    expect(hc10vs6.player1Target).toBe(7);
    expect(hc10vs6.player2Target).toBe(3);
    expect(hc10vs6.player2SpottedBalls).toEqual([6, 7, 8]);

    // Cleanup global mock
    if (isLocalStorageAvailable) {
      localStorage.removeItem('ptm_handicap_races');
    } else {
      delete (global as any).window;
      delete (global as any).localStorage;
    }

    // Reset adapter back to defaults
    await db.updateHandicapRaces(defaultRaces);
  });

  it('supports multiple handicap race styles and propagates them to tournaments and matches', async () => {
    const db = getDatabaseAdapter();
    const defaultRaces = await db.getHandicapRaces();

    // 1. Modify the custom 'short' style for SL 9 vs SL 5
    const modifiedRaces = defaultRaces.map(r => {
      if (r.gameType === '9-Ball' && r.higherSkill === 9 && r.lowerSkill === 5) {
        if (r.raceStyle === 'short') {
          return { ...r, higherTarget: 4, lowerTarget: 2, spottedBalls: [] };
        } else if (r.raceStyle === 'default') {
          return { ...r, higherTarget: 8, lowerTarget: 4, spottedBalls: [7, 8] };
        }
      }
      return r;
    });

    await db.updateHandicapRaces(modifiedRaces);

    // Mock localStorage to simulate client-side calculation
    const isLocalStorageAvailable = typeof window !== 'undefined' && typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function' && typeof localStorage.removeItem === 'function';
    if (isLocalStorageAvailable) {
      localStorage.setItem('ptm_handicap_races', JSON.stringify(modifiedRaces));
    } else {
      const store: Record<string, string> = {
        ptm_handicap_races: JSON.stringify(modifiedRaces)
      };
      global.window = {
        localStorage: {
          getItem: (key: string) => store[key] || null,
          setItem: (key: string, val: string) => { store[key] = val; },
          removeItem: (key: string) => { delete store[key]; },
        }
      } as any;
      global.localStorage = global.window.localStorage;
    }

    const p9: Player = { id: 'p9', name: 'SL9 Player', skillLevel8: 9, skillLevel9: 9, skillLevel10: 9, createdAt: '' };
    const p5: Player = { id: 'p5', name: 'SL5 Player', skillLevel8: 5, skillLevel9: 5, skillLevel10: 5, createdAt: '' };

    // Test distinct calculations for short vs default style
    const hcShort = calculateMatchHandicap(p9, p5, '9-Ball', 'short');
    expect(hcShort.player1Target).toBe(4);
    expect(hcShort.player2Target).toBe(2);

    const hcDefault = calculateMatchHandicap(p9, p5, '9-Ball', 'default');
    expect(hcDefault.player1Target).toBe(8);
    expect(hcDefault.player2Target).toBe(4);

    // 2. Register players in database to seed tournament
    const playerA = await db.createPlayer({ name: 'A', skillLevel8: 9, skillLevel9: 9, skillLevel10: 9 });
    const playerB = await db.createPlayer({ name: 'B', skillLevel8: 5, skillLevel9: 5, skillLevel10: 5 });
    
    // Create remaining 6 players for group stage
    const otherIds: string[] = [];
    for (let i = 0; i < 6; i++) {
      const p = await db.createPlayer({ name: `P${i}`, skillLevel8: 5, skillLevel9: 5, skillLevel10: 5 });
      otherIds.push(p.id);
    }

    // 3. Create a tournament using 'short' style
    const tournament = await db.createTournament(
      'Short Style Tournament',
      '9-Ball',
      [playerA.id, playerB.id, ...otherIds],
      10,
      [70, 30],
      false,
      undefined,
      undefined,
      undefined,
      undefined,
      'short'
    );

    expect(tournament.handicapRaceStyle).toBe('short');

    // Retrieve tournament details to inspect matches
    const details = await db.getTournamentDetails(tournament.id);
    expect(details).not.toBeNull();
    
    // Find the match where playerA (SL9) plays in Round 1
    const match = details!.matches.find(
      m => m.roundNumber === 1 && m.roundType === 'group_winners' &&
           (m.player1Id === playerA.id || m.player2Id === playerA.id)
    );

    expect(match).toBeDefined();
    expect(match?.handicapRaceStyle).toBe('short');
    
    // Check targets: playerA is SL 9, opponent is SL 5. In short style, targets must be 4 and 2.
    if (match?.player1Id === playerA.id) {
      expect(match?.player1Target).toBe(4);
      expect(match?.player2Target).toBe(2);
    } else {
      expect(match?.player1Target).toBe(2);
      expect(match?.player2Target).toBe(4);
    }

    // Clean up
    await db.deleteTournament(tournament.id);
    await db.deletePlayer(playerA.id);
    await db.deletePlayer(playerB.id);
    for (const id of otherIds) {
      await db.deletePlayer(id);
    }
    
    if (isLocalStorageAvailable) {
      localStorage.removeItem('ptm_handicap_races');
    } else {
      delete (global as any).window;
      delete (global as any).localStorage;
    }
    await db.updateHandicapRaces(defaultRaces);
  });

  it('saves and retrieves owner payout paid ids with granular segment identifiers', async () => {
    const db = getDatabaseAdapter();
    const playersRoster = ['efren', 'svb', 'filler', 'gorst', 'shaw', 'strickland', 'albin', 'bustamante'];
    const tournament = await db.createTournament(
      'Payment Segments Test',
      '8-Ball',
      playersRoster,
      50,
      [60, 40]
    );

    const initialDetails = await db.getTournamentDetails(tournament.id);
    expect(initialDetails?.tournament.ownerPayoutPaidIds).toBeFalsy();

    // Settle some segments specifically
    const ownerPayoutPaid = ['efren-player', 'svb-owner', 'filler-owner2'];
    const updatedDetails = await db.updateTournamentPayments(
      tournament.id,
      [],
      [],
      [],
      ownerPayoutPaid
    );

    expect(updatedDetails.tournament.ownerPayoutPaidIds).toEqual(ownerPayoutPaid);

    // Retrieve again to verify persistence
    const reFetched = await db.getTournamentDetails(tournament.id);
    expect(reFetched?.tournament.ownerPayoutPaidIds).toEqual(ownerPayoutPaid);

    // Clean up
    await db.deleteTournament(tournament.id);
  });

  it('cascades player handicap update to incomplete matches in active tournaments', async () => {
    const db = getDatabaseAdapter();
    const playersRoster = ['efren', 'svb', 'filler', 'gorst', 'shaw', 'strickland', 'albin', 'bustamante'];
    
    // Create a tournament
    const tournament = await db.createTournament(
      'Handicap Cascade Test',
      '9-Ball',
      playersRoster,
      10,
      [100]
    );

    // Start tournament to make status 'active' and generate group matches
    const details = await db.startTournament(tournament.id, []);
    expect(details.tournament.status).toBe('active');

    // Find a match with efren (e.g. Efren Reyes vs Shane Van Boening)
    const match = details.matches.find(m => m.player1Id === 'efren' || m.player2Id === 'efren');
    expect(match).toBeDefined();
    expect(match?.status).toBe('scheduled');
    
    const initialTarget1 = match?.player1Target;
    const initialTarget2 = match?.player2Target;

    // Fetch efren's original details
    const efren = details.players.find(p => p.id === 'efren');
    expect(efren).toBeDefined();

    if (efren && match) {
      // Modify efren's 9-ball skill level drastically (e.g. from 22 to 3)
      const updatedEfren = await db.updatePlayer('efren', {
        name: efren.name,
        skillLevel8: efren.skillLevel8,
        skillLevel9: 3, // drop to lowest skill level
        skillLevel10: efren.skillLevel10,
      });

      expect(updatedEfren.skillLevel9).toBe(3);

      // Fetch tournament details again to check updated matches
      const updatedDetails = await db.getTournamentDetails(tournament.id);
      const updatedMatch = updatedDetails?.matches.find(m => m.id === match.id);
      expect(updatedMatch).toBeDefined();
      
      // Since efren's handicap went down drastically, the targets should have recalculated and changed
      expect(updatedMatch?.player1Target).not.toBe(initialTarget1);
      expect(updatedMatch?.player2Target).not.toBe(initialTarget2);
    }

    // Clean up
    await db.deleteTournament(tournament.id);
    // Reset efren's skill level back to original 22
    if (efren) {
      await db.updatePlayer('efren', {
        name: efren.name,
        skillLevel8: efren.skillLevel8,
        skillLevel9: 22,
        skillLevel10: efren.skillLevel10,
      });
    }
  });

  it('correctly sets custom handicapRaceStyle when seeding single elimination knockout matches', () => {
    const playersMap: Record<string, Player> = {
      p1: { id: 'p1', name: 'Player 1', skillLevel8: 10, skillLevel9: 10, skillLevel10: 10, createdAt: '' },
      p2: { id: 'p2', name: 'Player 2', skillLevel8: 10, skillLevel9: 10, skillLevel10: 10, createdAt: '' },
    };
    const qualifiersList = [
      { groupId: 'g1', winners: ['p1'], losers: ['p2'] }
    ];

    const matches = seedSingleElimination('test_tourney', qualifiersList, playersMap, '9-Ball', 'short');
    expect(matches.length).toBeGreaterThan(0);
    matches.forEach(m => {
      expect(m.handicapRaceStyle).toBe('short');
    });
  });

  it('manually recalculates match handicaps using recalculateMatchHandicap method', async () => {
    const db = getDatabaseAdapter();
    const playersRoster = ['efren', 'svb', 'filler', 'gorst', 'shaw', 'strickland', 'albin', 'bustamante'];
    const tournament = await db.createTournament(
      'Manual Recalc Test',
      '9-Ball',
      playersRoster,
      10,
      [100]
    );

    const details = await db.startTournament(tournament.id, []);
    const match = details.matches.find(m => m.player1Id === 'efren' || m.player2Id === 'efren');
    expect(match).toBeDefined();

    if (match) {
      // Set target races manually to check recalculation later
      match.player1Target = 99;
      match.player2Target = 99;

      const currentMatches = (db as any).getStorageItem('ptm_matches', []);
      const idx = currentMatches.findIndex((m: any) => m.id === match.id);
      if (idx !== -1) {
        currentMatches[idx] = match;
        (db as any).setStorageItem('ptm_matches', currentMatches);
      }

      // Now run recalculation
      const updatedDetails = await db.recalculateMatchHandicap(tournament.id, match.id);
      const updatedMatch = updatedDetails.matches.find(m => m.id === match.id);
      expect(updatedMatch).toBeDefined();
      expect(updatedMatch?.player1Target).not.toBe(99);
      expect(updatedMatch?.player2Target).not.toBe(99);
    }

    await db.deleteTournament(tournament.id);
  });

  it('correctly retrieves and returns custom spots/ball handicap for 8-Ball matchups', () => {
    const customRaceSetting = {
      gameType: '8-Ball',
      higherSkill: 6,
      lowerSkill: 5,
      raceStyle: 'default',
      higherTarget: 5,
      lowerTarget: 4,
      spottedBalls: [1],
    };

    const isLocalStorageAvailable = typeof window !== 'undefined' && typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function' && typeof localStorage.removeItem === 'function';
    if (isLocalStorageAvailable) {
      localStorage.setItem('ptm_handicap_races', JSON.stringify([customRaceSetting]));
    } else {
      const store: Record<string, string> = {
        ptm_handicap_races: JSON.stringify([customRaceSetting])
      };
      global.window = {
        localStorage: {
          getItem: (key: string) => store[key] || null,
          setItem: (key: string, val: string) => { store[key] = val; },
          removeItem: (key: string) => { delete store[key]; },
        }
      } as any;
      global.localStorage = global.window.localStorage;
    }

    const p1: Player = { id: 'p1', name: 'Player 1', skillLevel8: 6, skillLevel9: 6, skillLevel10: 6, createdAt: '' };
    const p2: Player = { id: 'p2', name: 'Player 2', skillLevel8: 5, skillLevel9: 5, skillLevel10: 5, createdAt: '' };

    const handicap = calculateMatchHandicap(p1, p2, '8-Ball', 'default');
    expect(handicap.player1Target).toBe(5);
    expect(handicap.player2Target).toBe(4);
    expect(handicap.player2SpottedBalls).toEqual([1]);
    expect(handicap.player1SpottedBalls).toEqual([]);

    if (isLocalStorageAvailable) {
      localStorage.removeItem('ptm_handicap_races');
    } else {
      delete (global as any).window;
      delete (global as any).localStorage;
    }
  });

  it('supports swapping a player with a BYE player in Round 1 of knockout stage and correctly resets/auto-resolves matches', async () => {
    const db = getDatabaseAdapter();

    // 1. Create a set of 9 players to ensure 3 groups are created, producing 9 real qualifiers (not a power of 2)
    const playersRoster: string[] = [];
    for (let i = 1; i <= 9; i++) {
      const p = await db.createPlayer({
        name: `Real Player ${i}`,
        skillLevel8: 10,
        skillLevel9: 10,
        skillLevel10: 10,
      });
      playersRoster.push(p.id);
    }

    // 2. Create the tournament. Seeding 9 players will pad to 24 (3 groups of 8).
    const tournament = await db.createTournament(
      'Knockout BYE Swap Test',
      '9-Ball',
      playersRoster,
      10,
      [100]
    );

    // 3. Start tournament (status -> active) and generate group matches
    let details = await db.startTournament(tournament.id, []);
    expect(details.tournament.status).toBe('active');

    // 4. Force complete all group matches to trigger knockout bracket generation
    const groupMatches = details.matches.filter(m => m.roundType === 'group_winners' || m.roundType === 'group_losers');
    for (const m of groupMatches) {
      if (m.status !== 'completed') {
        details = await db.updateMatchScore(
          tournament.id,
          m.id,
          m.player1Target,
          0,
          { breakAndRun: false, tableRun: false },
          { breakAndRun: false, tableRun: false }
        );
      }
    }

    // After completing group stage, knockout matches must exist
    let knockoutMatches = details.matches.filter(m => m.roundType === 'knockout');
    expect(knockoutMatches.length).toBeGreaterThan(0);

    // Round 1 knockout matches: find one with a BYE and one with a real matchup or another BYE
    const byeMatch = knockoutMatches.find(m => m.roundNumber === 1 && (m.player1Id.includes('BYE') || m.player2Id.includes('BYE')));
    expect(byeMatch).toBeDefined();
    expect(byeMatch?.status).toBe('completed'); // Bye matches auto-complete

    // Find the players in byeMatch: one real player and one BYE player
    const realPlayerId = byeMatch?.player1Id.includes('BYE') ? byeMatch?.player2Id : byeMatch?.player1Id;
    const byePlayerId = byeMatch?.player1Id.includes('BYE') ? byeMatch?.player1Id : byeMatch?.player2Id;
    expect(realPlayerId).toBeDefined();
    expect(byePlayerId).toBeDefined();

    // Find a Round 1 match containing two real players to swap with
    const otherMatch = knockoutMatches.find(m => m.roundNumber === 1 && !m.player1Id.includes('BYE') && !m.player2Id.includes('BYE'));
    expect(otherMatch).toBeDefined();
    
    const otherPlayerId = otherMatch?.player1Id;
    expect(otherPlayerId).toBeDefined();

    // 5. Swap the real player from the other match with the BYE player in the BYE match
    const updatedDetails = await db.swapKnockoutPlayers(
      tournament.id,
      otherPlayerId!,
      byePlayerId!
    );

    // 6. Verify swap result
    const updatedKnockout = updatedDetails.matches.filter(m => m.roundType === 'knockout');
    const updatedByeMatch = updatedKnockout.find(m => m.id === byeMatch?.id);
    const updatedOtherMatch = updatedKnockout.find(m => m.id === otherMatch?.id);

    // The match that previously had a BYE and was completed should now contain two real players
    // and its status should be reset to scheduled with score 0
    expect(updatedByeMatch?.player1Id === otherPlayerId || updatedByeMatch?.player2Id === otherPlayerId).toBe(true);
    expect(updatedByeMatch?.status).toBe('scheduled');
    expect(updatedByeMatch?.winnerId).toBeUndefined();
    expect(updatedByeMatch?.player1Score).toBe(0);
    expect(updatedByeMatch?.player2Score).toBe(0);

    // The match that now contains the BYE player should auto-complete
    expect(updatedOtherMatch?.player1Id === byePlayerId || updatedOtherMatch?.player2Id === byePlayerId).toBe(true);
    expect(updatedOtherMatch?.status).toBe('completed');
    expect(updatedOtherMatch?.winnerId).toBeDefined();
    expect(updatedOtherMatch?.winnerId).not.toContain('BYE');

    // Clean up
    await db.deleteTournament(tournament.id);
    for (const pid of playersRoster) {
      await db.deletePlayer(pid);
    }
  });
});

