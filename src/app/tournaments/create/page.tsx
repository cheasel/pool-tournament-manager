'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Player, GameType } from '@/types';
import { getDatabaseAdapter } from '@/lib/db';
import { Trophy, Users, CheckSquare, Square, ChevronRight, Info } from 'lucide-react';

export default function CreateTournamentPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [gameType, setGameType] = useState<GameType>('8-Ball');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const db = getDatabaseAdapter();

  // Load players
  useEffect(() => {
    async function loadData() {
      try {
        const list = await db.getPlayers();
        setPlayers(list.filter(p => !p.isBye));
        // Select all by default to make testing super fast and easy!
        setSelectedIds(list.filter(p => !p.isBye).map(p => p.id));
      } catch (err) {
        console.error('Failed to load players:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const togglePlayer = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedIds(players.map(p => p.id));
  };

  const selectNone = () => {
    setSelectedIds([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Tournament name is required');
      return;
    }
    if (selectedIds.length < 2) {
      setError('Please select at least 2 players to start a tournament');
      return;
    }

    setSubmitting(true);
    try {
      const tournament = await db.createTournament(name.trim(), gameType, selectedIds);
      router.push(`/tournaments/${tournament.id}`);
    } catch (err) {
      console.error(err);
      setError('Failed to create tournament. Please try again.');
      setSubmitting(false);
    }
  };

  // Calculate BYE stats
  const numSelected = selectedIds.length;
  const nextMultipleOf8 = Math.ceil(numSelected / 8) * 8;
  const numByesNeeded = (8 - (numSelected % 8)) % 8;
  const numGroups = nextMultipleOf8 / 8;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Create <span className="text-primary">Tournament</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Configure game types, select players, and let the bracket engine generate the qualifying groups.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-8 md:grid-cols-3">
        {/* Left Column: Config */}
        <div className="md:col-span-1 space-y-6">
          <div className="glass-panel rounded-2xl p-6 shadow-xl space-y-5">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-border pb-3">
              <Trophy className="h-5 w-5 text-primary" />
              Settings
            </h2>

            {/* Tourney Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Tournament Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Summer Cup 2026"
                className="w-full rounded-lg bg-background border border-border px-4 py-2 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                required
              />
            </div>

            {/* Game Type Selection */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Game Format
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['8-Ball', '9-Ball', '10-Ball'] as GameType[]).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setGameType(type)}
                    className={`rounded-lg py-2.5 text-xs font-bold transition-all border cursor-pointer ${
                      gameType === type
                        ? 'bg-primary text-background border-primary shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                        : 'bg-background text-muted-foreground border-border hover:text-white hover:border-muted'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary Information */}
            <div className="rounded-lg bg-card border border-border p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                Structure Summary
              </h3>
              {numSelected > 0 ? (
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Registered Players:</span>
                    <span className="text-white font-semibold">{numSelected}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>BYE Slots Needed:</span>
                    <span className="text-white font-semibold">{numByesNeeded}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1.5 mt-1.5 font-medium">
                    <span className="text-white">Total Tournament Slots:</span>
                    <span className="text-primary font-bold">{nextMultipleOf8}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground/80">
                    <span>Qualifying Groups:</span>
                    <span>{numGroups} groups of 8</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground/80">
                    <span>Knockout Bracket:</span>
                    <span>{numGroups * 4} players Single Elim</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No players selected.</p>
              )}
            </div>

            {numByesNeeded > 0 && (
              <div className="rounded-lg bg-billiard-blue/10 border border-billiard-blue/20 p-3 flex gap-2">
                <Info className="h-4 w-4 text-billiard-blue shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Adding <span className="text-white font-bold">{numByesNeeded} BYE(s)</span> to complete a multiple of 8. BYEs will auto-resolve in brackets.
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-billiard-red/10 border border-billiard-red/20 p-3 text-xs text-billiard-red font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-background hover:bg-primary-hover shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Generating Bracket...' : 'Create & Launch'}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Right Column: Player Selection Grid */}
        <div className="md:col-span-2 space-y-4">
          <div className="glass-panel rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Select Roster ({numSelected} selected)
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="rounded bg-border/50 hover:bg-border px-2.5 py-1 text-xs text-white transition-colors cursor-pointer"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={selectNone}
                  className="rounded bg-border/50 hover:bg-border px-2.5 py-1 text-xs text-white transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12 text-muted-foreground">
                <span className="inline-block animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mr-2"></span>
                Loading player roster...
              </div>
            ) : players.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No players registered yet. Go to the{' '}
                <a href="/players" className="text-primary hover:underline font-bold">
                  Players Page
                </a>{' '}
                to add players first.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 max-h-[500px] overflow-y-auto pr-2">
                {players.map(player => {
                  const isSelected = selectedIds.includes(player.id);
                  const sl =
                    gameType === '8-Ball'
                      ? player.skillLevel8
                      : gameType === '9-Ball'
                      ? player.skillLevel9
                      : player.skillLevel10;

                  return (
                    <div
                      key={player.id}
                      onClick={() => togglePlayer(player.id)}
                      className={`glass-panel p-3.5 rounded-xl flex items-center gap-3 cursor-pointer select-none transition-all ${
                        isSelected
                          ? 'border-primary/40 bg-primary/[0.03] shadow-[0_0_12px_rgba(16,185,129,0.05)]'
                          : 'hover:border-border/80'
                      }`}
                    >
                      {isSelected ? (
                        <CheckSquare className="h-5 w-5 text-primary shrink-0" />
                      ) : (
                        <Square className="h-5 w-5 text-muted shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-muted-foreground'}`}>
                          {player.name}
                        </p>
                      </div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wide bg-background border border-border px-2 py-0.5 rounded text-muted-foreground">
                        SL {sl}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
