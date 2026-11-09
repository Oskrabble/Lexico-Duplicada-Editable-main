import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { isDesktop } from '@/utils/platform';
import { GameBoard } from '@/components/GameBoard';
import { Rack } from '@/components/Rack';
import { ScorePanel } from '@/components/ScorePanel';
import { DictionaryLoader } from '@/components/DictionaryLoader';
import { BlankPicker } from '@/components/BlankPicker';
import { RevealPanel } from '@/components/RevealPanel';
import { TopMovesPanel } from '@/components/TopMovesPanel';
import { dictionary } from '@/game/dictionary';
import {
  createEmptyBoard,
  cloneBoard,
  validateMove,
  applyMoveToBoard,
  getNewTiles,
  tileLetter,
  previewScore,
} from '@/game/engine';
import { findBestMove, findTopMoves } from '@/game/solver';
import { buildTileBag, shuffle, LETTER_VALUES, drawRackWithRule, refillRackWithRule, rackMeetsVowelConsonantRule, canEverSatisfyRule, MULTI_LETTER_TILES } from '@/game/tiles';
import { Board, Cell, PlacedTile, RackTile, Move, RoundResult } from '@/game/types';
import { Play, RotateCcw, ArrowRightLeft, Flag, Trophy, Eye, Crown, Clock, Infinity as InfinityIcon, Calculator, ShieldCheck, ShieldOff, ArrowLeft } from 'lucide-react';
import { useTileDrag } from '@/hooks/useTileDrag';

const RACK_SIZE = 7;

export default function App() {
  const [dictLoaded, setDictLoaded] = useState(false);
  const [gameMode, setGameMode] = useState<'timed' | 'untimed' | null>(null);
  const [validationMode, setValidationMode] = useState<boolean | null>(null);
  const [timeLeft, setTimeLeft] = useState(180);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [committedBoard, setCommittedBoard] = useState<Board>(createEmptyBoard);
  const [pendingBoard, setPendingBoard] = useState<Board>(createEmptyBoard);
  const [rack, setRack] = useState<RackTile[]>([]);
  const [bag, setBag] = useState<string[]>([]);
  const [selectedRackTile, setSelectedRackTile] = useState<number | null>(null);
  const [blankPickerOpen, setBlankPickerOpen] = useState(false);
  const [blankPickerCallback, setBlankPickerCallback] = useState<(letter: string) => void>(() => () => {});
  const [rounds, setRounds] = useState<RoundResult[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [bestPossibleScore, setBestPossibleScore] = useState(0);
  const [revealData, setRevealData] = useState<{
    playerMove: Move | null;
    bestMove: Move | null;
    playerAction: 'play' | 'swap' | 'pass';
    invalidWords?: string[];
  } | null>(null);
  const [bestMoveOverlay, setBestMoveOverlay] = useState<Map<string, PlacedTile> | null>(null);
  const [showBestMovePreview, setShowBestMovePreview] = useState(false);
  const [topMoves, setTopMoves] = useState<Move[]>([]);
  const [topMovesOpen, setTopMovesOpen] = useState(false);
  const [topMovesSelected, setTopMovesSelected] = useState<number | null>(null);
  const [showPassConfirm, setShowPassConfirm] = useState(false);
  const [showScorePreview, setShowScorePreview] = useState(false);
  const [showTopConfirm, setShowTopConfirm] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(true);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [topMoveOverlay, setTopMoveOverlay] = useState<Map<string, PlacedTile> | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [error, setError] = useState('');
  const [lastMoveCells, setLastMoveCells] = useState<Set<string>>(new Set());
  const [typingMode, setTypingMode] = useState<{ row: number; col: number; direction: 'H' | 'V' } | null>(null);
  const lastPlacementRef = useRef<{ key: string; row: number; col: number; rackId: string | null; time: number } | null>(null);
  const continueAfterRevealRef = useRef<() => void>(() => {});
  const lastClickRef = useRef<{ row: number; col: number; time: number } | null>(null);

  const TURN_SECONDS = 180;

  // Start (or restart) the per-turn timer, resetting to full time.
  // Accepts an optional mode override so it works when called from the
  // mode-select buttons before the gameMode state has updated.
  const startTimer = useCallback((modeOverride?: 'timed' | 'untimed' | null) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const effectiveMode = modeOverride !== undefined ? modeOverride : gameMode;
    if (effectiveMode !== 'timed') return;
    setTimeLeft(TURN_SECONDS);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [gameMode]);

  // Resume the timer without resetting (used after an invalid play)
  const resumeTimer = useCallback((modeOverride?: 'timed' | 'untimed' | null) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const effectiveMode = modeOverride !== undefined ? modeOverride : gameMode;
    if (effectiveMode !== 'timed') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [gameMode]);

  // Stop the timer
  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const tilesLeft = bag.length;
  const currentRound = rounds.length + 1;

  // Start a new game. Accepts an optional mode override so the timer
  // starts immediately when selecting a mode (before gameMode state updates).
  const startNewGame = useCallback((modeOverride?: 'timed' | 'untimed' | null) => {
    stopTimer();
    const effectiveMode = modeOverride !== undefined ? modeOverride : gameMode;
    const newBag = shuffle(buildTileBag());
    const { rackLetters: initialRack, remaining: remainingBag } = drawRackWithRule(newBag, RACK_SIZE);

    setBag(remainingBag);
    setRack(initialRack.map((letter, i) => ({
      id: `tile-0-${i}`,
      letter,
      isBlank: letter === '?',
      used: false,
    })));
    setCommittedBoard(createEmptyBoard());
    setPendingBoard(createEmptyBoard());
    setRounds([]);
    setTotalScore(0);
    setBestPossibleScore(0);
    setBestMoveOverlay(null);
    setTopMoveOverlay(null);
    setTopMoves([]);
    setTopMovesOpen(false);
    setTopMovesSelected(null);
    setShowTopConfirm(false);
    setShowBestMovePreview(false);
    setGameOver(false);
    setShowGameOverModal(true);
    setError('');
    setLastMoveCells(new Set());
    setTypingMode(null);
    lastPlacementRef.current = null;
    startTimer(effectiveMode);
  }, [startTimer, stopTimer, gameMode]);

  // Auto-start game when dictionary loads
  const handleDictLoaded = useCallback(() => {
    setDictLoaded(true);
    startNewGame();
  }, [startNewGame]);

  // Get pending tiles (placed but not committed)
  const pendingTiles = useMemo(() => {
    const map = new Map<string, PlacedTile>();
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        if (pendingBoard[r][c] && !committedBoard[r][c]) {
          map.set(`${r},${c}`, pendingBoard[r][c]!);
        }
      }
    }
    return map;
  }, [pendingBoard, committedBoard]);

  // Place a tile on the board (click-to-select then click-to-place)
  // Also handles typing mode activation (double-click) and cycling (H -> V -> off)
  const placeTileOnBoard = useCallback((row: number, col: number) => {
    const now = Date.now();
    const lastClick = lastClickRef.current;
    let isDoubleClick = !!(lastClick && lastClick.row === row && lastClick.col === col && now - lastClick.time < 300);
    lastClickRef.current = { row, col, time: now };

    // If double-click but typing mode is already on this cell, treat as single click
    if (isDoubleClick && typingMode && typingMode.row === row && typingMode.col === col) {
      isDoubleClick = false;
    }

    // Double-click on empty cell: activate typing mode H
    if (isDoubleClick && !committedBoard[row][col] && !revealData && !gameOver) {
      setTypingMode({ row, col, direction: 'H' });
      lastPlacementRef.current = null;
      return;
    }

    // Single click on typing mode cell: cycle H -> V -> off
    if (typingMode && typingMode.row === row && typingMode.col === col) {
      if (typingMode.direction === 'H') {
        setTypingMode({ row, col, direction: 'V' });
      } else {
        setTypingMode(null);
        lastPlacementRef.current = null;
      }
      return;
    }

    if (committedBoard[row][col]) return; // can't place on committed tile
    if (selectedRackTile === null) {
      // If there's a pending tile here, remove it back to rack
      if (pendingBoard[row][col] && !committedBoard[row][col]) {
        const tile = pendingBoard[row][col]!;
        setPendingBoard(prev => {
          const next = cloneBoard(prev);
          next[row][col] = null;
          return next;
        });
        setRack(prev => prev.map(t =>
          t.id === tile.rackId ? { ...t, used: false } : t
        ));
      }
      return;
    }

    const rackTile = rack[selectedRackTile];
    if (!rackTile || rackTile.used) return;

    // If there's already a pending tile here, return it to rack first
    if (pendingBoard[row][col] && !committedBoard[row][col]) {
      const existing = pendingBoard[row][col]!;
      setRack(prev => prev.map(t =>
        t.id === existing.rackId ? { ...t, used: false } : t
      ));
    }

    // If the tile is a blank, open the picker
    if (rackTile.isBlank) {
      setBlankPickerOpen(true);
      setBlankPickerCallback(() => (letter: string) => {
        setBlankPickerOpen(false);
        setPendingBoard(prev => {
          const next = cloneBoard(prev);
          next[row][col] = {
            letter: '?',
            isBlank: true,
            blankLetter: letter,
            rackId: rackTile.id,
          };
          return next;
        });
        setRack(prev => prev.map(t =>
          t.id === rackTile.id ? { ...t, used: true } : t
        ));
        setSelectedRackTile(null);
      });
      return;
    }

    // Regular tile
    setPendingBoard(prev => {
      const next = cloneBoard(prev);
      next[row][col] = {
        letter: rackTile.letter,
        isBlank: false,
        rackId: rackTile.id,
      };
      return next;
    });
    setRack(prev => prev.map(t =>
      t.id === rackTile.id ? { ...t, used: true } : t
    ));
    setSelectedRackTile(null);
  }, [committedBoard, pendingBoard, rack, selectedRackTile, typingMode, revealData, gameOver]);

  // Place a tile on the board via drag-and-drop
  const dropTileOnBoard = useCallback((row: number, col: number, rackIndex: number) => {
    if (committedBoard[row][col]) return;
    const rackTile = rack[rackIndex];
    if (!rackTile || rackTile.used) return;

    // If there's already a pending tile here, return it to rack first
    if (pendingBoard[row][col] && !committedBoard[row][col]) {
      const existing = pendingBoard[row][col]!;
      if (existing.rackId === rackTile.id) return; // dropping on itself
      setRack(prev => prev.map(t =>
        t.id === existing.rackId ? { ...t, used: false } : t
      ));
    }

    // If the tile is a blank, open the picker
    if (rackTile.isBlank) {
      setBlankPickerOpen(true);
      setBlankPickerCallback(() => (letter: string) => {
        setBlankPickerOpen(false);
        setPendingBoard(prev => {
          const next = cloneBoard(prev);
          next[row][col] = {
            letter: '?',
            isBlank: true,
            blankLetter: letter,
            rackId: rackTile.id,
          };
          return next;
        });
        setRack(prev => prev.map(t =>
          t.id === rackTile.id ? { ...t, used: true } : t
        ));
      });
      return;
    }

    // Regular tile
    setPendingBoard(prev => {
      const next = cloneBoard(prev);
      next[row][col] = {
        letter: rackTile.letter,
        isBlank: false,
        rackId: rackTile.id,
      };
      return next;
    });
    setRack(prev => prev.map(t =>
      t.id === rackTile.id ? { ...t, used: true } : t
    ));
  }, [committedBoard, pendingBoard, rack]);

  // Move a pending tile from one board cell to another via drag-and-drop
  const moveBoardTile = useCallback((fromRow: number, fromCol: number, toRow: number, toCol: number) => {
    if (committedBoard[toRow][toCol]) return; // can't drop on committed tile
    if (fromRow === toRow && fromCol === toCol) return;

    const sourceTile = pendingBoard[fromRow]?.[fromCol];
    if (!sourceTile || committedBoard[fromRow][fromCol]) return;

    // If target has a pending tile, swap them
    const targetTile = pendingBoard[toRow]?.[toCol];
    setPendingBoard(prev => {
      const next = cloneBoard(prev);
      if (targetTile && !committedBoard[toRow][toCol]) {
        next[fromRow][fromCol] = targetTile;
        next[toRow][toCol] = sourceTile;
      } else {
        next[fromRow][fromCol] = null;
        next[toRow][toCol] = sourceTile;
      }
      return next;
    });
  }, [committedBoard, pendingBoard]);

  // Return a pending board tile back to the rack via drag-and-drop
  const returnBoardTileToRack = useCallback((row: number, col: number) => {
    const tile = pendingBoard[row]?.[col];
    if (!tile || committedBoard[row][col]) return;
    if (tile.rackId === undefined) return;

    setPendingBoard(prev => {
      const next = cloneBoard(prev);
      next[row][col] = null;
      return next;
    });
    setRack(prev => prev.map(t =>
      t.id === tile.rackId ? { ...t, used: false } : t
    ));
  }, [pendingBoard, committedBoard]);

  // Reorder rack tiles via drag-and-drop
  const reorderRack = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setRack(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const { dragState, dropTarget, startDrag, consumeDragEnded } = useTileDrag({
    onDropRackToBoard: dropTileOnBoard,
    onDropBoardToBoard: moveBoardTile,
    onDropBoardToRack: returnBoardTileToRack,
    onDropRackToRack: reorderRack,
  });

  const handleRackDragStart = useCallback((e: React.PointerEvent, index: number, tile: RackTile) => {
    startDrag(e, { type: 'rack', rackIndex: index, letter: tile.letter, isBlank: tile.isBlank, blankLetter: tile.blankLetter });
  }, [startDrag]);

  const handleBoardDragStart = useCallback((e: React.PointerEvent, row: number, col: number, tile: PlacedTile) => {
    startDrag(e, { type: 'board', row, col, letter: tile.letter, isBlank: tile.isBlank, blankLetter: tile.blankLetter });
  }, [startDrag]);

  // Clear pending tiles back to rack
  const clearPending = useCallback(() => {
    const newPending = cloneBoard(committedBoard);
    const rackIdsToRestore = new Set<string>();

    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        if (pendingBoard[r][c] && !committedBoard[r][c]) {
          const tile = pendingBoard[r][c]!;
          if (tile.rackId !== undefined) {
            rackIdsToRestore.add(tile.rackId);
          }
        }
      }
    }

    setPendingBoard(newPending);
    setRack(prev => prev.map(t =>
      rackIdsToRestore.has(t.id) ? { ...t, used: false } : t
    ));
    setSelectedRackTile(null);
    setTypingMode(null);
    lastPlacementRef.current = null;
  }, [committedBoard, pendingBoard]);

  // Auto-pass when timer hits 0
  useEffect(() => {
    if (gameMode === 'timed' && timeLeft === 0 && !revealData && !gameOver && !showPassConfirm) {
      clearPending();
      const rackForSolver = rack.map(t => ({ letter: t.letter, isBlank: t.isBlank }));
      const bestMove = findBestMove(committedBoard, rackForSolver);
      const bestScore = bestMove?.score ?? 0;
      setBestPossibleScore(prev => prev + bestScore);
      setRevealData({ playerMove: null, bestMove, playerAction: 'pass' });
      if (bestMove) {
        const overlay = new Map<string, PlacedTile>();
        let r = bestMove.row, c = bestMove.col;
        const dr = bestMove.direction === 'V' ? 1 : 0;
        const dc = bestMove.direction === 'H' ? 1 : 0;
        for (const tile of bestMove.tiles) {
          while (committedBoard[r][c]) { r += dr; c += dc; }
          overlay.set(`${r},${c}`, { letter: tile.letter, isBlank: tile.isBlank, blankLetter: tile.blankLetter });
          r += dr; c += dc;
        }
        setBestMoveOverlay(overlay);
      }
      setError('Tiempo agotado. Turno pasado automáticamente.');
    }
  }, [timeLeft, gameMode, revealData, gameOver, showPassConfirm, rack, committedBoard, clearPending]);

  // Shuffle rack
  const shuffleRack = useCallback(() => {
    setRack(prev => shuffle(prev));
  }, []);

  // Play the current move
  const playMove = useCallback(() => {
    stopTimer();
    setError('');
    const result = validateMove(pendingBoard, committedBoard);
    if (!result.valid) {
      // When validation is off, accept moves that only fail dictionary checks
      const dictOnlyErrors = result.errors.some(e => e.startsWith('Palabra(s) no'));
      if (validationMode || !dictOnlyErrors || !result.wordsFormed.length) {
        setError(result.errors.join('. '));
        resumeTimer();
        return;
      }
    }

    const playerMove = result.move!;
    const invalidWords = result.valid ? [] : result.wordsFormed.filter(w => !dictionary.isValid(w));

    // Find best move (using the rack BEFORE the player's move)
    const rackForSolver = rack.map(t => ({
      letter: t.letter,
      isBlank: t.isBlank,
    }));

    const bestMove = findBestMove(committedBoard, rackForSolver);

    // Calculate scores: invalid words score 0
    const playerScore = result.valid ? playerMove.score : 0;
    const bestScore = bestMove?.score ?? 0;

    // Update totals
    setTotalScore(prev => prev + playerScore);
    setBestPossibleScore(prev => prev + bestScore);

    // Show reveal
    setRevealData({
      playerMove,
      bestMove,
      playerAction: result.valid ? 'play' : 'pass',
      invalidWords: result.valid ? undefined : invalidWords,
    });

    // Show best move overlay on board
    if (bestMove) {
      const overlay = new Map<string, PlacedTile>();
      let r = bestMove.row, c = bestMove.col;
      const dr = bestMove.direction === 'V' ? 1 : 0;
      const dc = bestMove.direction === 'H' ? 1 : 0;
      for (const tile of bestMove.tiles) {
        while (committedBoard[r][c]) {
          r += dr; c += dc;
        }
        overlay.set(`${r},${c}`, {
          letter: tile.letter,
          isBlank: tile.isBlank,
          blankLetter: tile.blankLetter,
        });
        r += dr; c += dc;
      }
      setBestMoveOverlay(overlay);
    }
  }, [pendingBoard, committedBoard, rack, resumeTimer, stopTimer, validationMode]);

  // Place a tile from the rack onto the board by matching a letter.
  // Used by the keyboard typing mode. Returns the rack tile ID if placed, null otherwise.
  const placeTileByLetter = useCallback((row: number, col: number, letter: string): string | null => {
    if (committedBoard[row][col]) return null;
    if (pendingBoard[row][col] && !committedBoard[row][col]) return null;

    const rackIdx = rack.findIndex(t => !t.used && !t.isBlank && t.letter === letter);
    if (rackIdx !== -1) {
      const rackTile = rack[rackIdx];
      setPendingBoard(prev => {
        const next = cloneBoard(prev);
        next[row][col] = { letter: rackTile.letter, isBlank: false, rackId: rackTile.id };
        return next;
      });
      setRack(prev => prev.map(t => t.id === rackTile.id ? { ...t, used: true } : t));
      return rackTile.id;
    }

    const blankIdx = rack.findIndex(t => !t.used && t.isBlank);
    if (blankIdx !== -1) {
      const blankTile = rack[blankIdx];
      setBlankPickerOpen(true);
      setBlankPickerCallback(() => (chosenLetter: string) => {
        setBlankPickerOpen(false);
        setPendingBoard(prev => {
          const next = cloneBoard(prev);
          next[row][col] = { letter: '?', isBlank: true, blankLetter: chosenLetter, rackId: blankTile.id };
          return next;
        });
        setRack(prev => prev.map(t => t.id === blankTile.id ? { ...t, used: true } : t));
      });
      return blankTile.id;
    }

    return null;
  }, [committedBoard, pendingBoard, rack]);

  // Find the next free cell in typing direction, skipping occupied cells
  const nextFreeCell = useCallback((row: number, col: number, direction: 'H' | 'V'): { row: number; col: number } | null => {
    const dr = direction === 'V' ? 1 : 0;
    const dc = direction === 'H' ? 1 : 0;
    let r = row + dr;
    let c = col + dc;
    while (r < 15 && c < 15) {
      if (!committedBoard[r][c] && !(pendingBoard[r][c] && !committedBoard[r][c])) {
        return { row: r, col: c };
      }
      r += dr;
      c += dc;
    }
    return null;
  }, [committedBoard, pendingBoard]);

  // Keyboard listener for typing mode (desktop only)
  useEffect(() => {
    if (!isDesktop()) return;
    if (!typingMode) {
      lastPlacementRef.current = null;
      return;
    }
    if (revealData || gameOver) {
      setTypingMode(null);
      lastPlacementRef.current = null;
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (pendingTiles.size > 0) {
          setTypingMode(null);
          lastPlacementRef.current = null;
          playMove();
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setTypingMode(null);
        lastPlacementRef.current = null;
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        lastPlacementRef.current = null;
        const mode = typingMode;
        const dr = mode.direction === 'V' ? 1 : 0;
        const dc = mode.direction === 'H' ? 1 : 0;
        let targetR = -1, targetC = -1;
        let r = mode.row, c = mode.col;
        while (r >= 0 && c >= 0) {
          const tile = pendingBoard[r][c];
          if (tile && !committedBoard[r][c] && tile.rackId !== undefined) {
            targetR = r;
            targetC = c;
            break;
          }
          r -= dr;
          c -= dc;
        }
        if (targetR >= 0) {
          const tile = pendingBoard[targetR][targetC]!;
          setPendingBoard(prev => {
            const next = cloneBoard(prev);
            next[targetR][targetC] = null;
            return next;
          });
          setRack(prev => prev.map(t => t.id === tile.rackId ? { ...t, used: false } : t));
          setTypingMode({ row: targetR, col: targetC, direction: mode.direction });
        } else {
          setTypingMode(null);
        }
        return;
      }
      const key = e.key.toUpperCase();
      if (key.length === 1 && ((key >= 'A' && key <= 'Z') || key === 'Ñ')) {
        e.preventDefault();
        if (blankPickerOpen) return;
        const mode = typingMode;
        if (committedBoard[mode.row][mode.col] || (pendingBoard[mode.row][mode.col] && !committedBoard[mode.row][mode.col])) {
          return;
        }

        // Check if this key + last placement key form a digraph (RR, LL, CH)
        const lastPlacement = lastPlacementRef.current;
        if (lastPlacement && Date.now() - lastPlacement.time < 500) {
          const potentialDigraph = lastPlacement.key + key;
          if (MULTI_LETTER_TILES.has(potentialDigraph)) {
            // Check if the digraph tile is available in the rack
            const digraphIdx = rack.findIndex(t => !t.used && !t.isBlank && t.letter === potentialDigraph);
            if (digraphIdx !== -1) {
              // Undo last placement if a tile was placed
              if (lastPlacement.rackId) {
                setPendingBoard(prev => {
                  const next = cloneBoard(prev);
                  next[lastPlacement.row][lastPlacement.col] = null;
                  return next;
                });
                setRack(prev => prev.map(t => t.id === lastPlacement.rackId ? { ...t, used: false } : t));
              }
              // Place the digraph tile at the last placement position
              const digraphTile = rack[digraphIdx];
              setPendingBoard(prev => {
                const next = cloneBoard(prev);
                next[lastPlacement.row][lastPlacement.col] = { letter: digraphTile.letter, isBlank: false, rackId: digraphTile.id };
                return next;
              });
              setRack(prev => prev.map(t => t.id === digraphTile.id ? { ...t, used: true } : t));
              // Advance from the last placement position
              const next = nextFreeCell(lastPlacement.row, lastPlacement.col, mode.direction);
              if (next) {
                setTypingMode({ ...next, direction: mode.direction });
              } else {
                setTypingMode({ row: lastPlacement.row, col: lastPlacement.col, direction: mode.direction });
              }
              lastPlacementRef.current = {
                key: potentialDigraph,
                row: lastPlacement.row,
                col: lastPlacement.col,
                rackId: digraphTile.id,
                time: Date.now(),
              };
              return;
            }
          }
        }

        // Normal placement
        const placedId = placeTileByLetter(mode.row, mode.col, key);
        if (placedId) {
          const next = nextFreeCell(mode.row, mode.col, mode.direction);
          if (next) {
            setTypingMode({ ...next, direction: mode.direction });
          } else {
            setTypingMode({ row: mode.row, col: mode.col, direction: mode.direction });
          }
          // Track placement for potential digraph upgrade (only regular tiles, not blanks)
          const usedTile = rack.find(t => t.id === placedId);
          if (usedTile && !usedTile.isBlank) {
            lastPlacementRef.current = { key, row: mode.row, col: mode.col, rackId: placedId, time: Date.now() };
          } else {
            lastPlacementRef.current = null;
          }
        } else {
          // Tile not placed, but track the key for potential digraph
          lastPlacementRef.current = { key, row: mode.row, col: mode.col, rackId: null, time: Date.now() };
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [typingMode, revealData, gameOver, pendingBoard, committedBoard, pendingTiles, playMove, placeTileByLetter, nextFreeCell, rack, blankPickerOpen]);

  // Enter key continues after reveal modal (desktop only)
  useEffect(() => {
    if (!isDesktop()) return;
    if (!revealData) return;
    const handleRevealKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        continueAfterRevealRef.current();
      }
    };
    window.addEventListener('keydown', handleRevealKey);
    return () => window.removeEventListener('keydown', handleRevealKey);
  }, [revealData]);

  // Swap tiles
  const swapTiles = useCallback(() => {
    stopTimer();
    setError('');
    // Get the pending tiles as the ones to swap
    const tilesToSwap: string[] = [];
    const rackIdsToSwap = new Set<string>();

    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        if (pendingBoard[r][c] && !committedBoard[r][c]) {
          const tile = pendingBoard[r][c]!;
          if (tile.rackId !== undefined) {
            rackIdsToSwap.add(tile.rackId);
            tilesToSwap.push(tile.isBlank ? '?' : tile.letter);
          }
        }
      }
    }

    if (tilesToSwap.length === 0) {
      setError('Coloca en el tablero las fichas que quieres cambiar');
      return;
    }

    if (tilesToSwap.length > bag.length) {
      setError(`No hay suficientes fichas en la bolsa (quedan ${bag.length})`);
      return;
    }

    // Find best move with current rack (before swap)
    const rackForSolver = rack.map(t => ({
      letter: t.letter,
      isBlank: t.isBlank,
    }));
    const bestMove = findBestMove(committedBoard, rackForSolver);
    const bestScore = bestMove?.score ?? 0;

    // Update totals
    setBestPossibleScore(prev => prev + bestScore);

    // Show reveal
    setRevealData({
      playerMove: null,
      bestMove,
      playerAction: 'swap',
    });

    if (bestMove) {
      const overlay = new Map<string, PlacedTile>();
      let r = bestMove.row, c = bestMove.col;
      const dr = bestMove.direction === 'V' ? 1 : 0;
      const dc = bestMove.direction === 'H' ? 1 : 0;
      for (const tile of bestMove.tiles) {
        while (committedBoard[r][c]) {
          r += dr; c += dc;
        }
        overlay.set(`${r},${c}`, {
          letter: tile.letter,
          isBlank: tile.isBlank,
          blankLetter: tile.blankLetter,
        });
        r += dr; c += dc;
      }
      setBestMoveOverlay(overlay);
    }
  }, [pendingBoard, committedBoard, rack, bag, stopTimer]);

  // Pass turn (with confirmation)
  const passTurn = useCallback(() => {
    setShowPassConfirm(true);
  }, []);

  const confirmPassTurn = useCallback(() => {
    setShowPassConfirm(false);
    stopTimer();
    setError('');
    clearPending();

    const rackForSolver = rack.map(t => ({
      letter: t.letter,
      isBlank: t.isBlank,
    }));
    const bestMove = findBestMove(committedBoard, rackForSolver);
    const bestScore = bestMove?.score ?? 0;

    setBestPossibleScore(prev => prev + bestScore);

    setRevealData({
      playerMove: null,
      bestMove,
      playerAction: 'pass',
    });

    if (bestMove) {
      const overlay = new Map<string, PlacedTile>();
      let r = bestMove.row, c = bestMove.col;
      const dr = bestMove.direction === 'V' ? 1 : 0;
      const dc = bestMove.direction === 'H' ? 1 : 0;
      for (const tile of bestMove.tiles) {
        while (committedBoard[r][c]) {
          r += dr; c += dc;
        }
        overlay.set(`${r},${c}`, {
          letter: tile.letter,
          isBlank: tile.isBlank,
          blankLetter: tile.blankLetter,
        });
        r += dr; c += dc;
      }
      setBestMoveOverlay(overlay);
    }
  }, [committedBoard, rack, clearPending, stopTimer]);

  // Open Top 20 moves panel (with confirmation)
  // If a top move is already being viewed, pressing Top clears the overlay and reopens the list.
  const openTopMoves = useCallback(() => {
    if (topMoveOverlay) {
      setTopMoveOverlay(null);
      setTopMovesSelected(null);
      setTopMovesOpen(true);
      return;
    }
    setShowTopConfirm(true);
  }, [topMoveOverlay]);

  const confirmOpenTopMoves = useCallback(() => {
    setShowTopConfirm(false);
    const rackForSolver = rack.map(t => ({
      letter: t.letter,
      isBlank: t.isBlank,
    }));
    const moves = findTopMoves(committedBoard, rackForSolver, 20);
    setTopMoves(moves);
    setTopMovesSelected(null);
    setTopMoveOverlay(null);
    setTopMovesOpen(true);
  }, [rack, committedBoard]);

  // Select a move from the Top panel — show it on the board and close the panel
  const selectTopMove = useCallback((index: number) => {
    setTopMovesSelected(index);
    const move = topMoves[index];
    if (!move) return;
    const overlay = new Map<string, PlacedTile>();
    let r = move.row, c = move.col;
    const dr = move.direction === 'V' ? 1 : 0;
    const dc = move.direction === 'H' ? 1 : 0;
    for (const tile of move.tiles) {
      while (committedBoard[r][c]) {
        r += dr; c += dc;
      }
      overlay.set(`${r},${c}`, {
        letter: tile.letter,
        isBlank: tile.isBlank,
        blankLetter: tile.blankLetter,
      });
      r += dr; c += dc;
    }
    setTopMoveOverlay(overlay);
    setTopMovesOpen(false);
  }, [topMoves, committedBoard]);

  // Close Top panel — clear overlay
  const closeTopMoves = useCallback(() => {
    setTopMovesOpen(false);
    setTopMovesSelected(null);
    setTopMoveOverlay(null);
  }, []);

  // Continue after reveal - commit the MASTER's (best) move and draw new tiles
  const continueAfterReveal = useCallback(() => {
    if (!revealData) return;

    let newBoard = committedBoard;
    let newBag = bag;
    const roundResult: RoundResult = {
      playerMove: revealData.playerMove,
      bestMove: revealData.bestMove,
      playerScore: revealData.playerAction === 'pass' ? 0 : (revealData.playerMove?.score ?? 0),
      bestScore: revealData.bestMove?.score ?? 0,
      difference: (revealData.bestMove?.score ?? 0) - (revealData.playerAction === 'pass' ? 0 : (revealData.playerMove?.score ?? 0)),
      playerAction: revealData.playerAction,
      invalidWords: revealData.invalidWords,
    };

    // In duplicate Scrabble, the master's (best) move is always committed to the board
    const moveToCommit = revealData.bestMove;
    if (moveToCommit) {
      newBoard = applyMoveToBoard(committedBoard, moveToCommit);

      // Track last move cells (the master's move)
      const moveCells = new Set<string>();
      let r = moveToCommit.row, c = moveToCommit.col;
      const dr = moveToCommit.direction === 'V' ? 1 : 0;
      const dc = moveToCommit.direction === 'H' ? 1 : 0;
      for (const tile of moveToCommit.tiles) {
        while (newBoard[r][c] && committedBoard[r][c]) {
          r += dr; c += dc;
        }
        moveCells.add(`${r},${c}`);
        r += dr; c += dc;
      }
      setLastMoveCells(moveCells);
    }

    // Determine how many tiles the master's move consumed
    const masterTileCount = moveToCommit?.tiles.length ?? 0;

    // Match the master's tiles to rack tiles and mark them as consumed
    // We match by letter (or blank). For blanks, match isBlank tiles.
    const consumedRackIndices = new Set<number>();
    const tilesToMatch = moveToCommit?.tiles.slice() ?? [];
    for (const mt of tilesToMatch) {
      for (let i = 0; i < rack.length; i++) {
        if (consumedRackIndices.has(i)) continue;
        const rt = rack[i];
        if (mt.isBlank && rt.isBlank) {
          consumedRackIndices.add(i);
          break;
        }
        if (!mt.isBlank && !rt.isBlank && rt.letter === mt.letter) {
          consumedRackIndices.add(i);
          break;
        }
      }
    }

    // Draw new tiles to replace consumed ones, enforcing the 2-vowel / 2-consonant rule.
    // The kept tiles are those NOT consumed by the master's move.
    const keptLetters = rack
      .map((t, i) => (consumedRackIndices.has(i) ? null : t.letter))
      .filter((l): l is string => l !== null);

    const { rackLetters: newRackLetters, remaining: remainingBag } = refillRackWithRule(keptLetters, newBag, RACK_SIZE);
    newBag = remainingBag;

    const newRack = newRackLetters.map((letter, i) => ({
      id: `tile-${rounds.length + 1}-${i}-${Math.random().toString(36).slice(2, 8)}`,
      letter,
      isBlank: letter === '?',
      used: false,
    }));

    // Game over when the rack can no longer satisfy the 2-vowel / 2-consonant rule
    // given the remaining bag (even if some tiles remain).
    if (!canEverSatisfyRule(newRackLetters, newBag)) {
      setGameOver(true);
      stopTimer();
    }

    setRounds(prev => [...prev, roundResult]);
    setCommittedBoard(newBoard);
    setPendingBoard(cloneBoard(newBoard));
    setBag(newBag);
    setRack(newRack);
    setRevealData(null);
    setBestMoveOverlay(null);
    setShowBestMovePreview(false);
    setTypingMode(null);
    lastPlacementRef.current = null;
    setSelectedRackTile(null);
    setError('');
    startTimer();
  }, [revealData, committedBoard, rack, bag, rounds.length, startTimer]);

  useEffect(() => {
    continueAfterRevealRef.current = continueAfterReveal;
  }, [continueAfterReveal]);

  // Show best move preview (peek) — toggle on/off, empty colored cells only
  const peekBestMove = useCallback(() => {
    if (showBestMovePreview) {
      setBestMoveOverlay(null);
      setShowBestMovePreview(false);
      return;
    }
    const rackForSolver = rack.map(t => ({
      letter: t.letter,
      isBlank: t.isBlank,
    }));
    const best = findBestMove(committedBoard, rackForSolver);
    if (best) {
      const overlay = new Map<string, PlacedTile>();
      let r = best.row, c = best.col;
      const dr = best.direction === 'V' ? 1 : 0;
      const dc = best.direction === 'H' ? 1 : 0;
      for (const tile of best.tiles) {
        while (committedBoard[r][c]) {
          r += dr; c += dc;
        }
        overlay.set(`${r},${c}`, {
          letter: tile.letter,
          isBlank: tile.isBlank,
          blankLetter: tile.blankLetter,
        });
        r += dr; c += dc;
      }
      setBestMoveOverlay(overlay);
      setShowBestMovePreview(true);
    }
  }, [showBestMovePreview, rack, committedBoard]);

  // End game manually — stop timer and reset to full time for the next game
  const restartToModeSelect = useCallback(() => {
    stopTimer();
    setTimeLeft(TURN_SECONDS);
    setGameMode(null);
    setValidationMode(null);
    setGameOver(false);
    setShowGameOverModal(true);
    setRevealData(null);
    setBestMoveOverlay(null);
    setTopMoveOverlay(null);
    setTopMoves([]);
    setTopMovesOpen(false);
    setTopMovesSelected(null);
    setShowTopConfirm(false);
    setShowBestMovePreview(false);
    setTypingMode(null);
    setError('');
  }, [stopTimer]);

  // Live score preview for pending tiles
  const scorePreviewData = useMemo(() => {
    if (!showScorePreview || revealData || gameOver) return null;
    return previewScore(pendingBoard, committedBoard);
  }, [showScorePreview, revealData, gameOver, pendingBoard, committedBoard]);

  // --- Render ---

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Validation selection screen (after mode selection, before game starts)
  if (dictLoaded && gameMode !== null && validationMode === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <button
            onClick={() => setGameMode(null)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-amber-700 transition-colors mb-4"
          >
            <ArrowLeft size={18} />
            Volver
          </button>
          <h1 className="text-3xl font-bold text-amber-900 mb-2 text-center">Léxico Duplicado</h1>
          <p className="text-gray-500 text-center mb-8">¿Validar palabras?</p>

          <div className="space-y-4">
            <button
              onClick={() => { setValidationMode(true); startNewGame(); }}
              className="w-full flex items-start gap-4 p-5 rounded-xl border-2 border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all text-left group"
            >
              <div className="w-12 h-12 shrink-0 rounded-xl bg-emerald-100 group-hover:bg-emerald-200 flex items-center justify-center transition-colors">
                <ShieldCheck size={24} className="text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-gray-800 text-lg">Sí, validar</p>
                <p className="text-sm text-gray-500">Solo se aceptan palabras del diccionario</p>
              </div>
            </button>

            <button
              onClick={() => { setValidationMode(false); startNewGame(); }}
              className="w-full flex items-start gap-4 p-5 rounded-xl border-2 border-gray-200 hover:border-amber-400 hover:bg-amber-50 transition-all text-left group"
            >
              <div className="w-12 h-12 shrink-0 rounded-xl bg-amber-100 group-hover:bg-amber-200 flex items-center justify-center transition-colors">
                <ShieldOff size={24} className="text-amber-600" />
              </div>
              <div>
                <p className="font-bold text-gray-800 text-lg">No, sin validación</p>
                <p className="text-sm text-gray-500">Se acepta cualquier palabra; las inválidas suman 0 puntos</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Mode selection screen (after dict load, before game starts)
  if (dictLoaded && gameMode === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <button
            onClick={() => { dictionary.clear(); setDictLoaded(false); }}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-amber-700 transition-colors mb-4"
          >
            <ArrowLeft size={18} />
            Volver
          </button>
          <h1 className="text-3xl font-bold text-amber-900 mb-2 text-center">Léxico Duplicado</h1>
          <p className="text-gray-500 text-center mb-8">Elige el modo de juego</p>

          <div className="space-y-4">
            <button
              onClick={() => { setGameMode('untimed'); startNewGame('untimed'); }}
              className="w-full flex items-start gap-4 p-5 rounded-xl border-2 border-gray-200 hover:border-amber-400 hover:bg-amber-50 transition-all text-left group"
            >
              <div className="w-12 h-12 shrink-0 rounded-xl bg-amber-100 group-hover:bg-amber-200 flex items-center justify-center transition-colors">
                <InfinityIcon size={24} className="text-amber-600" />
              </div>
              <div>
                <p className="font-bold text-gray-800 text-lg">Tiempo ilimitado</p>
                <p className="text-sm text-gray-500">Sin presión de tiempo, juega a tu ritmo</p>
              </div>
            </button>

            <button
              onClick={() => { setGameMode('timed'); startNewGame('timed'); }}
              className="w-full flex items-start gap-4 p-5 rounded-xl border-2 border-gray-200 hover:border-sky-400 hover:bg-sky-50 transition-all text-left group"
            >
              <div className="w-12 h-12 shrink-0 rounded-xl bg-sky-100 group-hover:bg-sky-200 flex items-center justify-center transition-colors">
                <Clock size={24} className="text-sky-600" />
              </div>
              <div>
                <p className="font-bold text-gray-800 text-lg">Con tiempo</p>
                <p className="text-sm text-gray-500">3 minutos por turno, se pasa automáticamente al agotarse</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!dictLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-amber-900 mb-2">Léxico Duplicado</h1>
            <p className="text-gray-500">Modalidad duplicada en español · Sin límite de tiempo</p>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">1. Carga el diccionario</h2>
            <DictionaryLoader onLoaded={handleDictLoaded} />
          </div>

          <div className="bg-amber-50 rounded-lg p-4 text-sm text-gray-600">
            <h3 className="font-semibold text-amber-800 mb-1">¿Cómo se juega?</h3>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Recibes un atril de 7 fichas (igual para todos en cada ronda)</li>
              <li>Coloca tu mejor jugada en el tablero</li>
              <li>Al confirmar, se revela la jugada óptima para comparar</li>
              <li>Se puntúa tu jugada y la del 'master' (mejor jugada)</li>
              <li>Sin límite de tiempo o 3 minutos por turno</li>
              <li>Finaliza al haber menos de 2 vocales o 2 consonantes entre la bolsa y el atril</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 lg:flex">
      {/* Sidebar (desktop) / Header (mobile) */}
      <header className="bg-white/80 backdrop-blur-sm border-amber-100 z-30 shrink-0
                         lg:sticky lg:top-0 lg:h-screen lg:w-56 lg:border-r lg:border-b-0
                         border-b sticky top-0">
        <div className="px-4 py-3 flex items-center justify-between lg:h-full lg:flex-col lg:items-start lg:justify-between lg:py-4 lg:gap-4">
          <div className="flex items-center gap-3 lg:w-full lg:flex-col lg:items-start lg:gap-2">
            <div className="w-10 h-10 bg-amber-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow shrink-0">
              S
            </div>
            <div>
              <h1 className="text-lg font-bold text-amber-900 lg:text-base lg:leading-tight">Léxico Duplicado</h1>
              <p className="text-xs text-gray-500 lg:text-[11px]">Español · {gameMode === 'timed' ? 'Con tiempo (3 min/turno)' : 'Sin límite de tiempo'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:w-full lg:flex-col lg:items-stretch lg:gap-2">
            {gameMode === 'timed' && !revealData && !gameOver && (
              <div className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-sm tabular-nums transition-colors ${timeLeft <= 30 ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-sky-100 text-sky-700'}`}>
                <Clock size={16} />
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
              </div>
            )}
            <button
              onClick={() => setShowEndConfirm(true)}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-sm font-medium transition-colors"
            >
              <Flag size={14} />
              Terminar
            </button>
            <button
              onClick={() => setShowNewGameConfirm(true)}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 text-sm font-medium transition-colors"
            >
              <RotateCcw size={14} />
              Nueva partida
            </button>
          </div>
        </div>
      </header>

      {/* Main game area */}
      <div className="flex-1 p-4 flex flex-col lg:flex-row gap-4 items-start justify-center min-w-0">
        {/* Board area */}
        <div className="flex flex-col items-center gap-4 w-full lg:w-auto">
          {/* Error message */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-2 text-rose-700 text-sm max-w-md text-center">
              {error}
            </div>
          )}

          <GameBoard
            board={committedBoard}
            pendingTiles={pendingTiles}
            bestMoveTiles={topMoveOverlay || bestMoveOverlay}
            onCellClick={placeTileOnBoard}
            selectedRackTile={selectedRackTile}
            lastMoveCells={lastMoveCells}
            previewScoreData={scorePreviewData}
            hideHintLabels={showBestMovePreview}
            onTileDragStart={handleBoardDragStart}
            dropTarget={dropTarget}
            consumeDragEnded={consumeDragEnded}
            typingMode={typingMode}
          />

          {/* Rack */}
          <Rack
            rack={rack}
            selectedTile={selectedRackTile}
            onSelectTile={setSelectedRackTile}
            onShuffle={shuffleRack}
            onClear={clearPending}
            disabled={!!revealData || gameOver}
            shuffleDisabled={pendingTiles.size > 0}
            onTileDragStart={handleRackDragStart}
            dropTarget={dropTarget}
            consumeDragEnded={consumeDragEnded}
          />

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={playMove}
              disabled={!!revealData || gameOver || pendingTiles.size === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors disabled:opacity-40 shadow-md"
            >
              <Play size={18} />
              Jugar
            </button>
            <button
              onClick={openTopMoves}
              disabled={!!revealData || gameOver}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-medium transition-colors disabled:opacity-40 shadow-md"
            >
              <Crown size={18} />
              Top
            </button>
            <button
              onClick={passTurn}
              disabled={!!revealData || gameOver}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-500 hover:bg-gray-600 text-white font-medium transition-colors disabled:opacity-40 shadow-md"
            >
              Pasar
            </button>
            <button
              onClick={peekBestMove}
              disabled={!!revealData || gameOver}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-100 hover:bg-violet-200 text-violet-700 font-medium transition-colors disabled:opacity-40"
              title="Ver la mejor jugada posible (modo práctica)"
            >
              <Eye size={18} />
              {showBestMovePreview ? 'Ocultar' : 'Pista'}
            </button>
            <button
              onClick={() => setShowScorePreview(prev => !prev)}
              disabled={!!revealData || gameOver}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-40 ${showScorePreview ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'}`}
              title="Ver puntaje de la jugada en curso"
            >
              <Calculator size={18} />
              Puntaje
            </button>
          </div>
        </div>

        {/* Score panel */}
        <div className="w-full lg:w-80 lg:sticky lg:top-4">
          <ScorePanel
            totalScore={totalScore}
            bestPossibleScore={bestPossibleScore}
            rounds={rounds}
            currentRound={currentRound}
            tilesLeft={tilesLeft}
          />
        </div>
      </div>

      {/* Blank picker modal */}
      {blankPickerOpen && (
        <BlankPicker
          onSelect={(letter) => blankPickerCallback(letter)}
          onCancel={() => setBlankPickerOpen(false)}
        />
      )}

      {/* End game confirmation dialog */}
      {showEndConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center">
            <p className="text-lg font-semibold text-gray-800 mb-2">¿Terminar la partida?</p>
            <p className="text-sm text-gray-500 mb-6">Se terminará el juego actual y volverás a la pantalla de inicio.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => { setShowEndConfirm(false); restartToModeSelect(); }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium transition-colors"
              >
                Sí, terminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New game confirmation dialog */}
      {showNewGameConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center">
            <p className="text-lg font-semibold text-gray-800 mb-2">¿Empezar nueva partida?</p>
            <p className="text-sm text-gray-500 mb-6">Se reiniciará el juego con un nuevo atril y tablero.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowNewGameConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => { setShowNewGameConfirm(false); restartToModeSelect(); }}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium transition-colors"
              >
                Sí, nueva partida
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top confirmation dialog */}
      {showTopConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center">
            <p className="text-lg font-semibold text-gray-800 mb-2">¿Ver la lista de jugadas Top?</p>
            <p className="text-sm text-gray-500 mb-6">Se calcularán las 20 mejores jugadas posibles con tu atril actual.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowTopConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmOpenTopMoves}
                className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-medium transition-colors"
              >
                Sí, ver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pass confirmation dialog */}
      {showPassConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center">
            <p className="text-lg font-semibold text-gray-800 mb-2">¿Seguro que quieres pasar?</p>
            <p className="text-sm text-gray-500 mb-6">Perderás este turno sin jugar fichas.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPassConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmPassTurn}
                className="flex-1 py-2.5 rounded-xl bg-gray-500 hover:bg-gray-600 text-white font-medium transition-colors"
              >
                Sí, pasar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top moves panel */}
      {topMovesOpen && (
        <TopMovesPanel
          moves={topMoves}
          selectedIndex={topMovesSelected}
          onSelect={selectTopMove}
          onClose={closeTopMoves}
        />
      )}

      {/* Reveal panel */}
      {revealData && (
        <RevealPanel
          playerMove={revealData.playerMove}
          bestMove={revealData.bestMove}
          playerAction={revealData.playerAction}
          invalidWords={revealData.invalidWords}
          onContinue={continueAfterReveal}
          isLastRound={false}
        />
      )}

      {/* Game over modal */}
      {gameOver && showGameOverModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
            <Trophy size={48} className="text-amber-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Partida terminada</h2>
            <div className="grid grid-cols-2 gap-4 my-6">
              <div className="bg-emerald-50 rounded-xl p-4">
                <p className="text-sm text-emerald-600">Tu puntaje</p>
                <p className="text-3xl font-bold text-emerald-700">{totalScore}</p>
              </div>
              <div className="bg-violet-50 rounded-xl p-4">
                <p className="text-sm text-violet-600">Mejor posible</p>
                <p className="text-3xl font-bold text-violet-700">{bestPossibleScore}</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <p className="text-sm text-gray-600">
                Eficiencia: <span className="font-bold text-gray-800">
                  {bestPossibleScore > 0 ? Math.round((totalScore / bestPossibleScore) * 100) : 0}%
                </span>
              </p>
            </div>
            <button
              onClick={restartToModeSelect}
              className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-colors"
            >
              Nueva partida
            </button>
            <button
              onClick={() => setShowGameOverModal(false)}
              className="w-full py-3 mt-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
            >
              Ver tablero
            </button>
          </div>
        </div>
      )}
      {gameOver && !showGameOverModal && (
        <button
          onClick={() => setShowGameOverModal(true)}
          className="fixed bottom-4 right-16 sm:right-4 z-50 flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-lg transition-colors"
        >
          <Trophy size={18} />
          Ver resultado
        </button>
      )}

      {/* Drag ghost */}
      {dragState && dragState.started && (
        <div
          className="fixed left-0 top-0 pointer-events-none z-[60] w-12 h-12 flex items-center justify-center rounded-lg shadow-2xl bg-amber-50 opacity-90"
          style={{
            transform: `translate(${dragState.x - 24}px, ${dragState.y - 24}px) scale(1.1)`,
          }}
        >
          <span className="text-lg font-bold text-amber-900 leading-none">
            {dragState.isBlank ? (dragState.blankLetter || '?') : dragState.letter}
          </span>
          <span className="absolute bottom-0.5 right-1 text-[9px] text-amber-600 leading-none font-semibold">
            {dragState.isBlank ? '0' : (LETTER_VALUES[dragState.letter] ?? 0)}
          </span>
        </div>
      )}
    </div>
  );
}
