'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Tournament, Player } from '@/types';
import { getDatabaseAdapter } from '@/lib/db';
import { Trophy, Calendar, Play, Circle, Award, PlusCircle, Users, Activity } from 'lucide-react';

export default function DashboardPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  const db = getDatabaseAdapter();

  useEffect(() => {
    async function loadData() {
      try {
        const tList = await db.getTournaments();
        const pList = await db.getPlayers();
        setTournaments(tList);
        setPlayers(pList.filter(p => !p.isBye));
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const activeTourneys = tournaments.filter(t => t.status === 'active');
  const completedTourneys = tournaments.filter(t => t.status === 'completed');

  // Find player name by ID
  const getPlayerName = (id?: string) => {
    if (!id) return '';
    return players.find(p => p.id === id)?.name || id;
  };

  // Format Game Type Pill Color
  const getFormatBadgeStyle = (format: string) => {
    if (format === '8-Ball') return 'bg-billiard-black text-white border border-slate-700';
    if (format === '9-Ball') return 'bg-billiard-yellow/10 text-billiard-yellow border border-billiard-yellow/30';
    return 'bg-billiard-blue/10 text-billiard-blue border border-billiard-blue/30';
  };

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Premium Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl glass-panel p-8 sm:p-12 shadow-2xl border border-white/5">
        {/* Glowing background billiard accents */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 h-80 w-80 rounded-full bg-primary/10 blur-[80px]" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 h-60 w-60 rounded-full bg-accent/5 blur-[60px]" />

        <div className="relative z-10 max-w-2xl space-y-6">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary border border-primary/20">
            <Activity className="h-3.5 w-3.5 animate-pulse" />
            Live Tournament Manager
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Organize Professional <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
              Cue Sports Brackets
            </span>
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            Run 8-ball, 9-ball, and 10-ball tournaments with automated APA-style handicap race calculations, money-ball spots, and a double-elimination to single-elimination hybrid stage structure.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <Link
              href="/tournaments/create"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-background hover:bg-primary-hover shadow-lg hover:shadow-primary/30 transition-all cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" />
              Create Tournament
            </Link>
            <Link
              href="/players"
              className="inline-flex items-center gap-2 rounded-xl bg-card border border-border px-5 py-3 text-sm font-bold text-white hover:bg-border/60 hover:text-white transition-all cursor-pointer"
            >
              <Users className="h-4 w-4" />
              Roster Directory
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {/* Stat item */}
        <div className="glass-panel rounded-2xl p-5 shadow-lg flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Total Players</p>
            <h3 className="text-2xl font-black text-white mt-0.5">{loading ? '-' : players.length}</h3>
          </div>
        </div>
        {/* Stat item */}
        <div className="glass-panel rounded-2xl p-5 shadow-lg flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Active Tourneys</p>
            <h3 className="text-2xl font-black text-white mt-0.5">{loading ? '-' : activeTourneys.length}</h3>
          </div>
        </div>
        {/* Stat item */}
        <div className="glass-panel rounded-2xl p-5 shadow-lg flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-billiard-red/10 flex items-center justify-center text-billiard-red">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Completed</p>
            <h3 className="text-2xl font-black text-white mt-0.5">{loading ? '-' : completedTourneys.length}</h3>
          </div>
        </div>
        {/* Stat item */}
        <div className="glass-panel rounded-2xl p-5 shadow-lg flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-billiard-yellow/10 flex items-center justify-center text-billiard-yellow">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Total Events</p>
            <h3 className="text-2xl font-black text-white mt-0.5">{loading ? '-' : tournaments.length}</h3>
          </div>
        </div>
      </div>

      {/* Tournaments Sections */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Circle className="h-2.5 w-2.5 fill-primary text-primary animate-pulse" />
            Tournaments
          </h2>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            <span className="inline-block animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mr-2 animate-spin"></span>
            Loading tournaments...
          </div>
        ) : tournaments.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 text-center text-muted-foreground">
            <Trophy className="h-12 w-12 mx-auto text-muted mb-4" />
            <p className="font-semibold text-white">No tournaments created yet</p>
            <p className="text-sm mt-1 max-w-sm mx-auto">
              Get started by clicking &quot;Create Tournament&quot; above to seed players and generate brackets.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {tournaments.map(tourney => {
              const isActive = tourney.status === 'active';

              return (
                <div
                  key={tourney.id}
                  className="glass-panel glass-panel-hover rounded-2xl p-6 shadow-xl flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    {/* Header: Format + Status */}
                    <div className="flex items-center justify-between">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase ${getFormatBadgeStyle(tourney.gameType)}`}>
                        {tourney.gameType}
                      </span>
                      {isActive ? (
                        <span className="flex items-center gap-1.5 text-xs text-primary font-bold">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                          Live
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground font-medium">
                          Completed
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <div>
                      <h3 className="text-lg font-bold text-white line-clamp-1">{tourney.name}</h3>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(tourney.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Body / Winner / CTA */}
                  <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                    {!isActive && tourney.winnerId ? (
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-billiard-yellow/10 flex items-center justify-center text-billiard-yellow border border-billiard-yellow/20">
                          <Trophy className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Winner</p>
                          <p className="text-xs font-bold text-white truncate max-w-[120px]">
                            {getPlayerName(tourney.winnerId)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                        Running Group Stage
                      </div>
                    )}

                    <Link
                      href={`/tournaments/${tourney.id}`}
                      className={`inline-flex items-center gap-1 rounded-lg px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-primary text-background hover:bg-primary-hover shadow-md'
                          : 'bg-card border border-border text-white hover:bg-border/50'
                      }`}
                    >
                      <Play className="h-3 w-3 fill-current" />
                      View Bracket
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
