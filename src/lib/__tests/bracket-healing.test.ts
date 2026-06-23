import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { Player, Tournament, Match } from '../../types';
import { calculateMatchHandicap } from '../handicap';

// Define the healing logic here for testing first
function healKnockoutMatches(
  matches: Match[],
  tournament: Tournament,
  playersMap: Record<string, Player>
): { healedMatches: Match[]; changed: boolean } {
  const seMatches = matches.filter(m => m.roundType === 'knockout');
  if (seMatches.length === 0) return { healedMatches: matches, changed: false };

  const maxRound = Math.max(...seMatches.map(m => m.roundNumber));
  let changed = false;
  const updatedMatches = [...matches];

  for (let r = 1; r <= maxRound; r++) {
    const expectedCount = Math.pow(2, maxRound - r);
    for (let mNum = 1; mNum <= expectedCount; mNum++) {
      const matchIndex = updatedMatches.findIndex(
        m => m.tournamentId === tournament.id && m.roundType === 'knockout' && m.roundNumber === r && m.matchNumber === mNum
      );

      if (matchIndex === -1) {
        const hasPrefix = seMatches.some(m => m.id.startsWith(`${tournament.id}_`));
        const matchId = hasPrefix ? `${tournament.id}_se_r${r}_m${mNum}` : `se_r${r}_m${mNum}`;

        let p1Id = '';
        let p2Id = '';
        if (r > 1) {
          const prevMatch1 = updatedMatches.find(
            m => m.tournamentId === tournament.id && m.roundType === 'knockout' && m.roundNumber === r - 1 && m.matchNumber === 2 * mNum - 1
          );
          const prevMatch2 = updatedMatches.find(
            m => m.tournamentId === tournament.id && m.roundType === 'knockout' && m.roundNumber === r - 1 && m.matchNumber === 2 * mNum
          );
          p1Id = (prevMatch1?.status === 'completed' && prevMatch1.winnerId) ? prevMatch1.winnerId : '';
          p2Id = (prevMatch2?.status === 'completed' && prevMatch2.winnerId) ? prevMatch2.winnerId : '';
        }

        let winnerId: string | undefined = undefined;
        let status: 'scheduled' | 'completed' = 'scheduled';
        let p1Score = 0;
        let p2Score = 0;

        const nextRoundNum = r + 1;
        const nextMatchNum = Math.ceil(mNum / 2);
        const isPlayer1Slot = mNum % 2 !== 0;

        const nextMatch = updatedMatches.find(
          m => m.tournamentId === tournament.id && m.roundType === 'knockout' && m.roundNumber === nextRoundNum && m.matchNumber === nextMatchNum
        );

        if (nextMatch) {
          const nextPlayerId = isPlayer1Slot ? nextMatch.player1Id : nextMatch.player2Id;
          if (nextPlayerId) {
            winnerId = nextPlayerId;
            status = 'completed';
          }
        }

        let p1Target = 1;
        let p2Target = 1;
        let p1Spotted: number[] = [];
        let p2Spotted: number[] = [];

        const p1Obj = p1Id ? playersMap[p1Id] : null;
        const p2Obj = p2Id ? playersMap[p2Id] : null;

        if (p1Obj && p2Obj) {
          const hc = calculateMatchHandicap(p1Obj, p2Obj, tournament.gameType, tournament.handicapRaceStyle);
          p1Target = hc.player1Target;
          p2Target = hc.player2Target;
          p1Spotted = hc.player1SpottedBalls;
          p2Spotted = hc.player2SpottedBalls;
        }

        if (status === 'completed' && winnerId) {
          if (winnerId === p1Id) {
            p1Score = p1Target;
            p2Score = 0;
          } else if (winnerId === p2Id) {
            p1Score = 0;
            p2Score = p2Target;
          }
        }

        const healedMatch: Match = {
          id: matchId,
          tournamentId: tournament.id,
          roundType: 'knockout',
          roundNumber: r,
          matchNumber: mNum,
          player1Id: p1Id,
          player2Id: p2Id,
          player1Score: p1Score,
          player2Score: p2Score,
          player1Target: p1Target,
          player2Target: p2Target,
          player1SpottedBalls: p1Spotted,
          player2SpottedBalls: p2Spotted,
          status,
          winnerId,
          createdAt: new Date().toISOString(),
          handicapRaceStyle: tournament.handicapRaceStyle,
        };

        updatedMatches.push(healedMatch);
        changed = true;
      }
    }
  }

  return { healedMatches: updatedMatches, changed };
}

describe('Bracket healing unit tests', () => {
  it('correctly heals the missing se_r2_m1 match from the database export', () => {
    const dbData = JSON.parse(fs.readFileSync('C:\\Users\\shabu\\OneDrive\\เดสก์ท็อป\\Backup DB\\pool_tournament_db_export.json', 'utf8'));
    const tournamentId = 'v0tqponsz';
    const tournament = dbData.ptm_tournaments.find((t: any) => t.id === tournamentId);
    
    const playersMap: Record<string, Player> = {};
    dbData.ptm_players.forEach((p: any) => {
      playersMap[p.id] = p;
    });

    const matches = dbData.ptm_matches.filter((m: any) => m.tournamentId === tournamentId);

    // Initial check: match should be missing
    const initialSE = matches.filter((m: any) => m.roundType === 'knockout');
    expect(initialSE.length).toBe(30);
    expect(initialSE.find((m: any) => m.roundNumber === 2 && m.matchNumber === 1)).toBeUndefined();

    // Run healing
    const { healedMatches, changed } = healKnockoutMatches(matches, tournament, playersMap);
    
    expect(changed).toBe(true);
    
    const finalSE = healedMatches.filter((m: any) => m.roundType === 'knockout');
    expect(finalSE.length).toBe(31);

    const healedMatch = finalSE.find((m: any) => m.roundNumber === 2 && m.matchNumber === 1);
    expect(healedMatch).toBeDefined();
    
    // Check values
    expect(healedMatch!.id).toBe('se_r2_m1');
    expect(healedMatch!.player1Id).toBe('djn4wcu2w'); // Hongte
    expect(healedMatch!.player2Id).toBe('88q7wjplo'); // Pang
    expect(healedMatch!.status).toBe('completed');
    expect(healedMatch!.winnerId).toBe('88q7wjplo'); // Pang
    expect(healedMatch!.player1Target).toBe(7);
    expect(healedMatch!.player2Target).toBe(4);
    expect(healedMatch!.player1Score).toBe(0);
    expect(healedMatch!.player2Score).toBe(4);
  });
});
