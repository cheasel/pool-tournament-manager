'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getDatabaseAdapter } from '@/lib/db';
import { HandicapRaceSetting, GameType } from '@/types';
import { generateDefaultRaces } from '@/lib/db';
import { Save, RotateCcw, Shield, ShieldAlert, Award } from 'lucide-react';

export default function HandicapManagementPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<GameType>('8-Ball');
  const [selectedHigherSkill, setSelectedHigherSkill] = useState<number>(9);
  const [selectedStyle, setSelectedStyle] = useState<string>('default');
  const [newStyleName, setNewStyleName] = useState<string>('');
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const [renameValue, setRenameValue] = useState<string>('');
  const [races, setRaces] = useState<HandicapRaceSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  const db = getDatabaseAdapter();

  useEffect(() => {
    async function loadRaces() {
      try {
        const data = await db.getHandicapRaces();
        setRaces(data);
      } catch (err) {
        console.error('Failed to load handicap races:', err);
      } finally {
        setLoading(false);
      }
    }
    loadRaces();
  }, []);

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh]">
        <span className="inline-block animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mb-3"></span>
        <span className="text-sm text-muted-foreground font-semibold">Loading settings...</span>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'super_admin') {
    return (
      <div className="max-w-md mx-auto my-12 text-center space-y-6 animate-fade-in">
        <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-billiard-red/10 border border-billiard-red/20 text-billiard-red shadow-[0_0_15px_rgba(239,68,68,0.15)]">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-white">Access Denied</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This settings page is restricted to Super Administrators. You do not have permission to configure handicap races.
          </p>
        </div>
        <div className="glass-panel p-6 rounded-xl border border-border flex flex-col gap-3">
          <button
            onClick={() => router.push('/')}
            className="w-full inline-flex items-center justify-center rounded-lg bg-primary py-3 text-sm font-bold text-background hover:bg-primary-hover shadow-lg hover:shadow-primary/20 transition-all font-bold cursor-pointer"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Get all unique styles present in the races data
  const uniqueStyles = Array.from(new Set(races.map(r => r.raceStyle || 'default')));

  // Filter races for the active tab (gameType) and selected style
  const activeRaces = races.filter(
    r => r.gameType === activeTab && (r.raceStyle || 'default') === selectedStyle
  );

  // Filter displaying races for the selected Higher Player Skill Level
  const displayedRaces = activeRaces
    .filter(r => r.higherSkill === selectedHigherSkill)
    .sort((a, b) => b.lowerSkill - a.lowerSkill);

  const handleTargetChange = (lowerSkill: number, field: 'higherTarget' | 'lowerTarget', value: number) => {
    setRaces(prev => prev.map(r => {
      if (
        r.gameType === activeTab &&
        (r.raceStyle || 'default') === selectedStyle &&
        r.higherSkill === selectedHigherSkill &&
        r.lowerSkill === lowerSkill
      ) {
        return { ...r, [field]: Math.max(1, value) };
      }
      return r;
    }));
  };

  const handleSpotToggle = (lowerSkill: number, ball: number) => {
    setRaces(prev => prev.map(r => {
      if (
        r.gameType === activeTab &&
        (r.raceStyle || 'default') === selectedStyle &&
        r.higherSkill === selectedHigherSkill &&
        r.lowerSkill === lowerSkill
      ) {
        const spotted = r.spottedBalls || [];
        const updated = spotted.includes(ball)
          ? spotted.filter(b => b !== ball)
          : [...spotted, ball].sort((a, b) => a - b);
        return { ...r, spottedBalls: updated };
      }
      return r;
    }));
  };

  const handleSetSpots = (lowerSkill: number, updatedSpots: number[]) => {
    setRaces(prev => prev.map(r => {
      if (
        r.gameType === activeTab &&
        (r.raceStyle || 'default') === selectedStyle &&
        r.higherSkill === selectedHigherSkill &&
        r.lowerSkill === lowerSkill
      ) {
        return { ...r, spottedBalls: updatedSpots };
      }
      return r;
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccessMsg('');
    try {
      await db.updateHandicapRaces(races);
      setSuccessMsg('Handicap race settings updated successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error(err);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (confirm(`Are you sure you want to reset the selected race style "${selectedStyle}" to default formula values? This will override custom settings for this style.`)) {
      const defaults = generateDefaultRaces([selectedStyle]);
      setRaces(prev => [
        ...prev.filter(r => (r.raceStyle || 'default') !== selectedStyle),
        ...defaults
      ]);
      setSuccessMsg(`Reset "${selectedStyle}" style to default formulas. Click "Save Settings" to apply.`);
    }
  };

  const handleCreateStyle = () => {
    const trimmed = newStyleName.trim();
    if (!trimmed) return;
    
    const exists = uniqueStyles.some(s => s.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      alert('A race style with this name already exists.');
      return;
    }

    const newStyleRaces = generateDefaultRaces([trimmed]);
    setRaces(prev => [...prev, ...newStyleRaces]);
    setSelectedStyle(trimmed);
    setNewStyleName('');
    setSuccessMsg(`Created race style "${trimmed}". Click "Save Settings" to persist.`);
  };

  const handleRenameStyle = () => {
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    if (selectedStyle === 'default') {
      alert('Cannot rename the default race style.');
      return;
    }
    
    const exists = uniqueStyles.some(s => s.toLowerCase() === trimmed.toLowerCase() && s !== selectedStyle);
    if (exists) {
      alert('A race style with this name already exists.');
      return;
    }

    setRaces(prev => prev.map(r => {
      if ((r.raceStyle || 'default') === selectedStyle) {
        return { ...r, raceStyle: trimmed };
      }
      return r;
    }));

    setSelectedStyle(trimmed);
    setIsRenaming(false);
    setSuccessMsg(`Renamed style to "${trimmed}". Click "Save Settings" to persist.`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] bg-billiard-orange/10 text-billiard-orange border border-billiard-orange/30 px-2.5 py-0.5 rounded-full font-bold shadow-[0_0_10px_rgba(249,115,22,0.1)]">
              <Shield className="h-3 w-3" />
              Super Admin Settings
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mt-2">
            Configure <span className="text-primary">Handicap Races</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Customize target race racks and ball spotting values based on skill level combinations.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 px-4 py-2.5 text-xs font-bold transition-all border border-border cursor-pointer select-none"
          >
            <RotateCcw className="h-4 w-4" />
            Reset Defaults
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary hover:bg-primary-hover text-background px-5 py-2.5 text-xs font-black transition-all shadow-lg hover:shadow-primary/25 cursor-pointer disabled:opacity-50 select-none"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {successMsg && (
        <div className="glass-panel p-4 rounded-xl border border-primary/20 bg-primary/10 text-primary text-xs font-bold text-center animate-pulse">
          {successMsg}
        </div>
      )}

      {/* Main Tab selectors */}
      <div className="flex gap-2.5 border-b border-border/40 pb-4">
        {(['8-Ball', '9-Ball', '10-Ball'] as GameType[]).map(type => (
          <button
            key={type}
            type="button"
            onClick={() => setActiveTab(type)}
            className={`rounded-lg px-5 py-2.5 text-xs font-extrabold transition-all border cursor-pointer ${
              activeTab === type
                ? 'bg-primary text-background border-primary shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                : 'bg-background text-muted-foreground border-border/80 hover:text-white hover:border-muted'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Race Style Selector and Creator Card */}
      <div className="glass-panel p-6 rounded-2xl border border-border/40 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          {/* Left side: Selector / Renaming */}
          <div className="flex-1 space-y-2">
            <label className="block text-xs font-black uppercase text-muted-foreground tracking-wider">
              Selected Handicap Race Style
            </label>
            
            {isRenaming ? (
              <div className="flex items-center gap-2 max-w-md">
                <input
                  type="text"
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  className="flex-1 bg-background border border-border/40 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-primary"
                  placeholder="Enter new style name..."
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleRenameStyle}
                  className="rounded-lg bg-primary hover:bg-primary-hover text-background px-3 py-2 text-xs font-black cursor-pointer transition-all"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsRenaming(false)}
                  className="rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-border/40 px-3 py-2 text-xs font-bold cursor-pointer transition-all"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <select
                  value={selectedStyle}
                  onChange={e => setSelectedStyle(e.target.value)}
                  className="bg-slate-950 border border-border/40 rounded-lg px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-primary min-w-[200px] cursor-pointer"
                >
                  {uniqueStyles.map(style => (
                    <option key={style} value={style}>
                      {style === 'default' ? 'Default / Standard Race' : style}
                    </option>
                  ))}
                </select>
                {selectedStyle !== 'default' && (
                  <button
                    type="button"
                    onClick={() => {
                      setRenameValue(selectedStyle);
                      setIsRenaming(true);
                    }}
                    className="rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-border/40 px-3 py-2.5 text-xs font-bold cursor-pointer transition-all animate-fade-in"
                  >
                    Rename
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right side: Create New Style */}
          <div className="flex-1 max-w-md space-y-2">
            <label className="block text-xs font-black uppercase text-muted-foreground tracking-wider">
              Create Custom Race Style
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newStyleName}
                onChange={e => setNewStyleName(e.target.value)}
                className="flex-1 bg-background border border-border/40 rounded-lg px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-primary"
                placeholder="e.g. Short Race, Long Race..."
              />
              <button
                type="button"
                onClick={handleCreateStyle}
                className="rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-border/40 px-4 py-2.5 text-xs font-black cursor-pointer transition-all select-none"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Selection of Higher Player Skill Level */}
      <div className="glass-panel p-5 rounded-2xl border border-border/40 space-y-3">
        <label className="block text-xs font-black uppercase text-muted-foreground tracking-wider">
          Higher Player Skill Level (SL)
        </label>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 20 }, (_, i) => 22 - i).map(sl => {
            const isSelected = selectedHigherSkill === sl;
            return (
              <button
                key={sl}
                type="button"
                onClick={() => setSelectedHigherSkill(sl)}
                className={`h-9 min-w-[44px] px-2 rounded-lg text-xs font-black transition-all border cursor-pointer ${
                  isSelected
                    ? 'bg-primary text-background border-primary shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                    : 'bg-slate-950 text-muted-foreground border-border/40 hover:text-white hover:border-muted'
                }`}
              >
                {sl}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Select a higher player's skill level above. The table below will show the handicap races against all possible lower player skill levels.
        </p>
      </div>

      {/* Settings Lookup/Edit Table */}
      <div className="glass-panel rounded-2xl shadow-xl overflow-hidden border border-border/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/60 border-b border-border/40 text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                <th className="py-3 px-6 text-center w-[20%]">Matchup</th>
                <th className="py-3 px-6 text-center w-[15%]">Difference</th>
                <th className="py-3 px-6 text-center w-[20%]">Higher Player Race</th>
                <th className="py-3 px-6 text-center w-[20%]">Lower Player Race</th>
                <th className="py-3 px-6 text-center w-[25%]">Lower Player Spots / Balls Given</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10 font-bold text-xs text-slate-200">
              {displayedRaces.map(row => {
                const spots = row.spottedBalls || [];
                const diff = row.higherSkill - row.lowerSkill;

                return (
                  <tr key={row.lowerSkill} className="hover:bg-slate-800/10 transition-colors">
                    {/* Matchup */}
                    <td className="py-4 px-6 text-center">
                      <span className="inline-flex items-center justify-center min-w-16 px-2.5 py-1 rounded bg-slate-900 border border-border/50 text-slate-300 font-extrabold text-[11px]">
                        SL {row.higherSkill} vs SL {row.lowerSkill}
                      </span>
                    </td>

                    {/* Difference Label */}
                    <td className="py-4 px-6 text-center">
                      <span className="text-[11px] text-muted-foreground font-black">
                        Diff {diff}
                      </span>
                    </td>

                    {/* Higher Target Input */}
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center gap-2 max-w-[120px] mx-auto">
                        <button
                          type="button"
                          onClick={() => handleTargetChange(row.lowerSkill, 'higherTarget', row.higherTarget - 1)}
                          className="h-8 w-8 rounded bg-slate-950 border border-border/40 hover:bg-slate-900 flex items-center justify-center text-white text-xs font-black cursor-pointer select-none"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={row.higherTarget}
                          onChange={e => handleTargetChange(row.lowerSkill, 'higherTarget', parseInt(e.target.value) || 1)}
                          className="w-12 bg-background border border-border/40 rounded py-1 text-center font-black text-white focus:outline-none focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={() => handleTargetChange(row.lowerSkill, 'higherTarget', row.higherTarget + 1)}
                          className="h-8 w-8 rounded bg-slate-950 border border-border/40 hover:bg-slate-900 flex items-center justify-center text-white text-xs font-black cursor-pointer select-none"
                        >
                          +
                        </button>
                      </div>
                    </td>

                    {/* Lower Target Input */}
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center gap-2 max-w-[120px] mx-auto">
                        <button
                          type="button"
                          onClick={() => handleTargetChange(row.lowerSkill, 'lowerTarget', row.lowerTarget - 1)}
                          className="h-8 w-8 rounded bg-slate-950 border border-border/40 hover:bg-slate-900 flex items-center justify-center text-white text-xs font-black cursor-pointer select-none"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={row.lowerTarget}
                          onChange={e => handleTargetChange(row.lowerSkill, 'lowerTarget', parseInt(e.target.value) || 1)}
                          className="w-12 bg-background border border-border/40 rounded py-1 text-center font-black text-white focus:outline-none focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={() => handleTargetChange(row.lowerSkill, 'lowerTarget', row.lowerTarget + 1)}
                          className="h-8 w-8 rounded bg-slate-950 border border-border/40 hover:bg-slate-900 flex items-center justify-center text-white text-xs font-black cursor-pointer select-none"
                        >
                          +
                        </button>
                      </div>
                    </td>

                    {/* Spots Toggles */}
                    <td className="py-4 px-6">
                      {activeTab === '8-Ball' ? (
                        <div className="flex items-center justify-center gap-2 select-none">
                          {[0, 1, 2, 3].map(count => {
                            const currentCount = spots.length;
                            const isSelected = currentCount === count;
                            return (
                              <button
                                key={count}
                                type="button"
                                onClick={() => {
                                  const updatedSpots = count === 0 ? [] : Array.from({ length: count }, (_, i) => i + 1);
                                  handleSetSpots(row.lowerSkill, updatedSpots);
                                }}
                                className={`h-8 px-2.5 rounded text-[10px] font-black transition-all border cursor-pointer ${
                                  isSelected
                                    ? 'bg-accent text-background border-accent shadow-[0_0_8px_rgba(251,191,36,0.3)]'
                                    : 'bg-slate-950 text-muted-foreground border-border/40 hover:text-white hover:border-muted'
                                }`}
                              >
                                {count === 0 ? 'None' : `${count} Ball${count > 1 ? 's' : ''}`}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2 select-none">
                          {[6, 7, 8].map(ball => {
                            const isSpotted = spots.includes(ball);
                            return (
                              <button
                                key={ball}
                                type="button"
                                onClick={() => handleSpotToggle(row.lowerSkill, ball)}
                                className={`h-8 px-3 rounded text-[10px] font-black transition-all border cursor-pointer flex items-center gap-1 ${
                                  isSpotted
                                    ? 'bg-accent text-background border-accent shadow-[0_0_8px_rgba(251,191,36,0.3)]'
                                    : 'bg-slate-950 text-muted-foreground border-border/40 hover:text-white hover:border-muted'
                                }`}
                              >
                                <Award className="h-3.5 w-3.5" />
                                {ball}-Ball
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
