import { Board, PlacedTile, Move, Direction } from './types';
import { BOARD_SIZE, getPremium } from './board';
import { FORBIDDEN_BLANK_LETTERS, SPANISH_TILES } from './tiles';
import { dictionary } from './dictionary';
import { tileLetter, tileValue, cloneBoard, hasInvalidDigraphSequence } from './engine';

// Letters a blank can represent (no K, no W, no digraphs which are multi-letter tiles)
const BLANK_LETTERS = 'ABCDEFGHIJLMNÑOPQRSTUVXYZ'.split('')
  .filter(l => !FORBIDDEN_BLANK_LETTERS.has(l));

// All possible tile letters (including digraphs CH, LL, RR)
const ALL_TILE_LETTERS = Array.from(new Set(SPANISH_TILES.map(t => t.letter)));

interface RackLetter {
  letter: string;
  isBlank: boolean;
  index: number;
}

interface Placement {
  row: number;
  col: number;
  letter: string;
  isBlank: boolean;
  rackIndex: number;
}

function isBoardEmpty(board: Board): boolean {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c]) return false;
    }
  }
  return true;
}

function getAnchors(board: Board): { row: number; col: number }[] {
  if (isBoardEmpty(board)) return [{ row: 7, col: 7 }];

  const anchors: { row: number; col: number }[] = [];
  const seen = new Set<string>();

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!board[r][c]) {
        const neighbors = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
        for (const [nr, nc] of neighbors) {
          if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc]) {
            const key = `${r},${c}`;
            if (!seen.has(key)) {
              seen.add(key);
              anchors.push({ row: r, col: c });
            }
            break;
          }
        }
      }
    }
  }
  return anchors;
}

// Compute the set of letters that form a valid cross-word at (row, col)
// when placing a tile in direction mainDir.
// Returns null if any letter is valid (no cross-word constraint).
function computeCrossCheck(
  board: Board, row: number, col: number, mainDir: Direction
): Set<string> | null {
  const crossDir: Direction = mainDir === 'H' ? 'V' : 'H';
  const dr = crossDir === 'V' ? 1 : 0;
  const dc = crossDir === 'H' ? 1 : 0;

  const beforeR = row - dr, beforeC = col - dc;
  const afterR = row + dr, afterC = col + dc;
  const hasBefore = beforeR >= 0 && beforeC >= 0 && board[beforeR]?.[beforeC];
  const hasAfter = afterR < BOARD_SIZE && afterC < BOARD_SIZE && board[afterR]?.[afterC];

  if (!hasBefore && !hasAfter) return null;

  let prefix = '';
  let r = beforeR, c = beforeC;
  while (r >= 0 && c >= 0 && board[r]?.[c]) {
    prefix = tileLetter(board[r][c]!) + prefix;
    r -= dr; c -= dc;
  }
  let suffix = '';
  r = afterR; c = afterC;
  while (r < BOARD_SIZE && c < BOARD_SIZE && board[r]?.[c]) {
    suffix += tileLetter(board[r][c]!);
    r += dr; c += dc;
  }

  if (prefix.length === 0 && suffix.length === 0) return null;

  const valid = new Set<string>();
  for (const letter of ALL_TILE_LETTERS) {
    const word = prefix + letter + suffix;
    if (dictionary.isValid(word)) {
      valid.add(letter);
    }
  }
  return valid;
}

// Score placements inline without storing all results
function scorePlacement(
  board: Board, placements: Placement[]
): { score: number; wordsFormed: string[] } | null {
  if (placements.length === 0) return null;

  const tempBoard = cloneBoard(board);
  for (const p of placements) {
    tempBoard[p.row][p.col] = {
      letter: p.isBlank ? '?' : p.letter,
      isBlank: p.isBlank,
      blankLetter: p.isBlank ? p.letter : undefined,
    };
  }

  const newSet = new Set(placements.map(p => `${p.row},${p.col}`));
  const rows = new Set(placements.map(p => p.row));
  const direction: Direction = rows.size > 1 ? 'V' : 'H';
  const dr = direction === 'V' ? 1 : 0;
  const dc = direction === 'H' ? 1 : 0;

  const words: { word: string; tiles: { row: number; col: number; tile: PlacedTile; isNew: boolean }[] }[] = [];
  const seenWords = new Set<string>();

  // Main word
  const first = placements[0];
  let sr = first.row, sc = first.col;
  while (sr - dr >= 0 && sc - dc >= 0 && tempBoard[sr - dr][sc - dc]) {
    sr -= dr; sc -= dc;
  }
  let mainWord = '';
  const mainTiles: { row: number; col: number; tile: PlacedTile; isNew: boolean }[] = [];
  let r = sr, c = sc;
  while (r < BOARD_SIZE && c < BOARD_SIZE && tempBoard[r][c]) {
    const tile = tempBoard[r][c]!;
    mainWord += tileLetter(tile);
    mainTiles.push({ row: r, col: c, tile, isNew: newSet.has(`${r},${c}`) });
    r += dr; c += dc;
  }
  if (mainTiles.length >= 2) {
    seenWords.add(mainWord);
    words.push({ word: mainWord, tiles: mainTiles });
  }

  // Cross words
  const crossDr = direction === 'H' ? 1 : 0;
  const crossDc = direction === 'H' ? 0 : 1;
  for (const p of placements) {
    let cr = p.row, cc = p.col;
    while (cr - crossDr >= 0 && cc - crossDc >= 0 && tempBoard[cr - crossDr][cc - crossDc]) {
      cr -= crossDr; cc -= crossDc;
    }
    let crossWord = '';
    const crossTiles: { row: number; col: number; tile: PlacedTile; isNew: boolean }[] = [];
    let tr = cr, tc = cc;
    while (tr < BOARD_SIZE && tc < BOARD_SIZE && tempBoard[tr][tc]) {
      const tile = tempBoard[tr][tc]!;
      crossWord += tileLetter(tile);
      crossTiles.push({ row: tr, col: tc, tile, isNew: newSet.has(`${tr},${tc}`) });
      tr += crossDr; tc += crossDc;
    }
    if (crossTiles.length >= 2 && !seenWords.has(crossWord)) {
      seenWords.add(crossWord);
      words.push({ word: crossWord, tiles: crossTiles });
    }
  }

  if (words.length === 0) return null;

  for (const w of words) {
    if (!dictionary.isValid(w.word)) return null;
    if (hasInvalidDigraphSequence(w.tiles)) return null;
  }

  let totalScore = 0;
  for (const w of words) {
    let wordScore = 0;
    let wordMultiplier = 1;
    for (const t of w.tiles) {
      let letterScore = tileValue(t.tile);
      if (t.isNew) {
        const premium = getPremium(t.row, t.col);
        if (premium === 'DL') letterScore *= 2;
        else if (premium === 'TL') letterScore *= 3;
        else if (premium === 'DW') wordMultiplier *= 2;
        else if (premium === 'TW') wordMultiplier *= 3;
      }
      wordScore += letterScore;
    }
    wordScore *= wordMultiplier;
    totalScore += wordScore;
  }
  if (placements.length === 7) totalScore += 50;
  return { score: totalScore, wordsFormed: words.map(w => w.word) };
}

// DFS with dictionary prefix pruning and cross-check letter sets.
// Tracks the partial word string so branches that can't form a dictionary
// word are pruned early — the key optimization for racks with blanks.
function searchLine(
  board: Board,
  rackLetters: RackLetter[],
  startR: number, startC: number,
  direction: Direction,
  anchorRow: number, anchorCol: number,
  onMove: (move: Move) => void,
  crossCheckCache: Map<string, Set<string> | null>
): void {
  const dr = direction === 'V' ? 1 : 0;
  const dc = direction === 'H' ? 1 : 0;

  // Compute backward prefix from existing tiles before the start position
  let backwardPrefix = '';
  let br = startR - dr, bc = startC - dc;
  while (br >= 0 && bc >= 0 && board[br]?.[bc]) {
    backwardPrefix = tileLetter(board[br][bc]!) + backwardPrefix;
    br -= dr; bc -= dc;
  }

  function getCrossCheck(r: number, c: number): Set<string> | null {
    const key = `${r},${c},${direction}`;
    if (!crossCheckCache.has(key)) {
      crossCheckCache.set(key, computeCrossCheck(board, r, c, direction));
    }
    return crossCheckCache.get(key)!;
  }

  function dfs(
    r: number, c: number,
    usedRack: Set<number>,
    currentPlacements: Placement[],
    partialWord: string,
    hasPlacedNew: boolean,
    hasPassedAnchor: boolean
  ) {
    if (r >= BOARD_SIZE || c >= BOARD_SIZE) {
      if (hasPlacedNew && hasPassedAnchor) {
        tryScore(currentPlacements);
      }
      return;
    }

    if (board[r][c]) {
      const newPartial = partialWord + tileLetter(board[r][c]!);
      if (hasPlacedNew && !dictionary.isPrefix(newPartial) && !dictionary.isValid(newPartial)) {
        return;
      }
      dfs(r + dr, c + dc, usedRack, currentPlacements, newPartial, hasPlacedNew, hasPassedAnchor);
      return;
    }

    // Try stopping here
    if (hasPlacedNew && hasPassedAnchor) {
      tryScore(currentPlacements);
    }

    // Try placing each unused rack tile
    for (let i = 0; i < rackLetters.length; i++) {
      if (usedRack.has(i)) continue;
      const rl = rackLetters[i];
      const passedAnchor = hasPassedAnchor || (r === anchorRow && c === anchorCol);

      if (rl.isBlank) {
        const crossCheck = getCrossCheck(r, c);
        for (const blankLetter of BLANK_LETTERS) {
          if (crossCheck && !crossCheck.has(blankLetter)) continue;
          const newPartial = partialWord + blankLetter;
          if (!dictionary.isPrefix(newPartial) && !dictionary.isValid(newPartial)) continue;
          currentPlacements.push({ row: r, col: c, letter: blankLetter, isBlank: true, rackIndex: i });
          usedRack.add(i);
          dfs(r + dr, c + dc, usedRack, currentPlacements, newPartial, true, passedAnchor);
          usedRack.delete(i);
          currentPlacements.pop();
        }
      } else {
        const crossCheck = getCrossCheck(r, c);
        if (crossCheck && !crossCheck.has(rl.letter)) continue;
        const newPartial = partialWord + rl.letter;
        if (!dictionary.isPrefix(newPartial) && !dictionary.isValid(newPartial)) continue;
        currentPlacements.push({ row: r, col: c, letter: rl.letter, isBlank: false, rackIndex: i });
        usedRack.add(i);
        dfs(r + dr, c + dc, usedRack, currentPlacements, newPartial, true, passedAnchor);
        usedRack.delete(i);
        currentPlacements.pop();
      }
    }
  }

  function tryScore(placements: Placement[]) {
    const result = scorePlacement(board, placements);
    if (result) {
      const firstP = placements[0];
      onMove({
        row: firstP.row, col: firstP.col,
        direction,
        tiles: placements.map(p => ({
          letter: p.isBlank ? '?' : p.letter,
          isBlank: p.isBlank,
          blankLetter: p.isBlank ? p.letter : undefined,
        })),
        word: result.wordsFormed[0] || '',
        score: result.score,
        wordsFormed: result.wordsFormed,
        isBingo: placements.length === 7,
      });
    }
  }

  dfs(startR, startC, new Set(), [], backwardPrefix, false, false);
}

export function findBestMove(
  board: Board,
  rack: { letter: string; isBlank: boolean }[]
): Move | null {
  if (!dictionary.isLoaded()) return null;

  const anchors = getAnchors(board);
  const rackLetters: RackLetter[] = rack.map((t, i) => ({
    letter: t.letter, isBlank: t.isBlank, index: i,
  }));

  const best = { score: -1, move: null as Move | null };
  const onMove = (move: Move) => {
    if (move.score > best.score) {
      best.score = move.score;
      best.move = move;
    }
  };

  const crossCheckCache = new Map<string, Set<string> | null>();

  for (const anchor of anchors) {
    for (const direction of ['H', 'V'] as Direction[]) {
      const dr = direction === 'V' ? 1 : 0;
      const dc = direction === 'H' ? 1 : 0;

      let maxBack = 0;
      let r = anchor.row - dr, c = anchor.col - dc;
      while (r >= 0 && c >= 0 && maxBack < rackLetters.length && !board[r][c]) {
        maxBack++;
        r -= dr; c -= dc;
      }

      for (let back = 0; back <= maxBack; back++) {
        const startR = anchor.row - back * dr;
        const startC = anchor.col - back * dc;
        if (startR < 0 || startC < 0) continue;
        if (board[startR]?.[startC]) continue;

        searchLine(board, rackLetters, startR, startC, direction,
          anchor.row, anchor.col, onMove, crossCheckCache);
      }
    }
  }

  return best.move;
}

export function findTopMoves(
  board: Board,
  rack: { letter: string; isBlank: boolean }[],
  count: number = 20
): Move[] {
  if (!dictionary.isLoaded()) return [];

  const anchors = getAnchors(board);
  const rackLetters: RackLetter[] = rack.map((t, i) => ({
    letter: t.letter, isBlank: t.isBlank, index: i,
  }));

  const allMoves: Move[] = [];
  const seen = new Set<string>();
  const onMove = (move: Move) => {
    const key = `${move.word}|${move.row},${move.col}|${move.direction}|${move.score}`;
    if (!seen.has(key)) {
      seen.add(key);
      allMoves.push(move);
    }
  };

  const crossCheckCache = new Map<string, Set<string> | null>();

  for (const anchor of anchors) {
    for (const direction of ['H', 'V'] as Direction[]) {
      const dr = direction === 'V' ? 1 : 0;
      const dc = direction === 'H' ? 1 : 0;

      let maxBack = 0;
      let r = anchor.row - dr, c = anchor.col - dc;
      while (r >= 0 && c >= 0 && maxBack < rackLetters.length && !board[r][c]) {
        maxBack++;
        r -= dr; c -= dc;
      }

      for (let back = 0; back <= maxBack; back++) {
        const startR = anchor.row - back * dr;
        const startC = anchor.col - back * dc;
        if (startR < 0 || startC < 0) continue;
        if (board[startR]?.[startC]) continue;

        searchLine(board, rackLetters, startR, startC, direction,
          anchor.row, anchor.col, onMove, crossCheckCache);
      }
    }
  }

  allMoves.sort((a, b) => b.score - a.score);
  return allMoves.slice(0, count);
}
