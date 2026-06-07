'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TournamentDetails, Match, Player, Group, MatchStats } from '@/types';
import { getDatabaseAdapter } from '@/lib/db';
import { calculateMatchHandicap } from '@/lib/handicap';
import { Trophy, Users, Award, Calendar, Check, Play, Edit3, X, Zap, ChevronRight, CornerDownRight } from 'lucide-react';

export default function TournamentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [details, setDetails] = useState<TournamentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'groups' | 'knockout'>('groups');
  const [activeGroupId, setActiveGroupId] = useState<string>('');
  
  // Scoring Modal State
  const [scoringMatch, setScoringMatch] = useState<Match | null>(null);
  const [score1, setScore1] = useState(0);
  const [score2, setScore2] = useState(0);
  const [stats1, setStats1] = useState<MatchStats>({ breakAndRun: false, tableRun: false });
  const [stats2, setStats2] = useState<MatchStats>({ breakAndRun: false, tableRun: false });
  const [saving, setSaving] = useState(false);

  const db = getDatabaseAdapter();

  async function loadTournament() {
    try {
      const res = await db.getTournamentDetails(id);
      if (res) {
        setDetails(res);
        if (res.groups.length > 0 && !activeGroupId) {
          setActiveGroupId(res.groups[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load tournament:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTournament();
  }, [id]);

  if (loading) {
    return (
      <div className="text-center py-24 text-muted-foreground animate-pulse">
        <span className="inline-block animate-spin h-8 w-8 border-3 border-primary border-t-transparent rounded-full mr-2"></span>
        Loading tournament brackets...
      </div>
    );
  }

  if (!details) {
    return (
      <div className="glass-panel rounded-3xl p-12 text-center max-w-md mx-auto my-12">
        <X className="h-12 w-12 mx-auto text-billiard-red mb-4" />
        <h2 className="text-xl font-bold text-white">Tournament Not Found</h2>
        <button
          onClick={() => router.push('/')}
          className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-background hover:bg-primary-hover transition-all cursor-pointer"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const { tournament, players, groups, matches } = details;
  const playersMap = players.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {} as Record<string, Player>);

  const getPlayer = (pid: string): Player => {
    return playersMap[pid] || {
      id: pid,
      name: pid === 'BYE' || pid.includes('BYE') ? 'BYE' : 'TBD',
      skillLevel8: 2,
      skillLevel9: 2,
      skillLevel10: 2,
      createdAt: '',
      isBye: pid === 'BYE' || pid.includes('BYE'),
    };
  };

  const openScoring = (match: Match) => {
    if (match.player1Id === 'BYE' || match.player2Id === 'BYE') return; // Cannot score bye
    if (!match.player1Id || !match.player2Id) return; // Cannot score TBD

    setScoringMatch(match);
    setScore1(match.player1Score || 0);
    setScore2(match.player2Score || 0);
    setStats1(match.player1Stats || { breakAndRun: false, tableRun: false });
    setStats2(match.player2Stats || { breakAndRun: false, tableRun: false });
  };

  const handleSaveScore = async () => {
    if (!scoringMatch) return;
    setSaving(true);
    try {
      const updatedDetails = await db.updateMatchScore(
        tournament.id,
        scoringMatch.id,
        score1,
        score2,
        stats1,
        stats2
      );
      setDetails(updatedDetails);
      setScoringMatch(null);
    } catch (err) {
      console.error(err);
      alert('Failed to save score');
    } finally {
      setSaving(false);
    }
  };

  const activeGroup = groups.find(g => g.id === activeGroupId);
  const activeGroupMatches = matches.filter(m => m.groupId === activeGroupId);

  // Group stander calculations
  const getGroupStandings = (group: Group) => {
    const groupMatches = matches.filter(m => m.groupId === group.id);
    const results: Record<string, { wins: number; losses: number; status: 'Qualified' | 'Active' | 'Eliminated' }> = {};
    
    group.playerIds.forEach(pid => {
      results[pid] = { wins: 0, losses: 0, status: 'Active' };
    });

    groupMatches.forEach(m => {
      if (m.status !== 'completed' || !m.winnerId) return;
      const loserId = m.player1Id === m.winnerId ? m.player2Id : m.player1Id;

      if (results[m.winnerId]) results[m.winnerId].wins++;
      if (results[loserId]) results[loserId].losses++;
    });

    // Determine specific status based on Double Elimination progression
    // M5 and M6 winners are qualified
    const m5 = groupMatches.find(m => m.matchNumber === 5);
    const m6 = groupMatches.find(m => m.matchNumber === 6);
    if (m5?.status === 'completed' && m5.winnerId && results[m5.winnerId]) {
      results[m5.winnerId].status = 'Qualified';
    }
    if (m6?.status === 'completed' && m6.winnerId && results[m6.winnerId]) {
      results[m6.winnerId].status = 'Qualified';
    }

    // M9 and M10 winners are qualified
    const m7 = groupMatches.find(m => m.matchNumber === 7);
    const m8 = groupMatches.find(m => m.matchNumber === 8);
    const m9 = groupMatches.find(m => m.matchNumber === 9);
    const m10 = groupMatches.find(m => m.matchNumber === 10);
    if (m9?.status === 'completed' && m9.winnerId && results[m9.winnerId]) {
      results[m9.winnerId].status = 'Qualified';
    }
    if (m10?.status === 'completed' && m10.winnerId && results[m10.winnerId]) {
      results[m10.winnerId].status = 'Qualified';
    }

    // Losers of M7 and M8, and M9 and M10 are eliminated
    if (m7?.status === 'completed') {
      const loser7 = m7.winnerId === m7.player1Id ? m7.player2Id : m7.player1Id;
      if (results[loser7]) results[loser7].status = 'Eliminated';
    }
    if (m8?.status === 'completed') {
      const loser8 = m8.winnerId === m8.player1Id ? m8.player2Id : m8.player1Id;
      if (results[loser8]) results[loser8].status = 'Eliminated';
    }
    if (m9?.status === 'completed') {
      const loser9 = m9.winnerId === m9.player1Id ? m9.player2Id : m9.player1Id;
      if (results[loser9]) results[loser9].status = 'Eliminated';
    }
    if (m10?.status === 'completed') {
      const loser10 = m10.winnerId === m10.player1Id ? m10.player2Id : m10.player1Id;
      if (results[loser10]) results[loser10].status = 'Eliminated';
    }

    return Object.entries(results).map(([id, stats]) => ({
      player: getPlayer(id),
      ...stats,
    })).filter(x => !x.player.isBye);
  };

  const knockoutMatches = matches.filter(m => m.roundType === 'knockout');
  const maxKnockoutRound = knockoutMatches.length > 0 ? Math.max(...knockoutMatches.map(m => m.roundNumber)) : 0;

  // Render a match card
  const renderMatchCard = (match: Match) => {
    const p1 = getPlayer(match.player1Id);
    const p2 = getPlayer(match.player2Id);

    const isCompleted = match.status === 'completed';
    const isP1Winner = isCompleted && match.winnerId === match.player1Id;
    const isP2Winner = isCompleted && match.winnerId === match.player2Id;

    const isClickable = match.player1Id && match.player2Id && !p1.isBye && !p2.isBye;

    const formatBilliardBall = (spotArray: number[]) => {
      if (spotArray.length === 0) return null;
      return (
        <span className="flex gap-1 ml-2 text-[9px] font-bold text-accent">
          Spot: {spotArray.join(', ')}
        </span>
      );
    };

    return (
      <div
        key={match.id}
        onClick={() => isClickable && openScoring(match)}
        className={`glass-panel rounded-xl p-3 shadow-md flex flex-col justify-between border relative ${
          isClickable ? 'cursor-pointer hover:border-primary/30 transition-all duration-200' : 'opacity-75'
        } ${isCompleted ? 'bg-card/40' : 'bg-card'}`}
      >
        {/* Match Header info */}
        <div className="flex justify-between items-center text-[10px] text-muted-foreground border-b border-border/40 pb-1.5 mb-2">
          <span className="font-extrabold uppercase text-primary/80">Match #{match.matchNumber}</span>
          <span className="font-medium">
            {match.roundType === 'knockout' ? `Round ${match.roundNumber}` : `DE Group`}
          </span>
        </div>

        {/* Player 1 Row */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isCompleted ? (isP1Winner ? 'bg-primary' : 'bg-muted') : 'bg-slate-500'
              }`}
            />
            <span className={`text-xs font-bold truncate ${isCompleted ? (isP1Winner ? 'text-white' : 'text-muted-foreground') : 'text-slate-200'}`}>
              {p1.name}
            </span>
            {!p1.isBye && match.player1Id && (
              <span className="text-[9px] font-medium text-muted-foreground">
                (SL{tournament.gameType === '8-Ball' ? p1.skillLevel8 : tournament.gameType === '9-Ball' ? p1.skillLevel9 : p1.skillLevel10})
              </span>
            )}
            {formatBilliardBall(match.player1SpottedBalls)}
          </div>
          <div className="flex items-center gap-2">
            {isCompleted ? (
              <span className={`text-xs font-black px-1.5 rounded ${isP1Winner ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}>
                {match.player1Score}
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-muted-foreground">
                /{match.player1Target}
              </span>
            )}
          </div>
        </div>

        {/* Player 2 Row */}
        <div className="flex items-center justify-between py-1 mt-1">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isCompleted ? (isP2Winner ? 'bg-primary' : 'bg-muted') : 'bg-slate-500'
              }`}
            />
            <span className={`text-xs font-bold truncate ${isCompleted ? (isP2Winner ? 'text-white' : 'text-muted-foreground') : 'text-slate-200'}`}>
              {p2.name}
            </span>
            {!p2.isBye && match.player2Id && (
              <span className="text-[9px] font-medium text-muted-foreground">
                (SL{tournament.gameType === '8-Ball' ? p2.skillLevel8 : tournament.gameType === '9-Ball' ? p2.skillLevel9 : p2.skillLevel10})
              </span>
            )}
            {formatBilliardBall(match.player2SpottedBalls)}
          </div>
          <div className="flex items-center gap-2">
            {isCompleted ? (
              <span className={`text-xs font-black px-1.5 rounded ${isP2Winner ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}>
                {match.player2Score}
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-muted-foreground">
                /{match.player2Target}
              </span>
            )}
          </div>
        </div>

        {/* Edit hover overlay icon */}
        {isClickable && !isCompleted && (
          <div className="absolute top-2 right-2 opacity-0 hover:opacity-100 transition-opacity">
            <Edit3 className="h-3 w-3 text-primary" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Info */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-xs font-bold uppercase">
              {tournament.gameType}
            </span>
            <span className={`text-xs font-semibold ${tournament.status === 'active' ? 'text-primary' : 'text-muted-foreground'}`}>
              • {tournament.status === 'active' ? 'Active Bracket' : 'Completed'}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mt-1">
            {tournament.name}
          </h1>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
            <Calendar className="h-3.5 w-3.5" />
            Launched {new Date(tournament.createdAt).toLocaleDateString()}
          </div>
        </div>

        {/* Winner Display if Complete */}
        {tournament.status === 'completed' && tournament.winnerId && (
          <div className="rounded-2xl bg-billiard-yellow/10 border border-billiard-yellow/20 px-6 py-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-billiard-yellow flex items-center justify-center text-background shadow-[0_0_15px_rgba(251,191,36,0.4)]">
              <Trophy className="h-5 w-5 fill-current" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-billiard-yellow">Tournament Champion</p>
              <p className="text-lg font-black text-white">{getPlayer(tournament.winnerId).name}</p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('groups')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'groups'
              ? 'border-primary text-primary shadow-[0_4px_10px_-4px_rgba(16,185,129,0.3)]'
              : 'border-transparent text-muted-foreground hover:text-white'
          }`}
        >
          Group Stages
        </button>
        <button
          onClick={() => setActiveTab('knockout')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'knockout'
              ? 'border-primary text-primary shadow-[0_4px_10px_-4px_rgba(16,185,129,0.3)]'
              : 'border-transparent text-muted-foreground hover:text-white'
          }`}
        >
          Knockout Bracket
        </button>
      </div>

      {/* Group Stage Tab View */}
      {activeTab === 'groups' && (
        <div className="space-y-6">
          {/* Group Tabs */}
          <div className="flex flex-wrap gap-2">
            {groups.map(g => (
              <button
                key={g.id}
                onClick={() => setActiveGroupId(g.id)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                  activeGroupId === g.id
                    ? 'bg-primary text-background border-primary shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                    : 'bg-card text-muted-foreground border-border hover:text-white'
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>

          {activeGroup && (
            <div className="grid gap-8 lg:grid-cols-4">
              {/* Group Standings */}
              <div className="lg:col-span-1 space-y-4">
                <div className="glass-panel rounded-2xl p-5 shadow-xl space-y-4">
                  <h3 className="text-sm font-extrabold text-white border-b border-border pb-2 flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-primary" />
                    Standings & Status
                  </h3>
                  <div className="space-y-3">
                    {getGroupStandings(activeGroup).map(standing => (
                      <div
                        key={standing.player.id}
                        className="flex items-center justify-between border-b border-border/40 pb-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate">{standing.player.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Record: {standing.wins}W - {standing.losses}L
                          </p>
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            standing.status === 'Qualified'
                              ? 'bg-primary/15 text-primary'
                              : standing.status === 'Eliminated'
                              ? 'bg-billiard-red/15 text-billiard-red'
                              : 'bg-billiard-blue/15 text-billiard-blue'
                          }`}
                        >
                          {standing.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Group DE Brackets */}
              <div className="lg:col-span-3 space-y-8">
                {/* Winner's Bracket section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Zap className="h-4 w-4 text-primary" />
                    Winner&apos;s Bracket (0-Loss Qualifying)
                  </h3>
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Winner's Round 1 */}
                    <div className="space-y-4">
                      <p className="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest border-b border-border/40 pb-1">
                        Round 1
                      </p>
                      <div className="space-y-4">
                        {activeGroupMatches.filter(m => m.roundType === 'group_winners' && m.roundNumber === 1).map(renderMatchCard)}
                      </div>
                    </div>
                    {/* Winner's Semis */}
                    <div className="space-y-4">
                      <p className="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest border-b border-border/40 pb-1">
                        Semifinals (Qualifying Matches)
                      </p>
                      <div className="space-y-4">
                        {activeGroupMatches.filter(m => m.roundType === 'group_winners' && m.roundNumber === 2).map(renderMatchCard)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Loser's Bracket section */}
                <div className="space-y-4 pt-6 border-t border-border/40">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Zap className="h-4 w-4 text-billiard-orange" />
                    Loser&apos;s Bracket (1-Loss Survival)
                  </h3>
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Loser's Round 1 */}
                    <div className="space-y-4">
                      <p className="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest border-b border-border/40 pb-1">
                        Loser Round 1
                      </p>
                      <div className="space-y-4">
                        {activeGroupMatches.filter(m => m.roundType === 'group_losers' && m.roundNumber === 1).map(renderMatchCard)}
                      </div>
                    </div>
                    {/* Loser's Round 2 */}
                    <div className="space-y-4">
                      <p className="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest border-b border-border/40 pb-1">
                        Loser Round 2 (Qualifying Matches)
                      </p>
                      <div className="space-y-4">
                        {activeGroupMatches.filter(m => m.roundType === 'group_losers' && m.roundNumber === 2).map(renderMatchCard)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Knockout Bracket Tab View */}
      {activeTab === 'knockout' && (
        <div className="space-y-6 overflow-x-auto pb-4">
          {knockoutMatches.length === 0 ? (
            <div className="glass-panel rounded-2xl p-8 text-center text-muted-foreground max-w-lg mx-auto">
              <Award className="h-8 w-8 mx-auto text-muted mb-2 animate-bounce" />
              <p className="font-semibold text-white">Knockout Stage Not Started</p>
              <p className="text-xs mt-1">
                The Single Elimination finals bracket will automatically seed once all group qualifying matches have completed.
              </p>
            </div>
          ) : (
            <div className="flex gap-8 min-w-[800px] justify-between">
              {Array.from({ length: maxKnockoutRound }).map((_, rIdx) => {
                const roundNum = rIdx + 1;
                const roundMatches = knockoutMatches.filter(m => m.roundNumber === roundNum);
                
                let roundName = `Round of ${roundMatches.length * 2}`;
                if (roundMatches.length === 4) roundName = 'Quarterfinals';
                if (roundMatches.length === 2) roundName = 'Semifinals';
                if (roundMatches.length === 1) roundName = 'Finals';

                return (
                  <div key={roundNum} className="flex-1 space-y-4">
                    <p className="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest border-b border-border/40 pb-1.5">
                      {roundName}
                    </p>
                    <div className="space-y-6 flex flex-col justify-around h-full min-h-[400px]">
                      {roundMatches.map(m => (
                        <div key={m.id} className="py-2">
                          {renderMatchCard(m)}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Scoring Modal */}
      {scoringMatch && (
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
                onClick={() => setScoringMatch(null)}
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
                onClick={() => setScoringMatch(null)}
                className="flex-1 rounded-lg border border-border py-2.5 text-sm font-semibold text-white hover:bg-border transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveScore}
                disabled={saving || (score1 < scoringMatch.player1Target && score2 < scoringMatch.player2Target)}
                className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-bold text-background hover:bg-primary-hover disabled:opacity-50 transition-all cursor-pointer shadow-lg hover:shadow-primary/20"
              >
                {saving ? 'Saving...' : 'Submit Score'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
