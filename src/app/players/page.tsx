'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Player } from '@/types';
import { getDatabaseAdapter } from '@/lib/db';
import { Search, Plus, User, Info, Lock, Trash2, Edit3 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function PlayersPage() {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [players, setPlayers] = useState<Player[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [name, setName] = useState('');
  const [sl8, setSl8] = useState(10);
  const [sl9, setSl9] = useState(10);
  const [sl10, setSl10] = useState(10);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  // Sync inputs with edit player details
  useEffect(() => {
    if (editingPlayer) {
      setName(editingPlayer.name);
      setSl8(editingPlayer.skillLevel8);
      setSl9(editingPlayer.skillLevel9);
      setSl10(editingPlayer.skillLevel10);
    } else {
      setName('');
      setSl8(10);
      setSl9(10);
      setSl10(10);
    }
  }, [editingPlayer]);

  const db = getDatabaseAdapter();

  // Load players
  useEffect(() => {
    async function loadData() {
      try {
        const list = await db.getPlayers();
        // Filter out BYEs in the general directory
        setPlayers(list.filter(p => !p.isBye));
      } catch (err) {
        console.error('Failed to load players:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Player name is required');
      return;
    }
    
    setError('');
    setMessage('');

    try {
      if (editingPlayer) {
        const updated = await db.updatePlayer(editingPlayer.id, {
          name: name.trim(),
          skillLevel8: sl8,
          skillLevel9: sl9,
          skillLevel10: sl10,
        }, user?.email);
        setPlayers(prev => prev.map(p => p.id === updated.id ? updated : p));
        setEditingPlayer(null);
        setMessage(`Successfully updated ${updated.name}!`);
      } else {
        const newPlayer = await db.createPlayer({
          name: name.trim(),
          skillLevel8: sl8,
          skillLevel9: sl9,
          skillLevel10: sl10,
        });
        setPlayers(prev => [newPlayer, ...prev]);
        setName('');
        setSl8(10);
        setSl9(10);
        setSl10(10);
        setMessage(`Successfully registered ${newPlayer.name}!`);
      }
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setError(editingPlayer ? 'Failed to update player' : 'Failed to register player');
    }
  };

  const handleDeletePlayer = async (playerId: string, name: string) => {
    if (!isSuperAdmin) return;
    if (confirm(`Are you sure you want to delete player "${name}"? This action cannot be undone.`)) {
      try {
        await db.deletePlayer(playerId);
        setPlayers(prev => prev.filter(p => p.id !== playerId));
        setMessage(`Successfully deleted ${name}`);
        setTimeout(() => setMessage(''), 3000);
      } catch (err) {
        console.error('Failed to delete player:', err);
        setError('Failed to delete player');
      }
    }
  };

  const filteredPlayers = players.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Helper to color skill levels
  const getSlColor = (sl: number) => {
    if (sl >= 16) return 'bg-billiard-red/10 text-billiard-red border border-billiard-red/30 shadow-[0_0_10px_rgba(239,68,68,0.15)]';
    if (sl >= 10) return 'bg-billiard-orange/10 text-billiard-orange border border-billiard-orange/30';
    if (sl >= 6) return 'bg-billiard-blue/10 text-billiard-blue border border-billiard-blue/30';
    return 'bg-billiard-green/10 text-billiard-green border border-billiard-green/30';
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Player <span className="text-primary">Directory</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage player rosters and update individual handicaps for 8, 9, and 10-ball tournaments.
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Register Player Form */}
        <div className="lg:col-span-1">
          {authLoading ? (
            <div className="glass-panel rounded-2xl p-6 shadow-xl space-y-6 text-center py-12">
              <span className="inline-block animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mb-2"></span>
              <p className="text-xs text-muted-foreground">Checking authorization...</p>
            </div>
          ) : !isAuthenticated ? (
            <div className="glass-panel rounded-2xl p-6 shadow-xl text-center py-10 space-y-6">
              <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-border/10 text-muted-foreground border border-border/20">
                <Lock className="h-5 w-5 text-muted-foreground/65" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-white">Registration Locked</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Only logged-in administrators can register new players or configure handicaps.
                </p>
              </div>
              <a
                href="/login"
                className="w-full inline-flex items-center justify-center rounded-lg bg-primary/10 border border-primary/20 py-2.5 text-xs font-bold text-primary hover:bg-primary hover:text-background transition-all"
              >
                Sign In as Admin
              </a>
            </div>
          ) : (
            <div className="glass-panel rounded-2xl p-6 shadow-xl space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  {editingPlayer ? (
                    <Edit3 className="h-5 w-5 text-billiard-blue shrink-0" />
                  ) : (
                    <Plus className="h-5 w-5 text-primary shrink-0" />
                  )}
                  {editingPlayer ? 'Edit Player Details' : 'Register New Player'}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {editingPlayer
                    ? `Modify name or handicap configurations for ${editingPlayer.name}.`
                    : 'Add players to the system to make them available for tournament selection.'}
                </p>
              </div>

              <form onSubmit={handleAddPlayer} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Jeanette Lee"
                    className="w-full rounded-lg bg-background border border-border px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  />
                </div>

                {/* 8-ball SL Selection */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    8-Ball Skill Level: <span className="text-white font-bold">{sl8}</span>
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="22"
                    value={sl8}
                    onChange={e => setSl8(parseInt(e.target.value))}
                    className="w-full accent-primary bg-border h-1.5 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground px-1 mt-1">
                    <span>3 (Novice)</span>
                    <span>22 (Grandmaster)</span>
                  </div>
                </div>

                {/* 9-ball SL Selection */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    9-Ball Skill Level: <span className="text-white font-bold">{sl9}</span>
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="22"
                    value={sl9}
                    onChange={e => setSl9(parseInt(e.target.value))}
                    className="w-full accent-primary bg-border h-1.5 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground px-1 mt-1">
                    <span>3 (Novice)</span>
                    <span>22 (Grandmaster)</span>
                  </div>
                </div>

                {/* 10-ball SL Selection */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    10-Ball Skill Level: <span className="text-white font-bold">{sl10}</span>
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="22"
                    value={sl10}
                    onChange={e => setSl10(parseInt(e.target.value))}
                    className="w-full accent-primary bg-border h-1.5 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground px-1 mt-1">
                    <span>3 (Novice)</span>
                    <span>22 (Grandmaster)</span>
                  </div>
                </div>

                {message && (
                  <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-xs text-primary font-medium animate-pulse">
                    {message}
                  </div>
                )}

                {error && (
                  <div className="rounded-lg bg-billiard-red/10 border border-billiard-red/20 p-3 text-xs text-billiard-red font-medium">
                    {error}
                  </div>
                )}

                <div className="flex gap-2">
                  {editingPlayer && (
                    <button
                      type="button"
                      onClick={() => setEditingPlayer(null)}
                      className="flex-1 rounded-lg bg-slate-900 border border-border py-3 text-sm font-bold text-white hover:bg-slate-800 transition-all cursor-pointer font-bold select-none"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    className="flex-1 rounded-lg bg-primary py-3 text-sm font-bold text-background hover:bg-primary-hover shadow-lg hover:shadow-primary/20 transition-all cursor-pointer"
                  >
                    {editingPlayer ? 'Save Changes' : 'Register Player'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Right Columns: Player List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center rounded-xl bg-card border border-border px-4 py-3 shadow-md focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
            <Search className="h-5 w-5 text-muted-foreground mr-3" />
            <input
              type="text"
              placeholder="Search players by name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-white focus:outline-none"
            />
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <span className="inline-block animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mr-2"></span>
              Loading players...
            </div>
          ) : filteredPlayers.length === 0 ? (
            <div className="glass-panel rounded-2xl p-8 text-center text-muted-foreground">
              <Info className="h-8 w-8 mx-auto text-muted mb-2" />
              No players found matching &quot;{searchQuery}&quot;.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredPlayers.map(player => (
                <div
                  key={player.id}
                  className="glass-panel glass-panel-hover rounded-xl p-5 flex items-start gap-4"
                >
                  <Link href={`/players/${player.id}`} className="shrink-0">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20 hover:border-primary/50 hover:bg-primary hover:text-background text-base font-bold uppercase transition-all duration-200 cursor-pointer">
                      {player.name.charAt(0)}{player.name.split(' ')[1]?.charAt(0) || ''}
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/players/${player.id}`}
                      className="hover:text-primary transition-colors inline-flex items-center gap-1.5 group"
                    >
                      <h3 className="text-base font-bold text-white group-hover:text-primary truncate transition-colors">
                        {player.name}
                      </h3>
                      <Info className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                    </Link>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                      Registered: {new Date(player.createdAt).toLocaleDateString()}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${getSlColor(player.skillLevel8)}`}>
                        8B: <span className="font-extrabold">{player.skillLevel8}</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${getSlColor(player.skillLevel9)}`}>
                        9B: <span className="font-extrabold">{player.skillLevel9}</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${getSlColor(player.skillLevel10)}`}>
                        10B: <span className="font-extrabold">{player.skillLevel10}</span>
                      </span>
                    </div>
                  </div>
                  {isSuperAdmin && (
                    <div className="flex gap-1.5 shrink-0 ml-auto">
                      <button
                        type="button"
                        onClick={() => setEditingPlayer(player)}
                        className={`p-2 rounded-lg bg-billiard-blue/10 border border-billiard-blue/25 text-billiard-blue hover:bg-billiard-blue hover:text-white hover:shadow-[0_0_8px_rgba(59,130,246,0.3)] transition-all cursor-pointer select-none ${
                          editingPlayer?.id === player.id ? 'ring-2 ring-primary bg-billiard-blue/30 text-white' : ''
                        }`}
                        title="Edit Player"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePlayer(player.id, player.name)}
                        className="p-2 rounded-lg bg-billiard-red/10 border border-billiard-red/25 text-billiard-red hover:bg-billiard-red hover:text-white hover:shadow-[0_0_8px_rgba(239,68,68,0.3)] transition-all cursor-pointer select-none"
                        title="Delete Player"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
