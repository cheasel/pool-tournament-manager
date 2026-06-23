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
  gameType: GameType,
  handicapRaceStyle?: string
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
      const handicap = calculateMatchHandicap(player1, player2, gameType, handicapRaceStyle);
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
      handicapRaceStyle,
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

    let matchChanged = false;

    if (p1.isBye && p2.isBye) {
      // Both are BYEs, advance player 1
      m.status = 'completed';
      m.winnerId = p1.id;
      m.player1Score = m.player1Target;
      m.player2Score = 0;
      matchChanged = true;
      changed = true;
    } else if (p1.isBye) {
      // Player 2 wins by BYE
      m.status = 'completed';
      m.winnerId = p2.id;
      m.player2Score = m.player2Target;
      m.player1Score = 0;
      matchChanged = true;
      changed = true;
    } else if (p2.isBye) {
      // Player 1 wins by BYE
      m.status = 'completed';
      m.winnerId = p1.id;
      m.player1Score = m.player1Target;
      m.player2Score = 0;
      matchChanged = true;
      changed = true;
    }

    if (matchChanged) {
      if (m.roundType === 'group_winners' || m.roundType === 'group_losers') {
        advanceDoubleEliminationMatch(m, matches, playersMap, gameType);
      }
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
      destMatch.handicapRaceStyle = completedMatch.handicapRaceStyle;
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
      destMatch.handicapRaceStyle = completedMatch.handicapRaceStyle;
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
      const hc = calculateMatchHandicap(p1, p2, gameType, match.handicapRaceStyle);
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
  gameType: GameType,
  handicapRaceStyle?: string
): Match[] {
  // 1. Collect all Winners and Losers
  const allWinners: { id: string; groupId: string }[] = [];
  const allLosers: { id: string; groupId: string }[] = [];

  for (const q of qualifiersList) {
    for (const w of q.winners) {
      if (w && !w.includes('BYE') && !playersMap[w]?.isBye) {
        allWinners.push({ id: w, groupId: q.groupId });
      }
    }
    for (const l of q.losers) {
      if (l && !l.includes('BYE') && !playersMap[l]?.isBye) {
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
      skillLevel8: 3,
      skillLevel9: 3,
      skillLevel10: 3,
      createdAt: new Date().toISOString(),
      isBye: true,
    });
  }

  // Combine real players + BYEs
  const matches: Match[] = [];
  const now = new Date().toISOString();

  // Create full list of slots
  // We want to construct bracketSize/2 matches for Round 1.
  const numMatches = bracketSize / 2;

  // Let's pair them up.
  // We want to ensure BYEs are paired with real players first (rewarding Winners first, then Losers).
  // This guarantees 0 BYE-BYE matches in Round 1 (no BYE will ever advance to Round 2) in standard brackets.
  const pairs: { p1: string; p2: string }[] = [];
  const usedWinners = new Set<string>();
  const usedLosers = new Set<string>();

  // Helper map of all players to include BYEs in playersMap
  const extendedPlayersMap = { ...playersMap };
  for (const bye of byePlayers) {
    extendedPlayersMap[bye.id] = bye;
  }

  let byeIdx = 0;

  // 1. Pair Winners with BYEs first (rewarding Winners with auto-wins)
  for (const w of allWinners) {
    if (byeIdx < byePlayers.length) {
      pairs.push({ p1: w.id, p2: byePlayers[byeIdx].id });
      usedWinners.add(w.id);
      byeIdx++;
    }
  }

  // 2. If there are still BYEs left, pair them with Losers
  for (const l of allLosers) {
    if (byeIdx < byePlayers.length) {
      pairs.push({ p1: l.id, p2: byePlayers[byeIdx].id });
      usedLosers.add(l.id);
      byeIdx++;
    }
  }

  // 3. If there are still BYEs left (e.g. B > R), pair remaining BYEs with each other
  while (byeIdx < byePlayers.length - 1) {
    pairs.push({ p1: byePlayers[byeIdx].id, p2: byePlayers[byeIdx + 1].id });
    byeIdx += 2;
  }

  // 4. Pair remaining Winners and Losers with each other (group avoidance)
  for (const w of allWinners) {
    if (usedWinners.has(w.id)) continue;
    // Try to find a Loser from a DIFFERENT group
    const partner = allLosers.find(l => l.groupId !== w.groupId && !usedLosers.has(l.id));
    if (partner) {
      pairs.push({ p1: w.id, p2: partner.id });
      usedWinners.add(w.id);
      usedLosers.add(partner.id);
    }
  }

  // If same-group is unavoidable, pair leftover Winners with leftover Losers
  for (const w of allWinners) {
    if (usedWinners.has(w.id)) continue;
    const partner = allLosers.find(l => !usedLosers.has(l.id));
    if (partner) {
      pairs.push({ p1: w.id, p2: partner.id });
      usedWinners.add(w.id);
      usedLosers.add(partner.id);
    }
  }

  // 5. If we only have Losers left, pair them with each other (group avoidance)
  const remainingLosers = allLosers.filter(l => !usedLosers.has(l.id));
  while (remainingLosers.length > 0) {
    const l1 = remainingLosers.shift()!;
    // Try to find a partner from a different group
    const partnerIdx = remainingLosers.findIndex(l2 => l2.groupId !== l1.groupId);
    if (partnerIdx !== -1) {
      const l2 = remainingLosers.splice(partnerIdx, 1)[0];
      pairs.push({ p1: l1.id, p2: l2.id });
    } else if (remainingLosers.length > 0) {
      // Unavoidable same group
      const l2 = remainingLosers.shift()!;
      pairs.push({ p1: l1.id, p2: l2.id });
    } else {
      // Odd one out (should not happen since bracket is power of 2 and padded)
      pairs.push({ p1: l1.id, p2: '' });
    }
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
      const hc = calculateMatchHandicap(p1, p2, gameType, handicapRaceStyle);
      target1 = hc.player1Target;
      target2 = hc.player2Target;
      spot1 = hc.player1SpottedBalls;
      spot2 = hc.player2SpottedBalls;
    }

    matches.push({
      id: `${tournamentId}_se_r1_m${i + 1}`,
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
      handicapRaceStyle,
    });
  }

  // Generate placeholder matches for subsequent rounds in the SE tree
  // Round 2 will have numMatches / 2 matches, Round 3 has numMatches / 4, etc.
  let currentRoundMatchesCount = numMatches / 2;
  let roundNum = 2;
  while (currentRoundMatchesCount >= 1) {
    for (let i = 0; i < currentRoundMatchesCount; i++) {
      matches.push({
        id: `${tournamentId}_se_r${roundNum}_m${i + 1}`,
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
        handicapRaceStyle,
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
      const nextRoundNum = r + 1;
      const nextMatchNum = Math.ceil(m.matchNumber / 2);
      const isPlayer1Slot = m.matchNumber % 2 !== 0;

      const destMatch = seMatches.find(
        nm => nm.roundNumber === nextRoundNum && nm.matchNumber === nextMatchNum
      );

      if (destMatch) {
        destMatch.handicapRaceStyle = m.handicapRaceStyle; // Propagate style
        const expectedPlayerId = (m.status === 'completed' && m.winnerId) ? m.winnerId : '';
        const currentSlotId = isPlayer1Slot ? destMatch.player1Id : destMatch.player2Id;

        if (currentSlotId !== expectedPlayerId) {
          if (isPlayer1Slot) {
            destMatch.player1Id = expectedPlayerId;
          } else {
            destMatch.player2Id = expectedPlayerId;
          }

          // Since the player in destMatch changed, reset destMatch to scheduled/incomplete
          destMatch.status = 'scheduled';
          destMatch.winnerId = undefined;
          destMatch.player1Score = 0;
          destMatch.player2Score = 0;
          destMatch.player1Stats = { breakAndRun: 0, tableRun: 0 };
          destMatch.player2Stats = { breakAndRun: 0, tableRun: 0 };
          destMatch.player1Target = 1;
          destMatch.player2Target = 1;
          destMatch.player1SpottedBalls = [];
          destMatch.player2SpottedBalls = [];

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

/**
 * Heals a knockout bracket by reconstructing any missing placeholder matches in the tree.
 * Correctly infers player IDs, completed status, winner IDs, scores, and handicap targets.
 */
export function healKnockoutMatches(
  matches: Match[],
  tournament: Tournament,
  playersMap: Record<string, Player>
): { healedMatches: Match[]; changed: boolean } {
  const seMatches = matches.filter(m => m.roundType === 'knockout');
  if (seMatches.length === 0) return { healedMatches: matches, changed: false };

  const maxRound = Math.max(...seMatches.map(m => m.roundNumber));
  let changed = false;
  const updatedMatches = [...matches];

  for (let r = 1; r <= maxRound; r++) {
    const expectedCount = Math.pow(2, maxRound - r);
    for (let mNum = 1; mNum <= expectedCount; mNum++) {
      const matchIndex = updatedMatches.findIndex(
        m => m.tournamentId === tournament.id && m.roundType === 'knockout' && m.roundNumber === r && m.matchNumber === mNum
      );

      if (matchIndex === -1) {
        const hasPrefix = seMatches.some(m => m.id.startsWith(`${tournament.id}_`));
        const matchId = hasPrefix ? `${tournament.id}_se_r${r}_m${mNum}` : `se_r${r}_m${mNum}`;

        let p1Id = '';
        let p2Id = '';
        if (r > 1) {
          const prevMatch1 = updatedMatches.find(
            m => m.tournamentId === tournament.id && m.roundType === 'knockout' && m.roundNumber === r - 1 && m.matchNumber === 2 * mNum - 1
          );
          const prevMatch2 = updatedMatches.find(
            m => m.tournamentId === tournament.id && m.roundType === 'knockout' && m.roundNumber === r - 1 && m.matchNumber === 2 * mNum
          );
          p1Id = (prevMatch1?.status === 'completed' && prevMatch1.winnerId) ? prevMatch1.winnerId : '';
          p2Id = (prevMatch2?.status === 'completed' && prevMatch2.winnerId) ? prevMatch2.winnerId : '';
        }

        let winnerId: string | undefined = undefined;
        let status: 'scheduled' | 'completed' = 'scheduled';
        let p1Score = 0;
        let p2Score = 0;

        const nextRoundNum = r + 1;
        const nextMatchNum = Math.ceil(mNum / 2);
        const isPlayer1Slot = mNum % 2 !== 0;

        const nextMatch = updatedMatches.find(
          m => m.tournamentId === tournament.id && m.roundType === 'knockout' && m.roundNumber === nextRoundNum && m.matchNumber === nextMatchNum
        );

        if (nextMatch) {
          const nextPlayerId = isPlayer1Slot ? nextMatch.player1Id : nextMatch.player2Id;
          if (nextPlayerId) {
            winnerId = nextPlayerId;
            status = 'completed';
          }
        }

        let p1Target = 1;
        let p2Target = 1;
        let p1Spotted: number[] = [];
        let p2Spotted: number[] = [];

        const p1Obj = p1Id ? playersMap[p1Id] : null;
        const p2Obj = p2Id ? playersMap[p2Id] : null;

        if (p1Obj && p2Obj) {
          const hc = calculateMatchHandicap(p1Obj, p2Obj, tournament.gameType, tournament.handicapRaceStyle);
          p1Target = hc.player1Target;
          p2Target = hc.player2Target;
          p1Spotted = hc.player1SpottedBalls;
          p2Spotted = hc.player2SpottedBalls;
        }

        if (status === 'completed' && winnerId) {
          if (winnerId === p1Id) {
            p1Score = p1Target;
            p2Score = 0;
          } else if (winnerId === p2Id) {
            p1Score = 0;
            p2Score = p2Target;
          }
        }

        const healedMatch: Match = {
          id: matchId,
          tournamentId: tournament.id,
          roundType: 'knockout',
          roundNumber: r,
          matchNumber: mNum,
          player1Id: p1Id,
          player2Id: p2Id,
          player1Score: p1Score,
          player2Score: p2Score,
          player1Target: p1Target,
          player2Target: p2Target,
          player1SpottedBalls: p1Spotted,
          player2SpottedBalls: p2Spotted,
          status,
          winnerId,
          createdAt: new Date().toISOString(),
          handicapRaceStyle: tournament.handicapRaceStyle,
        };

        updatedMatches.push(healedMatch);
        changed = true;
      }
    }
  }

  return { healedMatches: updatedMatches, changed };
}

