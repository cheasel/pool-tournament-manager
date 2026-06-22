'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getDatabaseAdapter } from '@/lib/db';
import { Player, Match } from '@/types';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Search, 
  ArrowUpDown, 
  ArrowLeft, 
  Edit3, 
  Trophy, 
  Activity, 
  Sparkles, 
  TrendingUp, 
  Check, 
  X, 
  ChevronRight,
  SlidersHorizontal,
  Flame,
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';

interface PlayerStats {
  player: Player;
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
  racksWon: number;
  racksLost: number;
  breakAndRuns: number;
  tableRuns: number;
  mismatchScore: number; // calculated rating of mismatch severity
  mismatchStatus: 'high' | 'warn' | 'none';
  mismatchReason: string;
}

export default function AnalysisPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const db = getDatabaseAdapter();

  // Data states
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter/Sort states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'flagged'>('all');
  const [sortField, setSortField] = useState<'winRate' | 'matches' | 'handicap' | 'mismatchScore'>('mismatchScore');
  const [sortAsc, setSortAsc] = useState(false);

  // In-place edit state
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSkill8, setEditSkill8] = useState<number>(3);
  const [editSkill9, setEditSkill9] = useState<number>(3);
  const [editSkill10, setEditSkill10] = useState<number>(3);
  const [savingPlayer, setSavingPlayer] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Route protection redirect
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Load database players and matches
  const loadData = async () => {
    try {
      setLoading(true);
      const [playerList, matchList] = await Promise.all([
        db.getPlayers(),
        db.getAllMatches()
      ]);
      // Filter out bye spacers
      setPlayers(playerList.filter(p => !p.isBye));
      setMatches(matchList);
    } catch (err) {
      console.error('Failed to load database data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && user?.role === 'super_admin') {
      loadData();
    }
  }, [isAuthenticated, user]);

  if (authLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh]">
        <span className="inline-block animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mb-3"></span>
        <span className="text-sm text-muted-foreground font-semibold">Checking authorization...</span>
      </div>
    );
  }

  // Access denied fallback screen
  if (!isAuthenticated || user?.role !== 'super_admin') {
    return (
      <div className="max-w-md mx-auto my-12 text-center space-y-6 animate-fade-in">
        <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-billiard-red/10 border border-billiard-red/20 text-billiard-red shadow-[0_0_15px_rgba(239,68,68,0.15)]">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-white">Access Denied</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This dashboard is restricted to Super Administrators. You do not have permission to view stats analysis.
          </p>
        </div>
        <div className="glass-panel p-6 rounded-xl border border-border flex flex-col gap-3">
          <button
            onClick={() => router.push('/')}
            className="w-full inline-flex items-center justify-center rounded-lg bg-primary py-3 text-sm font-bold text-background hover:bg-primary-hover shadow-lg hover:shadow-primary/20 transition-all cursor-pointer font-extrabold"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Perform statistics calculation for each player
  const calculatePlayerStats = (player: Player): PlayerStats => {
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

      if (stats?.breakAndRun) breakAndRuns++;
      if (stats?.tableRun) tableRuns++;
    });

    const totalMatches = wins + losses;
    const winRate = totalMatches > 0 ? wins / totalMatches : 0;

    // Evaluate mismatch severity
    let mismatchScore = 0;
    let mismatchStatus: 'high' | 'warn' | 'none' = 'none';
    let mismatchReason = '';

    const avgSkill = (player.skillLevel8 + player.skillLevel9 + player.skillLevel10) / 3;

    // Factor 1: Win rate threshold after min 5 matches
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

    // Factor 2: Advanced execution stats on low handicaps (sandbagging indicator)
    if (avgSkill < 10 && (breakAndRuns > 0 || tableRuns > 0)) {
      mismatchStatus = 'high';
      mismatchScore += (breakAndRuns * 15) + (tableRuns * 15);
      const runsText = [];
      if (breakAndRuns > 0) runsText.push(`${breakAndRuns} Break-and-run(s)`);
      if (tableRuns > 0) runsText.push(`${tableRuns} Table-run(s)`);
      mismatchReason += `Low handicap (${avgSkill.toFixed(0)}) player scoring ${runsText.join(' and ')}. `;
    }

    // Round mismatch score to integer
    mismatchScore = Math.round(mismatchScore);

    return {
      player,
      totalMatches,
      wins,
      losses,
      winRate,
      racksWon,
      racksLost,
      breakAndRuns,
      tableRuns,
      mismatchScore,
      mismatchStatus,
      mismatchReason: mismatchReason || 'No significant mismatch detected.'
    };
  };

  const allPlayerStats: PlayerStats[] = players.map(calculatePlayerStats);

  // Apply filters
  const filteredStats = allPlayerStats.filter(stat => {
    const matchesSearch = stat.player.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' || stat.mismatchStatus !== 'none';
    return matchesSearch && matchesFilter;
  });

  // Apply sorting
  const sortedStats = [...filteredStats].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'winRate') {
      comparison = a.winRate - b.winRate;
    } else if (sortField === 'matches') {
      comparison = a.totalMatches - b.totalMatches;
    } else if (sortField === 'handicap') {
      const avgA = (a.player.skillLevel8 + a.player.skillLevel9 + a.player.skillLevel10) / 3;
      const avgB = (b.player.skillLevel8 + b.player.skillLevel9 + b.player.skillLevel10) / 3;
      comparison = avgA - avgB;
    } else if (sortField === 'mismatchScore') {
      comparison = a.mismatchScore - b.mismatchScore;
    }
    return sortAsc ? comparison : -comparison;
  });

  const handleSort = (field: 'winRate' | 'matches' | 'handicap' | 'mismatchScore') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const openEditMode = (player: Player) => {
    setEditingPlayerId(player.id);
    setEditName(player.name);
    setEditSkill8(player.skillLevel8);
    setEditSkill9(player.skillLevel9);
    setEditSkill10(player.skillLevel10);
    setActionError('');
    setActionSuccess('');
  };

  const handleSaveHandicap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayerId) return;

    if (editSkill8 < 3 || editSkill8 > 22 || editSkill9 < 3 || editSkill9 > 22 || editSkill10 < 3 || editSkill10 > 22) {
      setActionError('Skill levels must be between 3 and 22.');
      return;
    }

    setSavingPlayer(true);
    setActionError('');
    try {
      await db.updatePlayer(
        editingPlayerId,
        {
          name: editName,
          skillLevel8: editSkill8,
          skillLevel9: editSkill9,
          skillLevel10: editSkill10
        },
        user?.username || 'Super Admin'
      );
      
      setActionSuccess('Player handicap updated successfully!');
      setEditingPlayerId(null);
      await loadData();
      
      // Clear success banner after 3 seconds
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to update player handicap.');
    } finally {
      setSavingPlayer(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 py-8 px-4 animate-fade-in">
      {/* Navigation breadcrumb */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      {/* Hero Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border/40 pb-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent border border-accent/20">
            <Sparkles className="h-3.5 w-3.5" />
            Super Admin Suite
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Player Handicap <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Analysis</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitor roster match history metrics to flag, check, and adjust mismatched player skill ratings.
          </p>
        </div>

        {/* Stats Summary Counter */}
        <div className="flex gap-4">
          <div className="glass-panel p-4 rounded-xl border border-border/40 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-billiard-red/10 border border-billiard-red/20 text-billiard-red flex items-center justify-center">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Mismatched</p>
              <p className="text-xl font-black text-white">{allPlayerStats.filter(s => s.mismatchStatus === 'high').length}</p>
            </div>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-border/40 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-billiard-yellow/10 border border-billiard-yellow/20 text-billiard-yellow flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Minor Alert</p>
              <p className="text-xl font-black text-white">{allPlayerStats.filter(s => s.mismatchStatus === 'warn').length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Toast */}
      {actionSuccess && (
        <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 flex gap-2.5 text-sm text-primary font-semibold animate-fade-in">
          <Check className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Control panel (Filter, Search, Sort) */}
      <div className="glass-panel rounded-2xl p-5 border border-border/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative max-w-md w-full">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground">
            <Search className="h-4.5 w-4.5" />
          </span>
          <input
            id="player-search-input"
            type="text"
            placeholder="Search players by name..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full rounded-xl bg-background border border-border pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors font-medium"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-900/60 p-1 rounded-xl border border-border/40 gap-1 text-xs font-bold">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-primary text-background shadow-md'
                  : 'text-muted-foreground hover:text-white'
              }`}
            >
              All Players
            </button>
            <button
              onClick={() => setFilterType('flagged')}
              className={`px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                filterType === 'flagged'
                  ? 'bg-billiard-red text-white shadow-md'
                  : 'text-muted-foreground hover:text-white'
              }`}
            >
              <Flame className="h-3.5 w-3.5" />
              Flagged Only
            </button>
          </div>
        </div>
      </div>

      {/* Main Analysis Table Card */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">
          <span className="inline-block animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mr-2"></span>
          Running handicap analysis algorithms...
        </div>
      ) : sortedStats.length === 0 ? (
        <div className="glass-panel rounded-3xl p-16 text-center text-muted-foreground">
          <ShieldCheck className="h-12 w-12 mx-auto text-primary mb-4" />
          <p className="font-semibold text-white">No players match the search criteria</p>
          <p className="text-sm mt-1 max-w-sm mx-auto">
            All players are within acceptable handicap ranges or no data matches.
          </p>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl border border-border/40 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm text-slate-300">
              <thead>
                <tr className="bg-slate-900/40 border-b border-border/30 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th scope="col" className="px-6 py-4">Player Name</th>
                  <th scope="col" className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('handicap')}>
                    <div className="flex items-center gap-1">
                      Current Handicap (8/9/10)
                      <ArrowUpDown className="h-3.5 w-3.5" />
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-4 cursor-pointer hover:text-white transition-colors text-center" onClick={() => handleSort('matches')}>
                    <div className="flex items-center justify-center gap-1">
                      Matches Played
                      <ArrowUpDown className="h-3.5 w-3.5" />
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-4 cursor-pointer hover:text-white transition-colors text-center" onClick={() => handleSort('winRate')}>
                    <div className="flex items-center justify-center gap-1">
                      Win Rate %
                      <ArrowUpDown className="h-3.5 w-3.5" />
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-4 text-center">Execution Stats (B&R / TR)</th>
                  <th scope="col" className="px-6 py-4 cursor-pointer hover:text-white transition-colors text-center" onClick={() => handleSort('mismatchScore')}>
                    <div className="flex items-center justify-center gap-1">
                      Mismatch Alert
                      <ArrowUpDown className="h-3.5 w-3.5" />
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20 text-xs font-bold">
                {sortedStats.map(stat => {
                  const avgSkill = ((stat.player.skillLevel8 + stat.player.skillLevel9 + stat.player.skillLevel10) / 3).toFixed(0);

                  return (
                    <tr key={stat.player.id} className={`hover:bg-slate-800/10 transition-colors ${
                      stat.mismatchStatus === 'high' 
                        ? 'bg-billiard-red/[0.02]' 
                        : stat.mismatchStatus === 'warn' 
                          ? 'bg-billiard-yellow/[0.01]' 
                          : ''
                    }`}>
                      {/* Player name */}
                      <td className="px-6 py-4">
                        <div className="font-extrabold text-sm text-white">
                          {stat.player.name}
                        </div>
                      </td>

                      {/* Handicap breakdown */}
                      <td className="px-6 py-4 text-slate-300">
                        <span className="font-mono text-xs">
                          {stat.player.skillLevel8} / {stat.player.skillLevel9} / {stat.player.skillLevel10}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium ml-1.5">
                          (Avg: {avgSkill})
                        </span>
                      </td>

                      {/* Matches Count */}
                      <td className="px-6 py-4 text-center text-slate-300">
                        {stat.totalMatches}
                        <span className="text-[10px] text-muted-foreground block font-medium">
                          {stat.wins}W - {stat.losses}L
                        </span>
                      </td>

                      {/* Win Rate */}
                      <td className="px-6 py-4 text-center">
                        <span className={`text-sm ${
                          stat.winRate > 0.70 
                            ? 'text-billiard-red' 
                            : stat.winRate < 0.30 && stat.totalMatches >= 5
                              ? 'text-billiard-blue' 
                              : 'text-slate-300'
                        }`}>
                          {(stat.winRate * 100).toFixed(0)}%
                        </span>
                        <span className="text-[10px] text-muted-foreground block font-medium">
                          racks: {stat.racksWon}-{stat.racksLost}
                        </span>
                      </td>

                      {/* runs */}
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <span className={`px-2 py-0.5 rounded border ${
                            stat.breakAndRuns > 0 
                              ? 'bg-primary/10 text-primary border-primary/20' 
                              : 'bg-slate-900/40 text-slate-500 border-slate-800'
                          }`}>
                            B&R: {stat.breakAndRuns}
                          </span>
                          <span className={`px-2 py-0.5 rounded border ${
                            stat.tableRuns > 0 
                              ? 'bg-accent/10 text-accent border-accent/20' 
                              : 'bg-slate-900/40 text-slate-500 border-slate-800'
                          }`}>
                            TR: {stat.tableRuns}
                          </span>
                        </div>
                      </td>

                      {/* alert badge */}
                      <td className="px-6 py-4 text-center">
                        {stat.mismatchStatus === 'high' ? (
                          <div className="inline-flex flex-col items-center gap-1">
                            <span className="inline-flex items-center gap-1 text-[10px] bg-billiard-red/10 text-billiard-red border border-billiard-red/30 px-2.5 py-0.5 rounded-full font-black animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.15)]">
                              <Flame className="h-3 w-3" />
                              High Alert
                            </span>
                            <span className="text-[9px] text-muted-foreground font-medium max-w-[150px] leading-tight block">
                              {stat.mismatchReason}
                            </span>
                          </div>
                        ) : stat.mismatchStatus === 'warn' ? (
                          <div className="inline-flex flex-col items-center gap-1">
                            <span className="inline-flex items-center gap-1 text-[10px] bg-billiard-yellow/10 text-billiard-yellow border border-billiard-yellow/30 px-2.5 py-0.5 rounded-full font-black">
                              <AlertTriangle className="h-3 w-3" />
                              Minor Alert
                            </span>
                            <span className="text-[9px] text-muted-foreground font-medium max-w-[150px] leading-tight block">
                              {stat.mismatchReason}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] bg-slate-900/60 text-slate-500 border border-slate-800 px-2.5 py-0.5 rounded-full font-medium">
                            Normal
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/players/${stat.player.id}`}
                            className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1"
                          >
                            History
                            <ChevronRight className="h-3 w-3" />
                          </Link>
                          <button
                            onClick={() => openEditMode(stat.player)}
                            className="inline-flex items-center gap-1 rounded bg-primary/10 hover:bg-primary hover:text-background text-primary border border-primary/20 px-2.5 py-1.5 transition-all cursor-pointer text-xs"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Adjust Handicap
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjust Handicap modal overlay */}
      {editingPlayerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-border/80 shadow-2xl scale-up-in space-y-6">
            <div className="flex items-center justify-between border-b border-border/30 pb-3">
              <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-primary" />
                Adjust Player Handicap
              </h3>
              <button 
                onClick={() => setEditingPlayerId(null)}
                className="text-muted-foreground hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHandicap} className="space-y-4">
              {/* Display name (non-editable for integrity, or edit just in case) */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Player Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-border px-4 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors font-semibold"
                  required
                />
              </div>

              {/* Grid of handicap skill levels */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 text-center">
                    8-Ball Handicap
                  </label>
                  <input
                    type="number"
                    min="3"
                    max="22"
                    value={editSkill8}
                    onChange={e => setEditSkill8(parseInt(e.target.value) || 3)}
                    className="w-full rounded-lg bg-background border border-border px-3 py-2 text-center text-sm text-white font-mono font-bold focus:outline-none focus:border-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 text-center">
                    9-Ball Handicap
                  </label>
                  <input
                    type="number"
                    min="3"
                    max="22"
                    value={editSkill9}
                    onChange={e => setEditSkill9(parseInt(e.target.value) || 3)}
                    className="w-full rounded-lg bg-background border border-border px-3 py-2 text-center text-sm text-white font-mono font-bold focus:outline-none focus:border-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 text-center">
                    10-Ball Handicap
                  </label>
                  <input
                    type="number"
                    min="3"
                    max="22"
                    value={editSkill10}
                    onChange={e => setEditSkill10(parseInt(e.target.value) || 3)}
                    className="w-full rounded-lg bg-background border border-border px-3 py-2 text-center text-sm text-white font-mono font-bold focus:outline-none focus:border-primary"
                    required
                  />
                </div>
              </div>

              {actionError && (
                <div className="rounded-lg bg-billiard-red/10 border border-billiard-red/20 p-3 text-xs text-billiard-red font-semibold flex gap-2">
                  <ShieldAlert className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <span>{actionError}</span>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4 border-t border-border/30">
                <button
                  type="button"
                  onClick={() => setEditingPlayerId(null)}
                  className="px-4 py-2.5 rounded-lg border border-border text-xs font-semibold text-white hover:bg-card cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPlayer}
                  className="px-5 py-2.5 rounded-lg bg-primary text-xs font-bold text-background hover:bg-primary-hover shadow-lg hover:shadow-primary/10 transition-all cursor-pointer"
                >
                  {savingPlayer ? 'Saving...' : 'Save Adjustments'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
