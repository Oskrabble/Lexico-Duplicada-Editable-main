import { useState } from 'react';
import { LETTERS_ALPHABETICAL, countLetters, rackMeetsVowelConsonantRule } from '@/game/tiles';

interface RackBuilderProps {
  round: number;
  bag: string[];
  keptLetters: string[];
  slots: number;
  onConfirm: (letters: string[]) => void;
}

export function RackBuilder({ round, bag, keptLetters, slots, onConfirm }: RackBuilderProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const bagCounts = countLetters(bag);
  const selectedCounts = countLetters(selected);
  const isFull = selected.length === slots;
  const meetsRule = rackMeetsVowelConsonantRule([...keptLetters, ...selected]);
  const canConfirm = isFull && meetsRule;

  const addLetter = (letter: string) => {
    if (selected.length >= slots) return;
    if ((selectedCounts[letter] ?? 0) >= (bagCounts[letter] ?? 0)) return;
    setSelected(prev => [...prev, letter]);
  };

  const removeAt = (index: number) => {
    setSelected(prev => prev.filter((_, i) => i !== index));
  };

  let hint = `Faltan ${slots - selected.length} ${slots - selected.length === 1 ? 'ficha' : 'fichas'}`;
  let hintClass = 'text-gray-500';
  if (isFull && !meetsRule) {
    hint = 'El atril necesita al menos 2 vocales y 2 consonantes';
    hintClass = 'text-rose-600';
  } else if (canConfirm) {
    hint = 'Atril listo';
    hintClass = 'text-emerald-600';
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Ronda {round}</p>
        <h2 className="text-2xl font-bold text-gray-800 mb-1">Arma tu atril</h2>
        <p className="text-sm text-gray-500 mb-5">
          Elige las fichas que tendrás en esta ronda. Cada ficha se descuenta de la bolsa.
        </p>

        {keptLetters.length > 0 && (
          <p className="text-sm text-gray-600 mb-3">
            Fichas que se quedan: <span className="font-bold text-gray-800">{keptLetters.join(', ')}</span>
          </p>
        )}

        <div className="flex items-center justify-center gap-2 mb-2">
          {Array.from({ length: slots }, (_, i) => {
            const letter = selected[i];
            return letter ? (
              <button
                key={i}
                onClick={() => removeAt(i)}
                title="Quitar ficha"
                className="w-11 h-11 rounded-lg bg-amber-500 hover:bg-rose-500 text-white font-bold shadow transition-colors"
              >
                {letter}
              </button>
            ) : (
              <div key={i} className="w-11 h-11 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50" />
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-3 mb-5 min-h-6">
          <p className={`text-sm font-medium ${hintClass}`}>{hint}</p>
          {selected.length > 0 && (
            <button
              onClick={() => setSelected([])}
              className="text-xs text-gray-500 hover:text-gray-800 underline underline-offset-2 transition-colors"
            >
              Limpiar
            </button>
          )}
        </div>

        <div className="grid grid-cols-7 gap-1.5 mb-6">
          {LETTERS_ALPHABETICAL.map(letter => {
            const available = (bagCounts[letter] ?? 0) - (selectedCounts[letter] ?? 0);
            const disabled = available <= 0 || isFull;
            return (
              <button
                key={letter}
                onClick={() => addLetter(letter)}
                disabled={disabled}
                title={letter === '?' ? 'Comodín' : undefined}
                className="flex flex-col items-center py-2 rounded-lg border border-amber-200 bg-white hover:bg-amber-50 hover:border-amber-400 transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
              >
                <span className="font-bold text-gray-800 leading-none">{letter}</span>
                <span className="text-[11px] text-gray-500 tabular-nums mt-1">{available}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onConfirm(selected)}
          disabled={!canConfirm}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors disabled:opacity-40"
        >
          Confirmar atril
        </button>
      </div>
    </div>
  );
}
