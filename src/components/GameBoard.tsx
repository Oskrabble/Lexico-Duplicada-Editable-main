import { BOARD_SIZE, getPremium, isCenter } from '@/game/board';
import { Cell, PlacedTile } from '@/game/types';
import { tileLetter, tileValue } from '@/game/engine';
import type { DropTarget } from '@/hooks/useTileDrag';

interface BoardProps {
  board: Cell[][];
  pendingTiles: Map<string, PlacedTile>;
  bestMoveTiles?: Map<string, PlacedTile> | null;
  onCellClick: (row: number, col: number) => void;
  selectedRackTile: number | null;
  lastMoveCells?: Set<string>;
  previewScoreData?: { score: number; lastTileRow: number; lastTileCol: number; direction: 'H' | 'V' } | null;
  hideHintLabels?: boolean;
  onTileDragStart: (e: React.PointerEvent, row: number, col: number, tile: PlacedTile) => void;
  dropTarget: DropTarget | null;
  consumeDragEnded: () => boolean;
  typingMode?: { row: number; col: number; direction: 'H' | 'V' } | null;
  onCellDoubleClick?: (row: number, col: number) => void;
}

const premiumColors: Record<string, string> = {
  TW: 'bg-rose-500',
  DW: 'bg-rose-300',
  TL: 'bg-sky-500',
  DL: 'bg-sky-300',
};

const premiumLabels: Record<string, string> = {
  TW: 'TP',
  DW: 'DP',
  TL: 'TL',
  DL: 'DL',
};

export function GameBoard({
  board, pendingTiles, bestMoveTiles, onCellClick,
  selectedRackTile, lastMoveCells,
  previewScoreData, hideHintLabels,
  onTileDragStart, dropTarget, consumeDragEnded,
  typingMode, onCellDoubleClick,
}: BoardProps) {
  return (
    <div className="w-full max-w-[600px] lg:max-w-[680px] bg-amber-900 p-1 sm:p-1.5 rounded-lg shadow-2xl">
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))` }}>
        {Array.from({ length: BOARD_SIZE }).map((_, row) =>
          Array.from({ length: BOARD_SIZE }).map((__, col) => {
            const key = `${row},${col}`;
            const committed = board[row][col];
            const pending = pendingTiles.get(key);
            const bestMove = bestMoveTiles?.get(key);
            const premium = getPremium(row, col);
            const center = isCenter(row, col);
            const isLastMove = lastMoveCells?.has(key);
            const cell = pending || committed;
            const showBestMove = bestMove && !committed;
            const isDropTarget = dropTarget?.type === 'board' && dropTarget.row === row && dropTarget.col === col && !committed;

            let bgClass = 'bg-amber-100';
            if (premium) bgClass = premiumColors[premium];
            if (center && !premium) bgClass = 'bg-amber-300';

            return (
              <button
                key={key}
                data-drop-board={`${row},${col}`}
                onClick={() => {
                  if (consumeDragEnded()) return;
                  onCellClick(row, col);
                }}
                onDoubleClick={() => onCellDoubleClick?.(row, col)}
                onPointerDown={pending ? (e) => onTileDragStart(e, row, col, pending) : undefined}
                className={`
                  relative aspect-square w-full
                  flex items-center justify-center
                  rounded-sm text-xs font-bold
                  transition-all duration-150
                  touch-none select-none
                  ${bgClass}
                  ${cell ? 'bg-white shadow-inner' : ''}
                  ${pending ? 'ring-2 ring-emerald-500 z-10 scale-105 cursor-grab active:cursor-grabbing' : ''}
                  ${isLastMove && !pending ? 'ring-1 ring-amber-500' : ''}
                  ${isDropTarget ? 'ring-2 ring-sky-500 z-10 scale-110' : ''}
                  hover:brightness-110 active:scale-95
                `}
              >
                {!cell && !showBestMove && premium && (
                  <span className="text-[8px] sm:text-[9px] font-bold text-white/90">
                    {premiumLabels[premium]}
                  </span>
                )}
                {!cell && !showBestMove && center && !premium && (
                  <span className="text-[8px] font-bold text-amber-700">★</span>
                )}
                {cell && (
                  <div className="relative flex items-center justify-center w-full h-full">
                    <span className={`text-sm sm:text-base font-bold leading-none ${cell.isBlank && !pending ? 'text-orange-400' : 'text-amber-900'}`}>
                      {tileLetter(cell)}
                    </span>
                    <span className={`absolute bottom-0 right-0.5 text-[7px] sm:text-[8px] leading-none font-semibold ${cell.isBlank && !pending ? 'text-orange-400' : 'text-amber-700'}`}>
                      {cell.isBlank ? '0' : tileValue(cell)}
                    </span>
                  </div>
                )}
                {showBestMove && bestMove && (
                  <div className="absolute inset-0 flex items-center justify-center bg-violet-400/50 rounded-sm ring-2 ring-violet-500 z-20">
                    {!hideHintLabels && (
                      <>
                        <span className="text-sm sm:text-base font-bold text-violet-900 leading-none">
                          {tileLetter(bestMove)}
                        </span>
                        <span className="absolute bottom-0 right-0.5 text-[7px] sm:text-[8px] text-violet-700 leading-none font-semibold">
                          {bestMove.isBlank ? '0' : tileValue(bestMove)}
                        </span>
                      </>
                    )}
                  </div>
                )}
                {previewScoreData && previewScoreData.lastTileRow === row && previewScoreData.lastTileCol === col && pending && (
                  <div className={`absolute bg-emerald-500 text-black text-[8px] sm:text-[9px] font-bold rounded-sm px-1 py-0.5 leading-none z-30 shadow border border-emerald-700 ${previewScoreData.direction === 'V' ? '-bottom-1.5 -left-1.5' : '-top-1.5 -right-1.5'}`}>
                    {previewScoreData.score}
                  </div>
                )}
                {typingMode && typingMode.row === row && typingMode.col === col && !committed && (
                  <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                    <svg width="14" height="14" viewBox="0 0 14 14" className="text-emerald-600 drop-shadow">
                      {typingMode.direction === 'H' ? (
                        <polygon points="3,2 12,7 3,12" fill="currentColor" />
                      ) : (
                        <polygon points="2,3 7,12 12,3" fill="currentColor" />
                      )}
                    </svg>
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
