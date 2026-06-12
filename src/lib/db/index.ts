import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Player, Tournament, Group, Match, MatchStats, TournamentDetails, CalcuttaBid } from '../../types';
import { initializeGroupMatches, getGroupQualifiers, seedSingleElimination, advanceDoubleEliminationMatch, advanceKnockoutMatches } from '../bracket';

export interface DatabaseAdapter {
  getPlayers(): Promise<Player[]>;
  createPlayer(player: Omit<Player, 'id' | 'createdAt'>): Promise<Player>;
  getTournaments(): Promise<Tournament[]>;
  getTournamentDetails(id: string): Promise<TournamentDetails | null>;
  createTournament(
    name: string,
    gameType: '8-Ball' | '9-Ball' | '10-Ball',
    playerIds: string[],
    entryFee?: number,
    payoutPercentages?: number[],
    hasCalcutta?: boolean,
    calcuttaMinStartBet?: number,
    calcuttaMinIncrement?: number,
    calcuttaPayoutPercentages?: number[],
    creatorEmail?: string
  ): Promise<Tournament>;
  updateMatchScore(
    tournamentId: string,
    matchId: string,
    score1: number,
    score2: number,
    stats1: MatchStats,
    stats2: MatchStats
  ): Promise<TournamentDetails>;
  startTournament(
    id: string,
    calcuttaBids?: CalcuttaBid[]
  ): Promise<TournamentDetails>;
  updateTournamentPayments(
    id: string,
    entryFeePaidIds: string[],
    calcuttaBidsPaidIds: string[],
    playerPayoutPaidIds: string[],
    ownerPayoutPaidIds: string[]
  ): Promise<TournamentDetails>;
  deleteTournament(id: string): Promise<void>;
}

// ----------------------------------------------------
// Mock Seed Data (Professional & Amateur Players)
// ----------------------------------------------------
const MOCK_PLAYERS_SEED: Player[] = [
  { id: 'efren', name: 'Efren Reyes', skillLevel8: 22, skillLevel9: 22, skillLevel10: 22, createdAt: new Date().toISOString() },
  { id: 'svb', name: 'Shane Van Boening', skillLevel8: 22, skillLevel9: 22, skillLevel10: 22, createdAt: new Date().toISOString() },
  { id: 'filler', name: 'Joshua Filler', skillLevel8: 22, skillLevel9: 22, skillLevel10: 22, createdAt: new Date().toISOString() },
  { id: 'gorst', name: 'Fedor Gorst', skillLevel8: 21, skillLevel9: 21, skillLevel10: 21, createdAt: new Date().toISOString() },
  { id: 'shaw', name: 'Jayson Shaw', skillLevel8: 21, skillLevel9: 21, skillLevel10: 21, createdAt: new Date().toISOString() },
  { id: 'strickland', name: 'Earl Strickland', skillLevel8: 18, skillLevel9: 18, skillLevel10: 18, createdAt: new Date().toISOString() },
  { id: 'albin', name: 'Albin Ouschan', skillLevel8: 19, skillLevel9: 19, skillLevel10: 19, createdAt: new Date().toISOString() },
  { id: 'bustamante', name: 'Francisco Bustamante', skillLevel8: 20, skillLevel9: 20, skillLevel10: 20, createdAt: new Date().toISOString() },
  { id: 'ko_pin_yi', name: 'Ko Pin Yi', skillLevel8: 22, skillLevel9: 22, skillLevel10: 22, createdAt: new Date().toISOString() },
  { id: 'pagulayan', name: 'Alex Pagulayan', skillLevel8: 20, skillLevel9: 20, skillLevel10: 20, createdAt: new Date().toISOString() },
  
  // Mid Range Players
  { id: 'john_doe', name: 'John Smith (Local A)', skillLevel8: 14, skillLevel9: 15, skillLevel10: 14, createdAt: new Date().toISOString() },
  { id: 'jane_smith', name: 'Jane Miller (Local B)', skillLevel8: 10, skillLevel9: 10, skillLevel10: 10, createdAt: new Date().toISOString() },
  { id: 'dave_c', name: 'Dave Carter', skillLevel8: 12, skillLevel9: 12, skillLevel10: 12, createdAt: new Date().toISOString() },
  { id: 'sarah_j', name: 'Sarah Jones', skillLevel8: 8, skillLevel9: 8, skillLevel10: 8, createdAt: new Date().toISOString() },
  { id: 'mike_t', name: 'Mike Thompson', skillLevel8: 16, skillLevel9: 17, skillLevel10: 17, createdAt: new Date().toISOString() },
  { id: 'amy_w', name: 'Amy Watson', skillLevel8: 6, skillLevel9: 5, skillLevel10: 5, createdAt: new Date().toISOString() },
  
  // Novice Players
  { id: 'bob_n', name: 'Bob Novice', skillLevel8: 3, skillLevel9: 3, skillLevel10: 3, createdAt: new Date().toISOString() },
  { id: 'clara_k', name: 'Clara Kelly', skillLevel8: 3, skillLevel9: 3, skillLevel10: 3, createdAt: new Date().toISOString() },
];

// ----------------------------------------------------
// LocalStorage Adapter
// ----------------------------------------------------
class LocalStorageAdapterImpl implements DatabaseAdapter {
  private memStorage: Record<string, string> = {};

  private getStorageItem<T>(key: string, defaultVal: T): T {
    if (typeof window === 'undefined') {
      const item = this.memStorage[key];
      return item ? JSON.parse(item) : defaultVal;
    }
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultVal;
  }

  private setStorageItem<T>(key: string, val: T): void {
    if (typeof window === 'undefined') {
      this.memStorage[key] = JSON.stringify(val);
      return;
    }
    localStorage.setItem(key, JSON.stringify(val));
  }

  async getPlayers(): Promise<Player[]> {
    let players = this.getStorageItem<Player[]>('ptm_players', []);
    if (players.length === 0) {
      this.setStorageItem('ptm_players', MOCK_PLAYERS_SEED);
      players = MOCK_PLAYERS_SEED;
    }
    return players;
  }

  async createPlayer(player: Omit<Player, 'id' | 'createdAt'>): Promise<Player> {
    const players = await this.getPlayers();
    const newPlayer: Player = {
      ...player,
      id: Math.random().toString(36).substring(2, 11),
      createdAt: new Date().toISOString(),
    };
    players.push(newPlayer);
    this.setStorageItem('ptm_players', players);
    return newPlayer;
  }

  async getTournaments(): Promise<Tournament[]> {
    return this.getStorageItem<Tournament[]>('ptm_tournaments', []);
  }

  async getTournamentDetails(id: string): Promise<TournamentDetails | null> {
    const tournaments = await this.getTournaments();
    const tournament = tournaments.find(t => t.id === id);
    if (!tournament) return null;

    const allPlayers = await this.getPlayers();
    const groups = this.getStorageItem<Group[]>('ptm_groups', []).filter(g => g.tournamentId === id);
    const matches = this.getStorageItem<Match[]>('ptm_matches', []).filter(m => m.tournamentId === id);

    // Extract all player IDs associated with this tournament (from groups and matches)
    const activePlayerIds = new Set<string>();
    groups.forEach(g => g.playerIds.forEach(pid => activePlayerIds.add(pid)));
    matches.forEach(m => {
      if (m.player1Id) activePlayerIds.add(m.player1Id);
      if (m.player2Id) activePlayerIds.add(m.player2Id);
    });

    const tournamentPlayers = allPlayers.filter(p => activePlayerIds.has(p.id));

    // Also inject mock players for BYEs so the client has details
    // Gather any dynamic SE_BYE or group byes
    const uniqueByes: Player[] = [];
    activePlayerIds.forEach(pid => {
      if (pid.includes('BYE') || pid === 'BYE') {
        uniqueByes.push({
          id: pid,
          name: 'BYE',
          skillLevel8: 3,
          skillLevel9: 3,
          skillLevel10: 3,
          createdAt: new Date().toISOString(),
          isBye: true,
        });
      }
    });

    return {
      tournament,
      players: [...tournamentPlayers, ...uniqueByes],
      groups,
      matches,
    };
  }

  async createTournament(
    name: string,
    gameType: '8-Ball' | '9-Ball' | '10-Ball',
    playerIds: string[],
    entryFee?: number,
    payoutPercentages?: number[],
    hasCalcutta?: boolean,
    calcuttaMinStartBet?: number,
    calcuttaMinIncrement?: number,
    calcuttaPayoutPercentages?: number[],
    creatorEmail?: string
  ): Promise<Tournament> {
    const allPlayers = await this.getPlayers();
    const playersMap = allPlayers.reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {} as Record<string, Player>);

    const tournamentId = Math.random().toString(36).substring(2, 11);
    const now = new Date().toISOString();

    const newTournament: Tournament = {
      id: tournamentId,
      name,
      gameType,
      status: hasCalcutta ? 'draft' : 'active',
      createdAt: now,
      entryFee,
      payoutPercentages,
      hasCalcutta,
      calcuttaMinStartBet,
      calcuttaMinIncrement,
      calcuttaPayoutPercentages,
      creatorEmail,
    };

    // 1. Resolve players, pad with BYEs to reach multiple of 8
    const selectedPlayers = playerIds.map(id => playersMap[id]).filter(Boolean);
    const numByesNeeded = (8 - (selectedPlayers.length % 8)) % 8;
    const finalPlayers: Player[] = [...selectedPlayers];

    for (let i = 0; i < numByesNeeded; i++) {
      const byeId = `BYE_${tournamentId}_${i}`;
      finalPlayers.push({
        id: byeId,
        name: `BYE ${i + 1}`,
        skillLevel8: 3,
        skillLevel9: 3,
        skillLevel10: 3,
        createdAt: now,
        isBye: true,
      });
    }

    // 2. Distribute BYEs round-robin across all groups to seed them as evenly as possible
    const realPlayers = [...selectedPlayers].sort(() => Math.random() - 0.5);
    const byePlayers = finalPlayers.filter(p => p.isBye).sort(() => Math.random() - 0.5);
    const numGroups = finalPlayers.length / 8;
    const groupsPlayers: Player[][] = Array.from({ length: numGroups }, () => []);

    let groupIdx = 0;
    while (byePlayers.length > 0) {
      const bye = byePlayers.pop()!;
      groupsPlayers[groupIdx].push(bye);
      groupIdx = (groupIdx + 1) % numGroups;
    }
    for (let i = 0; i < numGroups; i++) {
      while (groupsPlayers[i].length < 8 && realPlayers.length > 0) {
        groupsPlayers[i].push(realPlayers.pop()!);
      }
    }

    const groups: Group[] = [];
    let allMatches: Match[] = [];

    const groupPlayersMap = finalPlayers.reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {} as Record<string, Player>);

    for (let gIdx = 0; gIdx < numGroups; gIdx++) {
      const groupId = `group_${tournamentId}_${gIdx}`;
      const groupPlayers = groupsPlayers[gIdx];

      // Pair players in 4 matches, avoiding BYE-vs-BYE in first round
      const groupBye = groupPlayers.filter(p => p.isBye);
      const groupReal = groupPlayers.filter(p => !p.isBye);

      const pairs: [Player | null, Player | null][] = Array.from({ length: 4 }, () => [null, null]);
      let pairIdx = 0;
      for (const bye of groupBye) {
        if (pairIdx < 4) {
          pairs[pairIdx][0] = bye;
          pairIdx++;
        } else {
          const emptyPair = pairs.find(p => p[1] === null);
          if (emptyPair) {
            emptyPair[1] = bye;
          }
        }
      }

      for (const real of groupReal) {
        const p = pairs.find(p => p[0] === null || p[1] === null);
        if (p) {
          if (p[0] === null) p[0] = real;
          else p[1] = real;
        }
      }

      const shuffledPairs = [...pairs].sort(() => Math.random() - 0.5);
      const finalGroupPlayers: Player[] = [];
      for (const pair of shuffledPairs) {
        if (Math.random() > 0.5) {
          finalGroupPlayers.push(pair[1]!, pair[0]!);
        } else {
          finalGroupPlayers.push(pair[0]!, pair[1]!);
        }
      }

      const groupPlayerIds = finalGroupPlayers.map(p => p.id);

      const group: Group = {
        id: groupId,
        tournamentId,
        name: `Group ${String.fromCharCode(65 + gIdx)}`, // Group A, B, C...
        playerIds: groupPlayerIds,
        status: 'active',
      };
      groups.push(group);

      // Generate Double Elimination matches
      const groupMatches = initializeGroupMatches(tournamentId, group, groupPlayersMap, gameType);
      allMatches = [...allMatches, ...groupMatches];
    }

    // Save back to local storage
    const currentTournaments = await this.getTournaments();
    currentTournaments.push(newTournament);
    this.setStorageItem('ptm_tournaments', currentTournaments);

    const currentGroups = this.getStorageItem<Group[]>('ptm_groups', []);
    this.setStorageItem('ptm_groups', [...currentGroups, ...groups]);

    const currentMatches = this.getStorageItem<Match[]>('ptm_matches', []);
    this.setStorageItem('ptm_matches', [...currentMatches, ...allMatches]);

    return newTournament;
  }

  async updateMatchScore(
    tournamentId: string,
    matchId: string,
    score1: number,
    score2: number,
    stats1: MatchStats,
    stats2: MatchStats
  ): Promise<TournamentDetails> {
    const details = await this.getTournamentDetails(tournamentId);
    if (!details) throw new Error('Tournament not found');

    const match = details.matches.find(m => m.id === matchId);
    if (!match) throw new Error('Match not found');

    const playersMap = details.players.reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {} as Record<string, Player>);

    // Update match scores & status
    match.player1Score = score1;
    match.player2Score = score2;
    match.player1Stats = stats1;
    match.player2Stats = stats2;
    match.status = 'completed';
    match.winnerId = score1 >= match.player1Target ? match.player1Id : match.player2Id;

    if (match.roundType === 'group_winners' || match.roundType === 'group_losers') {
      // It is a Group Stage match. Run group progression.
      const groupMatches = details.matches.filter(m => m.groupId === match.groupId);
      advanceDoubleEliminationMatch(match, groupMatches, playersMap, details.tournament.gameType);

      // Check if all groups are completed
      const allGroupsDone = details.groups.every(g => {
        const gMatches = details.matches.filter(m => m.groupId === g.id);
        const completedCount = gMatches.filter(m => m.status === 'completed').length;
        // Total matches in group stage is 10
        return completedCount === 10;
      });

      // If all group matches are done, and we haven't seeded Single Elimination yet
      const knockoutMatchesExist = details.matches.some(m => m.roundType === 'knockout');
      if (allGroupsDone && !knockoutMatchesExist) {
        // Collect all qualifiers
        const qualifiersList = details.groups.map(g => getGroupQualifiers(g, details.matches));
        
        // Seed Single Elimination knockout bracket
        const knockoutMatches = seedSingleElimination(
          tournamentId,
          qualifiersList,
          playersMap,
          details.tournament.gameType
        );
        details.matches = [...details.matches, ...knockoutMatches];
      }
    } else {
      // It is a Single Elimination knockout match
      const seMatches = details.matches.filter(m => m.roundType === 'knockout');
      advanceKnockoutMatches(seMatches, playersMap, details.tournament.gameType);

      // Check if the overall tournament is completed
      // The final match is the last match in the knockout round with the highest roundNumber
      const maxRound = Math.max(...seMatches.map(m => m.roundNumber));
      const finalMatch = seMatches.find(m => m.roundNumber === maxRound);
      if (finalMatch?.status === 'completed' && finalMatch.winnerId) {
        details.tournament.status = 'completed';
        details.tournament.winnerId = finalMatch.winnerId;
      }
    }

    // Save changes
    const allMatches = this.getStorageItem<Match[]>('ptm_matches', []).filter(m => m.tournamentId !== tournamentId);
    this.setStorageItem('ptm_matches', [...allMatches, ...details.matches]);

    const tournaments = this.getStorageItem<Tournament[]>('ptm_tournaments', []).map(t => {
      if (t.id === tournamentId) return details.tournament;
      return t;
    });
    this.setStorageItem('ptm_tournaments', tournaments);

    return details;
  }

  async startTournament(id: string, calcuttaBids?: CalcuttaBid[]): Promise<TournamentDetails> {
    const tournaments = await this.getTournaments();
    const tournament = tournaments.find(t => t.id === id);
    if (!tournament) throw new Error('Tournament not found');

    tournament.status = 'active';
    if (calcuttaBids) {
      tournament.calcuttaBids = calcuttaBids;
    }

    this.setStorageItem('ptm_tournaments', tournaments);

    const details = await this.getTournamentDetails(id);
    if (!details) throw new Error('Failed to retrieve updated details');
    return details;
  }

  async updateTournamentPayments(
    id: string,
    entryFeePaidIds: string[],
    calcuttaBidsPaidIds: string[],
    playerPayoutPaidIds: string[],
    ownerPayoutPaidIds: string[]
  ): Promise<TournamentDetails> {
    const tournaments = await this.getTournaments();
    const tournament = tournaments.find(t => t.id === id);
    if (!tournament) throw new Error('Tournament not found');

    tournament.entryFeePaidIds = entryFeePaidIds;
    tournament.calcuttaBidsPaidIds = calcuttaBidsPaidIds;
    tournament.playerPayoutPaidIds = playerPayoutPaidIds;
    tournament.ownerPayoutPaidIds = ownerPayoutPaidIds;

    this.setStorageItem('ptm_tournaments', tournaments);

    const details = await this.getTournamentDetails(id);
    if (!details) throw new Error('Failed to retrieve updated details');
    return details;
  }

  async deleteTournament(id: string): Promise<void> {
    const currentTournaments = this.getStorageItem<Tournament[]>('ptm_tournaments', []);
    this.setStorageItem('ptm_tournaments', currentTournaments.filter(t => t.id !== id));

    const currentGroups = this.getStorageItem<Group[]>('ptm_groups', []);
    this.setStorageItem('ptm_groups', currentGroups.filter(g => g.tournamentId !== id));

    const currentMatches = this.getStorageItem<Match[]>('ptm_matches', []);
    this.setStorageItem('ptm_matches', currentMatches.filter(m => m.tournamentId !== id));
  }
}

// ----------------------------------------------------
// Supabase Adapter
// ----------------------------------------------------
class SupabaseAdapterImpl implements DatabaseAdapter {
  private client: SupabaseClient;

  constructor(url: string, key: string) {
    this.client = createClient(url, key);
  }

  // Fallback to local storage methods inside Supabase for schema operations
  // Note: We can implement real Supabase CRUD using PostgreSQL tables.
  // In our Dual-Mode approach, if Supabase is connected we will write to DB tables,
  // falling back to local storage if tables are missing or not set up.
  // Let's implement real Supabase fetch calls!
  async getPlayers(): Promise<Player[]> {
    const { data, error } = await this.client
      .from('players')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.warn('Supabase getPlayers error, falling back to LocalStorage', error);
      return localStorageAdapter.getPlayers();
    }
    
    // Map DB schema to interface
    return data.map((d: any) => ({
      id: d.id,
      name: d.name,
      skillLevel8: d.skill_level_8,
      skillLevel9: d.skill_level_9,
      skillLevel10: d.skill_level_10,
      createdAt: d.created_at,
    }));
  }

  async createPlayer(player: Omit<Player, 'id' | 'createdAt'>): Promise<Player> {
    const { data, error } = await this.client
      .from('players')
      .insert({
        name: player.name,
        skill_level_8: player.skillLevel8,
        skill_level_9: player.skillLevel9,
        skill_level_10: player.skillLevel10,
      })
      .select()
      .single();

    if (error) {
      console.warn('Supabase createPlayer error, falling back to LocalStorage', error);
      return localStorageAdapter.createPlayer(player);
    }

    return {
      id: data.id,
      name: data.name,
      skillLevel8: data.skill_level_8,
      skillLevel9: data.skill_level_9,
      skillLevel10: data.skill_level_10,
      createdAt: data.created_at,
    };
  }

  async getTournaments(): Promise<Tournament[]> {
    const { data, error } = await this.client
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase getTournaments error, falling back to LocalStorage', error);
      return localStorageAdapter.getTournaments();
    }

    return data.map((d: any) => ({
      id: d.id,
      name: d.name,
      gameType: d.game_type,
      status: d.status,
      createdAt: d.created_at,
      winnerId: d.winner_id,
    }));
  }

  async getTournamentDetails(id: string): Promise<TournamentDetails | null> {
    // Check if we have active supabase connection, if we encounter error, fallback
    try {
      const { data: tournamentData, error: tErr } = await this.client
        .from('tournaments')
        .select('*')
        .eq('id', id)
        .single();
      
      if (tErr || !tournamentData) throw new Error('Tournament not found in Supabase');

      const { data: groupsData, error: gErr } = await this.client
        .from('groups')
        .select('*')
        .eq('tournament_id', id);

      const { data: matchesData, error: mErr } = await this.client
        .from('matches')
        .select('*')
        .eq('tournament_id', id);

      if (gErr || mErr) throw new Error('Failed to load child tables in Supabase');

      // Map back data
      const tournament: Tournament = {
        id: tournamentData.id,
        name: tournamentData.name,
        gameType: tournamentData.game_type,
        status: tournamentData.status,
        createdAt: tournamentData.created_at,
        winnerId: tournamentData.winner_id,
        entryFee: tournamentData.entry_fee,
        payoutPercentages: tournamentData.payout_percentages,
        hasCalcutta: tournamentData.has_calcutta,
        calcuttaMinStartBet: tournamentData.calcutta_min_start_bet,
        calcuttaMinIncrement: tournamentData.calcutta_min_increment,
        calcuttaPayoutPercentages: tournamentData.calcutta_payout_percentages,
        calcuttaBids: tournamentData.calcutta_bids,
        entryFeePaidIds: tournamentData.entry_fee_paid_ids || [],
        calcuttaBidsPaidIds: tournamentData.calcutta_bids_paid_ids || [],
        playerPayoutPaidIds: tournamentData.player_payout_paid_ids || [],
        ownerPayoutPaidIds: tournamentData.owner_payout_paid_ids || [],
      };

      const groups: Group[] = (groupsData || []).map((g: any) => ({
        id: g.id,
        tournamentId: g.tournament_id,
        name: g.name,
        playerIds: g.player_ids,
        status: g.status,
      }));

      const matches: Match[] = (matchesData || []).map((m: any) => ({
        id: m.id,
        tournamentId: m.tournament_id,
        groupId: m.group_id,
        roundType: m.round_type,
        roundNumber: m.round_number,
        matchNumber: m.match_number,
        player1Id: m.player1_id,
        player2Id: m.player2_id,
        player1Score: m.player1_score,
        player2Score: m.player2_score,
        player1Target: m.player1_target,
        player2Target: m.player2_target,
        player1SpottedBalls: m.player1_spotted_balls || [],
        player2SpottedBalls: m.player2_spotted_balls || [],
        status: m.status,
        winnerId: m.winner_id,
        player1Stats: m.player1_stats || {},
        player2Stats: m.player2_stats || {},
        createdAt: m.created_at,
      }));

      const allPlayers = await this.getPlayers();
      const activePlayerIds = new Set<string>();
      groups.forEach(g => g.playerIds.forEach(pid => activePlayerIds.add(pid)));
      matches.forEach(m => {
        if (m.player1Id) activePlayerIds.add(m.player1Id);
        if (m.player2Id) activePlayerIds.add(m.player2Id);
      });

      const tournamentPlayers = allPlayers.filter(p => activePlayerIds.has(p.id));
      const uniqueByes: Player[] = [];
      activePlayerIds.forEach(pid => {
        if (pid.includes('BYE') || pid === 'BYE') {
          uniqueByes.push({
            id: pid,
            name: 'BYE',
            skillLevel8: 3,
            skillLevel9: 3,
            skillLevel10: 3,
            createdAt: new Date().toISOString(),
            isBye: true,
          });
        }
      });

      return {
        tournament,
        players: [...tournamentPlayers, ...uniqueByes],
        groups,
        matches,
      };
    } catch (e) {
      console.warn('Supabase getTournamentDetails failed, falling back to LocalStorage', e);
      return localStorageAdapter.getTournamentDetails(id);
    }
  }

  async createTournament(
    name: string,
    gameType: '8-Ball' | '9-Ball' | '10-Ball',
    playerIds: string[],
    entryFee?: number,
    payoutPercentages?: number[],
    hasCalcutta?: boolean,
    calcuttaMinStartBet?: number,
    calcuttaMinIncrement?: number,
    calcuttaPayoutPercentages?: number[],
    creatorEmail?: string
  ): Promise<Tournament> {
    try {
      // For creation, we perform bracket logic, and write records to Supabase tables:
      // tournaments, groups, matches
      const allPlayers = await this.getPlayers();
      const playersMap = allPlayers.reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {} as Record<string, Player>);

      // 1. Create tournament record
      const { data: tournamentData, error: tErr } = await this.client
        .from('tournaments')
        .insert({
          name,
          game_type: gameType,
          status: hasCalcutta ? 'draft' : 'active',
          entry_fee: entryFee,
          payout_percentages: payoutPercentages,
          has_calcutta: hasCalcutta,
          calcutta_min_start_bet: calcuttaMinStartBet,
          calcutta_min_increment: calcuttaMinIncrement,
          calcutta_payout_percentages: calcuttaPayoutPercentages,
          creator_email: creatorEmail,
        })
        .select()
        .single();

      if (tErr || !tournamentData) throw new Error('Failed to create tournament in Supabase');

      const tournamentId = tournamentData.id;

      // 2. Pad with BYEs
      const selectedPlayers = playerIds.map(id => playersMap[id]).filter(Boolean);
      const numByesNeeded = (8 - (selectedPlayers.length % 8)) % 8;
      const finalPlayers: Player[] = [...selectedPlayers];

      for (let i = 0; i < numByesNeeded; i++) {
        const byeId = `BYE_${tournamentId}_${i}`;
        finalPlayers.push({
          id: byeId,
          name: `BYE ${i + 1}`,
          skillLevel8: 3,
          skillLevel9: 3,
          skillLevel10: 3,
          createdAt: new Date().toISOString(),
          isBye: true,
        });
      }

      // 3. Seeding logic with constraint (avoid BYE-vs-BYE matches in round 1)
      const realPlayers = [...selectedPlayers].sort(() => Math.random() - 0.5);
      const byePlayers = finalPlayers.filter(p => p.isBye).sort(() => Math.random() - 0.5);
      const numGroups = finalPlayers.length / 8;
      const groupsPlayers: Player[][] = Array.from({ length: numGroups }, () => []);

      let groupIdx = 0;
      while (byePlayers.length > 0) {
        const bye = byePlayers.pop()!;
        groupsPlayers[groupIdx].push(bye);
        groupIdx = (groupIdx + 1) % numGroups;
      }
      for (let i = 0; i < numGroups; i++) {
        while (groupsPlayers[i].length < 8 && realPlayers.length > 0) {
          groupsPlayers[i].push(realPlayers.pop()!);
        }
      }

      const groupPlayersMap = finalPlayers.reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {} as Record<string, Player>);

      for (let gIdx = 0; gIdx < numGroups; gIdx++) {
        const groupPlayers = groupsPlayers[gIdx];

        // Pair players avoiding BYE-vs-BYE
        const groupBye = groupPlayers.filter(p => p.isBye);
        const groupReal = groupPlayers.filter(p => !p.isBye);

        const pairs: [Player | null, Player | null][] = Array.from({ length: 4 }, () => [null, null]);
        let pairIdx = 0;
        for (const bye of groupBye) {
          if (pairIdx < 4) {
            pairs[pairIdx][0] = bye;
            pairIdx++;
          } else {
            const emptyPair = pairs.find(p => p[1] === null);
            if (emptyPair) {
              emptyPair[1] = bye;
            }
          }
        }

        for (const real of groupReal) {
          const p = pairs.find(p => p[0] === null || p[1] === null);
          if (p) {
            if (p[0] === null) p[0] = real;
            else p[1] = real;
          }
        }

        const shuffledPairs = [...pairs].sort(() => Math.random() - 0.5);
        const finalGroupPlayers: Player[] = [];
        for (const pair of shuffledPairs) {
          if (Math.random() > 0.5) {
            finalGroupPlayers.push(pair[1]!, pair[0]!);
          } else {
            finalGroupPlayers.push(pair[0]!, pair[1]!);
          }
        }

        const groupPlayerIds = finalGroupPlayers.map(p => p.id);

        // Create Group
        const { data: groupData, error: gErr } = await this.client
          .from('groups')
          .insert({
            tournament_id: tournamentId,
            name: `Group ${String.fromCharCode(65 + gIdx)}`,
            player_ids: groupPlayerIds,
            status: 'active',
          })
          .select()
          .single();

        if (gErr || !groupData) throw new Error('Failed to create group in Supabase');

        const group: Group = {
          id: groupData.id,
          tournamentId,
          name: groupData.name,
          playerIds: groupData.player_ids,
          status: groupData.status,
        };

        // Initialize Matches
        const groupMatches = initializeGroupMatches(tournamentId, group, groupPlayersMap, gameType);
        
        // Write matches to Supabase
        const dbMatches = groupMatches.map(m => ({
          id: m.id,
          tournament_id: tournamentId,
          group_id: group.id,
          round_type: m.roundType,
          round_number: m.roundNumber,
          match_number: m.matchNumber,
          player1_id: m.player1Id,
          player2_id: m.player2Id,
          player1_score: m.player1Score,
          player2_score: m.player2Score,
          player1_target: m.player1Target,
          player2_target: m.player2Target,
          player1_spotted_balls: m.player1SpottedBalls,
          player2_spotted_balls: m.player2SpottedBalls,
          status: m.status,
          winner_id: m.winnerId,
        }));

        const { error: mErr } = await this.client.from('matches').insert(dbMatches);
        if (mErr) throw new Error('Failed to write group matches in Supabase');
      }

      return {
        id: tournamentData.id,
        name: tournamentData.name,
        gameType: tournamentData.game_type,
        status: tournamentData.status,
        createdAt: tournamentData.created_at,
        entryFee: tournamentData.entry_fee,
        payoutPercentages: tournamentData.payout_percentages,
        hasCalcutta: tournamentData.has_calcutta,
        calcuttaMinStartBet: tournamentData.calcutta_min_start_bet,
        calcuttaMinIncrement: tournamentData.calcutta_min_increment,
        calcuttaPayoutPercentages: tournamentData.calcutta_payout_percentages,
        creatorEmail: tournamentData.creator_email || undefined,
        calcuttaBids: tournamentData.calcutta_bids,
      };
    } catch (e) {
      console.warn('Supabase createTournament failed, falling back to LocalStorage', e);
      return localStorageAdapter.createTournament(
        name,
        gameType,
        playerIds,
        entryFee,
        payoutPercentages,
        hasCalcutta,
        calcuttaMinStartBet,
        calcuttaMinIncrement,
        calcuttaPayoutPercentages,
        creatorEmail
      );
    }
  }

  async updateMatchScore(
    tournamentId: string,
    matchId: string,
    score1: number,
    score2: number,
    stats1: MatchStats,
    stats2: MatchStats
  ): Promise<TournamentDetails> {
    try {
      // First download details to perform progression in-memory
      const details = await this.getTournamentDetails(tournamentId);
      if (!details) throw new Error('Tournament details not found in Supabase');

      const match = details.matches.find(m => m.id === matchId);
      if (!match) throw new Error('Match not found in Supabase');

      const playersMap = details.players.reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {} as Record<string, Player>);

      // Update local match state
      match.player1Score = score1;
      match.player2Score = score2;
      match.player1Stats = stats1;
      match.player2Stats = stats2;
      match.status = 'completed';
      match.winnerId = score1 >= match.player1Target ? match.player1Id : match.player2Id;

      const updatedMatchesList: Match[] = [match];

      if (match.roundType === 'group_winners' || match.roundType === 'group_losers') {
        const groupMatches = details.matches.filter(m => m.groupId === match.groupId);
        advanceDoubleEliminationMatch(match, groupMatches, playersMap, details.tournament.gameType);
        
        // Collect all group matches that changed (have new players assigned, or were auto-completed by BYEs)
        groupMatches.forEach(gm => {
          if (gm.id !== matchId) {
            updatedMatchesList.push(gm);
          }
        });

        // Check groups completion
        const allGroupsDone = details.groups.every(g => {
          const gMatches = details.matches.filter(m => m.groupId === g.id);
          const completedCount = gMatches.filter(m => m.status === 'completed').length;
          return completedCount === 10;
        });

        const knockoutMatchesExist = details.matches.some(m => m.roundType === 'knockout');
        if (allGroupsDone && !knockoutMatchesExist) {
          const qualifiersList = details.groups.map(g => getGroupQualifiers(g, details.matches));
          const knockoutMatches = seedSingleElimination(
            tournamentId,
            qualifiersList,
            playersMap,
            details.tournament.gameType
          );
          
          // These are brand-new matches we must insert into DB later
          details.matches = [...details.matches, ...knockoutMatches];
          
          // Write the new knockout matches to DB
          const dbKnockouts = knockoutMatches.map(m => ({
            id: m.id,
            tournament_id: tournamentId,
            round_type: m.roundType,
            round_number: m.roundNumber,
            match_number: m.matchNumber,
            player1_id: m.player1Id,
            player2_id: m.player2Id,
            player1_score: m.player1Score,
            player2_score: m.player2Score,
            player1_target: m.player1Target,
            player2_target: m.player2Target,
            player1_spotted_balls: m.player1SpottedBalls,
            player2_spotted_balls: m.player2SpottedBalls,
            status: m.status,
            winner_id: m.winnerId,
          }));

          const { error: insErr } = await this.client.from('matches').insert(dbKnockouts);
          if (insErr) throw new Error('Failed to insert knockout matches in Supabase');
        }
      } else {
        // Single Elimination match progression
        const seMatches = details.matches.filter(m => m.roundType === 'knockout');
        advanceKnockoutMatches(seMatches, playersMap, details.tournament.gameType);

        seMatches.forEach(sm => {
          if (sm.id !== matchId) {
            updatedMatchesList.push(sm);
          }
        });

        const maxRound = Math.max(...seMatches.map(m => m.roundNumber));
        const finalMatch = seMatches.find(m => m.roundNumber === maxRound);
        if (finalMatch?.status === 'completed' && finalMatch.winnerId) {
          details.tournament.status = 'completed';
          details.tournament.winnerId = finalMatch.winnerId;

          // Update tournament status in DB
          await this.client
            .from('tournaments')
            .update({ status: 'completed', winner_id: finalMatch.winnerId })
            .eq('id', tournamentId);
        }
      }

    // Upsert the updated matches list to Supabase
      const matchesToUpsert = updatedMatchesList.map(m => ({
        id: m.id,
        tournament_id: tournamentId,
        group_id: m.groupId || null,
        round_type: m.roundType,
        round_number: m.roundNumber,
        match_number: m.matchNumber,
        player1_id: m.player1Id || null,
        player2_id: m.player2Id || null,
        player1_score: m.player1Score,
        player2_score: m.player2Score,
        player1_target: m.player1Target,
        player2_target: m.player2Target,
        player1_spotted_balls: m.player1SpottedBalls,
        player2_spotted_balls: m.player2SpottedBalls,
        status: m.status,
        winner_id: m.winnerId || null,
        player1_stats: m.player1Stats || {},
        player2_stats: m.player2Stats || {},
      }));

      const { error: upsErr } = await this.client.from('matches').upsert(matchesToUpsert);
      if (upsErr) throw new Error('Failed to update matches in Supabase');

      return details;
    } catch (e) {
      console.warn('Supabase updateMatchScore failed, falling back to LocalStorage', e);
      return localStorageAdapter.updateMatchScore(tournamentId, matchId, score1, score2, stats1, stats2);
    }
  }

  async startTournament(id: string, calcuttaBids?: CalcuttaBid[]): Promise<TournamentDetails> {
    try {
      const { data, error } = await this.client
        .from('tournaments')
        .update({
          status: 'active',
          calcutta_bids: calcuttaBids,
        })
        .eq('id', id)
        .select()
        .single();

      if (error || !data) throw new Error('Failed to update tournament status in Supabase');

      const details = await this.getTournamentDetails(id);
      if (!details) throw new Error('Failed to load updated tournament details');
      return details;
    } catch (e) {
      console.warn('Supabase startTournament failed, falling back to LocalStorage', e);
      return localStorageAdapter.startTournament(id, calcuttaBids);
    }
  }

  async updateTournamentPayments(
    id: string,
    entryFeePaidIds: string[],
    calcuttaBidsPaidIds: string[],
    playerPayoutPaidIds: string[],
    ownerPayoutPaidIds: string[]
  ): Promise<TournamentDetails> {
    try {
      const { data, error } = await this.client
        .from('tournaments')
        .update({
          entry_fee_paid_ids: entryFeePaidIds,
          calcutta_bids_paid_ids: calcuttaBidsPaidIds,
          player_payout_paid_ids: playerPayoutPaidIds,
          owner_payout_paid_ids: ownerPayoutPaidIds,
        })
        .eq('id', id)
        .select()
        .single();

      if (error || !data) throw new Error('Failed to update tournament payments in Supabase');

      const details = await this.getTournamentDetails(id);
      if (!details) throw new Error('Failed to load updated tournament details');
      return details;
    } catch (e) {
      console.warn('Supabase updateTournamentPayments failed, falling back to LocalStorage', e);
      return localStorageAdapter.updateTournamentPayments(
        id,
        entryFeePaidIds,
        calcuttaBidsPaidIds,
        playerPayoutPaidIds,
        ownerPayoutPaidIds
      );
    }
  }

  async deleteTournament(id: string): Promise<void> {
    try {
      await this.client.from('matches').delete().eq('tournament_id', id);
      await this.client.from('groups').delete().eq('tournament_id', id);
      const { error } = await this.client.from('tournaments').delete().eq('id', id);
      if (error) throw error;
    } catch (e) {
      console.warn('Supabase deleteTournament failed, falling back to LocalStorage', e);
      await localStorageAdapter.deleteTournament(id);
    }
  }
}

// Instantiate fallback adapters
const localStorageAdapter = new LocalStorageAdapterImpl();

let databaseAdapter: DatabaseAdapter = localStorageAdapter;

if (
  typeof window !== 'undefined' &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
) {
  databaseAdapter = new SupabaseAdapterImpl(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function getDatabaseAdapter(): DatabaseAdapter {
  return databaseAdapter;
}
