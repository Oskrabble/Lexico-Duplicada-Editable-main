import { LETTERS_ALPHABETICAL, countLetters } from '@/game/tiles';

interface BagCounterProps {
  bag: string[];
}

export function BagCounter({ bag }: BagCounterProps) {
  const counts = countLetters(bag);

  return (
    <div className="bg-white/90 rounded-2xl shadow-md border border-amber-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-amber-900">Fichas en la bolsa</h3>
        <span className="text-xs text-gray-500 tabular-nums">{bag.length} en total</span>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {LETTERS_ALPHABETICAL.map(letter => {
          const count = counts[letter] ?? 0;
          return (
            <div
              key={letter}
              className={`flex flex-col items-center rounded-lg py-1.5 transition-colors ${
                count > 0 ? 'bg-amber-50 text-amber-900' : 'bg-gray-50 text-gray-400'
              }`}
            >
              <span className="text-sm font-bold leading-none">{letter}</span>
              <span className="text-[11px] tabular-nums mt-1 font-semibold">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
