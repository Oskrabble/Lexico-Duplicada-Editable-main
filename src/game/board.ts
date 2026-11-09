// Standard 15x15 Scrabble board premium squares
// Coordinates: 0-indexed row, col (row 0 = top, col 0 = left)

export type PremiumType = 'TW' | 'DW' | 'TL' | 'DL' | null;

export const BOARD_SIZE = 15;
export const CENTER_ROW = 7;
export const CENTER_COL = 7;

// Triple Word squares
const TW_POSITIONS: [number, number][] = [
  [0, 0], [0, 7], [0, 14],
  [7, 0], [7, 14],
  [14, 0], [14, 7], [14, 14],
];

// Double Word squares
const DW_POSITIONS: [number, number][] = [
  [1, 1], [1, 13],
  [2, 2], [2, 12],
  [3, 3], [3, 11],
  [4, 4], [4, 10],
  [7, 7], // center
  [10, 4], [10, 10],
  [11, 3], [11, 11],
  [12, 2], [12, 12],
  [13, 1], [13, 13],
];

// Triple Letter squares
const TL_POSITIONS: [number, number][] = [
  [1, 5], [1, 9],
  [5, 1], [5, 5], [5, 9], [5, 13],
  [9, 1], [9, 5], [9, 9], [9, 13],
  [13, 5], [13, 9],
];

// Double Letter squares
const DL_POSITIONS: [number, number][] = [
  [0, 3], [0, 11],
  [2, 6], [2, 8],
  [3, 0], [3, 7], [3, 14],
  [6, 2], [6, 6], [6, 8], [6, 12],
  [7, 3], [7, 11],
  [8, 2], [8, 6], [8, 8], [8, 12],
  [11, 0], [11, 7], [11, 14],
  [12, 6], [12, 8],
  [14, 3], [14, 11],
];

function buildPremiumGrid(): PremiumType[][] {
  const grid: PremiumType[][] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    grid.push(new Array(BOARD_SIZE).fill(null));
  }
  for (const [r, c] of TW_POSITIONS) grid[r][c] = 'TW';
  for (const [r, c] of DW_POSITIONS) grid[r][c] = 'DW';
  for (const [r, c] of TL_POSITIONS) grid[r][c] = 'TL';
  for (const [r, c] of DL_POSITIONS) grid[r][c] = 'DL';
  return grid;
}

export const PREMIUM_GRID: PremiumType[][] = buildPremiumGrid();

export function getPremium(r: number, c: number): PremiumType {
  return PREMIUM_GRID[r]?.[c] ?? null;
}

export function isCenter(r: number, c: number): boolean {
  return r === CENTER_ROW && c === CENTER_COL;
}
