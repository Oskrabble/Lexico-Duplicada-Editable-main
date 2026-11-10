import { ArrowLeft, Hand, Shuffle } from 'lucide-react';
import type { RackMode } from '@/game/types';

interface RackModeSelectProps {
  onSelect: (mode: RackMode) => void;
  onBack: () => void;
}

export function RackModeSelect({ onSelect, onBack }: RackModeSelectProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-amber-700 transition-colors mb-4"
        >
          <ArrowLeft size={18} />
          Volver
        </button>
        <h1 className="text-3xl font-bold text-amber-900 mb-2 text-center">Léxico Duplicado</h1>
        <p className="text-gray-500 text-center mb-8">¿Cómo se forma el atril en cada ronda?</p>

        <div className="space-y-4">
          <button
            onClick={() => onSelect('random')}
            className="w-full flex items-start gap-4 p-5 rounded-xl border-2 border-gray-200 hover:border-sky-400 hover:bg-sky-50 transition-all text-left group"
          >
            <div className="w-12 h-12 shrink-0 rounded-xl bg-sky-100 group-hover:bg-sky-200 flex items-center justify-center transition-colors">
              <Shuffle size={24} className="text-sky-600" />
            </div>
            <div>
              <p className="font-bold text-gray-800 text-lg">Aleatorio</p>
              <p className="text-sm text-gray-500">Las fichas se reparten al azar en cada ronda</p>
            </div>
          </button>

          <button
            onClick={() => onSelect('manual')}
            className="w-full flex items-start gap-4 p-5 rounded-xl border-2 border-gray-200 hover:border-amber-400 hover:bg-amber-50 transition-all text-left group"
          >
            <div className="w-12 h-12 shrink-0 rounded-xl bg-amber-100 group-hover:bg-amber-200 flex items-center justify-center transition-colors">
              <Hand size={24} className="text-amber-600" />
            </div>
            <div>
              <p className="font-bold text-gray-800 text-lg">Manual</p>
              <p className="text-sm text-gray-500">Eliges tus fichas en cada ronda y ves cuántas quedan de cada letra</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
