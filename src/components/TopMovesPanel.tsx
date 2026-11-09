import { Move } from '@/game/types';
import { X, Crown } from 'lucide-react';

interface TopMovesPanelProps {
  moves: Move[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onClose: () => void;
}

export function TopMovesPanel({ moves, selectedIndex, onSelect, onClose }: TopMovesPanelProps) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Crown size={20} className="text-amber-500" />
            <h2 className="text-lg font-bold text-gray-800">Top 20 jugadas</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-3">
          {moves.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No hay jugadas disponibles</p>
          ) : (
            <ol className="space-y-1.5">
              {moves.map((move, i) => (
                <li key={i}>
                  <button
                    onClick={() => onSelect(i)}
                    className={`
                      w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-all
                      ${selectedIndex === i
                        ? 'bg-violet-100 ring-2 ring-violet-400'
                        : 'hover:bg-gray-50'}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`
                        w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold
                        ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}
                      `}>
                        {i + 1}
                      </span>
                      <span className="font-semibold text-gray-800 text-sm uppercase tracking-wide">
                        {move.word}
                      </span>
                      {move.isBingo && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">
                          BINGO
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-amber-700">{move.score}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400 text-center">
          Toca una jugada para verla en el tablero
        </div>
      </div>
    </div>
  );
}
