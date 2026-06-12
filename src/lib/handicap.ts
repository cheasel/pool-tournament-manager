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

  const higherTarget = 5 + Math.ceil(diff / 2);
  const lowerTarget = Math.max(2, 5 - Math.floor(diff / 2));

  // Ball spotting rules (9-Ball and 10-Ball only)
  let p1SpottedBalls: number[] = [];
  let p2SpottedBalls: number[] = [];

  if (gameType !== '8-Ball') {
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
  }

  return {
    player1Target: p1IsHigher ? higherTarget : lowerTarget,
    player2Target: p1IsHigher ? lowerTarget : higherTarget,
    player1SpottedBalls: p1SpottedBalls,
    player2SpottedBalls: p2SpottedBalls,
  };
}
