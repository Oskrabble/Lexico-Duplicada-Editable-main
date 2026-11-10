// Core type definitions for the Scrabble duplicate game

export interface PlacedTile {
  letter: string;      // The letter shown (e.g. 'A', 'CH', '?' for blank)
  isBlank: boolean;    // True if this is a blank tile
  blankLetter?: string; // If blank, the letter it represents (e.g. 'A')
  rackId?: string;     // Unique id of the rack tile it came from (for undo during placement)
}

export type Cell = PlacedTile | null;

export type Board = Cell[][]; // 15x15 grid

export interface RackTile {
  id: string;       // unique id for tracking
  letter: string;   // 'A', 'CH', '?' for blank
  isBlank: boolean;
  blankLetter?: string;
  used: boolean;    // whether currently placed on board (pending)
}

export type Direction = 'H' | 'V';

export type RackMode = 'random' | 'manual';

export interface Move {
  row: number;
  col: number;
  direction: Direction;
  tiles: { letter: string; isBlank: boolean; blankLetter?: string }[];
  word: string;        // main word formed
  score: number;
  wordsFormed: string[]; // all words formed (for validation display)
  isBingo: boolean;     // 7-tile bonus (50 points)
}

export interface GamePhase {
  phase: 'playing' | 'revealed' | 'finished';
}

export interface RoundResult {
  playerMove: Move | null;     // null if passed or swapped
  bestMove: Move | null;      // the optimal move found by solver
  playerScore: number;
  bestScore: number;
  difference: number;          // bestScore - playerScore
  playerAction: 'play' | 'swap' | 'pass';
  swappedTiles?: string[];
  invalidWords?: string[];
}
