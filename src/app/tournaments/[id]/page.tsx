'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TournamentDetails, Match, Player, Group, MatchStats } from '@/types';
import { getDatabaseAdapter } from '@/lib/db';
import { calculateMatchHandicap } from '@/lib/handicap';
import { Trophy, Users, Award, Calendar, Check, Play, Edit3, X, Zap, ChevronRight, CornerDownRight, Coins, Info } from 'lucide-react';

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
  const [bidsMap, setBidsMap] = useState<Record<string, { bidAmount: number; buyerName: string; split: boolean }>>({});
  const [startingTournament, setStartingTournament] = useState(false);

  // Auction specific states
  const [auctionStarted, setAuctionStarted] = useState(false);
  const [shuffledRoster, setShuffledRoster] = useState<Player[]>([]);
  const [currentRosterIdx, setCurrentRosterIdx] = useState(0);
  const [activeBuyerName, setActiveBuyerName] = useState('');
  const [activeBidAmount, setActiveBidAmount] = useState(0);
  const [activeSplit, setActiveSplit] = useState(false);

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

  useEffect(() => {
    if (details && details.tournament.hasCalcutta && details.tournament.status === 'draft') {
      const initialMap: Record<string, { bidAmount: number; buyerName: string; split: boolean }> = {};
      const minStartBet = details.tournament.calcuttaMinStartBet ?? 10;
      
      const existingBids = details.tournament.calcuttaBids || [];
      const existingBidsMap = existingBids.reduce((acc, b) => {
        acc[b.playerId] = { bidAmount: b.bidAmount, buyerName: b.buyerName, split: !!b.split };
        return acc;
      }, {} as Record<string, { bidAmount: number; buyerName: string; split: boolean }>);

      details.players.forEach(p => {
        if (!p.isBye) {
          initialMap[p.id] = existingBidsMap[p.id] || {
            bidAmount: minStartBet,
            buyerName: '',
            split: false,
          };
        }
      });
      setBidsMap(initialMap);

      // If they already have bids saved, mark auction as started and indices at the end
      if (existingBids.length > 0) {
        const realPlayers = details.players.filter(p => !p.isBye);
        setShuffledRoster(realPlayers);
        setCurrentRosterIdx(realPlayers.length);
        setAuctionStarted(true);
      }
    }
  }, [details]);

  const startAuction = () => {
    if (!details) return;
    const realPlayers = details.players.filter(p => !p.isBye);
    // Shuffle the players roster randomly
    const shuffled = [...realPlayers].sort(() => Math.random() - 0.5);
    setShuffledRoster(shuffled);
    setCurrentRosterIdx(0);
    setActiveBuyerName('');
    setActiveBidAmount(details.tournament.calcuttaMinStartBet ?? 10);
    setActiveSplit(false);
    setAuctionStarted(true);
    
    // Reset/initialize bidsMap with minimum values
    const minStart = details.tournament.calcuttaMinStartBet ?? 10;
    const initialMap: Record<string, { bidAmount: number; buyerName: string; split: boolean }> = {};
    realPlayers.forEach(p => {
      initialMap[p.id] = { bidAmount: minStart, buyerName: '', split: false };
    });
    setBidsMap(initialMap);
  };

  const handleBidSold = () => {
    if (currentRosterIdx >= shuffledRoster.length) return;
    const activePlayer = shuffledRoster[currentRosterIdx];
    
    // Save current active player's bid
    setBidsMap(prev => ({
      ...prev,
      [activePlayer.id]: {
        bidAmount: activeBidAmount,
        buyerName: activeBuyerName.trim() || 'Player (Self)',
        split: activeSplit,
      },
    }));

    // Advance index
    const nextIdx = currentRosterIdx + 1;
    setCurrentRosterIdx(nextIdx);

    // Initialize state for the next player if there is one
    if (nextIdx < shuffledRoster.length) {
      setActiveBuyerName('');
      setActiveBidAmount(details?.tournament.calcuttaMinStartBet ?? 10);
      setActiveSplit(false);
    }
  };

  const handleStartTournament = async () => {
    if (!details) return;
    setStartingTournament(true);
    try {
      const calcuttaBids = Object.entries(bidsMap).map(([playerId, val]) => ({
        playerId,
        bidAmount: val.bidAmount,
        buyerName: val.buyerName.trim() || 'Player (Self)',
        split: val.split,
      }));

      const updatedDetails = await db.startTournament(details.tournament.id, calcuttaBids);
      setDetails(updatedDetails);
    } catch (err) {
      console.error(err);
      alert('Failed to start tournament');
    } finally {
      setStartingTournament(false);
    }
  };

  const updateBidValue = (playerId: string, field: 'bidAmount' | 'buyerName' | 'split', value: any) => {
    setBidsMap(prev => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [field]: value,
      },
    }));
  };

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

  const numRealPlayers = players.filter(p => !p.isBye).length;
  const entryFee = tournament.entryFee || 0;
  const totalPrizePool = entryFee * numRealPlayers;
  const payoutPercentages = tournament.payoutPercentages || [];

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
    const m9 = groupMatches.find(m => m.matchNumber === 9);
    const m10 = groupMatches.find(m => m.matchNumber === 10);
    if (m9?.status === 'completed' && m9.winnerId && results[m9.winnerId]) {
      results[m9.winnerId].status = 'Qualified';
    }
    if (m10?.status === 'completed' && m10.winnerId && results[m10.winnerId]) {
      results[m10.winnerId].status = 'Qualified';
    }

    // Losers of M5, M6, M7, and M8 are eliminated
    if (m5?.status === 'completed') {
      const loser5 = m5.winnerId === m5.player1Id ? m5.player2Id : m5.player1Id;
      if (loser5 && results[loser5]) results[loser5].status = 'Eliminated';
    }
    if (m6?.status === 'completed') {
      const loser6 = m6.winnerId === m6.player1Id ? m6.player2Id : m6.player1Id;
      if (loser6 && results[loser6]) results[loser6].status = 'Eliminated';
    }
    const m7 = groupMatches.find(m => m.matchNumber === 7);
    const m8 = groupMatches.find(m => m.matchNumber === 8);
    if (m7?.status === 'completed') {
      const loser7 = m7.winnerId === m7.player1Id ? m7.player2Id : m7.player1Id;
      if (loser7 && results[loser7]) results[loser7].status = 'Eliminated';
    }
    if (m8?.status === 'completed') {
      const loser8 = m8.winnerId === m8.player1Id ? m8.player2Id : m8.player1Id;
      if (loser8 && results[loser8]) results[loser8].status = 'Eliminated';
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

  const renderQualifiedSlot = (playerId?: string, label?: string) => {
    const p = playerId ? getPlayer(playerId) : null;
    const getSeedCode = (pid: string) => {
      if (!pid || pid === 'BYE' || pid.includes('BYE')) return '';
      const idx = activeGroup?.playerIds.indexOf(pid) ?? -1;
      if (idx === -1) return '';
      const groupLetter = activeGroup?.name.split(' ').pop() || 'A';
      return `${groupLetter}${idx + 1}`;
    };

    return (
      <div className="w-[145px] sm:w-[155px] flex items-center justify-between bg-slate-900 border border-slate-700/60 rounded p-1.5 shadow-md">
        {p && !p.isBye ? (
          <>
            <span className="w-8 h-5 inline-flex items-center justify-center font-extrabold bg-orange-600 text-white rounded text-[9px] shrink-0">
              {getSeedCode(p.id)}
            </span>
            <span className="flex-1 h-5 px-1.5 ml-1 bg-slate-100 text-slate-900 font-extrabold rounded truncate flex items-center text-[10px]">
              {p.name}
            </span>
          </>
        ) : (
          <span className="flex-1 text-center font-bold text-muted-foreground/30 text-[9px] italic py-0.5">
            {label || 'TBD'}
          </span>
        )}
      </div>
    );
  };

  const renderGroupMatchCard = (match: Match) => {
    if (!match) return null;
    const p1 = getPlayer(match.player1Id);
    const p2 = getPlayer(match.player2Id);

    const isCompleted = match.status === 'completed';
    const isClickable = match.player1Id && match.player2Id && !p1.isBye && !p2.isBye;

    const getSeedCode = (playerId?: string) => {
      if (!playerId || playerId === 'BYE' || playerId.includes('BYE')) return '';
      const idx = activeGroup?.playerIds.indexOf(playerId) ?? -1;
      if (idx === -1) return '';
      const groupLetter = activeGroup?.name.split(' ').pop() || 'A';
      return `${groupLetter}${idx + 1}`;
    };

    return (
      <div
        onClick={() => isClickable && openScoring(match)}
        className={`w-[190px] sm:w-[200px] rounded-lg p-2 shadow-lg border relative flex flex-col gap-1 transition-all duration-200 bg-slate-900/80 border-slate-700/60 ${
          isClickable ? 'cursor-pointer hover:border-primary/50 hover:shadow-primary/5' : 'opacity-85'
        }`}
      >
        {/* Match Header */}
        <div className="flex justify-between items-center text-[9px] font-bold text-muted-foreground border-b border-border/40 pb-1 mb-0.5">
          <span className="text-primary/95">MATCH #{match.matchNumber}</span>
          <span>{isCompleted ? 'COMPLETED' : 'SCHEDULED'}</span>
        </div>

        {/* Player 1 Row */}
        <div className="flex items-center text-xs h-6">
          {/* Target (Green) */}
          <span className="w-5 h-5 inline-flex items-center justify-center font-extrabold bg-emerald-500 text-slate-950 rounded text-[10px] shrink-0">
            {match.player1Target}
          </span>
          {/* Seed (Orange) */}
          {match.player1Id && !p1.isBye ? (
            <span className="w-8 h-5 inline-flex items-center justify-center font-extrabold bg-orange-600 text-white rounded text-[9px] ml-1 shrink-0">
              {getSeedCode(match.player1Id)}
            </span>
          ) : (
            <span className="w-8 h-5 inline-flex items-center justify-center bg-slate-800 text-slate-500 rounded text-[9px] ml-1 shrink-0">
              -
            </span>
          )}
          {/* Name (White-ish box) */}
          <span className="flex-1 h-5 px-1.5 ml-1 bg-slate-100 text-slate-900 font-extrabold rounded truncate flex items-center justify-between text-[10px]">
            {p1.isBye ? 'BYE' : p1.name || 'TBD'}
          </span>
          {/* Score (Blue-green) */}
          <span className="w-7 h-5 inline-flex items-center justify-center font-black bg-teal-600 text-white rounded text-[10px] ml-1 shrink-0">
            {isCompleted ? match.player1Score : '-'}
          </span>
        </div>

        {/* Player 2 Row */}
        <div className="flex items-center text-xs h-6">
          {/* Target (Green) */}
          <span className="w-5 h-5 inline-flex items-center justify-center font-extrabold bg-emerald-500 text-slate-950 rounded text-[10px] shrink-0">
            {match.player2Target}
          </span>
          {/* Seed (Orange) */}
          {match.player2Id && !p2.isBye ? (
            <span className="w-8 h-5 inline-flex items-center justify-center font-extrabold bg-orange-600 text-white rounded text-[9px] ml-1 shrink-0">
              {getSeedCode(match.player2Id)}
            </span>
          ) : (
            <span className="w-8 h-5 inline-flex items-center justify-center bg-slate-800 text-slate-500 rounded text-[9px] ml-1 shrink-0">
              -
            </span>
          )}
          {/* Name (White-ish box) */}
          <span className="flex-1 h-5 px-1.5 ml-1 bg-slate-100 text-slate-900 font-extrabold rounded truncate flex items-center justify-between text-[10px]">
            {p2.isBye ? 'BYE' : p2.name || 'TBD'}
          </span>
          {/* Score (Blue-green) */}
          <span className="w-7 h-5 inline-flex items-center justify-center font-black bg-teal-600 text-white rounded text-[10px] ml-1 shrink-0">
            {isCompleted ? match.player2Score : '-'}
          </span>
        </div>
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
              • {tournament.status === 'active' ? 'Active Bracket' : tournament.status === 'draft' ? 'Calcutta Auction' : 'Completed'}
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

      {tournament.status === 'draft' && tournament.hasCalcutta ? (
        /* Main Calcutta Auction Screen Layout */
        <div className="w-full space-y-6">
          {/* Header row (Logo, title, date) */}
          <div className="text-center space-y-2 py-4 border-b border-border/40 relative overflow-hidden bg-slate-950/20 rounded-2xl p-6 shadow-md">
            <div className="inline-flex items-center justify-center gap-3">
              <Coins className="h-9 w-9 text-primary" />
              <span className="text-2xl font-black tracking-wider text-white uppercase">Calcutta Auction</span>
            </div>
            <p className="text-xs text-muted-foreground font-semibold">
              Tournament: {tournament.name} • Started {new Date(tournament.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          {/* If the auction has NOT started, show the intro panel in full width */}
          {!auctionStarted ? (
            <div className="max-w-xl mx-auto glass-panel rounded-2xl p-8 shadow-xl text-center space-y-6 border border-border/40 py-12">
              <Coins className="h-16 w-16 text-primary mx-auto animate-pulse" />
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white">Calcutta Player Auction</h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Bid on players to buy them for the Calcutta betting pool. Players will be presented one-by-one in a random order.
                </p>
              </div>

              <div className="max-w-xs mx-auto bg-slate-900/60 p-4 rounded-xl border border-border/30 text-left text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Auction Order:</span>
                  <span className="text-white font-bold">Randomized</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Minimum Bid:</span>
                  <span className="text-white font-bold">${tournament.calcuttaMinStartBet ?? 10}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Increment:</span>
                  <span className="text-white font-bold">${tournament.calcuttaMinIncrement ?? 5}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Roster Size:</span>
                  <span className="text-white font-bold">{players.filter(p => !p.isBye).length} Players</span>
                </div>
              </div>

              <button
                type="button"
                onClick={startAuction}
                className="rounded-xl bg-primary text-background font-black text-sm px-8 py-3.5 hover:bg-primary-hover shadow-lg hover:shadow-primary/30 transition-all cursor-pointer inline-flex items-center gap-1.5 inline-flex items-center gap-1.5"
              >
                Start Calcutta Auction
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            /* Three-Column Active Dashboard Layout (matches 64 players screenshot style) */
            <>
              {(() => {
                const realPlayers = players.filter(p => !p.isBye);
                const half = Math.ceil(realPlayers.length / 2);
                const leftPlayers = realPlayers.slice(0, half);
                const rightPlayers = realPlayers.slice(half);

                const totalCalcuttaPool = Object.values(bidsMap).reduce((sum, b) => sum + b.bidAmount, 0);
                const totalPlayersPool = realPlayers.length * (tournament.entryFee || 0);

                const renderRosterTable = (rosterList: Player[], offset: number) => {
                  return (
                    <div className="w-full overflow-hidden">
                      <table className="w-full text-[9px] xl:text-[10px] text-left border-collapse table-layout-fixed">
                        <thead>
                          <tr className="text-[8px] xl:text-[9px] text-muted-foreground uppercase font-extrabold border-b border-border/40">
                            <th className="py-1.5 px-0.5 text-center font-bold w-[8%]">#</th>
                            <th className="py-1.5 px-0.5 w-[28%]">Player</th>
                            <th className="py-1.5 px-0.5 text-center font-bold w-[10%]">HC</th>
                            <th className="py-1.5 px-0.5 w-[20%]">Owner</th>
                            <th className="py-1.5 px-0.5 text-right w-[14%]">BID</th>
                            <th className="py-1.5 px-0.5 text-center w-[10%]">Split</th>
                            <th className="py-1.5 px-0.5 text-center w-[10%]">Stat</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/10">
                          {rosterList.map((player, idx) => {
                            const absoluteIdx = offset + idx;
                            const isCurrent = currentRosterIdx < shuffledRoster.length && shuffledRoster[currentRosterIdx]?.id === player.id;
                            const isSold = shuffledRoster.slice(0, currentRosterIdx).some(p => p.id === player.id) || bidsMap[player.id]?.buyerName !== '';
                            const bid = bidsMap[player.id];
                            const sl = tournament.gameType === '8-Ball' ? player.skillLevel8 : tournament.gameType === '9-Ball' ? player.skillLevel9 : player.skillLevel10;

                            let rowClass = 'hover:bg-slate-900/40 transition-colors';
                            let statusLabel = 'PEND';
                            let statusClass = 'text-muted-foreground bg-slate-800/80';

                            if (isCurrent) {
                              rowClass = 'bg-primary/15 border-l-2 border-primary text-white font-bold animate-pulse';
                              statusLabel = 'BLOCK';
                              statusClass = 'text-primary bg-primary/20 border border-primary/30';
                            } else if (isSold) {
                              rowClass = 'bg-emerald-500/5 text-emerald-400 border-l-2 border-emerald-500';
                              statusLabel = 'SOLD';
                              statusClass = 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20';
                            }

                            return (
                              <tr key={player.id} className={rowClass}>
                                <td className="py-1.5 px-0.5 font-bold text-muted-foreground text-center">
                                  <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[8px] font-black bg-slate-950 border border-border/40 text-slate-300">
                                    {absoluteIdx + 1}
                                  </span>
                                </td>
                                <td className="py-1.5 px-0.5 font-bold text-white truncate max-w-0" title={player.name}>
                                  {player.name}
                                </td>
                                <td className="py-1.5 px-0.5 text-center font-extrabold text-muted-foreground">
                                  A{sl}
                                </td>
                                <td className="py-1.5 px-0.5 truncate max-w-0 font-semibold text-slate-200" title={isSold ? (bid?.buyerName || 'Player') : '-'}>
                                  {isSold ? (bid?.buyerName || 'Player') : '-'}
                                </td>
                                <td className="py-1.5 px-0.5 text-right font-black text-emerald-400">
                                  {isSold ? `$${bid?.bidAmount || 0}` : '-'}
                                </td>
                                <td className="py-1.5 px-0.5 text-center font-extrabold text-slate-400">
                                  {isSold ? (bid?.split ? 'YES' : 'NO') : '-'}
                                </td>
                                <td className="py-1.5 px-0.5 text-center">
                                  <span className={`inline-block px-0.5 py-0 rounded-[3px] text-[7.5px] font-black leading-tight border ${statusClass}`}>
                                    {statusLabel}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                };

                return (
                  <div className="grid gap-2.5 xl:gap-4 lg:grid-cols-4 animate-fade-in">
                    {/* Left Column: Roster Table Part 1 (1 to half) */}
                    <div className="lg:col-span-1 glass-panel px-1.5 py-3 xl:p-3 rounded-2xl border border-border/40 flex flex-col h-fit overflow-hidden">
                      <h3 className="text-xs font-black text-primary border-b border-border/40 pb-2 mb-3 tracking-wider uppercase text-center flex items-center justify-center gap-1.5 shrink-0">
                        <Users className="h-3.5 w-3.5 text-primary" />
                        Roster (1-{half})
                      </h3>
                      <div>
                        {renderRosterTable(leftPlayers, 0)}
                      </div>
                    </div>

                    {/* Center Column: Hub contents (payout tables, bidding card, active card) */}
                    <div className="lg:col-span-2 space-y-6">
                      
                      {/* Bidding state hubs */}
                      {currentRosterIdx < shuffledRoster.length ? (
                        /* Live Auction Area */
                        <div className="space-y-6">
                          
                          {/* Parameters badges */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-900/60 p-3 rounded-xl border border-border/40 text-center space-y-0.5">
                              <span className="block text-[10px] uppercase font-bold text-muted-foreground">Min Start BID</span>
                              <span className="text-lg font-black text-primary">${tournament.calcuttaMinStartBet ?? 10}</span>
                            </div>
                            <div className="bg-slate-900/60 p-3 rounded-xl border border-border/40 text-center space-y-0.5">
                              <span className="block text-[10px] uppercase font-bold text-muted-foreground">Increment</span>
                              <span className="text-lg font-black text-primary">${tournament.calcuttaMinIncrement ?? 5}</span>
                            </div>
                          </div>

                          {/* Side-by-side Payout Tables */}
                          <div className="grid gap-4 md:grid-cols-2">
                            
                            {/* Left: Auction (Calcutta) Payout Splits */}
                            <div className="glass-panel p-4 rounded-xl border border-border/40 space-y-3">
                              <div className="flex justify-between items-center border-b border-border/40 pb-1.5 shrink-0">
                                <h4 className="text-xs font-extrabold uppercase text-billiard-red flex items-center gap-1">
                                  <Coins className="h-3.5 w-3.5 text-billiard-red" />
                                  Auction Prize
                                </h4>
                                <span className="text-[10px] text-emerald-400 font-extrabold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                  Total: ${totalCalcuttaPool}
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                {(tournament.calcuttaPayoutPercentages || []).map((pct, idx) => {
                                  const label = idx === 0 ? 'CHAMPION' : idx === 1 ? 'Runner-up' : idx === 2 ? '3rd Place' : `${idx + 1}th Place`;
                                  const pctLabel = idx === 0 ? '1st' : idx === 1 ? '2nd' : idx === 2 ? '3rd' : `${idx + 1}th`;
                                  const amt = (totalCalcuttaPool * pct) / 100;
                                  return (
                                    <div key={idx} className="flex justify-between items-center text-[11px] font-bold border-b border-border/10 pb-1">
                                      <div className="flex gap-2">
                                        <span className="text-muted-foreground w-6 text-left">{pctLabel}</span>
                                        <span className="text-[9px] font-extrabold text-muted-foreground bg-slate-800 px-1 rounded flex items-center">{pct}%</span>
                                        <span className="text-slate-300 font-semibold">{label}</span>
                                      </div>
                                      <span className="font-black text-emerald-400">${amt.toFixed(0)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Right: Players Payout Splits */}
                            <div className="glass-panel p-4 rounded-xl border border-border/40 space-y-3">
                              <div className="flex justify-between items-center border-b border-border/40 pb-1.5 shrink-0">
                                <h4 className="text-xs font-extrabold uppercase text-primary flex items-center gap-1">
                                  <Trophy className="h-3.5 w-3.5 text-primary" />
                                  Tournament Prize
                                </h4>
                                <span className="text-[10px] text-emerald-400 font-extrabold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                  Total: ${totalPlayersPool}
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                {(tournament.payoutPercentages || []).map((pct, idx) => {
                                  const label = idx === 0 ? 'CHAMPION' : idx === 1 ? 'Runner-up' : idx === 2 ? '3rd Place' : `${idx + 1}th Place`;
                                  const pctLabel = idx === 0 ? '1st' : idx === 1 ? '2nd' : idx === 2 ? '3rd' : `${idx + 1}th`;
                                  const amt = (totalPlayersPool * pct) / 100;
                                  return (
                                    <div key={idx} className="flex justify-between items-center text-[11px] font-bold border-b border-border/10 pb-1">
                                      <div className="flex gap-2">
                                        <span className="text-muted-foreground w-6 text-left">{pctLabel}</span>
                                        <span className="text-[9px] font-extrabold text-muted-foreground bg-slate-800 px-1 rounded flex items-center">{pct}%</span>
                                        <span className="text-slate-300 font-semibold">{label}</span>
                                      </div>
                                      <span className="font-black text-emerald-400">${amt.toFixed(0)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                          </div>

                          {/* Active Player Card */}
                          <div className="glass-panel rounded-2xl p-6 shadow-xl space-y-5 border border-primary/20 relative overflow-hidden bg-slate-950/40 shrink-0">
                            {/* Glowing background ball accent */}
                            <div className="absolute top-0 right-0 -mr-16 -mt-16 h-40 w-40 rounded-full bg-primary/10 blur-[45px]" />
                            
                            <div className="flex justify-between items-center text-xs font-bold text-muted-foreground border-b border-border/40 pb-2.5">
                              <span className="text-primary uppercase tracking-wider font-extrabold">ACTIVE BIDDING BLOCK</span>
                              <span>Player {currentRosterIdx + 1} of {shuffledRoster.length}</span>
                            </div>

                            {(() => {
                              const player = shuffledRoster[currentRosterIdx];
                              const sl = tournament.gameType === '8-Ball' ? player.skillLevel8 : tournament.gameType === '9-Ball' ? player.skillLevel9 : player.skillLevel10;
                              return (
                                <div className="text-center py-1 space-y-1">
                                  <span className="inline-flex items-center justify-center h-10 w-10 font-black text-lg rounded-full bg-slate-900 border border-border text-primary shadow-inner">
                                    {currentRosterIdx + 1}
                                  </span>
                                  <h3 className="text-2xl font-black text-white tracking-tight">{player.name}</h3>
                                  <span className="inline-block text-[10px] font-extrabold uppercase bg-slate-800 border border-border/40 px-3 py-0.5 rounded text-muted-foreground">
                                    HC: A{sl}
                                  </span>
                                </div>
                              );
                            })()}

                            {/* Controls Inputs Row */}
                            <div className="grid gap-4 sm:grid-cols-3 bg-slate-950/60 p-4 rounded-xl border border-border/40 text-xs">
                              {/* Buyer Name */}
                              <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                  Owner / Buyer
                                </label>
                                <input
                                  type="text"
                                  value={activeBuyerName}
                                  onChange={e => setActiveBuyerName(e.target.value)}
                                  placeholder="e.g. Scott"
                                  className="w-full rounded-lg bg-background border border-border px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-semibold transition-colors"
                                  autoFocus
                                />
                              </div>

                              {/* Winning Bid */}
                              <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                  Winning Bid ($)
                                </label>
                                <div className="flex items-center bg-background border border-border rounded-lg px-2 py-0.5">
                                  <button
                                    type="button"
                                    onClick={() => setActiveBidAmount(a => Math.max(tournament.calcuttaMinStartBet ?? 10, a - (tournament.calcuttaMinIncrement ?? 5)))}
                                    className="h-7 w-7 rounded bg-slate-900 border border-border hover:bg-border text-white flex items-center justify-center text-xs font-bold cursor-pointer transition-colors shrink-0 font-extrabold"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min={tournament.calcuttaMinStartBet ?? 10}
                                    value={activeBidAmount}
                                    onChange={e => setActiveBidAmount(Math.max(tournament.calcuttaMinStartBet ?? 10, parseInt(e.target.value) || (tournament.calcuttaMinStartBet ?? 10)))}
                                    className="w-full bg-transparent text-center font-black text-white text-sm focus:outline-none px-1"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setActiveBidAmount(a => a + (tournament.calcuttaMinIncrement ?? 5))}
                                    className="h-7 w-7 rounded bg-slate-900 border border-border hover:bg-border text-white flex items-center justify-center text-xs font-bold cursor-pointer transition-colors shrink-0 font-extrabold"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              {/* Split Toggle */}
                              <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                  Split with Player?
                                </label>
                                <select
                                  value={activeSplit ? 'YES' : 'NO'}
                                  onChange={e => setActiveSplit(e.target.value === 'YES')}
                                  className="w-full rounded-lg bg-background border border-border px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-semibold transition-colors"
                                >
                                  <option value="NO">NO</option>
                                  <option value="YES">YES</option>
                                </select>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={handleBidSold}
                              className="w-full rounded-xl bg-primary py-3 text-xs font-black text-background hover:bg-primary-hover shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center gap-1 cursor-pointer uppercase tracking-wider font-extrabold"
                            >
                              Sold! (Next Player)
                              <ChevronRight className="h-4.5 w-4.5" />
                            </button>
                          </div>

                          {/* Last Sold Player Banner Accent */}
                          {currentRosterIdx > 0 && (
                            <div className="glass-panel p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/15 text-center animate-fade-in relative overflow-hidden shrink-0">
                              <div className="absolute top-0 left-0 bg-emerald-500 text-slate-950 font-black text-[9px] uppercase px-2 py-0.5 rounded-br">
                                SOLD
                              </div>
                              {(() => {
                                const lastPlayer = shuffledRoster[currentRosterIdx - 1];
                                const lastBid = bidsMap[lastPlayer.id] || { bidAmount: 0, buyerName: 'Player', split: false };
                                const lastSl = tournament.gameType === '8-Ball' ? lastPlayer.skillLevel8 : tournament.gameType === '9-Ball' ? lastPlayer.skillLevel9 : lastPlayer.skillLevel10;
                                return (
                                  <div className="flex flex-wrap items-center justify-around gap-4 text-[11px] font-bold mt-1">
                                    <div>
                                      <span className="text-muted-foreground block text-[8px] uppercase">Player</span>
                                      <span className="text-white text-xs font-extrabold">{lastPlayer.name}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground block text-[8px] uppercase">HC</span>
                                      <span className="text-primary font-extrabold">A{lastSl}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground block text-[8px] uppercase">Owner</span>
                                      <span className="text-slate-200 font-extrabold">{lastBid.buyerName}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground block text-[8px] uppercase">BID Amount</span>
                                      <span className="text-emerald-400 font-black">${lastBid.bidAmount}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground block text-[8px] uppercase">Split</span>
                                      <span className="text-slate-300 font-extrabold">{lastBid.split ? 'YES' : 'NO'}</span>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          {/* Recent Auctions Edit History (Optional edit below block) */}
                          {Object.keys(bidsMap).some(pid => bidsMap[pid].buyerName !== '' || bidsMap[pid].bidAmount > (tournament.calcuttaMinStartBet ?? 10)) && (
                            <div className="glass-panel rounded-2xl p-4 shadow-xl space-y-3 border border-border/40 shrink-0">
                              <h3 className="text-xs font-black text-white border-b border-border/40 pb-1.5 uppercase tracking-wider">
                                Recent Auctions Bids Editor
                              </h3>
                              <div className="grid gap-3 sm:grid-cols-2 max-h-[140px] overflow-y-auto pr-1">
                                {players.filter(p => !p.isBye).map(player => {
                                  const bid = bidsMap[player.id];
                                  const isSold = shuffledRoster.slice(0, currentRosterIdx).some(p => p.id === player.id);
                                  if (!isSold) return null;

                                  return (
                                    <div key={player.id} className="bg-background/40 p-2 rounded-lg border border-border/20 text-xs flex justify-between items-center">
                                      <div className="min-w-0">
                                        <p className="font-bold text-white truncate text-[11px]">{player.name}</p>
                                        <div className="flex gap-2 items-center text-[10px]">
                                          <input
                                            type="text"
                                            value={bid.buyerName}
                                            onChange={e => updateBidValue(player.id, 'buyerName', e.target.value)}
                                            className="bg-transparent text-[10px] text-muted-foreground w-14 p-0 border-none focus:outline-none focus:ring-0 truncate font-semibold"
                                            placeholder="Edit Buyer"
                                          />
                                          <span className="text-[10px] text-muted-foreground/40">•</span>
                                          <select
                                            value={bid.split ? 'YES' : 'NO'}
                                            onChange={e => updateBidValue(player.id, 'split', e.target.value === 'YES')}
                                            className="bg-transparent text-[10px] text-muted-foreground p-0 border-none focus:outline-none focus:ring-0 font-semibold cursor-pointer"
                                          >
                                            <option value="NO">Split: NO</option>
                                            <option value="YES">Split: YES</option>
                                          </select>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1 bg-background border border-border rounded px-1.5 py-0.5 shrink-0">
                                        <span className="text-[9px] font-medium text-muted-foreground/60">$</span>
                                        <input
                                          type="number"
                                          value={bid.bidAmount}
                                          onChange={e => updateBidValue(player.id, 'bidAmount', Math.max(0, parseInt(e.target.value) || 0))}
                                          className="w-10 bg-transparent text-right font-bold text-white focus:outline-none p-0 border-none focus:ring-0 text-[10px]"
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Auction Complete Review & Start triggers */
                        <div className="space-y-6 animate-fade-in">
                          
                          {/* Final Review Table */}
                          <div className="glass-panel rounded-2xl p-6 shadow-xl space-y-4 border border-border/40">
                            <div className="flex justify-between items-center border-b border-border pb-3">
                              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Check className="h-5 w-5 text-primary" />
                                Review Final Bids
                              </h2>
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm("Are you sure you want to reset the auction? All registered bids will be cleared.")) {
                                    startAuction();
                                  }
                                }}
                                className="rounded bg-border/40 hover:bg-border px-2.5 py-1 text-[10px] text-white transition-colors cursor-pointer"
                              >
                                Reset Auction
                              </button>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 max-h-[420px] overflow-y-auto pr-1">
                              {players.filter(p => !p.isBye).map(player => {
                                const bid = bidsMap[player.id] || { bidAmount: tournament.calcuttaMinStartBet ?? 10, buyerName: '', split: false };
                                return (
                                  <div key={player.id} className="glass-panel p-2.5 rounded-lg border border-border/40 flex justify-between items-center text-xs">
                                    <div className="min-w-0">
                                      <p className="font-bold text-white truncate text-[11px]">{player.name}</p>
                                      <div className="flex gap-2 items-center text-[10px]">
                                        <input
                                          type="text"
                                          value={bid.buyerName}
                                          onChange={e => updateBidValue(player.id, 'buyerName', e.target.value)}
                                          className="bg-transparent text-[10px] text-muted-foreground w-20 p-0 border-none focus:outline-none focus:ring-0 truncate font-semibold"
                                          placeholder="Edit Buyer"
                                        />
                                        <span className="text-[10px] text-muted-foreground/40">•</span>
                                        <select
                                          value={bid.split ? 'YES' : 'NO'}
                                          onChange={e => updateBidValue(player.id, 'split', e.target.value === 'YES')}
                                          className="bg-transparent text-[10px] text-muted-foreground p-0 border-none focus:outline-none focus:ring-0 font-semibold cursor-pointer"
                                        >
                                          <option value="NO">Split: NO</option>
                                          <option value="YES">Split: YES</option>
                                        </select>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 bg-background border border-border rounded px-1.5 py-0.5 shrink-0">
                                      <span className="text-[9px] font-medium text-muted-foreground/60">$</span>
                                      <input
                                        type="number"
                                        value={bid.bidAmount}
                                        onChange={e => updateBidValue(player.id, 'bidAmount', Math.max(0, parseInt(e.target.value) || 0))}
                                        className="w-10 bg-transparent text-right font-bold text-white focus:outline-none p-0 border-none focus:ring-0 text-[10px]"
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Locked Bids Details sidebar cards inside Center Hub */}
                          <div className="glass-panel rounded-2xl p-6 shadow-xl space-y-4 border border-border/40">
                            <h4 className="text-xs font-extrabold uppercase text-white border-b border-border/40 pb-2">
                              Ready to Launch Tournament?
                            </h4>
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="bg-slate-900/60 p-4 rounded-xl border border-border/40 text-center space-y-1">
                                <p className="text-[9px] uppercase font-bold text-muted-foreground">Total Calcutta Pool</p>
                                <p className="text-3xl font-black text-emerald-400">${totalCalcuttaPool}</p>
                              </div>
                              <div className="bg-slate-900/60 p-4 rounded-xl border border-border/40 text-center space-y-1">
                                <p className="text-[9px] uppercase font-bold text-muted-foreground">Players Entry Pool</p>
                                <p className="text-3xl font-black text-primary">${totalPlayersPool}</p>
                              </div>
                            </div>

                            <div className="rounded-lg bg-billiard-blue/10 border border-billiard-blue/20 p-3.5 flex gap-2 text-xs text-muted-foreground">
                              <Info className="h-4 w-4 text-billiard-blue shrink-0 mt-0.5" />
                              <p className="leading-relaxed">
                                Locking bids will activate all matches, generate Double Elimination group cards, and unlock scoring entries. Ensure splits and bids are accurate.
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={handleStartTournament}
                              disabled={startingTournament}
                              className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-background hover:bg-primary-hover shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              {startingTournament ? 'Locking Bids & Starting...' : 'Lock Bids & Start Bracket'}
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </div>

                        </div>
                      )}
                    </div>

                    {/* Right Column: Roster Table Part 2 (half + 1 to end) */}
                    <div className="lg:col-span-1 glass-panel px-1.5 py-3 xl:p-3 rounded-2xl border border-border/40 flex flex-col h-fit overflow-hidden">
                      <h3 className="text-xs font-black text-primary border-b border-border/40 pb-2 mb-3 tracking-wider uppercase text-center flex items-center justify-center gap-1.5 shrink-0">
                        <Users className="h-3.5 w-3.5 text-primary" />
                        Roster ({half + 1}-{realPlayers.length})
                      </h3>
                      <div>
                        {renderRosterTable(rightPlayers, half)}
                      </div>
                    </div>

                  </div>
                );
              })()}
            </>
          )}
        </div>
      ) : (
        <>
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
                <div className="space-y-8">
                  {/* Staggered DE Bracket Tree */}
                  <div className="w-full overflow-x-auto pb-6">
                    <div className="flex gap-4 sm:gap-6 md:gap-8 justify-between items-center py-6 px-4 bg-slate-950/40 rounded-3xl border border-white/5 p-6 min-w-[1200px] relative">
                      
                      {/* Glowing Group Badge in Background */}
                      <div className="absolute top-4 left-4 z-10">
                        <span className="inline-flex items-center justify-center h-10 w-10 font-black text-xl rounded bg-primary text-background shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                          {activeGroup.name.split(' ').pop()}
                        </span>
                      </div>

                      {/* Column 1: Loser Qualifiers (Left side) */}
                      <div className="flex flex-col gap-24 py-8 items-center justify-around h-full">
                        <div className="flex flex-col items-center gap-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Winner L5</span>
                          {renderQualifiedSlot(
                            activeGroupMatches.find(m => m.matchNumber === 5)?.status === 'completed'
                              ? activeGroupMatches.find(m => m.matchNumber === 5)!.winnerId
                              : '',
                            'L5 Qualifier'
                          )}
                        </div>
                        <div className="flex flex-col items-center gap-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Winner L6</span>
                          {renderQualifiedSlot(
                            activeGroupMatches.find(m => m.matchNumber === 6)?.status === 'completed'
                              ? activeGroupMatches.find(m => m.matchNumber === 6)!.winnerId
                              : '',
                            'L6 Qualifier'
                          )}
                        </div>
                      </div>

                      {/* Column 2: Round 3 Losers */}
                      <div className="flex flex-col gap-28 justify-center py-6 h-full">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground text-center">Round 3 (M5)</span>
                          {renderGroupMatchCard(activeGroupMatches.find(m => m.matchNumber === 5)!)}
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground text-center">Round 3 (M6)</span>
                          {renderGroupMatchCard(activeGroupMatches.find(m => m.matchNumber === 6)!)}
                        </div>
                      </div>

                      {/* Column 3: Round 2 Losers */}
                      <div className="flex flex-col gap-28 justify-center py-6 h-full">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground text-center">Round 2 (M7)</span>
                          {renderGroupMatchCard(activeGroupMatches.find(m => m.matchNumber === 7)!)}
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground text-center">Round 2 (M8)</span>
                          {renderGroupMatchCard(activeGroupMatches.find(m => m.matchNumber === 8)!)}
                        </div>
                      </div>

                      {/* Column 4: Round 1 (Middle Column / Red Box) */}
                      <div className="flex flex-col gap-4 justify-center py-4 px-3 bg-red-950/20 border border-red-500/20 rounded-2xl h-full shadow-[0_0_15px_rgba(239,68,68,0.05)]">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-red-400 text-center">Round 1 (M1)</span>
                          {renderGroupMatchCard(activeGroupMatches.find(m => m.matchNumber === 1)!)}
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-red-400 text-center">Round 1 (M2)</span>
                          {renderGroupMatchCard(activeGroupMatches.find(m => m.matchNumber === 2)!)}
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-red-400 text-center">Round 1 (M3)</span>
                          {renderGroupMatchCard(activeGroupMatches.find(m => m.matchNumber === 3)!)}
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-red-400 text-center">Round 1 (M4)</span>
                          {renderGroupMatchCard(activeGroupMatches.find(m => m.matchNumber === 4)!)}
                        </div>
                      </div>

                      {/* Column 5: Round 2 Winners */}
                      <div className="flex flex-col gap-28 justify-center py-6 h-full">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground text-center">Round 2 (M9)</span>
                          {renderGroupMatchCard(activeGroupMatches.find(m => m.matchNumber === 9)!)}
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground text-center">Round 2 (M10)</span>
                          {renderGroupMatchCard(activeGroupMatches.find(m => m.matchNumber === 10)!)}
                        </div>
                      </div>

                      {/* Column 6: Winner Qualifiers (Right side) */}
                      <div className="flex flex-col gap-24 py-8 items-center justify-around h-full">
                        <div className="flex flex-col items-center gap-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Winner A1</span>
                          {renderQualifiedSlot(
                            activeGroupMatches.find(m => m.matchNumber === 9)?.status === 'completed'
                              ? activeGroupMatches.find(m => m.matchNumber === 9)!.winnerId
                              : '',
                            'A1 Qualifier'
                          )}
                          <span className="h-5 w-5 inline-flex items-center justify-center font-extrabold text-[10px] rounded-full bg-slate-900 text-primary border border-primary/20 shadow-sm">
                            8
                          </span>
                        </div>
                        <div className="flex flex-col items-center gap-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Winner A2</span>
                          {renderQualifiedSlot(
                            activeGroupMatches.find(m => m.matchNumber === 10)?.status === 'completed'
                              ? activeGroupMatches.find(m => m.matchNumber === 10)!.winnerId
                              : '',
                            'A2 Qualifier'
                          )}
                          <span className="h-5 w-5 inline-flex items-center justify-center font-extrabold text-[10px] rounded-full bg-slate-900 text-primary border border-primary/20 shadow-sm">
                            8
                          </span>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Group Standings & Payouts */}
                  <div className={`max-w-4xl mx-auto grid gap-6 md:grid-cols-2 ${tournament.hasCalcutta ? 'lg:grid-cols-3' : ''}`}>
                    {/* Standings Card */}
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

                    {/* Prize Pool & Payouts Card */}
                    <div className="glass-panel rounded-2xl p-5 shadow-xl space-y-4">
                      <h3 className="text-sm font-extrabold text-white border-b border-border pb-2 flex items-center gap-1.5">
                        <Trophy className="h-4 w-4 text-primary" />
                        Prize Pool & Payouts
                      </h3>
                      {entryFee > 0 && payoutPercentages.length > 0 ? (
                        <div className="space-y-4">
                          {/* Payout Summary numbers */}
                          <div className="grid grid-cols-2 gap-3 bg-slate-900/60 p-3 rounded-xl border border-border/40 text-xs">
                            <div>
                              <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Entry Price</p>
                              <p className="text-base font-black text-white mt-0.5">${entryFee}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Total Prize Pool</p>
                              <p className="text-base font-black text-emerald-400 mt-0.5">${totalPrizePool}</p>
                            </div>
                          </div>

                          {/* Position breakdown list */}
                          <div className="space-y-2.5">
                            {payoutPercentages.map((pct, idx) => {
                              const label = idx === 0 ? '1st Place' : idx === 1 ? '2nd Place' : idx === 2 ? '3rd Place' : `${idx + 1}th Place`;
                              const amount = (totalPrizePool * pct) / 100;
                              return (
                                <div key={idx} className="flex justify-between items-center text-xs border-b border-border/20 pb-1.5 font-bold">
                                  <span className="text-slate-200">{label}</span>
                                  <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-extrabold text-muted-foreground bg-slate-800 px-1.5 py-0.5 rounded">{pct}%</span>
                                    <span className="font-black text-emerald-400 text-sm">${amount.toFixed(0)}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-6 text-muted-foreground text-xs italic">
                          No entry price or prize pool configured for this tournament.
                        </div>
                      )}
                    </div>

                    {/* Calcutta Betting Setup Card */}
                    {tournament.hasCalcutta && (
                      <div className="glass-panel rounded-2xl p-5 shadow-xl space-y-4 animate-fade-in">
                        <h3 className="text-sm font-extrabold text-white border-b border-border pb-2 flex items-center gap-1.5">
                          <Coins className="h-4 w-4 text-primary" />
                          Calcutta Betting
                        </h3>
                        <div className="space-y-4">
                          {/* Calcutta Summary numbers */}
                          {(() => {
                            const bids = tournament.calcuttaBids || [];
                            const totalPool = bids.reduce((sum, b) => sum + b.bidAmount, 0);
                            
                            return (
                              <>
                                <div className="grid grid-cols-2 gap-3 bg-slate-900/60 p-3 rounded-xl border border-border/40 text-xs">
                                  <div>
                                    <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider font-bold">Min Start Bet / Inc</p>
                                    <p className="text-sm font-black text-white mt-0.5">
                                      ${tournament.calcuttaMinStartBet ?? 10} / ${tournament.calcuttaMinIncrement ?? 5}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider font-bold">Calcutta Prize Pool</p>
                                    <p className="text-sm font-black text-emerald-400 mt-0.5">${totalPool}</p>
                                  </div>
                                </div>

                                {/* Position breakdown list */}
                                <div className="space-y-2">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Payout Splits</p>
                                  {(tournament.calcuttaPayoutPercentages || []).map((pct, idx) => {
                                    const label = idx === 0 ? '1st Place' : idx === 1 ? '2nd Place' : idx === 2 ? '3rd Place' : `${idx + 1}th Place`;
                                    const amt = (totalPool * pct) / 100;
                                    return (
                                      <div key={idx} className="flex justify-between items-center text-xs border-b border-border/20 pb-1 font-bold">
                                        <span className="text-slate-200">{label}</span>
                                        <div className="flex items-center gap-3">
                                          <span className="text-[9px] font-extrabold text-muted-foreground bg-slate-800 px-1.5 py-0.5 rounded">{pct}%</span>
                                          <span className="font-black text-emerald-400">${amt.toFixed(0)}</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Bids Table */}
                                {bids.length > 0 && (
                                  <div className="space-y-2">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Winning Bids</p>
                                    <div className="max-h-48 overflow-y-auto border border-border/30 rounded-lg bg-background/50 divide-y divide-border/25">
                                      {bids.map(bid => (
                                        <div key={bid.playerId} className="flex justify-between items-center px-2.5 py-1.5 text-[11px]">
                                          <div className="min-w-0">
                                            <p className="font-bold text-white truncate">{getPlayer(bid.playerId).name}</p>
                                            <p className="text-[9px] text-muted-foreground truncate">Owner: {bid.buyerName}</p>
                                          </div>
                                          <span className="font-extrabold text-white shrink-0">${bid.bidAmount}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              )}
            </div>
          )}
        </>
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
