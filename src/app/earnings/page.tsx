'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getDatabaseAdapter } from '@/lib/db';
import { TournamentDetails } from '@/types';
import {
  aggregateGlobalEarnings,
  PlayerGlobalEarnings,
  OwnerGlobalEarnings,
  CombinedGlobalEarnings,
} from '@/lib/earnings';
import {
  Trophy,
  Coins,
  Search,
  TrendingUp,
  User,
  Users,
  Award,
  ArrowUpRight,
} from 'lucide-react';

export default function EarningsPage() {
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [nameToIdMap, setNameToIdMap] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'combined' | 'player' | 'owner'>('combined');
  const [tournamentsDetails, setTournamentsDetails] = useState<TournamentDetails[]>([]);
  const [gameTypeFilter, setGameTypeFilter] = useState<'all' | '8-Ball' | '9-Ball' | '10-Ball'>('all');
  const [sortBy, setSortBy] = useState<'total' | 'net'>('total');

  const db = getDatabaseAdapter();

  useEffect(() => {
    async function loadEarningsData() {
      try {
        const tournamentsList = await db.getTournaments();
        const playersList = await db.getPlayers();
        const mapping: Record<string, string> = {};
        playersList.forEach(p => {
          mapping[p.name.toLowerCase()] = p.id;
        });
        setNameToIdMap(mapping);

        // Load details for each tournament
        const detailsList: TournamentDetails[] = [];
        for (const t of tournamentsList) {
          const details = await db.getTournamentDetails(t.id);
          if (details) {
            detailsList.push(details);
          }
        }
        setTournamentsDetails(detailsList);
      } catch (err) {
        console.error('Failed to load earnings stats:', err);
      } finally {
        setLoading(false);
      }
    }

    loadEarningsData();
  }, []);

  // Filter tournamentsDetails by game type, only when activeTab is player and format is selected
  const filteredDetails = React.useMemo(() => {
    if (activeTab !== 'player' || gameTypeFilter === 'all') {
      return tournamentsDetails;
    }
    return tournamentsDetails.filter(d => d.tournament.gameType === gameTypeFilter);
  }, [tournamentsDetails, activeTab, gameTypeFilter]);

  // Aggregate stats dynamically based on active filters
  const stats = React.useMemo(() => {
    return aggregateGlobalEarnings(filteredDetails);
  }, [filteredDetails]);

  // Dynamic summary statistics
  const summary = React.useMemo(() => {
    let totalPrizePools = 0;
    filteredDetails.forEach(d => {
      if (d.tournament.status === 'completed') {
        const numRealPlayers = d.players.filter(p => !p.isBye).length;
        const entryPool = (d.tournament.entryFee || 0) * numRealPlayers;
        const calcuttaPool = (d.tournament.calcuttaBids || []).reduce(
          (sum, b) => sum + b.bidAmount,
          0
        );
        totalPrizePools += entryPool + calcuttaPool;
      }
    });

    const topPlayer = stats.players.length > 0
      ? { name: stats.players[0].playerName, amount: stats.players[0].totalEarnings }
      : { name: 'N/A', amount: 0 };

    const topOwner = stats.owners.length > 0
      ? { name: stats.owners[0].ownerName, amount: stats.owners[0].ownerCalcuttaShare }
      : { name: 'N/A', amount: 0 };

    return {
      totalPrizePools,
      topPlayer,
      topOwner,
    };
  }, [filteredDetails, stats]);

  // Helper to handle tab switching and reset game type filter
  const handleTabChange = (tab: 'combined' | 'player' | 'owner') => {
    setActiveTab(tab);
    setGameTypeFilter('all');
    setSortBy('total');
  };

  // Filter and sort combined
  const filteredCombined = React.useMemo(() => {
    const list = [...stats.combined].filter(c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return list.sort((a, b) => (sortBy === 'net' ? b.netProfit - a.netProfit : b.totalEarnings - a.totalEarnings));
  }, [stats.combined, searchQuery, sortBy]);

  // Filter and sort players
  const filteredPlayers = React.useMemo(() => {
    const list = [...stats.players].filter(p =>
      p.playerName.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return list.sort((a, b) => (sortBy === 'net' ? b.netPlayerEarnings - a.netPlayerEarnings : b.totalEarnings - a.totalEarnings));
  }, [stats.players, searchQuery, sortBy]);

  // Filter and sort owners
  const filteredOwners = React.useMemo(() => {
    const list = [...stats.owners].filter(o =>
      o.ownerName.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return list.sort((a, b) => (sortBy === 'net' ? b.netOwnerEarnings - a.netOwnerEarnings : b.ownerCalcuttaShare - a.ownerCalcuttaShare));
  }, [stats.owners, searchQuery, sortBy]);

  // Helper to format currency
  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
    }).format(Math.abs(amount));
    return `${amount < 0 ? '-' : ''}฿${formatted}`;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Title Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Earnings <span className="text-primary">Leaderboard</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Track global earnings, entry fee payouts, and Calcutta auction returns across completed tournaments.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-24 text-muted-foreground">
          <span className="inline-block animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mr-3"></span>
          Calculating earnings sheets...
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-5 sm:grid-cols-3">
            {/* Total Paid Out */}
            <div className="glass-panel rounded-2xl p-5 shadow-xl flex items-center gap-4 border border-border/60">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Coins className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Pools Paid Out</p>
                <p className="text-2xl font-black text-white mt-1">
                  {formatCurrency(summary.totalPrizePools)}
                </p>
              </div>
            </div>

            {/* Top Player Earner */}
            <div className="glass-panel rounded-2xl p-5 shadow-xl flex items-center gap-4 border border-border/60">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-billiard-blue/10 text-billiard-blue border border-billiard-blue/20">
                <Trophy className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Top Player Earner</p>
                <p className="text-lg font-black text-white truncate mt-1">
                  {summary.topPlayer.name}
                </p>
                <p className="text-xs font-bold text-emerald-400">
                  {formatCurrency(summary.topPlayer.amount)} gross
                </p>
              </div>
            </div>

            {/* Top Owner Earner */}
            <div className="glass-panel rounded-2xl p-5 shadow-xl flex items-center gap-4 border border-border/60">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-billiard-orange/10 text-billiard-orange border border-billiard-orange/20">
                <Coins className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Top Owner Earner</p>
                <p className="text-lg font-black text-white truncate mt-1">
                  {summary.topOwner.name}
                </p>
                <p className="text-xs font-bold text-emerald-400">
                  {formatCurrency(summary.topOwner.amount)} payout
                </p>
              </div>
            </div>
          </div>

          {/* Filters & Tabs Row */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full md:w-auto">
              {/* Search filter */}
              <div className="flex items-center rounded-xl bg-card border border-border px-4 py-2.5 shadow-md focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all w-full sm:w-80">
                <Search className="h-4 w-4 text-muted-foreground mr-3" />
                <input
                  type="text"
                  placeholder="Filter by name..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-transparent text-sm text-white focus:outline-none w-full"
                />
              </div>

              {/* Game Type Selector Tabs (Only when activeTab === 'player') */}
              {activeTab === 'player' && (
                <div className="flex bg-slate-900/60 p-1 rounded-xl border border-border/40 text-[11px] sm:text-xs font-bold gap-1 self-start sm:self-auto animate-fade-in">
                  {(['all', '8-Ball', '9-Ball', '10-Ball'] as const).map(gt => (
                    <button
                      key={gt}
                      onClick={() => setGameTypeFilter(gt)}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        gameTypeFilter === gt
                          ? 'bg-primary text-background shadow-md'
                          : 'text-muted-foreground hover:text-white'
                      }`}
                    >
                      {gt === 'all' ? 'All Formats' : gt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sort & Tab switchers */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center self-start md:self-auto w-full sm:w-auto">
              {/* Sort controls */}
              <div className="flex bg-slate-900/60 p-1 rounded-xl border border-border/40 text-[11px] sm:text-xs font-bold gap-1 self-start sm:self-auto w-full sm:w-auto">
                <button
                  onClick={() => setSortBy('total')}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    sortBy === 'total'
                      ? 'bg-primary text-background shadow-md'
                      : 'text-muted-foreground hover:text-white'
                  }`}
                >
                  Total Earning
                </button>
                <button
                  onClick={() => setSortBy('net')}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    sortBy === 'net'
                      ? 'bg-primary text-background shadow-md'
                      : 'text-muted-foreground hover:text-white'
                  }`}
                >
                  Net Profit
                </button>
              </div>

              {/* Tab switchers */}
              <div className="flex bg-slate-900/60 p-1 rounded-xl border border-border/40 w-full sm:w-auto">
                <button
                  onClick={() => handleTabChange('combined')}
                  className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'combined'
                      ? 'bg-primary text-background shadow-md'
                      : 'text-muted-foreground hover:text-white'
                  }`}
                >
                  All Earnings
                </button>
                <button
                  onClick={() => handleTabChange('player')}
                  className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'player'
                      ? 'bg-primary text-background shadow-md'
                      : 'text-muted-foreground hover:text-white'
                  }`}
                >
                  Players
                </button>
                <button
                  onClick={() => handleTabChange('owner')}
                  className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'owner'
                      ? 'bg-primary text-background shadow-md'
                      : 'text-muted-foreground hover:text-white'
                  }`}
                >
                  Owners
                </button>
              </div>
            </div>
          </div>

          {/* Leaderboard Table Panel */}
          <div className="glass-panel rounded-2xl shadow-xl overflow-hidden border border-border/60">
            {activeTab === 'combined' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900/40 border-b border-border text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                      <th className="py-4 px-6 text-center w-16">Rank</th>
                      <th className="py-4 px-6">Name</th>
                      <th className="py-4 px-6 text-right">Player Earning</th>
                      <th className="py-4 px-6 text-right">Owner Earning</th>
                      <th className="py-4 px-6 text-right">Net Profit</th>
                      <th className="py-4 px-6 text-right text-white">Total Earning</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20 text-xs font-bold">
                    {filteredCombined.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-muted-foreground italic">
                          No records found.
                        </td>
                      </tr>
                    ) : (
                      filteredCombined.map((row, idx) => (
                        <tr
                          key={row.name}
                          className="hover:bg-slate-800/20 transition-colors"
                        >
                          <td className="py-4 px-6 text-center">
                            {idx === 0 ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                                1
                              </span>
                            ) : idx === 1 ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-300/10 text-slate-300 border border-slate-300/20">
                                2
                              </span>
                            ) : idx === 2 ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-700/10 text-amber-700 border border-amber-700/20">
                                3
                              </span>
                            ) : (
                              <span className="text-muted-foreground font-medium">{idx + 1}</span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-sm text-white font-black">
                            {nameToIdMap[row.name.toLowerCase()] ? (
                              <Link href={`/players/${nameToIdMap[row.name.toLowerCase()]}`} className="hover:text-primary transition-colors hover:underline">
                                {row.name}
                              </Link>
                            ) : (
                              row.name
                            )}
                          </td>
                          <td className="py-4 px-6 text-right text-slate-300">
                            {row.playerEarnings > 0 ? formatCurrency(row.playerEarnings) : '—'}
                          </td>
                          <td className="py-4 px-6 text-right text-slate-300">
                            {row.ownerEarnings > 0 ? formatCurrency(row.ownerEarnings) : '—'}
                          </td>
                          <td className={`py-4 px-6 text-right ${row.netProfit >= 0 ? 'text-primary' : 'text-billiard-red'}`}>
                            {row.netProfit >= 0 ? '+' : ''}{formatCurrency(row.netProfit)}
                          </td>
                          <td className="py-4 px-6 text-right text-base font-black text-emerald-400">
                            {formatCurrency(row.totalEarnings)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'player' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900/40 border-b border-border text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                      <th className="py-4 px-6 text-center w-16">Rank</th>
                      <th className="py-4 px-6">Player Name</th>
                      <th className="py-4 px-6 text-right">Tournament Payout</th>
                      <th className="py-4 px-6 text-right">Calcutta Share</th>
                      <th className="py-4 px-6 text-right">Net Profit</th>
                      <th className="py-4 px-6 text-right text-white">Gross Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20 text-xs font-bold">
                    {filteredPlayers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-muted-foreground italic">
                          No records found.
                        </td>
                      </tr>
                    ) : (
                      filteredPlayers.map((row, idx) => (
                        <tr
                          key={row.playerId}
                          className="hover:bg-slate-800/20 transition-colors"
                        >
                          <td className="py-4 px-6 text-center">
                            {idx === 0 ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                                1
                              </span>
                            ) : idx === 1 ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-300/10 text-slate-300 border border-slate-300/20">
                                2
                              </span>
                            ) : idx === 2 ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-700/10 text-amber-700 border border-amber-700/20">
                                3
                              </span>
                            ) : (
                              <span className="text-muted-foreground font-medium">{idx + 1}</span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-sm text-white font-black">
                            <Link href={`/players/${row.playerId}`} className="hover:text-primary transition-colors hover:underline">
                              {row.playerName}
                            </Link>
                          </td>
                          <td className="py-4 px-6 text-right text-slate-300">
                            {row.playerPayout > 0 ? formatCurrency(row.playerPayout) : '—'}
                          </td>
                          <td className="py-4 px-6 text-right text-slate-300">
                            {row.playerCalcuttaShare > 0 ? formatCurrency(row.playerCalcuttaShare) : '—'}
                          </td>
                          <td className={`py-4 px-6 text-right ${row.netPlayerEarnings >= 0 ? 'text-primary' : 'text-billiard-red'}`}>
                            {row.netPlayerEarnings >= 0 ? '+' : ''}{formatCurrency(row.netPlayerEarnings)}
                          </td>
                          <td className="py-4 px-6 text-right text-base font-black text-emerald-400">
                            {formatCurrency(row.totalEarnings)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'owner' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900/40 border-b border-border text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                      <th className="py-4 px-6 text-center w-16">Rank</th>
                      <th className="py-4 px-6">Owner Name</th>
                      <th className="py-4 px-6 text-right">Calcutta Payout</th>
                      <th className="py-4 px-6 text-right text-white">Net Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20 text-xs font-bold">
                    {filteredOwners.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-muted-foreground italic">
                          No records found.
                        </td>
                      </tr>
                    ) : (
                      filteredOwners.map((row, idx) => (
                        <tr
                          key={row.ownerName}
                          className="hover:bg-slate-800/20 transition-colors"
                        >
                          <td className="py-4 px-6 text-center">
                            {idx === 0 ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                                1
                              </span>
                            ) : idx === 1 ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-300/10 text-slate-300 border border-slate-300/20">
                                2
                              </span>
                            ) : idx === 2 ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-700/10 text-amber-700 border border-amber-700/20">
                                3
                              </span>
                            ) : (
                              <span className="text-muted-foreground font-medium">{idx + 1}</span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-sm text-white font-black">
                            {nameToIdMap[row.ownerName.toLowerCase()] ? (
                              <Link href={`/players/${nameToIdMap[row.ownerName.toLowerCase()]}`} className="hover:text-primary transition-colors hover:underline">
                                {row.ownerName}
                              </Link>
                            ) : (
                              row.ownerName
                            )}
                          </td>
                          <td className="py-4 px-6 text-right text-slate-300">
                            {row.ownerCalcuttaShare > 0 ? formatCurrency(row.ownerCalcuttaShare) : '—'}
                          </td>
                          <td className={`py-4 px-6 text-right text-base font-black ${row.netOwnerEarnings >= 0 ? 'text-primary' : 'text-billiard-red'}`}>
                            {row.netOwnerEarnings >= 0 ? '+' : ''}{formatCurrency(row.netOwnerEarnings)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
