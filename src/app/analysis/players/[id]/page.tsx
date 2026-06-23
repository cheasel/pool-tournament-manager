'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getDatabaseAdapter } from '@/lib/db';
import { Player, TournamentDetails, HandicapHistoryEntry, Match } from '@/types';
import { getPlayerStats, PlayerStatsSummary } from '@/lib/stats';
import { useAuth } from '@/context/AuthContext';
import { calculateTournamentEarnings } from '@/lib/earnings';
import { 
  ArrowLeft, 
  Trophy, 
  TrendingUp, 
  Zap, 
  Clock, 
  Percent, 
  ShieldAlert,
  ChevronRight,
  Target,
  LineChart as ChartIcon,
  Flame,
  Award,
  Sparkles
} from 'lucide-react';

export default function PlayerVisualAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id: playerId } = React.use(params);
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const db = getDatabaseAdapter();

  const [player, setPlayer] = useState<Player | null>(null);
  const [stats, setStats] = useState<PlayerStatsSummary | null>(null);
  const [history, setHistory] = useState<HandicapHistoryEntry[]>([]);
  
  interface PlacementPoint {
    tournamentId: string;
    tournamentName: string;
    date: string;
    rank: number;
    maxRound: number;
    positionLabel: 'Champion' | 'Runner-up' | 'Semifinalist' | 'Knockout Round' | 'Group Stage';
    positionValue: number;
  }
  
  const [placements, setPlacements] = useState<PlacementPoint[]>([]);
  const [loading, setLoading] = useState(true);

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

        // Compute placements for the last 5 completed tournaments
        const participatedDetails = validDetails
          .filter(d => d.tournament.status === 'completed' && d.players.some(p => p.id === playerId))
          .sort((a, b) => new Date(b.tournament.createdAt).getTime() - new Date(a.tournament.createdAt).getTime());

        const last5Participated = participatedDetails.slice(0, 5).reverse(); // last 5, oldest to newest

        const placementPoints: PlacementPoint[] = last5Participated.map(d => {
          const t = d.tournament;
          const seMatches = d.matches.filter(m => m.roundType === 'knockout');
          const maxRound = seMatches.length > 0 ? Math.max(...seMatches.map(m => m.roundNumber), 0) : 0;
          
          const earningsList = calculateTournamentEarnings(d);
          const playerEarnings = earningsList.find(e => e.playerId === playerId);
          const rank = playerEarnings ? playerEarnings.rank : 0;

          let positionLabel: PlacementPoint['positionLabel'] = 'Group Stage';
          let positionValue = 1;

          const groupStageRank = maxRound > 0 ? Math.pow(2, maxRound) + 1 : 9;

          if (rank === 1) {
            positionLabel = 'Champion';
            positionValue = 5;
          } else if (rank === 2) {
            positionLabel = 'Runner-up';
            positionValue = 4;
          } else if (rank === 3) {
            positionLabel = 'Semifinalist';
            positionValue = 3;
          } else if (rank > 3 && rank < groupStageRank) {
            positionLabel = 'Knockout Round';
            positionValue = 2;
          } else {
            positionLabel = 'Group Stage';
            positionValue = 1;
          }

          return {
            tournamentId: t.id,
            tournamentName: t.name,
            date: new Date(t.createdAt).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
            rank,
            maxRound,
            positionLabel,
            positionValue,
          };
        });

        setPlacements(placementPoints);

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

  if (authLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh]">
        <span className="inline-block animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mb-3"></span>
        <span className="text-sm text-muted-foreground font-semibold">Checking authorization...</span>
      </div>
    );
  }

  // Route protection redirect
  if (!isAuthenticated || user?.role !== 'super_admin') {
    return (
      <div className="max-w-md mx-auto my-12 text-center space-y-6 animate-fade-in">
        <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-billiard-red/10 border border-billiard-red/20 text-billiard-red shadow-[0_0_15px_rgba(239,68,68,0.15)]">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-white">Access Denied</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This dashboard is restricted to Super Administrators. You do not have permission to view player visual analysis.
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

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <span className="inline-block animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mb-3"></span>
        <span className="text-sm text-muted-foreground font-semibold">Running data visualization engine...</span>
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
            The player profile or match details could not be found.
          </p>
        </div>
        <div className="glass-panel p-6 rounded-xl border border-border flex flex-col gap-3">
          <button
            onClick={() => router.push('/analysis')}
            className="w-full inline-flex items-center justify-center rounded-lg bg-primary py-3 text-sm font-bold text-background hover:bg-primary-hover shadow-lg hover:shadow-primary/20 transition-all cursor-pointer font-extrabold"
          >
            Return to Analysis Suite
          </button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // Reconstruct Handicap History Trend Data Points
  // ----------------------------------------------------
  interface ChartPoint {
    label: string;
    sl8: number;
    sl9: number;
    sl10: number;
  }

  const chronologicalHistory = [...history].sort(
    (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime()
  );

  const chartPoints: ChartPoint[] = [];

  if (chronologicalHistory.length === 0) {
    // If no adjustments have ever been made, show two flat points representing start and end
    chartPoints.push({
      label: 'Initial Roster',
      sl8: player.skillLevel8,
      sl9: player.skillLevel9,
      sl10: player.skillLevel10
    });
    chartPoints.push({
      label: 'Current Status',
      sl8: player.skillLevel8,
      sl9: player.skillLevel9,
      sl10: player.skillLevel10
    });
  } else {
    // Starting point (old handicap of the oldest entry)
    const first = chronologicalHistory[0];
    chartPoints.push({
      label: 'Seeded',
      sl8: first.oldSkillLevel8,
      sl9: first.oldSkillLevel9,
      sl10: first.oldSkillLevel10
    });

    // Each change point
    chronologicalHistory.forEach((h, i) => {
      chartPoints.push({
        label: new Date(h.changedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        sl8: h.newSkillLevel8,
        sl9: h.newSkillLevel9,
        sl10: h.newSkillLevel10
      });
    });

    // Current point
    chartPoints.push({
      label: 'Current',
      sl8: player.skillLevel8,
      sl9: player.skillLevel9,
      sl10: player.skillLevel10
    });
  }

  // SVG dimensions for Handicap History Trend Line Chart
  const svgWidth = 600;
  const svgHeight = 250;
  const paddingX = 40;
  const paddingY = 30;

  // Render path helpers mapping coordinates
  const getX = (index: number) => {
    if (chartPoints.length <= 1) return paddingX;
    return paddingX + (index / (chartPoints.length - 1)) * (svgWidth - 2 * paddingX);
  };

  const getY = (level: number) => {
    // Map skill levels 3 (bottom) to 22 (top)
    const range = 22 - 3;
    const percentage = (level - 3) / range;
    return paddingY + (1 - percentage) * (svgHeight - 2 * paddingY);
  };

  const getPathD = (getVal: (pt: ChartPoint) => number) => {
    return chartPoints
      .map((pt, idx) => {
        const x = getX(idx);
        const y = getY(getVal(pt));
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  };

  // Win rate segments for Donut chart
  const winPercent = stats.matches.played > 0 ? (stats.matches.won / stats.matches.played) * 100 : 0;
  const hasMatches = stats.matches.played > 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8 py-8 px-4 animate-fade-in">
      {/* Top back navigation and detail links */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link
          href="/analysis"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Handicap Analysis
        </Link>
        <Link
          href={`/players/${player.id}`}
          className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-hover transition-colors bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg"
        >
          View Public Profile
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Hero card header info */}
      <div className="relative overflow-hidden rounded-3xl glass-panel p-6 sm:p-8 shadow-2xl border border-white/5">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-primary/10 blur-[80px]" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 h-48 w-48 rounded-full bg-accent/5 blur-[50px]" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4.5">
            <div className="h-16 w-16 rounded-full flex items-center justify-center font-black text-2xl uppercase bg-primary/15 border border-primary/30 text-primary shadow-[0_0_20px_rgba(16,185,129,0.25)] shrink-0">
              {player.name.charAt(0)}{player.name.split(' ')[1]?.charAt(0) || ''}
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-bold text-accent border border-accent/20">
                <Sparkles className="h-3 w-3" />
                Performance Report Card
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight mt-1">{player.name}</h1>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Handicaps: {player.skillLevel8} (8B) / {player.skillLevel9} (9B) / {player.skillLevel10} (10B)
              </p>
            </div>
          </div>

          {/* Quick Summary Grid */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-slate-900/60 border border-border/40 px-4 py-2 rounded-xl text-center">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Match Record</p>
              <p className="text-sm font-black text-primary mt-0.5">{stats.matches.won}W - {stats.matches.lost}L</p>
            </div>
            <div className="bg-slate-900/60 border border-border/40 px-4 py-2 rounded-xl text-center">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Match Win %</p>
              <p className="text-sm font-black text-billiard-blue mt-0.5">{stats.matches.winRate}%</p>
            </div>
            <div className="bg-slate-900/60 border border-border/40 px-4 py-2 rounded-xl text-center">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Frame Record</p>
              <p className="text-sm font-black text-emerald-400 mt-0.5">{stats.racks.won}W - {stats.racks.lost}L</p>
            </div>
            <div className="bg-slate-900/60 border border-border/40 px-4 py-2 rounded-xl text-center">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Frame Win %</p>
              <p className="text-sm font-black text-accent mt-0.5">{stats.racks.winRate}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Frame vs Losses Segment Donut Chart */}
        <div className="glass-panel p-6 rounded-2xl border border-border/40 shadow-xl flex flex-col justify-between h-96">
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2 border-b border-border/20 pb-3">
              <Percent className="h-4.5 w-4.5 text-primary" />
              Frame Win-Loss Ratio
            </h2>
            <p className="text-xs text-muted-foreground mt-2">
              Career frame (rack) distribution showing percentage of individual game wins.
            </p>
          </div>

          <div className="py-6 flex items-center justify-center">
            {hasMatches ? (
              <div className="relative h-44 w-44 flex items-center justify-center">
                <svg width="160" height="160" viewBox="0 0 36 36" className="w-full max-w-[170px] transform -rotate-90">
                  {/* Losses segments (Base Circle) */}
                  <circle cx="18" cy="18" r="15.915" fill="none" stroke="#ef4444" strokeWidth="3.5" />
                  {/* Wins segments (Overlay Circle) */}
                  <circle cx="18" cy="18" r="15.915" fill="none" stroke="#10b981" strokeWidth="3.5" 
                          strokeDasharray={`${stats.racks.winRate} ${100 - stats.racks.winRate}`} strokeDashoffset="0" pathLength="100" />
                </svg>
                {/* Center text cut-out overlay */}
                <div className="absolute inset-0 m-4 bg-slate-950 border border-border/30 rounded-full flex flex-col items-center justify-center">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Frame Win %</span>
                  <span className="text-2xl font-black text-white mt-0.5">{stats.racks.winRate.toFixed(0)}%</span>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-2 py-8 text-muted-foreground italic text-xs">
                No matches played.
              </div>
            )}
          </div>

          {/* Legend indicators */}
          <div className="flex justify-center gap-6 text-xs font-bold border-t border-border/20 pt-3 bg-card/10">
            <span className="flex items-center gap-1.5 text-primary">
              <span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" />
              Frames Won ({stats.racks.won})
            </span>
            <span className="flex items-center gap-1.5 text-billiard-red">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
              Frames Lost ({stats.racks.lost})
            </span>
          </div>
        </div>

        {/* Win rate by Game discipline Bar Chart */}
        <div className="glass-panel p-6 rounded-2xl border border-border/40 shadow-xl flex flex-col justify-between h-96">
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2 border-b border-border/20 pb-3">
              <Target className="h-4.5 w-4.5 text-accent" />
              Discipline Frame Win %
            </h2>
            <p className="text-xs text-muted-foreground mt-2">
              Performance breakdown comparing 8-Ball, 9-Ball, and 10-Ball frame (rack) win rates.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-6 items-end justify-center h-48">
            {(['8-Ball', '9-Ball', '10-Ball'] as const).map(gt => {
              const gb = stats.gameBreakdown[gt];
              const playedRacks = gb.racks.won + gb.racks.lost;
              const frameWinRate = gb.racks.winRate;

              return (
                <div key={gt} className="flex flex-col items-center gap-2 h-full justify-end group">
                  <div className="text-[10px] font-mono text-slate-300 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                    {frameWinRate}%
                  </div>
                  {/* Visual Bar container */}
                  <div className="w-10 bg-slate-900 border border-slate-800 rounded-t-lg h-36 flex flex-col justify-end overflow-hidden">
                    {playedRacks > 0 ? (
                      <div 
                        className={`w-full rounded-t bg-gradient-to-t transition-all duration-700 shadow-md ${
                          gt === '8-Ball' 
                            ? 'from-billiard-black to-emerald-500 shadow-emerald-500/20' 
                            : gt === '9-Ball' 
                              ? 'from-[#b45309]/50 to-billiard-yellow shadow-billiard-yellow/20' 
                              : 'from-billiard-blue/50 to-blue-400 shadow-blue-400/20'
                        }`} 
                        style={{ height: `${frameWinRate}%` }} 
                      />
                    ) : (
                      <div className="w-full bg-slate-950/20 h-1.5" />
                    )}
                  </div>
                  {/* Labels */}
                  <div className="text-xs font-bold text-white mt-1">{gt}</div>
                  <div className="text-[9px] text-muted-foreground font-semibold uppercase">{gb.racks.won}W - {gb.racks.lost}L</div>
                </div>
              );
            })}
          </div>

          <div className="text-[10px] text-muted-foreground border-t border-border/20 pt-3 text-center leading-normal">
            Hover over the bars to view detailed percentages.
          </div>
        </div>

        {/* Career advanced stats panel */}
        <div className="glass-panel p-6 rounded-2xl border border-border/40 shadow-xl flex flex-col justify-between h-96">
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2 border-b border-border/20 pb-3">
              <Zap className="h-4.5 w-4.5 text-billiard-yellow" />
              Advanced Play Runs
            </h2>
            <p className="text-xs text-muted-foreground mt-2">
              Frequency of perfect table clearances logged during tournament execution.
            </p>
          </div>

          <div className="space-y-5 py-4">
            {/* Break and runs */}
            <div className="bg-slate-900/40 border border-border/30 rounded-xl p-4 flex justify-between items-center relative overflow-hidden group">
              <div className="absolute top-0 right-0 h-12 w-12 bg-primary/5 group-hover:bg-primary/10 transition-colors rounded-full -mt-2 -mr-2" />
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase font-black text-muted-foreground tracking-wider">Break & Runs</p>
                <p className="text-xs text-slate-300 font-medium">Closes table in one continuous run right after their break.</p>
              </div>
              <div className="text-3xl font-black text-primary px-3 shrink-0">{stats.runs.breakAndRun}</div>
            </div>

            {/* Table runs */}
            <div className="bg-slate-900/40 border border-border/30 rounded-xl p-4 flex justify-between items-center relative overflow-hidden group">
              <div className="absolute top-0 right-0 h-12 w-12 bg-accent/5 group-hover:bg-accent/10 transition-colors rounded-full -mt-2 -mr-2" />
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase font-black text-muted-foreground tracking-wider">Table Runs (Dry break)</p>
                <p className="text-xs text-slate-300 font-medium">Closes table in a single turn after opponent misses.</p>
              </div>
              <div className="text-3xl font-black text-accent px-3 shrink-0">{stats.runs.tableRun}</div>
            </div>
          </div>

          <div className="bg-slate-900/30 rounded-lg p-2.5 border border-border/30 text-[10px] text-muted-foreground leading-relaxed">
            Note: High frequencies of runs on low handicaps are a primary indicator of handicap mismatches.
          </div>
        </div>
      </div>

      {/* Handicap History Trend Line Graph */}
      <div className="glass-panel p-6 rounded-2xl border border-border/40 shadow-xl space-y-4">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center gap-2 border-b border-border/20 pb-3">
            <ChartIcon className="h-4.5 w-4.5 text-primary" />
            Handicap Skill Level Trend
          </h2>
          <p className="text-xs text-muted-foreground mt-2">
            Chronological progression of the player's handicaps across 8-Ball, 9-Ball, and 10-Ball disciplines.
          </p>
        </div>

        <div className="w-full overflow-x-auto pt-4 pb-2 scrollbar-none">
          <svg width={svgWidth} height={svgHeight} className="mx-auto block bg-slate-950/40 border border-border/20 rounded-xl">
            {/* Grid horizontal guidelines */}
            {[5, 10, 15, 20].map(level => {
              const y = getY(level);
              return (
                <g key={level} className="opacity-30">
                  <line x1={paddingX} y1={y} x2={svgWidth - paddingX} y2={y} stroke="#475569" strokeWidth="0.8" strokeDasharray="4 4" />
                  <text x={paddingX - 10} y={y + 3} className="fill-slate-400 text-[10px] font-mono text-right" textAnchor="end">
                    {level}
                  </text>
                </g>
              );
            })}

            {/* Grid labels for levels 3 & 22 */}
            <text x={paddingX - 10} y={getY(3) + 3} className="fill-slate-500 text-[9px] font-mono opacity-40" textAnchor="end">3</text>
            <text x={paddingX - 10} y={getY(22) + 3} className="fill-slate-500 text-[9px] font-mono opacity-40" textAnchor="end">22</text>

            {/* Vertical data points axis tick guidelines */}
            {chartPoints.map((pt, idx) => {
              const x = getX(idx);
              return (
                <g key={idx} className="opacity-20">
                  <line x1={x} y1={paddingY} x2={x} y2={svgHeight - paddingY} stroke="#475569" strokeWidth="0.8" />
                </g>
              );
            })}

            {/* Line 1: 8-Ball Trend Line */}
            <path d={getPathD(pt => pt.sl8)} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

            {/* Line 2: 9-Ball Trend Line */}
            <path d={getPathD(pt => pt.sl9)} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

            {/* Line 3: 10-Ball Trend Line */}
            <path d={getPathD(pt => pt.sl10)} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

            {/* Interactive Circles / Dots */}
            {chartPoints.map((pt, idx) => {
              const x = getX(idx);
              const y8 = getY(pt.sl8);
              const y9 = getY(pt.sl9);
              const y10 = getY(pt.sl10);

              return (
                <g key={idx} className="group/dot cursor-pointer">
                  {/* Dot circles */}
                  <circle cx={x} cy={y8} r="3.5" className="fill-slate-950 stroke-emerald-500 stroke-[2] hover:r-5 transition-all" />
                  <circle cx={x} cy={y9} r="3.5" className="fill-slate-950 stroke-amber-500 stroke-[2] hover:r-5 transition-all" />
                  <circle cx={x} cy={y10} r="3.5" className="fill-slate-950 stroke-blue-500 stroke-[2] hover:r-5 transition-all" />
                </g>
              );
            })}

            {/* X-Axis labels */}
            {chartPoints.map((pt, idx) => {
              const x = getX(idx);
              return (
                <text key={idx} x={x} y={svgHeight - 12} className="fill-slate-400 text-[9px] font-bold text-center" textAnchor="middle">
                  {pt.label}
                </text>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-6 text-xs font-bold pt-1">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" />
            8-Ball (Current: {player.skillLevel8})
          </span>
          <span className="flex items-center gap-1.5 text-amber-400">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
            9-Ball (Current: {player.skillLevel9})
          </span>
          <span className="flex items-center gap-1.5 text-blue-400">
            <span className="h-2.5 w-2.5 rounded-full bg-[#3b82f6]" />
            10-Ball (Current: {player.skillLevel10})
          </span>
        </div>
      </div>

      {/* Tournament Placement History Trend Graph */}
      <div className="glass-panel p-6 rounded-2xl border border-border/40 shadow-xl space-y-4">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center gap-2 border-b border-border/20 pb-3">
            <Trophy className="h-4.5 w-4.5 text-primary" />
            Tournament Placement History (Last 5 Tournaments)
          </h2>
          <p className="text-xs text-muted-foreground mt-2">
            Chronological finishing positions reached by the player across their last 5 completed tournaments.
          </p>
        </div>

        {placements.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground italic text-xs">
            No completed tournament history available.
          </div>
        ) : (
          <div className="w-full overflow-x-auto pt-4 pb-2 scrollbar-none">
            <svg width={svgWidth} height={svgHeight} className="mx-auto block bg-slate-950/40 border border-border/20 rounded-xl">
              {/* Grid horizontal guidelines */}
              {[
                { value: 5, label: 'Champion' },
                { value: 4, label: 'Runner-up' },
                { value: 3, label: 'Semifinalist' },
                { value: 2, label: 'Knockout Round' },
                { value: 1, label: 'Group Stage' },
              ].map(item => {
                const percentage = (item.value - 1) / 4;
                const usableHeight = svgHeight - 2 * paddingY;
                const y = paddingY + (1 - percentage) * usableHeight;
                const paddingXLeft = 110;
                return (
                  <g key={item.value} className="opacity-30">
                    <line x1={paddingXLeft} y1={y} x2={svgWidth - paddingX} y2={y} stroke="#475569" strokeWidth="0.8" strokeDasharray="4 4" />
                    <text x={paddingXLeft - 12} y={y + 3} className="fill-slate-400 text-[10px] font-bold text-right" textAnchor="end">
                      {item.label}
                    </text>
                  </g>
                );
              })}

              {/* Vertical guidelines */}
              {placements.map((pt, idx) => {
                const paddingXLeft = 110;
                const paddingXRight = 40;
                let x = paddingXLeft;
                if (placements.length > 1) {
                  const usableWidth = svgWidth - paddingXLeft - paddingXRight;
                  x = paddingXLeft + (idx / (placements.length - 1)) * usableWidth;
                } else {
                  x = paddingXLeft + (svgWidth - paddingXLeft - paddingXRight) / 2;
                }
                return (
                  <g key={idx} className="opacity-20">
                    <line x1={x} y1={paddingY} x2={x} y2={svgHeight - paddingY} stroke="#475569" strokeWidth="0.8" />
                  </g>
                );
              })}

              {/* Trend Line */}
              {placements.length > 0 && (
                <path
                  d={(() => {
                    const paddingXLeft = 110;
                    const paddingXRight = 40;
                    return placements
                      .map((pt, idx) => {
                        let x = paddingXLeft;
                        if (placements.length > 1) {
                          const usableWidth = svgWidth - paddingXLeft - paddingXRight;
                          x = paddingXLeft + (idx / (placements.length - 1)) * usableWidth;
                        } else {
                          x = paddingXLeft + (svgWidth - paddingXLeft - paddingXRight) / 2;
                        }
                        const percentage = (pt.positionValue - 1) / 4;
                        const usableHeight = svgHeight - 2 * paddingY;
                        const y = paddingY + (1 - percentage) * usableHeight;
                        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
                      })
                      .join(' ');
                  })()}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Dots */}
              {placements.map((pt, idx) => {
                const paddingXLeft = 110;
                const paddingXRight = 40;
                let x = paddingXLeft;
                if (placements.length > 1) {
                  const usableWidth = svgWidth - paddingXLeft - paddingXRight;
                  x = paddingXLeft + (idx / (placements.length - 1)) * usableWidth;
                } else {
                  x = paddingXLeft + (svgWidth - paddingXLeft - paddingXRight) / 2;
                }
                const percentage = (pt.positionValue - 1) / 4;
                const usableHeight = svgHeight - 2 * paddingY;
                const y = paddingY + (1 - percentage) * usableHeight;

                return (
                  <g key={idx} className="group/dot cursor-pointer">
                    <circle cx={x} cy={y} r="4" className="fill-slate-950 stroke-amber-500 stroke-[2] hover:r-5 transition-all" />
                  </g>
                );
              })}

              {/* X-Axis labels */}
              {placements.map((pt, idx) => {
                const paddingXLeft = 110;
                const paddingXRight = 40;
                let x = paddingXLeft;
                if (placements.length > 1) {
                  const usableWidth = svgWidth - paddingXLeft - paddingXRight;
                  x = paddingXLeft + (idx / (placements.length - 1)) * usableWidth;
                } else {
                  x = paddingXLeft + (svgWidth - paddingXLeft - paddingXRight) / 2;
                }
                return (
                  <g key={idx}>
                    <text x={x} y={svgHeight - 16} className="fill-slate-300 text-[9px] font-bold text-center" textAnchor="middle">
                      {pt.tournamentName.length > 15 ? pt.tournamentName.substring(0, 12) + '...' : pt.tournamentName}
                    </text>
                    <text x={x} y={svgHeight - 6} className="fill-slate-500 text-[8px] font-mono text-center" textAnchor="middle">
                      {pt.date}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {/* Modification logs list */}
      <div className="glass-panel rounded-2xl border border-border/40 shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border/30 bg-card/30 flex justify-between items-center">
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <Clock className="h-4.5 w-4.5 text-primary" />
            Handicap Update Log
          </h3>
          <span className="text-xs bg-slate-800 border border-slate-700 text-slate-300 font-bold px-2.5 py-0.5 rounded-full">
            {history.length} Modification{history.length !== 1 ? 's' : ''}
          </span>
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground italic">
            No handicap modifications recorded. This player has their original seed handicap values.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs text-slate-300">
              <thead>
                <tr className="border-b border-border/30 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-card/10">
                  <th scope="col" className="px-6 py-3.5">Log Date</th>
                  <th scope="col" className="px-6 py-3.5 text-center">8B Adjustment</th>
                  <th scope="col" className="px-6 py-3.5 text-center">9B Adjustment</th>
                  <th scope="col" className="px-6 py-3.5 text-center">10B Adjustment</th>
                  <th scope="col" className="px-6 py-3.5">Approved By</th>
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
                        <span className="flex items-center justify-center gap-1.5">
                          <span>{entry.oldSkillLevel8}</span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          <span className="text-white font-extrabold">{entry.newSkillLevel8}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-normal">{entry.newSkillLevel8}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {entry.oldSkillLevel9 !== entry.newSkillLevel9 ? (
                        <span className="flex items-center justify-center gap-1.5">
                          <span>{entry.oldSkillLevel9}</span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          <span className="text-white font-extrabold">{entry.newSkillLevel9}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-normal">{entry.newSkillLevel9}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {entry.oldSkillLevel10 !== entry.newSkillLevel10 ? (
                        <span className="flex items-center justify-center gap-1.5">
                          <span>{entry.oldSkillLevel10}</span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          <span className="text-white font-extrabold">{entry.newSkillLevel10}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-normal">{entry.newSkillLevel10}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-white font-bold">{entry.changedBy || 'System'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
