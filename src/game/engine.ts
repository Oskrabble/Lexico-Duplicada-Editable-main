import { Board, Cell, Move, Direction, PlacedTile, RackTile } from './types';
import { BOARD_SIZE, CENTER_ROW, CENTER_COL, getPremium, isCenter } from './board';
import { LETTER_VALUES, FORBIDDEN_BLANK_LETTERS, MULTI_LETTER_TILES } from './tiles';
import { dictionary } from './dictionary';

export function createEmptyBoard(): Board {
  const board: Board = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    board.push(new Array(BOARD_SIZE).fill(null));
  }
  return board;
}

export function cloneBoard(board: Board): Board {
  return board.map(row => row.map(cell => cell ? { ...cell } : null));
}

// Get the effective letter of a placed tile (blank uses blankLetter)
export function tileLetter(tile: PlacedTile): string {
  if (tile.isBlank) return tile.blankLetter || '';
  return tile.letter;
}

// Get the point value of a placed tile
export function tileValue(tile: PlacedTile): number {
  if (tile.isBlank) return 0;
  return LETTER_VALUES[tile.letter] ?? 0;
}

// Find all newly placed tiles on the board (tiles that are pending/placed by current move)
// We track this by comparing with a "committed" board
export function getNewTiles(
  currentBoard: Board,
  committedBoard: Board
): { row: number; col: number; tile: PlacedTile }[] {
  const newTiles: { row: number; col: number; tile: PlacedTile }[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const curr = currentBoard[r][c];
      const comm = committedBoard[r][c];
      if (curr && !comm) {
        newTiles.push({ row: r, col: c, tile: curr });
      }
    }
  }
  return newTiles;
}

// Check if the board is empty (no committed tiles)
export function isBoardEmpty(board: Board): boolean {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c]) return false;
    }
  }
  return true;
}

// Get the full word at a position along a direction, including existing tiles
export function getWordAt(
  board: Board,
  row: number,
  col: number,
  direction: Direction
): { word: string; startRow: number; startCol: number; tiles: { row: number; col: number; tile: PlacedTile }[] } | null {
  const dr = direction === 'V' ? 1 : 0;
  const dc = direction === 'H' ? 1 : 0;

  // Find start of word
  let sr = row, sc = col;
  while (sr - dr >= 0 && sc - dc >= 0 && board[sr - dr][sc - dc]) {
    sr -= dr;
    sc -= dc;
  }

  // Collect word
  let word = '';
  const tiles: { row: number; col: number; tile: PlacedTile }[] = [];
  let r = sr, c = sc;
  while (r < BOARD_SIZE && c < BOARD_SIZE && board[r][c]) {
    const tile = board[r][c]!;
    word += tileLetter(tile);
    tiles.push({ row: r, col: c, tile });
    r += dr;
    c += dc;
  }

  if (tiles.length < 2) return null;
  return { word, startRow: sr, startCol: sc, tiles };
}

// Find all words formed by a move (the new tiles placed)
export function findWordsFormed(
  board: Board,
  newTiles: { row: number; col: number; tile: PlacedTile }[]
): { word: string; tiles: { row: number; col: number; tile: PlacedTile; isNew: boolean }[] }[] {
  if (newTiles.length === 0) return [];

  // Determine main direction
  const rows = new Set(newTiles.map(t => t.row));
  const cols = new Set(newTiles.map(t => t.col));
  // Horizontal: all tiles share the same row (rows.size === 1, cols vary)
  // Vertical:   all tiles share the same col (cols.size === 1, rows vary)
  const isHorizontal = rows.size === 1 && cols.size > 1;
  const isVertical = cols.size === 1 && rows.size > 1;

  const words: { word: string; tiles: { row: number; col: number; tile: PlacedTile; isNew: boolean }[] }[] = [];
  const seenWords = new Set<string>();

  // Check main word (in the direction of the move)
  const directions: Direction[] = [];
  if (isHorizontal) directions.push('H');
  else if (isVertical) directions.push('V');
  else {
    // Single tile - check both
    directions.push('H', 'V');
  }

  for (const dir of directions) {
    // Get the word that contains all new tiles in this direction
    const firstTile = newTiles[0];
    const result = getWordAt(board, firstTile.row, firstTile.col, dir);
    if (result && result.tiles.length >= 2) {
      const key = `${dir}:${result.startRow},${result.startCol}:${result.word}`;
      if (!seenWords.has(key)) {
        seenWords.add(key);
        // Check that at least one new tile is in this word
        const newSet = new Set(newTiles.map(t => `${t.row},${t.col}`));
        const hasNew = result.tiles.some(t => newSet.has(`${t.row},${t.col}`));
        if (hasNew) {
          words.push({
            word: result.word,
            tiles: result.tiles.map(t => ({
              row: t.row,
              col: t.col,
              tile: t.tile,
              isNew: newSet.has(`${t.row},${t.col}`),
            })),
          });
        }
      }
    }
  }

  // Check cross words for each new tile
  for (const nt of newTiles) {
    // Cross words are perpendicular to the main direction
    const dirsToCheck: Direction[] = isHorizontal ? ['V'] : (isVertical ? ['H'] : ['H', 'V']);

    for (const dir of dirsToCheck) {
      const result = getWordAt(board, nt.row, nt.col, dir);
      if (result && result.tiles.length >= 2) {
        const key = `${dir}:${result.startRow},${result.startCol}:${result.word}`;
        if (!seenWords.has(key)) {
          seenWords.add(key);
          const newSet = new Set(newTiles.map(t => `${t.row},${t.col}`));
          const hasNew = result.tiles.some(t => newSet.has(`${t.row},${t.col}`));
          if (hasNew) {
            words.push({
              word: result.word,
              tiles: result.tiles.map(t => ({
                row: t.row,
                col: t.col,
                tile: t.tile,
                isNew: newSet.has(`${t.row},${t.col}`),
              })),
            });
          }
        }
      }
    }
  }

  return words;
}

// Check whether a sequence of placed tiles contains an invalid digraph:
// two consecutive single-letter tiles whose letters combine into CH, LL, or RR.
// A genuine multi-letter tile (CH/LL/RR) is a single PlacedTile and is always valid.
export function hasInvalidDigraphSequence(
  tiles: { tile: PlacedTile }[]
): boolean {
  for (let i = 0; i < tiles.length - 1; i++) {
    const a = tiles[i].tile;
    const b = tiles[i + 1].tile;
    if (MULTI_LETTER_TILES.has(a.letter) || MULTI_LETTER_TILES.has(b.letter)) continue;
    const la = tileLetter(a);
    const lb = tileLetter(b);
    if (la.length === 1 && lb.length === 1) {
      const combo = la + lb;
      if (combo === 'CH' || combo === 'LL' || combo === 'RR') return true;
    }
  }
  return false;
}

// Validate a move: check connectivity, word validity, placement rules
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  wordsFormed: string[];
  move: Move | null;
}

export function validateMove(
  currentBoard: Board,
  committedBoard: Board
): ValidationResult {
  const errors: string[] = [];
  const newTiles = getNewTiles(currentBoard, committedBoard);

  if (newTiles.length === 0) {
    return { valid: false, errors: ['No hay fichas colocadas'], wordsFormed: [], move: null };
  }

  // Check all new tiles are in a single line
  const rows = new Set(newTiles.map(t => t.row));
  const cols = new Set(newTiles.map(t => t.col));

  if (rows.size > 1 && cols.size > 1) {
    return {
      valid: false,
      errors: ['Las fichas deben estar en una sola línea (horizontal o vertical)'],
      wordsFormed: [],
      move: null,
    };
  }

  const direction: Direction = rows.size > 1 ? 'V' : 'H';

  // Check no gaps in the line (all cells between min and max must be filled)
  if (direction === 'H') {
    const row = newTiles[0].row;
    const minCol = Math.min(...newTiles.map(t => t.col));
    const maxCol = Math.max(...newTiles.map(t => t.col));
    for (let c = minCol; c <= maxCol; c++) {
      if (!currentBoard[row][c]) {
        return {
          valid: false,
          errors: ['Hay huecos en la línea de fichas'],
          wordsFormed: [],
          move: null,
        };
      }
    }
  } else {
    const col = newTiles[0].col;
    const minRow = Math.min(...newTiles.map(t => t.row));
    const maxRow = Math.max(...newTiles.map(t => t.row));
    for (let r = minRow; r <= maxRow; r++) {
      if (!currentBoard[r][col]) {
        return {
          valid: false,
          errors: ['Hay huecos en la línea de fichas'],
          wordsFormed: [],
          move: null,
        };
      }
    }
  }

  // Check bounds
  for (const t of newTiles) {
    if (t.row < 0 || t.row >= BOARD_SIZE || t.col < 0 || t.col >= BOARD_SIZE) {
      return { valid: false, errors: ['Fichas fuera del tablero'], wordsFormed: [], move: null };
    }
  }

  // Check no overlap with committed tiles
  for (const t of newTiles) {
    if (committedBoard[t.row][t.col]) {
      return { valid: false, errors: ['No se puede colocar sobre una ficha existente'], wordsFormed: [], move: null };
    }
  }

  // Check blank assignments
  for (const t of newTiles) {
    if (t.tile.isBlank) {
      const bl = t.tile.blankLetter || '';
      if (!bl) {
        errors.push('Comodín sin letra asignada');
      } else if (FORBIDDEN_BLANK_LETTERS.has(bl)) {
        errors.push(`No se puede usar comodín como ${bl}`);
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, wordsFormed: [], move: null };
  }

  // Check first move covers center
  if (isBoardEmpty(committedBoard)) {
    const coversCenter = newTiles.some(t => isCenter(t.row, t.col));
    if (!coversCenter) {
      return {
        valid: false,
        errors: ['La primera jugada debe cubrir la casilla central'],
        wordsFormed: [],
        move: null,
      };
    }
    if (newTiles.length < 2) {
      return {
        valid: false,
        errors: ['La primera jugada debe tener al menos 2 fichas'],
        wordsFormed: [],
        move: null,
      };
    }
  } else {
    // Check connectivity: at least one new tile must be adjacent to an existing tile
    const committedSet = new Set<string>();
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (committedBoard[r][c]) committedSet.add(`${r},${c}`);
      }
    }
    let connected = false;
    for (const t of newTiles) {
      const neighbors = [[t.row - 1, t.col], [t.row + 1, t.col], [t.row, t.col - 1], [t.row, t.col + 1]];
      for (const [nr, nc] of neighbors) {
        if (committedSet.has(`${nr},${nc}`)) {
          connected = true;
          break;
        }
      }
      if (connected) break;
    }
    if (!connected) {
      return {
        valid: false,
        errors: ['La jugada debe conectar con las fichas existentes'],
        wordsFormed: [],
        move: null,
      };
    }
  }

  // Find all words formed
  const wordsFormed = findWordsFormed(currentBoard, newTiles);

  if (wordsFormed.length === 0) {
    return {
      valid: false,
      errors: ['No se forma ninguna palabra'],
      wordsFormed: [],
      move: null,
    };
  }

  // Reject words formed by two consecutive single-letter tiles that spell CH, LL, or RR.
  // Only a genuine multi-letter tile (CH/LL/RR) is valid; C+H, L+L, R+R as separate tiles is illegal.
  const digraphErrors: string[] = [];
  for (const w of wordsFormed) {
    if (hasInvalidDigraphSequence(w.tiles)) {
      digraphErrors.push(w.word);
    }
  }
  if (digraphErrors.length > 0) {
    return {
      valid: false,
      errors: [`Secuencia de fichas no válida (CH/LL/RR deben ser una sola ficha): ${digraphErrors.join(', ')}`],
      wordsFormed: wordsFormed.map(w => w.word),
      move: null,
    };
  }

  // Validate all words in dictionary
  const invalidWords: string[] = [];
  for (const w of wordsFormed) {
    if (!dictionary.isValid(w.word)) {
      invalidWords.push(w.word);
    }
  }

  if (invalidWords.length > 0) {
    return {
      valid: false,
      errors: [`Palabra(s) no válida(s): ${invalidWords.join(', ')}`],
      wordsFormed: wordsFormed.map(w => w.word),
      move: null,
    };
  }

  // Calculate score
  const score = calculateScore(wordsFormed, newTiles.length);
  const mainWord = wordsFormed[0].word;

  // Determine the move's starting position
  let moveRow = newTiles[0].row;
  let moveCol = newTiles[0].col;
  if (direction === 'H') {
    moveRow = newTiles[0].row;
    moveCol = Math.min(...newTiles.map(t => t.col));
  } else {
    moveCol = newTiles[0].col;
    moveRow = Math.min(...newTiles.map(t => t.row));
  }

  const move: Move = {
    row: moveRow,
    col: moveCol,
    direction,
    tiles: newTiles.map(t => ({
      letter: t.tile.letter,
      isBlank: t.tile.isBlank,
      blankLetter: t.tile.blankLetter,
    })),
    word: mainWord,
    score,
    wordsFormed: wordsFormed.map(w => w.word),
    isBingo: newTiles.length === 7,
  };

  return {
    valid: true,
    errors: [],
    wordsFormed: wordsFormed.map(w => w.word),
    move,
  };
}

// Calculate score for a move
export function calculateScore(
  wordsFormed: { word: string; tiles: { row: number; col: number; tile: PlacedTile; isNew: boolean }[] }[],
  newTileCount: number
): number {
  let totalScore = 0;

  for (const wf of wordsFormed) {
    let wordScore = 0;
    let wordMultiplier = 1;

    for (const t of wf.tiles) {
      const baseValue = tileValue(t.tile);
      let letterScore = baseValue;

      // Premium squares only apply to newly placed tiles
      if (t.isNew) {
        const premium = getPremium(t.row, t.col);
        if (premium === 'DL') letterScore = baseValue * 2;
        else if (premium === 'TL') letterScore = baseValue * 3;
        else if (premium === 'DW') wordMultiplier *= 2;
        else if (premium === 'TW') wordMultiplier *= 3;
      }

      wordScore += letterScore;
    }

    wordScore *= wordMultiplier;
    totalScore += wordScore;
  }

  // Bingo bonus: 50 points for using all 7 tiles
  if (newTileCount === 7) {
    totalScore += 50;
  }

  return totalScore;
}

// Apply a move to the committed board
export function applyMoveToBoard(
  committedBoard: Board,
  move: Move
): Board {
  const board = cloneBoard(committedBoard);
  const dr = move.direction === 'V' ? 1 : 0;
  const dc = move.direction === 'H' ? 1 : 0;

  let r = move.row, c = move.col;
  for (const tile of move.tiles) {
    // Skip over existing tiles
    while (r < BOARD_SIZE && c < BOARD_SIZE && board[r][c]) {
      r += dr;
      c += dc;
    }
    board[r][c] = {
      letter: tile.letter,
      isBlank: tile.isBlank,
      blankLetter: tile.blankLetter,
    };
    r += dr;
    c += dc;
  }

  return board;
}

// Preview the score of a pending move without dictionary validation.
// Returns the score and the position of the last pending tile in the word direction.
export function previewScore(
  currentBoard: Board,
  committedBoard: Board
): { score: number; lastTileRow: number; lastTileCol: number } | null {
  const newTiles = getNewTiles(currentBoard, committedBoard);
  if (newTiles.length === 0) return null;

  const rows = new Set(newTiles.map(t => t.row));
  const cols = new Set(newTiles.map(t => t.col));
  if (rows.size > 1 && cols.size > 1) return null;

  const direction: Direction = rows.size > 1 ? 'V' : 'H';

  if (direction === 'H') {
    const row = newTiles[0].row;
    const minCol = Math.min(...newTiles.map(t => t.col));
    const maxCol = Math.max(...newTiles.map(t => t.col));
    for (let c = minCol; c <= maxCol; c++) {
      if (!currentBoard[row][c]) return null;
    }
  } else {
    const col = newTiles[0].col;
    const minRow = Math.min(...newTiles.map(t => t.row));
    const maxRow = Math.max(...newTiles.map(t => t.row));
    for (let r = minRow; r <= maxRow; r++) {
      if (!currentBoard[r][col]) return null;
    }
  }

  for (const t of newTiles) {
    if (t.tile.isBlank && !t.tile.blankLetter) return null;
  }

  if (isBoardEmpty(committedBoard)) {
    if (!newTiles.some(t => isCenter(t.row, t.col)) || newTiles.length < 2) return null;
  } else {
    const committedSet = new Set<string>();
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (committedBoard[r][c]) committedSet.add(`${r},${c}`);
      }
    }
    let connected = false;
    for (const t of newTiles) {
      const neighbors = [[t.row - 1, t.col], [t.row + 1, t.col], [t.row, t.col - 1], [t.row, t.col + 1]];
      for (const [nr, nc] of neighbors) {
        if (committedSet.has(`${nr},${nc}`)) { connected = true; break; }
      }
      if (connected) break;
    }
    if (!connected) return null;
  }

  const wordsFormed = findWordsFormed(currentBoard, newTiles);
  if (wordsFormed.length === 0) return null;

  for (const w of wordsFormed) {
    if (hasInvalidDigraphSequence(w.tiles)) return null;
  }

  const score = calculateScore(wordsFormed, newTiles.length);

  let lastTileRow: number;
  let lastTileCol: number;
  if (direction === 'H') {
    const last = newTiles.reduce((max, t) => t.col > max.col ? t : max);
    lastTileRow = last.row;
    lastTileCol = last.col;
  } else {
    const last = newTiles.reduce((max, t) => t.row > max.row ? t : max);
    lastTileRow = last.row;
    lastTileCol = last.col;
  }

  return { score, lastTileRow, lastTileCol, direction };
}

// Draw tiles from bag to fill rack
export function drawTiles(bag: string[], count: number): { drawn: string[]; remaining: string[] } {
  const drawn = bag.slice(0, count);
  const remaining = bag.slice(count);
  return { drawn, remaining };
}

// Convert drawn letters to rack tiles
export function lettersToRackTiles(letters: string[]): RackTile[] {
  return letters.map((letter, i) => ({
    id: `tile-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
    letter,
    isBlank: letter === '?',
    used: false,
  }));
}
