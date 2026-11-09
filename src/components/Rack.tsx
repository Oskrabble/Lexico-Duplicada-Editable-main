import { RackTile } from '@/game/types';
import { LETTER_VALUES } from '@/game/tiles';
import { Shuffle, Trash2 } from 'lucide-react';
import type { DropTarget } from '@/hooks/useTileDrag';

interface RackProps {
  rack: RackTile[];
  selectedTile: number | null;
  onSelectTile: (index: number) => void;
  onShuffle: () => void;
  onClear: () => void;
  disabled: boolean;
  shuffleDisabled: boolean;
  onTileDragStart: (e: React.PointerEvent, index: number, tile: RackTile) => void;
  dropTarget: DropTarget | null;
  consumeDragEnded: () => boolean;
}

export function Rack({
  rack, selectedTile, onSelectTile, onShuffle, onClear,
  disabled, shuffleDisabled,
  onTileDragStart, dropTarget, consumeDragEnded,
}: RackProps) {
  return (
    <div className="flex items-center gap-3 bg-amber-800 rounded-xl p-3 shadow-lg">
      <div className="flex gap-1.5">
        {rack.map((tile, index) => {
          const isSelected = selectedTile === index;
          const isUsed = tile.used;
          const isDropTarget = dropTarget?.type === 'rack' && dropTarget.rackIndex === index;
          return (
            <button
              key={tile.id}
              data-drop-rack={index}
              onClick={() => {
                if (consumeDragEnded()) return;
                if (!disabled && !isUsed) onSelectTile(index);
              }}
              disabled={disabled || isUsed}
              onPointerDown={(e) => {
                if (disabled || isUsed) return;
                onTileDragStart(e, index, tile);
              }}
              className={`
                relative w-11 h-11 sm:w-12 sm:h-12
                flex items-center justify-center
                rounded-lg shadow-md transition-all duration-150
                touch-none
                ${isUsed ? 'opacity-30 bg-amber-200' : 'bg-amber-50 hover:bg-white'}
                ${isSelected && !isUsed ? 'ring-2 ring-emerald-500 scale-110 -translate-y-1' : ''}
                ${isDropTarget && !isUsed ? 'ring-2 ring-sky-500 scale-105' : ''}
                ${!disabled && !isUsed ? 'cursor-pointer hover:shadow-lg cursor-grab active:cursor-grabbing' : 'cursor-default'}
              `}
            >
              <span className="text-lg font-bold text-amber-900 leading-none">
                {tile.isBlank ? '?' : tile.letter}
              </span>
              <span className="absolute bottom-0.5 right-1 text-[8px] sm:text-[9px] text-amber-600 leading-none font-semibold">
                {tile.isBlank ? '0' : LETTER_VALUES[tile.letter] ?? 0}
              </span>
              {tile.isBlank && !isUsed && (
                <span className="absolute -top-1 -right-1 text-[7px] bg-violet-500 text-white rounded-full px-1">
                  ?
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5 ml-2">
        <button
          onClick={onShuffle}
          disabled={disabled || shuffleDisabled}
          className="p-2 rounded-lg bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white transition-colors"
          title="Mezclar atril"
        >
          <Shuffle size={16} />
        </button>
        <button
          onClick={onClear}
          disabled={disabled}
          className="p-2 rounded-lg bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white transition-colors"
          title="Retirar fichas del tablero"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
