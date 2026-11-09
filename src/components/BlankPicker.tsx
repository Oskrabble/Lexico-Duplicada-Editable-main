import { FORBIDDEN_BLANK_LETTERS } from '@/game/tiles';
import { X } from 'lucide-react';

interface BlankPickerProps {
  onSelect: (letter: string) => void;
  onCancel: () => void;
}

const ALPHABET = 'ABCDEFGHIJLMNÑOPQRSTUVXYZ'.split('');
const DIGRAPHS = ['CH', 'LL', 'RR'];

export function BlankPicker({ onSelect, onCancel }: BlankPickerProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">Elige una letra para el comodín</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {ALPHABET.map((letter) => {
            const forbidden = FORBIDDEN_BLANK_LETTERS.has(letter);
            return (
              <button
                key={letter}
                onClick={() => !forbidden && onSelect(letter)}
                disabled={forbidden}
                className={`
                  aspect-square rounded-lg font-bold text-lg transition-all
                  ${forbidden
                    ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-900 hover:scale-110 shadow-sm'
                  }
                `}
              >
                {letter}
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          <p className="text-sm font-semibold text-gray-600 mb-2">Dígrafos</p>
          <div className="flex gap-3">
            {DIGRAPHS.map((dg) => (
              <button
                key={dg}
                onClick={() => onSelect(dg)}
                className="px-4 py-2 rounded-lg font-bold text-lg bg-violet-50 hover:bg-violet-100 text-violet-900 hover:scale-110 shadow-sm transition-all"
              >
                {dg}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-3">
          Las letras K y W no están disponibles (no existen en el Scrabble en español).
        </p>
      </div>
    </div>
  );
}
