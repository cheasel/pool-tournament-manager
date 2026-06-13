import { GameType, Player } from '../types';

export interface HandicapMatchSetup {
  player1Target: number;
  player2Target: number;
  player1SpottedBalls: number[];
  player2SpottedBalls: number[];
}

/**
 * Calculates match handicap targets and spotted balls for two players.
 */
export function calculateMatchHandicap(
  player1: Player,
  player2: Player,
  gameType: GameType
): HandicapMatchSetup {
  // If one of the players is a BYE, return default targets
  if (player1.isBye || player2.isBye) {
    return {
      player1Target: 1,
      player2Target: 1,
      player1SpottedBalls: [],
      player2SpottedBalls: [],
    };
  }

  const sl1 = gameType === '8-Ball' ? player1.skillLevel8 : gameType === '9-Ball' ? player1.skillLevel9 : player1.skillLevel10;
  const sl2 = gameType === '8-Ball' ? player2.skillLevel8 : gameType === '9-Ball' ? player2.skillLevel9 : player2.skillLevel10;

  const diff = Math.abs(sl1 - sl2);
  const p1IsHigher = sl1 >= sl2;

  let higherTarget = 5 + Math.ceil(diff / 2);
  let lowerTarget = Math.max(2, 5 - Math.floor(diff / 2));

  // Ball spotting rules (9-Ball and 10-Ball only)
  let spots: number[] = [];
  if (gameType !== '8-Ball') {
    if (diff === 2) {
      spots = [8];
    } else if (diff === 3) {
      spots = [7, 8];
    } else if (diff >= 4) {
      spots = [6, 7, 8];
    }
  }

  // Load custom races if configured in localStorage
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('ptm_handicap_races');
    if (saved) {
      try {
        const customRaces = JSON.parse(saved);
        if (Array.isArray(customRaces)) {
          const matched = customRaces.find(
            (r: any) =>
              r.gameType === gameType &&
              r.higherSkill === Math.max(sl1, sl2) &&
              r.lowerSkill === Math.min(sl1, sl2)
          );
          if (matched) {
            higherTarget = matched.higherTarget;
            lowerTarget = matched.lowerTarget;
            spots = gameType !== '8-Ball' ? (matched.spottedBalls || []) : [];
          }
        }
      } catch (e) {
        console.error('Failed to parse custom handicap races from localStorage', e);
      }
    }
  }

  let p1SpottedBalls: number[] = [];
  let p2SpottedBalls: number[] = [];

  if (spots.length > 0) {
    if (p1IsHigher) {
      p2SpottedBalls = spots;
    } else {
      p1SpottedBalls = spots;
    }
  }

  return {
    player1Target: p1IsHigher ? higherTarget : lowerTarget,
    player2Target: p1IsHigher ? lowerTarget : higherTarget,
    player1SpottedBalls: p1SpottedBalls,
    player2SpottedBalls: p2SpottedBalls,
  };
}
