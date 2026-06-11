import { Player, Match, Group, GameType } from '../types';
import { calculateMatchHandicap } from './handicap';

/**
 * Double Elimination Match progression map for 8-player group.
 * Group match numbers are 1-10.
 */
interface ProgressionRule {
  onWin: { type: 'match' | 'qualify'; id: number; slot: 1 | 2 };
  onLoss: { type: 'match' | 'eliminate' | 'qualify'; id?: number; slot?: 1 | 2 };
}

export const DE_PROGRESSION: Record<number, ProgressionRule> = {
  // First Round (Middle Column)
  1: {
    onWin: { type: 'match', id: 9, slot: 1 },
    onLoss: { type: 'match', id: 7, slot: 1 },
  },
  2: {
    onWin: { type: 'match', id: 9, slot: 2 },
    onLoss: { type: 'match', id: 7, slot: 2 },
  },
  3: {
    onWin: { type: 'match', id: 10, slot: 1 },
    onLoss: { type: 'match', id: 8, slot: 1 },
  },
  4: {
    onWin: { type: 'match', id: 10, slot: 2 },
    onLoss: { type: 'match', id: 8, slot: 2 },
  },
  // Round 3 Losers (Far-Left Column)
  5: {
    onWin: { type: 'qualify', id: 3, slot: 1 },
    onLoss: { type: 'eliminate' },
  },
  6: {
    onWin: { type: 'qualify', id: 4, slot: 1 },
    onLoss: { type: 'eliminate' },
  },
  // Round 2 Losers (Left-Middle Column)
  7: {
    onWin: { type: 'match', id: 5, slot: 1 },
    onLoss: { type: 'eliminate' },
  },
  8: {
    onWin: { type: 'match', id: 6, slot: 1 },
    onLoss: { type: 'eliminate' },
  },
  // Round 2 Winners (Right Column)
  9: {
    onWin: { type: 'qualify', id: 1, slot: 1 },
    onLoss: { type: 'match', id: 6, slot: 2 },
  },
  10: {
    onWin: { type: 'qualify', id: 2, slot: 1 },
    onLoss: { type: 'match', id: 5, slot: 2 },
  },
};

/**
 * Initializes a staggered 8-player Double Elimination group stage.
 */
export function initializeGroupMatches(
  tournamentId: string,
  group: Group,
  playersMap: Record<string, Player>,
  gameType: GameType
): Match[] {
  const matches: Match[] = [];
  const pIds = group.playerIds; // Exactly 8 player IDs

  // Define the 10 matches in the staggered DE bracket
  const matchSetups = [
    // Round 1 (All 8 players play in Matches 1-4)
    { matchNumber: 1, p1: pIds[0], p2: pIds[1] },
    { matchNumber: 2, p1: pIds[2], p2: pIds[3] },
    { matchNumber: 3, p1: pIds[4], p2: pIds[5] },
    { matchNumber: 4, p1: pIds[6], p2: pIds[7] },
    // Round 3 Losers
    { matchNumber: 5, p1: '', p2: '' },
    { matchNumber: 6, p1: '', p2: '' },
    // Round 2 Losers
    { matchNumber: 7, p1: '', p2: '' },
    { matchNumber: 8, p1: '', p2: '' },
    // Round 2 Winners
    { matchNumber: 9, p1: '', p2: '' },
    { matchNumber: 10, p1: '', p2: '' },
  ];

  const now = new Date().toISOString();

  for (const setup of matchSetups) {
    const player1 = setup.p1 ? playersMap[setup.p1] : null;
    const player2 = setup.p2 ? playersMap[setup.p2] : null;

    let target1 = 1;
    let target2 = 1;
    let spot1: number[] = [];
    let spot2: number[] = [];

    if (player1 && player2) {
      const handicap = calculateMatchHandicap(player1, player2, gameType);
      target1 = handicap.player1Target;
      target2 = handicap.player2Target;
      spot1 = handicap.player1SpottedBalls;
      spot2 = handicap.player2SpottedBalls;
    }

    let roundType: 'group_winners' | 'group_losers' = 'group_winners';
    let roundNumber = 1;

    if (setup.matchNumber >= 1 && setup.matchNumber <= 4) {
      roundType = 'group_winners';
      roundNumber = 1;
    } else if (setup.matchNumber === 9 || setup.matchNumber === 10) {
      roundType = 'group_winners';
      roundNumber = 2;
    } else if (setup.matchNumber === 7 || setup.matchNumber === 8) {
      roundType = 'group_losers';
      roundNumber = 1;
    } else {
      // Matches 5 and 6
      roundType = 'group_losers';
      roundNumber = 2;
    }

    const match: Match = {
      id: `${group.id}_m${setup.matchNumber}`,
      tournamentId,
      groupId: group.id,
      roundType,
      roundNumber,
      matchNumber: setup.matchNumber,
      player1Id: setup.p1 || '',
      player2Id: setup.p2 || '',
      player1Score: 0,
      player2Score: 0,
      player1Target: target1,
      player2Target: target2,
      player1SpottedBalls: spot1,
      player2SpottedBalls: spot2,
      status: 'scheduled',
      createdAt: now,
    };

    matches.push(match);
  }

  // Auto-resolve matches with BYEs in Round 1
  resolveByeMatches(matches, playersMap, gameType);

  return matches;
}

/**
 * Auto-resolves any matches that contain BYE players.
 */
export function resolveByeMatches(
  matches: Match[],
  playersMap: Record<string, Player>,
  gameType: GameType
): boolean {
  let changed = false;

  for (const m of matches) {
    if (m.status !== 'scheduled' || !m.player1Id || !m.player2Id) continue;

    const p1 = playersMap[m.player1Id];
    const p2 = playersMap[m.player2Id];

    if (!p1 || !p2) continue;

    if (p1.isBye && p2.isBye) {
      // Both are BYEs, advance player 1
      m.status = 'completed';
      m.winnerId = p1.id;
      m.player1Score = m.player1Target;
      m.player2Score = 0;
      changed = true;
    } else if (p1.isBye) {
      // Player 2 wins by BYE
      m.status = 'completed';
      m.winnerId = p2.id;
      m.player2Score = m.player2Target;
      m.player1Score = 0;
      changed = true;
    } else if (p2.isBye) {
      // Player 1 wins by BYE
      m.status = 'completed';
      m.winnerId = p1.id;
      m.player1Score = m.player1Target;
      m.player2Score = 0;
      changed = true;
    }

    if (changed) {
      advanceDoubleEliminationMatch(m, matches, playersMap, gameType);
    }
  }

  return changed;
}

/**
 * Advances players through the Double Elimination bracket based on match completion.
 */
export function advanceDoubleEliminationMatch(
  completedMatch: Match,
  groupMatches: Match[],
  playersMap: Record<string, Player>,
  gameType: GameType
): void {
  const rule = DE_PROGRESSION[completedMatch.matchNumber];
  if (!rule || completedMatch.status !== 'completed' || !completedMatch.winnerId) return;

  const winnerId = completedMatch.winnerId;
  const loserId = completedMatch.player1Id === winnerId ? completedMatch.player2Id : completedMatch.player1Id;

  // 1. Process Winner
  if (rule.onWin.type === 'match') {
    const destMatch = groupMatches.find(m => m.matchNumber === rule.onWin.id);
    if (destMatch) {
      if (rule.onWin.slot === 1) {
        destMatch.player1Id = winnerId;
      } else {
        destMatch.player2Id = winnerId;
      }
      
      // Update targets if both players are set
      updateMatchTargets(destMatch, playersMap, gameType);
    }
  }

  // 2. Process Loser
  if (rule.onLoss.type === 'match' && rule.onLoss.id) {
    const destMatch = groupMatches.find(m => m.matchNumber === rule.onLoss.id);
    if (destMatch) {
      if (rule.onLoss.slot === 1) {
        destMatch.player1Id = loserId;
      } else {
        destMatch.player2Id = loserId;
      }

      // Update targets if both players are set
      updateMatchTargets(destMatch, playersMap, gameType);
    }
  }

  // Recursively run to auto-resolve any newly populated BYE matches
  resolveByeMatches(groupMatches, playersMap, gameType);
}

function updateMatchTargets(match: Match, playersMap: Record<string, Player>, gameType: GameType) {
  if (match.player1Id && match.player2Id) {
    const p1 = playersMap[match.player1Id];
    const p2 = playersMap[match.player2Id];
    if (p1 && p2) {
      const hc = calculateMatchHandicap(p1, p2, gameType);
      match.player1Target = hc.player1Target;
      match.player2Target = hc.player2Target;
      match.player1SpottedBalls = hc.player1SpottedBalls;
      match.player2SpottedBalls = hc.player2SpottedBalls;
    }
  }
}

/**
 * Collects qualifiers from all groups of a tournament.
 * Returns arrays of:
 * - Winners side qualifiers (0 losses)
 * - Losers side qualifiers (1 loss)
 */
export interface GroupQualifiers {
  groupId: string;
  winners: string[]; // Length 2
  losers: string[]; // Length 2
}

export function getGroupQualifiers(group: Group, matches: Match[]): GroupQualifiers {
  const groupMatches = matches.filter(m => m.groupId === group.id);
  
  // Winners are the winners of Matches 9 and 10
  const m9 = groupMatches.find(m => m.matchNumber === 9);
  const m10 = groupMatches.find(m => m.matchNumber === 10);
  const winners: string[] = [];
  if (m9?.status === 'completed' && m9.winnerId) winners.push(m9.winnerId);
  if (m10?.status === 'completed' && m10.winnerId) winners.push(m10.winnerId);

  // Losers are the winners of Matches 5 and 6
  const m5 = groupMatches.find(m => m.matchNumber === 5);
  const m6 = groupMatches.find(m => m.matchNumber === 6);
  const losers: string[] = [];
  if (m5?.status === 'completed' && m5.winnerId) losers.push(m5.winnerId);
  if (m6?.status === 'completed' && m6.winnerId) losers.push(m6.winnerId);

  return {
    groupId: group.id,
    winners,
    losers,
  };
}

/**
 * Seeds the Single Elimination Knockout stage from group qualifiers.
 * Generates group-avoidance matchups.
 */
export function seedSingleElimination(
  tournamentId: string,
  qualifiersList: GroupQualifiers[],
  playersMap: Record<string, Player>,
  gameType: GameType
): Match[] {
  // 1. Collect all Winners and Losers
  const allWinners: { id: string; groupId: string }[] = [];
  const allLosers: { id: string; groupId: string }[] = [];

  for (const q of qualifiersList) {
    for (const w of q.winners) {
      if (!playersMap[w]?.isBye) {
        allWinners.push({ id: w, groupId: q.groupId });
      }
    }
    for (const l of q.losers) {
      if (!playersMap[l]?.isBye) {
        allLosers.push({ id: l, groupId: q.groupId });
      }
    }
  }

  const numRealQualifiers = allWinners.length + allLosers.length;
  if (numRealQualifiers === 0) return [];

  // Determine bracket size S (next power of 2)
  let bracketSize = 2;
  while (bracketSize < numRealQualifiers) {
    bracketSize *= 2;
  }

  // Create temporary BYEs if we need to pad the Single Elimination bracket
  const numByesNeeded = bracketSize - numRealQualifiers;
  const byePlayers: Player[] = [];
  for (let i = 0; i < numByesNeeded; i++) {
    const byeId = `SE_BYE_${i}`;
    byePlayers.push({
      id: byeId,
      name: 'BYE',
      skillLevel8: 2,
      skillLevel9: 2,
      skillLevel10: 2,
      createdAt: new Date().toISOString(),
      isBye: true,
    });
  }

  // Combine real players + BYEs
  // To reward the Winners, we pair Winners against Losers from other groups first.
  // If we have remaining slots, we fill with BYEs (Winners get the BYEs first).
  const matches: Match[] = [];
  const now = new Date().toISOString();

  // Create full list of slots
  // We want to construct bracketSize/2 matches for Round 1.
  const numMatches = bracketSize / 2;

  // Let's pair them up.
  // Group-avoidance algorithm:
  // Sort Winners and Losers. For each Winner, try to find a Loser from a different group.
  const pairs: { p1: string; p2: string }[] = [];
  const usedWinners = new Set<string>();
  const usedLosers = new Set<string>();

  // Helper map of all players to include BYEs in playersMap
  const extendedPlayersMap = { ...playersMap };
  for (const bye of byePlayers) {
    extendedPlayersMap[bye.id] = bye;
  }

  // 1. First pair Winners with Losers from DIFFERENT groups
  for (const w of allWinners) {
    // Find a loser from a different group
    const partner = allLosers.find(l => l.groupId !== w.groupId && !usedLosers.has(l.id));
    if (partner) {
      pairs.push({ p1: w.id, p2: partner.id });
      usedWinners.add(w.id);
      usedLosers.add(partner.id);
    }
  }

  // 2. Pair remaining Winners with remaining Losers (even if same group, though should be avoided if possible)
  for (const w of allWinners) {
    if (usedWinners.has(w.id)) continue;
    const partner = allLosers.find(l => !usedLosers.has(l.id));
    if (partner) {
      pairs.push({ p1: w.id, p2: partner.id });
      usedWinners.add(w.id);
      usedLosers.add(partner.id);
    }
  }

  // 3. For any remaining Winners, pair with BYEs
  let byeIdx = 0;
  for (const w of allWinners) {
    if (usedWinners.has(w.id)) continue;
    if (byeIdx < byePlayers.length) {
      pairs.push({ p1: w.id, p2: byePlayers[byeIdx].id });
      usedWinners.add(w.id);
      byeIdx++;
    }
  }

  // 4. For any remaining Losers, pair with BYEs
  for (const l of allLosers) {
    if (usedLosers.has(l.id)) continue;
    if (byeIdx < byePlayers.length) {
      pairs.push({ p1: l.id, p2: byePlayers[byeIdx].id });
      usedLosers.add(l.id);
      byeIdx++;
    }
  }

  // 5. If there are still BYEs left, pair BYE with BYE (edge case)
  while (byeIdx < byePlayers.length - 1) {
    pairs.push({ p1: byePlayers[byeIdx].id, p2: byePlayers[byeIdx + 1].id });
    byeIdx += 2;
  }

  // Generate the actual matches for Round 1 of Single Elimination
  for (let i = 0; i < numMatches; i++) {
    const pair = pairs[i] || { p1: '', p2: '' };
    const p1 = pair.p1 ? extendedPlayersMap[pair.p1] : null;
    const p2 = pair.p2 ? extendedPlayersMap[pair.p2] : null;

    let target1 = 1;
    let target2 = 1;
    let spot1: number[] = [];
    let spot2: number[] = [];

    if (p1 && p2) {
      const hc = calculateMatchHandicap(p1, p2, gameType);
      target1 = hc.player1Target;
      target2 = hc.player2Target;
      spot1 = hc.player1SpottedBalls;
      spot2 = hc.player2SpottedBalls;
    }

    matches.push({
      id: `se_r1_m${i + 1}`,
      tournamentId,
      roundType: 'knockout',
      roundNumber: 1,
      matchNumber: i + 1,
      player1Id: pair.p1,
      player2Id: pair.p2,
      player1Score: 0,
      player2Score: 0,
      player1Target: target1,
      player2Target: target2,
      player1SpottedBalls: spot1,
      player2SpottedBalls: spot2,
      status: 'scheduled',
      createdAt: now,
    });
  }

  // Generate placeholder matches for subsequent rounds in the SE tree
  // Round 2 will have numMatches / 2 matches, Round 3 has numMatches / 4, etc.
  let currentRoundMatchesCount = numMatches / 2;
  let roundNum = 2;
  while (currentRoundMatchesCount >= 1) {
    for (let i = 0; i < currentRoundMatchesCount; i++) {
      matches.push({
        id: `se_r${roundNum}_m${i + 1}`,
        tournamentId,
        roundType: 'knockout',
        roundNumber: roundNum,
        matchNumber: i + 1,
        player1Id: '',
        player2Id: '',
        player1Score: 0,
        player2Score: 0,
        player1Target: 1,
        player2Target: 1,
        player1SpottedBalls: [],
        player2SpottedBalls: [],
        status: 'scheduled',
        createdAt: now,
      });
    }
    currentRoundMatchesCount /= 2;
    roundNum++;
  }

  // Auto-resolve any BYEs in the first round of Single Elimination
  resolveByeMatches(matches, extendedPlayersMap, gameType);
  advanceKnockoutMatches(matches, extendedPlayersMap, gameType);

  return matches;
}

/**
 * Progresses winners in the Single Elimination bracket.
 */
export function advanceKnockoutMatches(
  seMatches: Match[],
  playersMap: Record<string, Player>,
  gameType: GameType
): boolean {
  let changed = false;

  // Run through rounds sequentially to bubble up winners
  const maxRound = Math.max(...seMatches.map(m => m.roundNumber));

  for (let r = 1; r < maxRound; r++) {
    const roundMatches = seMatches.filter(m => m.roundNumber === r);
    for (const m of roundMatches) {
      if (m.status !== 'completed' || !m.winnerId) continue;

      const nextRoundNum = r + 1;
      const nextMatchNum = Math.ceil(m.matchNumber / 2);
      const isPlayer1Slot = m.matchNumber % 2 !== 0;

      const destMatch = seMatches.find(
        nm => nm.roundNumber === nextRoundNum && nm.matchNumber === nextMatchNum
      );

      if (destMatch) {
        const currentSlotId = isPlayer1Slot ? destMatch.player1Id : destMatch.player2Id;
        if (currentSlotId !== m.winnerId) {
          if (isPlayer1Slot) {
            destMatch.player1Id = m.winnerId;
          } else {
            destMatch.player2Id = m.winnerId;
          }
          updateMatchTargets(destMatch, playersMap, gameType);
          changed = true;
        }
      }
    }
  }

  // Resolve newly appeared BYEs in higher rounds
  const byeChanged = resolveByeMatches(seMatches, playersMap, gameType);
  if (byeChanged || changed) {
    // Recurse to bubble up further
    advanceKnockoutMatches(seMatches, playersMap, gameType);
    return true;
  }

  return changed;
}
