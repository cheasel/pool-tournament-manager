'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getDatabaseAdapter } from '@/lib/db';
import { Player, TournamentDetails, HandicapHistoryEntry } from '@/types';
import { getPlayerStats, PlayerStatsSummary } from '@/lib/stats';
import { 
  ArrowLeft, 
  Award, 
  Trophy, 
  TrendingUp, 
  Zap, 
  Clock, 
  Percent, 
  Coins, 
  ShieldAlert,
  ChevronRight,
  Target
} from 'lucide-react';

export default function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id: playerId } = React.use(params);

  const [player, setPlayer] = useState<Player | null>(null);
  const [stats, setStats] = useState<PlayerStatsSummary | null>(null);
  const [history, setHistory] = useState<HandicapHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'breakdown' | 'history' | 'handicaps'>('overview');

  const db = getDatabaseAdapter();

  useEffect(() => {
    async function loadData() {
      try {
        const allPlayers = await db.getPlayers();
        const activePlayer = allPlayers.find(p => p.id === playerId);
        if (!activePlayer) {
          setLoading(false);
          return;
        }

        setPlayer(activePlayer);

        // Fetch tournament data for career calculations
        const tournaments = await db.getTournaments();
        const detailsList = await Promise.all(
          tournaments.map(t => db.getTournamentDetails(t.id))
        );

        // Filter out null results
        const validDetails = detailsList.filter((d): d is TournamentDetails => d !== null);

        // Compute statistics
        const computedStats = getPlayerStats(activePlayer, validDetails);
        setStats(computedStats);

        // Fetch handicap history timeline
        const handicapLog = await db.getHandicapHistory(playerId);
        setHistory(handicapLog.sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()));

      } catch (err) {
        console.error('Failed to load player statistics:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [playerId]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <span className="inline-block animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mb-3"></span>
        <span className="text-sm text-muted-foreground font-semibold">Loading player profile...</span>
      </div>
    );
  }

  if (!player || !stats) {
    return (
      <div className="max-w-md mx-auto my-12 text-center space-y-6 animate-fade-in">
        <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-billiard-red/10 border border-billiard-red/20 text-billiard-red shadow-[0_0_15px_rgba(239,68,68,0.15)]">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-white">Player Not Found</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The player you are searching for does not exist or has been deleted from the database.
          </p>
        </div>
        <div className="glass-panel p-6 rounded-xl border border-border flex flex-col gap-3">
          <button
            onClick={() => router.push('/players')}
            className="w-full inline-flex items-center justify-center rounded-lg bg-primary py-3 text-sm font-bold text-background hover:bg-primary-hover shadow-lg hover:shadow-primary/20 transition-all cursor-pointer font-extrabold"
          >
            Return to Player Directory
          </button>
        </div>
      </div>
    );
  }

  // Color-coded handicap helpers
  const getSlDetails = (sl: number) => {
    if (sl >= 16) return { color: 'text-billiard-red', bg: 'bg-billiard-red', label: 'Grandmaster' };
    if (sl >= 10) return { color: 'text-billiard-orange', bg: 'bg-billiard-orange', label: 'Advanced' };
    if (sl >= 6) return { color: 'text-billiard-blue', bg: 'bg-billiard-blue', label: 'Intermediate' };
    return { color: 'text-primary', bg: 'bg-primary', label: 'Novice' };
  };

  const sl8Info = getSlDetails(player.skillLevel8);
  const sl9Info = getSlDetails(player.skillLevel9);
  const sl10Info = getSlDetails(player.skillLevel10);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in py-8 px-4">
      {/* Back navigation */}
      <Link
        href="/players"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Player Directory
      </Link>

      {/* Header card info */}
      <div className="glass-panel p-6 rounded-2xl border border-border/50 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full flex items-center justify-center font-bold text-xl uppercase bg-primary/10 border border-primary/25 text-primary shadow-[0_0_15px_rgba(16,185,129,0.15)] shrink-0">
            {player.name.charAt(0)}{player.name.split(' ')[1]?.charAt(0) || ''}
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight sm:text-3xl">{player.name}</h1>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
              Registered on {new Date(player.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="bg-slate-900/40 border border-border/50 px-4 py-2.5 rounded-xl text-center min-w-[70px]">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">8-Ball SL</p>
            <p className={`text-base font-extrabold ${sl8Info.color}`}>{player.skillLevel8}</p>
          </div>
          <div className="bg-slate-900/40 border border-border/50 px-4 py-2.5 rounded-xl text-center min-w-[70px]">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">9-Ball SL</p>
            <p className={`text-base font-extrabold ${sl9Info.color}`}>{player.skillLevel9}</p>
          </div>
          <div className="bg-slate-900/40 border border-border/50 px-4 py-2.5 rounded-xl text-center min-w-[70px]">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">10-Ball SL</p>
            <p className={`text-base font-extrabold ${sl10Info.color}`}>{player.skillLevel10}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Handicap progress panels */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-border/50 shadow-lg space-y-5">
            <h2 className="text-base font-extrabold text-white flex items-center gap-2 border-b border-border/30 pb-3">
              <Target className="h-4.5 w-4.5 text-primary" />
              Handicap Settings
            </h2>

            {/* 8-Ball progress slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-300">8-Ball Skill Level</span>
                <span className={`${sl8Info.color} font-bold`}>{player.skillLevel8} ({sl8Info.label})</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-border/40">
                <div 
                  className={`h-full ${sl8Info.bg} rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]`} 
                  style={{ width: `${(player.skillLevel8 / 22) * 100}%` }}
                />
              </div>
            </div>

            {/* 9-Ball progress slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-300">9-Ball Skill Level</span>
                <span className={`${sl9Info.color} font-bold`}>{player.skillLevel9} ({sl9Info.label})</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-border/40">
                <div 
                  className={`h-full ${sl9Info.bg} rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]`} 
                  style={{ width: `${(player.skillLevel9 / 22) * 100}%` }}
                />
              </div>
            </div>

            {/* 10-Ball progress slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-300">10-Ball Skill Level</span>
                <span className={`${sl10Info.color} font-bold`}>{player.skillLevel10} ({sl10Info.label})</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-border/40">
                <div 
                  className={`h-full ${sl10Info.bg} rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]`} 
                  style={{ width: `${(player.skillLevel10 / 22) * 100}%` }}
                />
              </div>
            </div>

            <div className="bg-slate-900/40 rounded-xl p-3 border border-border/30 text-[10px] text-muted-foreground leading-relaxed">
              Skill Levels range from 3 (Novice) up to 22 (Grandmaster). Match target lengths and spotted balls scale dynamically based on the difference between skill levels.
            </div>
          </div>
        </div>

        {/* Right Columns: Stats Dashboard and Tab Views */}
        <div className="lg:col-span-2 space-y-6">
          {/* Custom Navigation Tab Buttons */}
          <div className="flex border-b border-border/50 gap-6 overflow-x-auto text-sm font-semibold scrollbar-none pb-0.5">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'overview' 
                  ? 'border-primary text-white font-extrabold' 
                  : 'border-transparent text-muted-foreground hover:text-white'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('breakdown')}
              className={`pb-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'breakdown' 
                  ? 'border-primary text-white font-extrabold' 
                  : 'border-transparent text-muted-foreground hover:text-white'
              }`}
            >
              Discipline Breakdown
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`pb-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'history' 
                  ? 'border-primary text-white font-extrabold' 
                  : 'border-transparent text-muted-foreground hover:text-white'
              }`}
            >
              Tournament Ledger
            </button>
            <button
              onClick={() => setActiveTab('handicaps')}
              className={`pb-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'handicaps' 
                  ? 'border-primary text-white font-extrabold' 
                  : 'border-transparent text-muted-foreground hover:text-white'
              }`}
            >
              Handicap History ({history.length})
            </button>
          </div>

          {/* Tab Content 1: Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fade-in">
              {/* Primary Stats Grid */}
              <div className="grid gap-4 sm:grid-cols-3">
                {/* Tournaments Played */}
                <div className="glass-panel p-5 rounded-2xl border border-border/50 text-center space-y-2 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 h-16 w-16 -mt-3 -mr-3 rounded-full bg-primary/5 group-hover:bg-primary/10 transition-colors" />
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tournaments</p>
                  <p className="text-3xl font-black text-white">{stats.tournamentsPlayed}</p>
                  <p className="text-[10px] text-muted-foreground font-semibold">Career Entries</p>
                </div>

                {/* Match Win Rate Circular Display */}
                <div className="glass-panel p-5 rounded-2xl border border-border/50 text-center space-y-2 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 h-16 w-16 -mt-3 -mr-3 rounded-full bg-billiard-blue/5 group-hover:bg-billiard-blue/10 transition-colors" />
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Match Win Rate</p>
                  <div className="flex items-baseline justify-center gap-0.5">
                    <p className="text-3xl font-black text-white">{stats.matches.winRate}</p>
                    <span className="text-xs font-bold text-muted-foreground">%</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-semibold">
                    {stats.matches.won} Wins / {stats.matches.lost} Losses
                  </p>
                </div>

                {/* Career Earnings (Baht) */}
                <div className="glass-panel p-5 rounded-2xl border border-border/50 text-center space-y-2 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 h-16 w-16 -mt-3 -mr-3 rounded-full bg-billiard-orange/5 group-hover:bg-billiard-orange/10 transition-colors" />
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Career Payouts</p>
                  <div className="flex items-baseline justify-center text-primary font-black">
                    <span className="text-sm mr-0.5">฿</span>
                    <p className="text-3xl font-black text-primary">{stats.earnings.totalEarnings.toLocaleString()}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-semibold">
                    Entry + Calcutta Shares
                  </p>
                </div>
              </div>

              {/* Secondary stats row */}
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Rack win record */}
                <div className="glass-panel p-5 rounded-2xl border border-border/50 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-border/30 pb-2.5">
                    <Percent className="h-4 w-4 text-billiard-blue" />
                    Rack Record Details
                  </h3>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase">Racks Won</p>
                      <p className="text-xl font-extrabold text-white">{stats.racks.won}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase">Racks Lost</p>
                      <p className="text-xl font-extrabold text-white">{stats.racks.lost}</p>
                    </div>
                    <div className="text-center bg-slate-900 border border-border px-3 py-1.5 rounded-lg">
                      <p className="text-[9px] text-muted-foreground uppercase font-bold">Win Rate</p>
                      <p className="text-sm font-black text-billiard-blue">{stats.racks.winRate}%</p>
                    </div>
                  </div>
                </div>

                {/* Runs record */}
                <div className="glass-panel p-5 rounded-2xl border border-border/50 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-border/30 pb-2.5">
                    <Zap className="h-4 w-4 text-billiard-orange" />
                    Special Match Runs
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase">Break & Runs</p>
                      <p className="text-xl font-extrabold text-white">{stats.runs.breakAndRun}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase">Table Runs</p>
                      <p className="text-xl font-extrabold text-white">{stats.runs.tableRun}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Podiums widget finishes */}
              <div className="glass-panel p-6 rounded-2xl border border-border/50 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-border/30 pb-2.5">
                  <Trophy className="h-4 w-4 text-primary" />
                  Tournament Podium Placements
                </h3>

                <div className="grid gap-4 grid-cols-3">
                  {/* First Place */}
                  <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl text-center space-y-1">
                    <div className="mx-auto h-8 w-8 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 flex items-center justify-center">
                      <Award className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-bold text-white mt-1">1st Place</p>
                    <p className="text-xl font-extrabold text-primary">{stats.podiums.first}</p>
                  </div>

                  {/* Second Place */}
                  <div className="bg-slate-900/40 border border-border/50 p-4 rounded-xl text-center space-y-1">
                    <div className="mx-auto h-8 w-8 rounded-full bg-slate-400/10 border border-slate-400/30 text-slate-400 flex items-center justify-center">
                      <Award className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-bold text-white mt-1">2nd Place</p>
                    <p className="text-xl font-extrabold text-white">{stats.podiums.second}</p>
                  </div>

                  {/* Third Place */}
                  <div className="bg-slate-900/40 border border-border/50 p-4 rounded-xl text-center space-y-1">
                    <div className="mx-auto h-8 w-8 rounded-full bg-amber-700/10 border border-amber-700/30 text-amber-700 flex items-center justify-center">
                      <Award className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-bold text-white mt-1">3rd/4th Place</p>
                    <p className="text-xl font-extrabold text-slate-400">{stats.podiums.third}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content 2: Breakdown */}
          {activeTab === 'breakdown' && (
            <div className="grid gap-6 md:grid-cols-3 animate-fade-in">
              {(['8-Ball', '9-Ball', '10-Ball'] as const).map(gt => {
                const b = stats.gameBreakdown[gt];
                const active = b.matches.played > 0;
                return (
                  <div key={gt} className="glass-panel p-5 rounded-2xl border border-border/50 flex flex-col justify-between gap-4">
                    <div>
                      <h3 className="text-base font-extrabold text-white border-b border-border/30 pb-2 mb-3">
                        {gt} Stats
                      </h3>
                      {!active ? (
                        <p className="text-xs text-muted-foreground italic py-6 text-center">
                          No matches played.
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {/* Matches record */}
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground font-bold uppercase">Matches Record</p>
                            <div className="flex justify-between text-xs text-slate-300 font-semibold">
                              <span>Wins: {b.matches.won}</span>
                              <span>Losses: {b.matches.lost}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs text-muted-foreground font-bold uppercase">Win Rate:</span>
                              <span className="text-xs font-extrabold text-primary">{b.matches.winRate}%</span>
                            </div>
                          </div>

                          {/* Racks Margin */}
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground font-bold uppercase">Racks Record</p>
                            <div className="flex justify-between text-xs text-slate-300 font-semibold">
                              <span>Won: {b.racks.won}</span>
                              <span>Lost: {b.racks.lost}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs text-muted-foreground font-bold uppercase">Win Rate:</span>
                              <span className="text-xs font-extrabold text-billiard-blue">{b.racks.winRate}%</span>
                            </div>
                          </div>

                          {/* Runs */}
                          <div className="space-y-1 border-t border-border/30 pt-3">
                            <p className="text-[10px] text-muted-foreground font-bold uppercase">Special Runs</p>
                            <div className="flex justify-between text-xs text-slate-300 font-semibold">
                              <span>Break/Runs: {b.runs.breakAndRun}</span>
                              <span>Table Runs: {b.runs.tableRun}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tab Content 3: Ledger */}
          {activeTab === 'history' && (
            <div className="glass-panel rounded-2xl border border-border/50 shadow-lg overflow-hidden animate-fade-in">
              <div className="px-6 py-4 border-b border-border/30 bg-card/30">
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Coins className="h-4.5 w-4.5 text-primary" />
                  Tournament Ledger
                </h3>
              </div>

              {stats.tournamentHistory.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground italic">
                  This player has not participated in any tournaments yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs text-slate-300">
                    <thead>
                      <tr className="border-b border-border/30 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-card/10">
                        <th className="px-6 py-3.5">Tournament</th>
                        <th className="px-6 py-3.5">Game Type</th>
                        <th className="px-6 py-3.5">Placement</th>
                        <th className="px-6 py-3.5 text-right">Player Payout</th>
                        <th className="px-6 py-3.5 text-right">Calcutta Earnings</th>
                        <th className="px-6 py-3.5 text-right">Total Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30 font-medium">
                      {stats.tournamentHistory.map(entry => (
                        <tr key={entry.tournamentId} className="hover:bg-card/10 transition-colors">
                          <td className="px-6 py-4">
                            <Link 
                              href={`/tournaments/${entry.tournamentId}`}
                              className="text-white font-extrabold hover:text-primary transition-colors flex items-center gap-1 group"
                            >
                              {entry.tournamentName}
                              <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                            </Link>
                            <span className="text-[10px] text-muted-foreground font-semibold">
                              {new Date(entry.createdAt).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-400 font-semibold">{entry.gameType}</td>
                          <td className="px-6 py-4">
                            {entry.rank === 0 ? (
                              <span className="text-muted-foreground">Active</span>
                            ) : entry.rank === 1 ? (
                              <span className="text-primary font-black">1st (Winner)</span>
                            ) : entry.rank === 2 ? (
                              <span className="text-slate-300 font-extrabold">2nd</span>
                            ) : entry.rank <= 4 ? (
                              <span className="text-slate-400">3rd/4th</span>
                            ) : (
                              <span className="text-muted-foreground">Group Stage</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right text-slate-400">
                            {entry.playerPayout > 0 ? `฿${entry.playerPayout.toLocaleString()}` : '—'}
                          </td>
                          <td className="px-6 py-4 text-right text-slate-400">
                            {entry.ownerPayout > 0 ? `฿${entry.ownerPayout.toLocaleString()}` : '—'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className={entry.netEarnings > 0 ? 'text-primary font-bold' : 'text-slate-400'}>
                              {entry.netEarnings > 0 ? `฿${entry.netEarnings.toLocaleString()}` : '฿0'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab Content 4: Handicaps Log */}
          {activeTab === 'handicaps' && (
            <div className="glass-panel rounded-2xl border border-border/50 shadow-lg overflow-hidden animate-fade-in">
              <div className="px-6 py-4 border-b border-border/30 bg-card/30">
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Clock className="h-4.5 w-4.5 text-primary" />
                  Handicap Modification History
                </h3>
              </div>

              {history.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground italic">
                  No handicap changes have been logged for this player.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs text-slate-300">
                    <thead>
                      <tr className="border-b border-border/30 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-card/10">
                        <th className="px-6 py-3.5">Date & Time</th>
                        <th className="px-6 py-3.5 text-center">8B Handicap Change</th>
                        <th className="px-6 py-3.5 text-center">9B Handicap Change</th>
                        <th className="px-6 py-3.5 text-center">10B Handicap Change</th>
                        <th className="px-6 py-3.5">Approved By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30 font-semibold text-slate-400">
                      {history.map(entry => (
                        <tr key={entry.id} className="hover:bg-card/10 transition-colors">
                          <td className="px-6 py-4 text-slate-300 font-bold">
                            {new Date(entry.changedAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {entry.oldSkillLevel8 !== entry.newSkillLevel8 ? (
                              <span className="flex items-center justify-center gap-1">
                                <span>{entry.oldSkillLevel8}</span>
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                <span className="text-white font-extrabold">{entry.newSkillLevel8}</span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground font-normal">{entry.newSkillLevel8} (No Change)</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {entry.oldSkillLevel9 !== entry.newSkillLevel9 ? (
                              <span className="flex items-center justify-center gap-1">
                                <span>{entry.oldSkillLevel9}</span>
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                <span className="text-white font-extrabold">{entry.newSkillLevel9}</span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground font-normal">{entry.newSkillLevel9} (No Change)</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {entry.oldSkillLevel10 !== entry.newSkillLevel10 ? (
                              <span className="flex items-center justify-center gap-1">
                                <span>{entry.oldSkillLevel10}</span>
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                <span className="text-white font-extrabold">{entry.newSkillLevel10}</span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground font-normal">{entry.newSkillLevel10} (No Change)</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-white font-bold">
                            {entry.changedBy || 'System/Initial Seeding'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
