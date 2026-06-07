import { GameType, Player } from '../types';

export interface HandicapMatchSetup {
  player1Target: number;
  player2Target: number;
  player1SpottedBalls: number[];
  player2SpottedBalls: number[];
}

/**
 * APA 8-ball race-to grid.
 * Key represents higherSL_lowerSL. Value represents [higherTarget, lowerTarget].
 */
const APA_8BALL_GRID: Record<string, [number, number]> = {
  '7_7': [5, 5],
  '7_6': [5, 4],
  '7_5': [5, 3],
  '7_4': [5, 2],
  '7_3': [5, 2],
  '7_2': [5, 2],
  '6_6': [5, 5],
  '6_5': [5, 4],
  '6_4': [5, 3],
  '6_3': [5, 2],
  '6_2': [5, 2],
  '5_5': [4, 4],
  '5_4': [4, 3],
  '5_3': [4, 2],
  '5_2': [4, 2],
  '4_4': [3, 3],
  '4_3': [3, 2],
  '4_2': [3, 2],
  '3_3': [2, 2],
  '3_2': [2, 2],
  '2_2': [2, 2],
};

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

  if (gameType === '8-Ball') {
    const sl1 = player1.skillLevel8;
    const sl2 = player2.skillLevel8;
    
    // Sort to look up in the grid
    const p1IsHigher = sl1 >= sl2;
    const key = p1IsHigher ? `${sl1}_${sl2}` : `${sl2}_${sl1}`;
    const gridResult = APA_8BALL_GRID[key];

    if (!gridResult) {
      // Fallback
      return {
        player1Target: 3,
        player2Target: 3,
        player1SpottedBalls: [],
        player2SpottedBalls: [],
      };
    }

    const [higherTarget, lowerTarget] = gridResult;
    return {
      player1Target: p1IsHigher ? higherTarget : lowerTarget,
      player2Target: p1IsHigher ? lowerTarget : higherTarget,
      player1SpottedBalls: [],
      player2SpottedBalls: [],
    };
  } else {
    // 9-Ball and 10-Ball use skill level 2-9
    const sl1 = gameType === '9-Ball' ? player1.skillLevel9 : player1.skillLevel10;
    const sl2 = gameType === '9-Ball' ? player2.skillLevel9 : player2.skillLevel10;

    const diff = Math.abs(sl1 - sl2);
    const p1IsHigher = sl1 >= sl2;

    let higherTarget = 5;
    let lowerTarget = 5;

    // Race targets based on difference
    if (diff === 0) {
      higherTarget = 5;
      lowerTarget = 5;
    } else if (diff === 1) {
      higherTarget = 5;
      lowerTarget = 4;
    } else if (diff === 2) {
      higherTarget = 5;
      lowerTarget = 3;
    } else if (diff === 3) {
      higherTarget = 6;
      lowerTarget = 3;
    } else {
      // diff >= 4
      higherTarget = 7;
      lowerTarget = 3;
    }

    // Ball spotting rules
    let p1SpottedBalls: number[] = [];
    let p2SpottedBalls: number[] = [];

    // The lower-rated player gets the spot.
    if (diff === 2) {
      if (p1IsHigher) {
        p2SpottedBalls = [8];
      } else {
        p1SpottedBalls = [8];
      }
    } else if (diff === 3) {
      if (p1IsHigher) {
        p2SpottedBalls = [7, 8];
      } else {
        p1SpottedBalls = [7, 8];
      }
    } else if (diff >= 4) {
      if (p1IsHigher) {
        p2SpottedBalls = [6, 7, 8];
      } else {
        p1SpottedBalls = [6, 7, 8];
      }
    }

    return {
      player1Target: p1IsHigher ? higherTarget : lowerTarget,
      player2Target: p1IsHigher ? lowerTarget : higherTarget,
      player1SpottedBalls: p1SpottedBalls,
      player2SpottedBalls: p2SpottedBalls,
    };
  }
}
