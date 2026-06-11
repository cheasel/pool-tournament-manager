'use client';

import React from 'react';
import { Match, Tournament, Player, MatchStats } from '@/types';
import { X } from 'lucide-react';

interface ScoringModalProps {
  scoringMatch: Match;
  tournament: Tournament;
  getPlayer: (pid: string) => Player;
  score1: number;
  setScore1: React.Dispatch<React.SetStateAction<number>>;
  score2: number;
  setScore2: React.Dispatch<React.SetStateAction<number>>;
  stats1: MatchStats;
  setStats1: React.Dispatch<React.SetStateAction<MatchStats>>;
  stats2: MatchStats;
  setStats2: React.Dispatch<React.SetStateAction<MatchStats>>;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function ScoringModal({
  scoringMatch,
  tournament,
  getPlayer,
  score1,
  setScore1,
  score2,
  setScore2,
  stats1,
  setStats1,
  stats2,
  setStats2,
  saving,
  onClose,
  onSave,
}: ScoringModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-primary/20 space-y-6">
        {/* Modal Header */}
        <div className="flex justify-between items-start border-b border-border pb-4">
          <div>
            <span className="text-[10px] font-bold uppercase bg-primary/15 text-primary px-2.5 py-0.5 rounded">
              Match #{scoringMatch.matchNumber} Scoring
            </span>
            <h2 className="text-xl font-bold text-white mt-2">
              Enter Final Score
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Match Information */}
        <div className="rounded-xl bg-card border border-border p-4 space-y-2 text-xs">
          <div className="flex justify-between text-muted-foreground">
            <span>Format:</span>
            <span className="text-white font-bold">{tournament.gameType}</span>
          </div>
          {/* Ball Spots explanation */}
          {scoringMatch.player1SpottedBalls.length > 0 && (
            <div className="flex justify-between text-accent font-medium mt-1">
              <span>Ball Spots:</span>
              <span>{getPlayer(scoringMatch.player1Id).name} gets the [{scoringMatch.player1SpottedBalls.join(', ')}] spotted</span>
            </div>
          )}
          {scoringMatch.player2SpottedBalls.length > 0 && (
            <div className="flex justify-between text-accent font-medium mt-1">
              <span>Ball Spots:</span>
              <span>{getPlayer(scoringMatch.player2Id).name} gets the [{scoringMatch.player2SpottedBalls.join(', ')}] spotted</span>
            </div>
          )}
        </div>

        {/* Score inputs */}
        <div className="grid gap-6 grid-cols-2">
          {/* Player 1 input */}
          <div className="space-y-3 text-center">
            <p className="text-xs font-bold text-white truncate">
              {getPlayer(scoringMatch.player1Id).name}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setScore1(s => Math.max(0, s - 1))}
                className="h-8 w-8 rounded-full border border-border text-white hover:bg-border flex items-center justify-center font-bold cursor-pointer"
              >
                -
              </button>
              <span className="text-3xl font-black text-white w-8">{score1}</span>
              <button
                onClick={() => setScore1(s => Math.min(scoringMatch.player1Target, s + 1))}
                className="h-8 w-8 rounded-full border border-border text-white hover:bg-border flex items-center justify-center font-bold cursor-pointer"
              >
                +
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">Target: Race to {scoringMatch.player1Target}</p>
            
            {/* Stats Checkboxes P1 */}
            <div className="pt-2 text-left space-y-2 border-t border-border/40 mt-2">
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!stats1.breakAndRun}
                  onChange={e => setStats1(prev => ({ ...prev, breakAndRun: e.target.checked }))}
                  className="rounded accent-primary bg-background border-border"
                />
                Break & Run
              </label>
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!stats1.tableRun}
                  onChange={e => setStats1(prev => ({ ...prev, tableRun: e.target.checked }))}
                  className="rounded accent-primary bg-background border-border"
                />
                Table Run
              </label>
            </div>
          </div>

          {/* Player 2 input */}
          <div className="space-y-3 text-center border-l border-border/60 pl-6">
            <p className="text-xs font-bold text-white truncate">
              {getPlayer(scoringMatch.player2Id).name}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setScore2(s => Math.max(0, s - 1))}
                className="h-8 w-8 rounded-full border border-border text-white hover:bg-border flex items-center justify-center font-bold cursor-pointer"
              >
                -
              </button>
              <span className="text-3xl font-black text-white w-8">{score2}</span>
              <button
                onClick={() => setScore2(s => Math.min(scoringMatch.player2Target, s + 1))}
                className="h-8 w-8 rounded-full border border-border text-white hover:bg-border flex items-center justify-center font-bold cursor-pointer"
              >
                +
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">Target: Race to {scoringMatch.player2Target}</p>

            {/* Stats Checkboxes P2 */}
            <div className="pt-2 text-left space-y-2 border-t border-border/40 mt-2">
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!stats2.breakAndRun}
                  onChange={e => setStats2(prev => ({ ...prev, breakAndRun: e.target.checked }))}
                  className="rounded accent-primary bg-background border-border"
                />
                Break & Run
              </label>
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!stats2.tableRun}
                  onChange={e => setStats2(prev => ({ ...prev, tableRun: e.target.checked }))}
                  className="rounded accent-primary bg-background border-border"
                />
                Table Run
              </label>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-4 border-t border-border">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border py-2.5 text-sm font-semibold text-white hover:bg-border transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving || (score1 < scoringMatch.player1Target && score2 < scoringMatch.player2Target)}
            className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-bold text-background hover:bg-primary-hover disabled:opacity-50 transition-all cursor-pointer shadow-lg hover:shadow-primary/20"
          >
            {saving ? 'Saving...' : 'Submit Score'}
          </button>
        </div>
      </div>
    </div>
  );
}
