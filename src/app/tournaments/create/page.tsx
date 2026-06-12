'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Player, GameType } from '@/types';
import { getDatabaseAdapter } from '@/lib/db';
import { Trophy, Users, CheckSquare, Square, ChevronRight, Info, Coins } from 'lucide-react';

const PAYOUT_PRESETS: Record<number, number[]> = {
  2: [70, 30],
  4: [40, 30, 20, 10],
  8: [25, 18, 15, 12, 10, 8, 7, 5],
  16: [20, 14, 9, 9, 6, 6, 6, 6, 3, 3, 3, 3, 3, 3, 3, 3],
  32: [28, 12, 6, 6, 4, 4, 4, 4, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
};

export default function CreateTournamentPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [gameType, setGameType] = useState<GameType>('8-Ball');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [entryFee, setEntryFee] = useState<number>(0);
  const [payoutPositions, setPayoutPositions] = useState<number>(4);
  const [payoutPercentages, setPayoutPercentages] = useState<number[]>([40, 30, 20, 10]);

  const [hasCalcutta, setHasCalcutta] = useState<boolean>(false);
  const [calcuttaMinStartBet, setCalcuttaMinStartBet] = useState<number>(10);
  const [calcuttaMinIncrement, setCalcuttaMinIncrement] = useState<number>(5);
  const [calcuttaPayoutPositions, setCalcuttaPayoutPositions] = useState<number>(4);
  const [calcuttaPayoutPercentages, setCalcuttaPayoutPercentages] = useState<number[]>([40, 30, 20, 10]);

  // Inline player creation states
  const [showAddPlayerForm, setShowAddPlayerForm] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newSl8, setNewSl8] = useState(4);
  const [newSl9, setNewSl9] = useState(4);
  const [newSl10, setNewSl10] = useState(4);
  const [inlineError, setInlineError] = useState('');

  const db = getDatabaseAdapter();

  const handleAddPlayerInline = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError('');

    if (!newPlayerName.trim()) {
      setInlineError('Player name is required');
      return;
    }

    try {
      const newPlayer = await db.createPlayer({
        name: newPlayerName.trim(),
        skillLevel8: newSl8,
        skillLevel9: newSl9,
        skillLevel10: newSl10,
      });

      // Update players list in UI
      setPlayers(prev => [newPlayer, ...prev]);

      // Auto-select the newly created player
      setSelectedIds(prev => [...prev, newPlayer.id]);

      // Reset form fields
      setNewPlayerName('');
      setNewSl8(4);
      setNewSl9(4);
      setNewSl10(4);
      setShowAddPlayerForm(false);
    } catch (err) {
      console.error(err);
      setInlineError('Failed to register player inline');
    }
  };

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

  const handlePayoutPositionsChange = (num: number) => {
    setPayoutPositions(num);
    const preset = PAYOUT_PRESETS[num] || Array(num).fill(Math.floor(100 / num));
    setPayoutPercentages(preset);
    setCalcuttaPayoutPositions(num);
    setCalcuttaPayoutPercentages(preset);
  };

  const handlePercentageChange = (index: number, val: number) => {
    setPayoutPercentages(prev => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  const handleCalcuttaPayoutPositionsChange = (num: number) => {
    setCalcuttaPayoutPositions(num);
    setCalcuttaPayoutPercentages(PAYOUT_PRESETS[num] || Array(num).fill(Math.floor(100 / num)));
  };

  const handleCalcuttaPercentageChange = (index: number, val: number) => {
    setCalcuttaPayoutPercentages(prev => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  const percentageSum = payoutPercentages.reduce((a, b) => a + b, 0);
  const calcuttaPercentageSum = calcuttaPayoutPercentages.reduce((a, b) => a + b, 0);
  const totalPrizePool = entryFee * selectedIds.length;

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
    if (percentageSum !== 100) {
      setError('Prize money payout percentages must sum to exactly 100%');
      return;
    }
    if (hasCalcutta && calcuttaPercentageSum !== 100) {
      setError('Calcutta payout percentages must sum to exactly 100%');
      return;
    }

    setSubmitting(true);
    try {
      const tournament = await db.createTournament(
        name.trim(),
        gameType,
        selectedIds,
        entryFee,
        payoutPercentages,
        hasCalcutta,
        calcuttaMinStartBet,
        calcuttaMinIncrement,
        hasCalcutta ? calcuttaPayoutPercentages : undefined
      );
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

            {/* Entry Fee */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Entry Price (฿)
              </label>
              <input
                type="number"
                min="0"
                value={entryFee === 0 ? '' : entryFee}
                onChange={e => setEntryFee(Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="e.g. 50 (Optional)"
                className="w-full rounded-lg bg-background border border-border px-4 py-2 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors font-bold"
              />
            </div>

            {/* Payout Positions Selection */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Paid Positions
              </label>
              <div className="flex items-center gap-1 justify-between bg-background p-1 border border-border rounded-lg">
                {[2, 4, 8, 16, 32].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handlePayoutPositionsChange(num)}
                    className={`h-7 w-9 rounded font-extrabold text-[10px] cursor-pointer transition-all flex items-center justify-center ${
                      payoutPositions === num
                        ? 'bg-primary text-background'
                        : 'text-muted-foreground hover:text-white hover:bg-border/30'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Payout Percentages Config */}
            <div className="space-y-2.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Payout Splits (%)
              </label>
              <div className="space-y-2 bg-background/40 border border-border/40 p-3 rounded-lg">
                {payoutPercentages.map((pct, idx) => {
                  const label = idx === 0 ? '1st' : idx === 1 ? '2nd' : idx === 2 ? '3rd' : `${idx + 1}th`;
                  const estAmount = (totalPrizePool * pct) / 100;
                  return (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <span className="w-8 font-bold text-muted-foreground">{label}:</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={pct}
                        onChange={e => handlePercentageChange(idx, Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                        className="w-14 rounded bg-background border border-border/60 px-2 py-1 text-center font-black text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                      <span className="text-muted-foreground/60 font-medium">%</span>
                      {entryFee > 0 && selectedIds.length > 0 && (
                        <span className="ml-auto font-black text-emerald-400 text-[11px]">
                          ฿{estAmount.toFixed(0)}
                        </span>
                      )}
                    </div>
                  );
                })}
                <div className="flex justify-between items-center border-t border-border/40 pt-2 mt-1 text-[11px]">
                  <span className="font-bold text-muted-foreground">Total:</span>
                  <span className={`font-black ${percentageSum === 100 ? 'text-primary' : 'text-billiard-red'}`}>
                    {percentageSum}%
                  </span>
                </div>
              </div>
            </div>

            {/* Calcutta Setup Checkbox */}
            <div className="pt-2 border-t border-border/40">
              <label className="flex items-start gap-3 text-xs font-semibold text-white select-none cursor-pointer group">
                <input
                  type="checkbox"
                  checked={hasCalcutta}
                  onChange={e => setHasCalcutta(e.target.checked)}
                  className="rounded accent-primary bg-background border-border mt-0.5 cursor-pointer h-4 w-4"
                />
                <div>
                  <span className="font-bold text-white group-hover:text-primary transition-colors flex items-center gap-1.5">
                    <Coins className="h-4 w-4 text-primary" />
                    Enable Calcutta Betting
                  </span>
                  <p className="text-[10px] text-muted-foreground font-normal mt-0.5">
                    Players can be auctioned to bets. Configure start bets and increment.
                  </p>
                </div>
              </label>
            </div>

            {/* Calcutta Settings Expandable Panel */}
            {hasCalcutta && (
              <div className="space-y-4 pt-3 border-t border-border/30 animate-fade-in">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Min Start Bet (฿)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={calcuttaMinStartBet === 0 ? '' : calcuttaMinStartBet}
                      onChange={e => setCalcuttaMinStartBet(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full rounded-lg bg-background border border-border px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary transition-colors font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Bid Increment (฿)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={calcuttaMinIncrement === 0 ? '' : calcuttaMinIncrement}
                      onChange={e => setCalcuttaMinIncrement(Math.max(1, parseInt(e.target.value) || 0))}
                      className="w-full rounded-lg bg-background border border-border px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary transition-colors font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Calcutta Splits (%)
                  </label>
                  <div className="space-y-2 bg-background/40 border border-border/40 p-3 rounded-lg">
                    {calcuttaPayoutPercentages.map((pct, idx) => {
                      const label = idx === 0 ? '1st' : idx === 1 ? '2nd' : idx === 2 ? '3rd' : `${idx + 1}th`;
                      return (
                        <div key={idx} className="flex items-center gap-2 text-xs">
                          <span className="w-8 font-bold text-muted-foreground">{label}:</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={pct}
                            onChange={e => handleCalcuttaPercentageChange(idx, Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                            className="w-12 rounded bg-background border border-border/60 px-2 py-0.5 text-center font-bold text-white focus:outline-none focus:border-primary"
                          />
                          <span className="text-muted-foreground/60 font-medium">%</span>
                        </div>
                      );
                    })}
                    <div className="flex justify-between items-center border-t border-border/40 pt-2 mt-1 text-[10px]">
                      <span className="font-bold text-muted-foreground">Total:</span>
                      <span className={`font-black ${calcuttaPercentageSum === 100 ? 'text-primary' : 'text-billiard-red'}`}>
                        {calcuttaPercentageSum}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

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
              disabled={submitting || percentageSum !== 100 || (hasCalcutta && calcuttaPercentageSum !== 100)}
              className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-background hover:bg-primary-hover shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddPlayerForm(!showAddPlayerForm)}
                  className={`rounded px-2.5 py-1 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    showAddPlayerForm
                      ? 'bg-billiard-red text-white'
                      : 'bg-primary text-background hover:bg-primary-hover shadow-md'
                  }`}
                >
                  {showAddPlayerForm ? 'Cancel' : '+ Add Player'}
                </button>
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

            {showAddPlayerForm && (
              <form onSubmit={handleAddPlayerInline} className="glass-panel p-4 rounded-xl border border-primary/20 bg-slate-950/40 space-y-4 animate-fade-in">
                <div className="flex items-center justify-between pb-1.5 border-b border-border/20">
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">Register New Player</h3>
                  <button
                    type="button"
                    onClick={() => setShowAddPlayerForm(false)}
                    className="text-[10px] font-bold text-muted-foreground hover:text-white"
                  >
                    Close
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={newPlayerName}
                      onChange={e => setNewPlayerName(e.target.value)}
                      placeholder="e.g. Jeanette Lee"
                      className="w-full rounded-lg bg-background border border-border/40 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary font-semibold"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        8-Ball Skill Level: <span className="text-primary font-black">{newSl8}</span>
                      </label>
                      <div className="flex gap-1 justify-between bg-background p-0.5 border border-border/40 rounded-lg">
                        {[2, 3, 4, 5, 6, 7].map(num => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setNewSl8(num)}
                            className={`h-6 w-7 rounded font-black text-[10px] transition-all flex items-center justify-center cursor-pointer ${
                              newSl8 === num
                                ? 'bg-primary text-background'
                                : 'text-muted-foreground hover:text-white'
                            }`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        9-Ball Skill Level: <span className="text-primary font-black">{newSl9}</span>
                      </label>
                      <div className="flex gap-1 justify-between bg-background p-0.5 border border-border/40 rounded-lg">
                        {[2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setNewSl9(num)}
                            className={`h-6 w-6 rounded font-black text-[9px] transition-all flex items-center justify-center cursor-pointer ${
                              newSl9 === num
                                ? 'bg-primary text-background'
                                : 'text-muted-foreground hover:text-white'
                            }`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        10-Ball Skill Level: <span className="text-primary font-black">{newSl10}</span>
                      </label>
                      <div className="flex gap-1 justify-between bg-background p-0.5 border border-border/40 rounded-lg">
                        {[2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setNewSl10(num)}
                            className={`h-6 w-6 rounded font-black text-[9px] transition-all flex items-center justify-center cursor-pointer ${
                              newSl10 === num
                                ? 'bg-primary text-background'
                                : 'text-muted-foreground hover:text-white'
                            }`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {inlineError && (
                  <div className="rounded bg-billiard-red/10 border border-billiard-red/20 p-2 text-[10px] text-billiard-red font-bold animate-pulse">
                    {inlineError}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full rounded-lg bg-primary py-2 text-xs font-black text-background hover:bg-primary-hover shadow-lg hover:shadow-primary/10 transition-all cursor-pointer"
                >
                  Register & Select Player
                </button>
              </form>
            )}

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
