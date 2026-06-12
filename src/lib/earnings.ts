import { TournamentDetails, Player, CalcuttaBid } from '../types';

export interface PlayerTournamentEarnings {
  playerId: string;
  playerName: string;
  rank: number; // 0 = Active/unranked, 1 = 1st, 2 = 2nd, 3 = tied 3rd, 5 = tied 5th, etc.
  isBye: boolean;
  entryFeePaid: number;
  playerPayout: number; // Gross payout from entry fee pool
  calcuttaOwner: string; // Buyer name
  calcuttaOwner2?: string; // Joint buyer name
  calcuttaBidAmount: number;
  hasCalcuttaSplit: boolean;
  calcuttaPayout: number; // Total calcutta payout for position
  playerCalcuttaShare: number; // Player's portion of Calcutta payout
  ownerCalcuttaShare: number; // Owner's portion of Calcutta payout
  owner2CalcuttaShare?: number; // Owner 2's portion of Calcutta payout
  netPlayerEarnings: number; // playerPayout + playerCalcuttaShare - entryFeePaid - playerCalcuttaCost
  netOwnerEarnings: number; // ownerCalcuttaShare - ownerCalcuttaCost
  netOwner2Earnings?: number; // Owner 2 net
}

export interface TournamentEarningsSummary {
  tournamentId: string;
  tournamentName: string;
  completed: boolean;
  totalEntryPool: number;
  totalCalcuttaPool: number;
  playerEarnings: PlayerTournamentEarnings[];
}

export interface PlayerGlobalEarnings {
  playerId: string;
  playerName: string;
  playerPayout: number;
  playerCalcuttaShare: number;
  netPlayerEarnings: number;
  totalEarnings: number; // playerPayout + playerCalcuttaShare
}

export interface OwnerGlobalEarnings {
  ownerName: string;
  ownerCalcuttaShare: number;
  netOwnerEarnings: number;
}

export interface CombinedGlobalEarnings {
  name: string;
  playerEarnings: number;
  ownerEarnings: number;
  totalEarnings: number;
}

/**
 * Calculates earnings, ranks, and Calcutta splits for a specific tournament.
 */
export function calculateTournamentEarnings(details: TournamentDetails): PlayerTournamentEarnings[] {
  const { tournament, players, groups, matches } = details;
  const allPlayers = players.filter(p => !p.isBye);
  const entryFee = tournament.entryFee || 0;
  const numRealPlayers = allPlayers.length;
  const totalPrizePool = entryFee * numRealPlayers;

  const bids = tournament.calcuttaBids || [];
  const totalCalcuttaPool = bids.reduce((sum, b) => sum + b.bidAmount, 0);

  const payoutPercentages = tournament.payoutPercentages || [];
  const calcuttaPayoutPercentages = tournament.calcuttaPayoutPercentages || [];

  // Determine ranks
  const playerRanks: Record<string, number> = {};
  const wonFinal: Record<string, boolean> = {};
  const eliminatedInRound: Record<string, number> = {};

  const seMatches = matches.filter(m => m.roundType === 'knockout');
  const maxRound = seMatches.length > 0 ? Math.max(...seMatches.map(m => m.roundNumber), 0) : 0;

  // Track who was eliminated in which knockout round
  const completedKnockouts = seMatches.filter(m => m.status === 'completed' && m.winnerId);
  for (const m of completedKnockouts) {
    const winnerId = m.winnerId!;
    const loserId = m.player1Id === winnerId ? m.player2Id : m.player1Id;

    if (loserId && !loserId.includes('BYE')) {
      eliminatedInRound[loserId] = m.roundNumber;
    }

    if (m.roundNumber === maxRound) {
      wonFinal[winnerId] = true;
    }
  }

  // Get qualifiers from groups to identify group stage losers
  let qualifierIds = new Set<string>();
  if (groups.length > 0) {
    // Check if the group stage matches are populated and check qualifiers
    const qualifiersList = groups.map(g => {
      // Find qualifiers using bracket helper
      // If matches are not complete yet, this will just return whatever is complete
      const groupMatches = matches.filter(m => m.groupId === g.id);
      
      const m9 = groupMatches.find(m => m.matchNumber === 9);
      const m10 = groupMatches.find(m => m.matchNumber === 10);
      const winners: string[] = [];
      if (m9?.status === 'completed' && m9.winnerId) winners.push(m9.winnerId);
      if (m10?.status === 'completed' && m10.winnerId) winners.push(m10.winnerId);

      const m5 = groupMatches.find(m => m.matchNumber === 5);
      const m6 = groupMatches.find(m => m.matchNumber === 6);
      const losers: string[] = [];
      if (m5?.status === 'completed' && m5.winnerId) losers.push(m5.winnerId);
      if (m6?.status === 'completed' && m6.winnerId) losers.push(m6.winnerId);

      return { winners, losers };
    });
    qualifierIds = new Set(qualifiersList.flatMap(q => [...q.winners, ...q.losers]));
  }

  const groupStageRank = maxRound > 0 ? Math.pow(2, maxRound) + 1 : 9;

  for (const p of allPlayers) {
    if (wonFinal[p.id]) {
      playerRanks[p.id] = 1;
    } else if (eliminatedInRound[p.id] === maxRound) {
      playerRanks[p.id] = 2;
    } else if (eliminatedInRound[p.id] !== undefined) {
      const r = eliminatedInRound[p.id];
      playerRanks[p.id] = Math.pow(2, maxRound - r) + 1;
    } else {
      // Check if they qualified or played in knockout
      const playedKnockout = seMatches.some(m => m.player1Id === p.id || m.player2Id === p.id);
      if (playedKnockout || qualifierIds.has(p.id)) {
        // Still active or uncompleted knockout match
        playerRanks[p.id] = 0;
      } else {
        // Got eliminated in group stage
        playerRanks[p.id] = groupStageRank;
      }
    }
  }

  // Group players by rank for tie splits (only ranks > 0)
  const playersByRank = new Map<number, Player[]>();
  for (const p of allPlayers) {
    const r = playerRanks[p.id] || 0;
    if (r > 0) {
      if (!playersByRank.has(r)) {
        playersByRank.set(r, []);
      }
      playersByRank.get(r)!.push(p);
    }
  }

  const earningsMap: Record<string, PlayerTournamentEarnings> = {};

  // Initialize all player records first (defaulting to 0/active values)
  for (const p of allPlayers) {
    const r = playerRanks[p.id] || 0;
    const bid = bids.find(b => b.playerId === p.id);
    const bidAmount = bid ? bid.bidAmount : 0;
    const buyerName = bid ? bid.buyerName : '';
    const buyerName2 = bid ? bid.buyerName2 : undefined;
    const split = bid ? !!bid.split : false;

    const ownerCost = split ? 0.5 * bidAmount : bidAmount;
    const owner1Cost = buyerName2 ? ownerCost * 0.5 : ownerCost;
    const owner2Cost = buyerName2 ? ownerCost * 0.5 : 0;

    // For active players (rank === 0)
    earningsMap[p.id] = {
      playerId: p.id,
      playerName: p.name,
      rank: r,
      isBye: false,
      entryFeePaid: entryFee,
      playerPayout: 0,
      calcuttaOwner: buyerName,
      calcuttaOwner2: buyerName2,
      calcuttaBidAmount: bidAmount,
      hasCalcuttaSplit: split,
      calcuttaPayout: 0,
      playerCalcuttaShare: 0,
      ownerCalcuttaShare: 0,
      owner2CalcuttaShare: buyerName2 ? 0 : undefined,
      netPlayerEarnings: -entryFee - (split ? 0.5 * bidAmount : 0),
      netOwnerEarnings: buyerName ? -owner1Cost : 0,
      netOwner2Earnings: buyerName2 ? -owner2Cost : undefined,
    };
  }

  // Distribute payouts for ranked groups
  playersByRank.forEach((groupPlayers, rank) => {
    const n = groupPlayers.length;

    // Sum entry fee payout percentages
    let sumPct = 0;
    for (let i = 0; i < n; i++) {
      sumPct += payoutPercentages[rank - 1 + i] || 0;
    }
    const avgPct = sumPct / n;

    // Sum Calcutta payout percentages
    let sumCalcuttaPct = 0;
    for (let i = 0; i < n; i++) {
      sumCalcuttaPct += calcuttaPayoutPercentages[rank - 1 + i] || 0;
    }
    const avgCalcuttaPct = sumCalcuttaPct / n;

    for (const p of groupPlayers) {
      const record = earningsMap[p.id];
      if (!record) continue;

      const playerPayout = (totalPrizePool * avgPct) / 100;
      const calcuttaPayout = (totalCalcuttaPool * avgCalcuttaPct) / 100;

      const split = record.hasCalcuttaSplit;
      const bidAmount = record.calcuttaBidAmount;
      const hasSecondOwner = !!record.calcuttaOwner2;

      const playerCalcuttaShare = split ? 0.5 * calcuttaPayout : 0;
      const totalOwnerShare = split ? 0.5 * calcuttaPayout : calcuttaPayout;
      const ownerCalcuttaShare = hasSecondOwner ? 0.5 * totalOwnerShare : totalOwnerShare;
      const owner2CalcuttaShare = hasSecondOwner ? 0.5 * totalOwnerShare : undefined;

      const playerCalcuttaCost = split ? 0.5 * bidAmount : 0;
      const totalOwnerCost = split ? 0.5 * bidAmount : bidAmount;
      const ownerCalcuttaCost = hasSecondOwner ? 0.5 * totalOwnerCost : totalOwnerCost;
      const owner2CalcuttaCost = hasSecondOwner ? 0.5 * totalOwnerCost : 0;

      record.playerPayout = playerPayout;
      record.calcuttaPayout = calcuttaPayout;
      record.playerCalcuttaShare = playerCalcuttaShare;
      record.ownerCalcuttaShare = ownerCalcuttaShare;
      if (hasSecondOwner) {
        record.owner2CalcuttaShare = owner2CalcuttaShare;
      }

      record.netPlayerEarnings = playerPayout + playerCalcuttaShare - entryFee - playerCalcuttaCost;
      record.netOwnerEarnings = record.calcuttaOwner
        ? ownerCalcuttaShare - ownerCalcuttaCost
        : 0;
      if (hasSecondOwner) {
        record.netOwner2Earnings = owner2CalcuttaShare! - owner2CalcuttaCost;
      }
    }
  });

  return allPlayers.map(p => earningsMap[p.id]).sort((a, b) => {
    if (a.rank === 0 && b.rank !== 0) return 1;
    if (b.rank === 0 && a.rank !== 0) return -1;
    if (a.rank !== b.rank) return a.rank - b.rank;
    return b.playerPayout - a.playerPayout; // secondary sort by payout
  });
}

/**
 * Aggregates player and owner earnings across a set of tournaments.
 */
export function aggregateGlobalEarnings(tournamentsDetails: TournamentDetails[]): {
  players: PlayerGlobalEarnings[];
  owners: OwnerGlobalEarnings[];
  combined: CombinedGlobalEarnings[];
} {
  const playerMap: Record<string, { name: string; playerPayout: number; playerCalcuttaShare: number; netPlayerEarnings: number }> = {};
  const ownerMap: Record<string, { ownerCalcuttaShare: number; netOwnerEarnings: number }> = {};
  const combinedMap: Record<string, { playerEarnings: number; ownerEarnings: number }> = {};

  for (const details of tournamentsDetails) {
    // Only aggregate if tournament is completed to ensure final standings
    if (details.tournament.status !== 'completed') continue;

    const earningsList = calculateTournamentEarnings(details);
    for (const earn of earningsList) {
      // Aggregate player
      if (!playerMap[earn.playerId]) {
        playerMap[earn.playerId] = {
          name: earn.playerName,
          playerPayout: 0,
          playerCalcuttaShare: 0,
          netPlayerEarnings: 0,
        };
      }
      const pData = playerMap[earn.playerId];
      pData.playerPayout += earn.playerPayout;
      pData.playerCalcuttaShare += earn.playerCalcuttaShare;
      pData.netPlayerEarnings += earn.netPlayerEarnings;

      // Combined - Player component
      if (!combinedMap[earn.playerName]) {
        combinedMap[earn.playerName] = { playerEarnings: 0, ownerEarnings: 0 };
      }
      combinedMap[earn.playerName].playerEarnings += earn.playerPayout + earn.playerCalcuttaShare;

      // Aggregate owner
      if (earn.calcuttaOwner) {
        const ownerName = earn.calcuttaOwner.trim();
        if (!ownerMap[ownerName]) {
          ownerMap[ownerName] = {
            ownerCalcuttaShare: 0,
            netOwnerEarnings: 0,
          };
        }
        const oData = ownerMap[ownerName];
        oData.ownerCalcuttaShare += earn.ownerCalcuttaShare;
        oData.netOwnerEarnings += earn.netOwnerEarnings;

        // Combined - Owner component
        if (!combinedMap[ownerName]) {
          combinedMap[ownerName] = { playerEarnings: 0, ownerEarnings: 0 };
        }
        combinedMap[ownerName].ownerEarnings += earn.ownerCalcuttaShare;
      }

      // Aggregate owner 2
      if (earn.calcuttaOwner2) {
        const owner2Name = earn.calcuttaOwner2.trim();
        if (!ownerMap[owner2Name]) {
          ownerMap[owner2Name] = {
            ownerCalcuttaShare: 0,
            netOwnerEarnings: 0,
          };
        }
        const oData2 = ownerMap[owner2Name];
        oData2.ownerCalcuttaShare += earn.owner2CalcuttaShare || 0;
        oData2.netOwnerEarnings += earn.netOwner2Earnings || 0;

        // Combined - Owner component
        if (!combinedMap[owner2Name]) {
          combinedMap[owner2Name] = { playerEarnings: 0, ownerEarnings: 0 };
        }
        combinedMap[owner2Name].ownerEarnings += earn.owner2CalcuttaShare || 0;
      }
    }
  }

  // Map to final arrays
  const players: PlayerGlobalEarnings[] = Object.entries(playerMap).map(([id, data]) => ({
    playerId: id,
    playerName: data.name,
    playerPayout: data.playerPayout,
    playerCalcuttaShare: data.playerCalcuttaShare,
    netPlayerEarnings: data.netPlayerEarnings,
    totalEarnings: data.playerPayout + data.playerCalcuttaShare,
  })).sort((a, b) => b.totalEarnings - a.totalEarnings);

  const owners: OwnerGlobalEarnings[] = Object.entries(ownerMap).map(([name, data]) => ({
    ownerName: name,
    ownerCalcuttaShare: data.ownerCalcuttaShare,
    netOwnerEarnings: data.netOwnerEarnings,
  })).sort((a, b) => b.ownerCalcuttaShare - a.ownerCalcuttaShare);

  const combined: CombinedGlobalEarnings[] = Object.entries(combinedMap).map(([name, data]) => ({
    name,
    playerEarnings: data.playerEarnings,
    ownerEarnings: data.ownerEarnings,
    totalEarnings: data.playerEarnings + data.ownerEarnings,
  })).sort((a, b) => b.totalEarnings - a.totalEarnings);

  return { players, owners, combined };
}
