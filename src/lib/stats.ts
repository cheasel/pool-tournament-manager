import { TournamentDetails, Player, Match, Tournament } from '../types';
import { calculateTournamentEarnings, PlayerTournamentEarnings } from './earnings';

export interface PlayerStatsSummary {
  player: Player;
  tournamentsPlayed: number;
  podiums: {
    first: number;
    second: number;
    third: number; // tied 3rd / semifinalist
  };
  matches: {
    played: number;
    won: number;
    lost: number;
    winRate: number;
  };
  racks: {
    won: number;
    lost: number;
    winRate: number;
  };
  runs: {
    breakAndRun: number;
    tableRun: number;
  };
  earnings: {
    playerPayout: number; // money from entry fees
    calcuttaPayout: number; // player Calcutta payout share + owner Calcutta share
    totalEarnings: number; // player + owner + calcutta
  };
  gameBreakdown: Record<
    '8-Ball' | '9-Ball' | '10-Ball',
    {
      matches: { played: number; won: number; lost: number; winRate: number };
      racks: { won: number; lost: number; winRate: number };
      runs: { breakAndRun: number; tableRun: number };
    }
  >;
  tournamentHistory: {
    tournamentId: string;
    tournamentName: string;
    createdAt: string;
    gameType: '8-Ball' | '9-Ball' | '10-Ball';
    rank: number;
    playerPayout: number;
    ownerPayout: number;
    calcuttaBid: number;
    netEarnings: number;
  }[];
}

export function getPlayerStats(
  player: Player,
  allTournamentDetails: TournamentDetails[]
): PlayerStatsSummary {
  const playerId = player.id;
  const playerName = player.name;

  let tournamentsPlayed = 0;
  let matchesPlayed = 0;
  let matchesWon = 0;
  let matchesLost = 0;

  let racksWon = 0;
  let racksLost = 0;

  let breakAndRuns = 0;
  let tableRuns = 0;

  let playerPayoutTotal = 0;
  let calcuttaPayoutTotal = 0;
  let ownerPayoutTotal = 0;

  const podiums = { first: 0, second: 0, third: 0 };

  const gameBreakdown: PlayerStatsSummary['gameBreakdown'] = {
    '8-Ball': {
      matches: { played: 0, won: 0, lost: 0, winRate: 0 },
      racks: { won: 0, lost: 0, winRate: 0 },
      runs: { breakAndRun: 0, tableRun: 0 },
    },
    '9-Ball': {
      matches: { played: 0, won: 0, lost: 0, winRate: 0 },
      racks: { won: 0, lost: 0, winRate: 0 },
      runs: { breakAndRun: 0, tableRun: 0 },
    },
    '10-Ball': {
      matches: { played: 0, won: 0, lost: 0, winRate: 0 },
      racks: { won: 0, lost: 0, winRate: 0 },
      runs: { breakAndRun: 0, tableRun: 0 },
    },
  };

  const tournamentHistory: PlayerStatsSummary['tournamentHistory'] = [];

  for (const details of allTournamentDetails) {
    const isParticipant = details.players.some(p => p.id === playerId);
    if (!isParticipant) continue;

    tournamentsPlayed++;
    const t = details.tournament;
    const gType = t.gameType as '8-Ball' | '9-Ball' | '10-Ball';

    // Earnings calculation for this tournament
    const earningsList = calculateTournamentEarnings(details);
    const playerEarnings = earningsList.find(e => e.playerId === playerId);

    let rank = 0;
    let playerPayout = 0;
    let ownerPayout = 0;
    let calcuttaBid = 0;

    if (playerEarnings) {
      rank = playerEarnings.rank;
      playerPayout = playerEarnings.playerPayout;
      playerPayoutTotal += playerPayout;

      // Calcutta payout is the share that goes to the player
      calcuttaPayoutTotal += playerEarnings.playerCalcuttaShare;
      calcuttaBid = playerEarnings.calcuttaBidAmount;

      // If they finished in the top ranks, increment podium count
      if (rank === 1) podiums.first++;
      else if (rank === 2) podiums.second++;
      else if (rank === 3 || rank === 4) podiums.third++; // tied 3rd/4th in single/double elimination
    }

    // Did they also purchase anyone in Calcutta?
    // Check if the buyer matches the player's name
    const bids = t.calcuttaBids || [];
    bids.forEach(b => {
      const isOwner1 = b.buyerName.trim().toLowerCase() === playerName.trim().toLowerCase();
      const isOwner2 = b.buyerName2?.trim().toLowerCase() === playerName.trim().toLowerCase();

      if (isOwner1 || isOwner2) {
        // Find the player being bought
        const playerBoughtEarnings = earningsList.find(e => e.playerId === b.playerId);
        if (playerBoughtEarnings) {
          let share = 0;
          if (isOwner1 && isOwner2) {
            share = (playerBoughtEarnings.ownerCalcuttaShare + (playerBoughtEarnings.owner2CalcuttaShare || 0));
          } else if (isOwner1) {
            share = playerBoughtEarnings.ownerCalcuttaShare;
          } else if (isOwner2) {
            share = playerBoughtEarnings.owner2CalcuttaShare || 0;
          }
          ownerPayout += share;
          ownerPayoutTotal += share;
        }
      }
    });

    const netEarnings = playerPayout + (playerEarnings?.playerCalcuttaShare || 0) + ownerPayout;

    tournamentHistory.push({
      tournamentId: t.id,
      tournamentName: t.name,
      createdAt: t.createdAt,
      gameType: gType,
      rank,
      playerPayout,
      ownerPayout,
      calcuttaBid,
      netEarnings,
    });

    // Matches played by this player in this tournament
    const playerMatches = details.matches.filter(
      m => m.player1Id === playerId || m.player2Id === playerId
    );

    playerMatches.forEach(m => {
      // Only include matches that are completed
      if (m.status !== 'completed') return;

      matchesPlayed++;
      gameBreakdown[gType].matches.played++;

      const isP1 = m.player1Id === playerId;
      const score = isP1 ? m.player1Score : m.player2Score;
      const oppScore = isP1 ? m.player2Score : m.player1Score;

      racksWon += score;
      racksLost += oppScore;

      gameBreakdown[gType].racks.won += score;
      gameBreakdown[gType].racks.lost += oppScore;

      const won = m.winnerId === playerId;
      if (won) {
        matchesWon++;
        gameBreakdown[gType].matches.won++;
      } else {
        matchesLost++;
        gameBreakdown[gType].matches.lost++;
      }

      // Check run stats
      const stats = isP1 ? m.player1Stats : m.player2Stats;
      if (stats?.breakAndRun) {
        breakAndRuns++;
        gameBreakdown[gType].runs.breakAndRun++;
      }
      if (stats?.tableRun) {
        tableRuns++;
        gameBreakdown[gType].runs.tableRun++;
      }
    });
  }

  // Calculate percentages
  const calcWinRate = (w: number, l: number) => {
    const total = w + l;
    return total > 0 ? parseFloat(((w / total) * 100).toFixed(1)) : 0;
  };

  const matchesWinRate = calcWinRate(matchesWon, matchesLost);
  const racksWinRate = calcWinRate(racksWon, racksLost);

  // Set win rates for breakdowns
  const gameTypes: ('8-Ball' | '9-Ball' | '10-Ball')[] = ['8-Ball', '9-Ball', '10-Ball'];
  for (const gt of gameTypes) {
    const gb = gameBreakdown[gt];
    gb.matches.winRate = calcWinRate(gb.matches.won, gb.matches.lost);
    gb.racks.winRate = calcWinRate(gb.racks.won, gb.racks.lost);
  }

  return {
    player,
    tournamentsPlayed,
    podiums,
    matches: {
      played: matchesPlayed,
      won: matchesWon,
      lost: matchesLost,
      winRate: matchesWinRate,
    },
    racks: {
      won: racksWon,
      lost: racksLost,
      winRate: racksWinRate,
    },
    runs: {
      breakAndRun: breakAndRuns,
      tableRun: tableRuns,
    },
    earnings: {
      playerPayout: playerPayoutTotal,
      calcuttaPayout: calcuttaPayoutTotal + ownerPayoutTotal,
      totalEarnings: playerPayoutTotal + calcuttaPayoutTotal + ownerPayoutTotal,
    },
    gameBreakdown,
    tournamentHistory: tournamentHistory.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
  };
}
