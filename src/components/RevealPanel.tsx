import { useRef, useState, useCallback, useEffect } from 'react';
import { Move } from '@/game/types';
import { Award, Target, ArrowRight, CheckCircle2, XCircle, GripVertical } from 'lucide-react';

interface RevealPanelProps {
  playerMove: Move | null;
  bestMove: Move | null;
  playerAction: 'play' | 'swap' | 'pass';
  invalidWords?: string[];
  onContinue: () => void;
  isLastRound: boolean;
}

export function RevealPanel({ playerMove, bestMove, playerAction, invalidWords, onContinue, isLastRound }: RevealPanelProps) {
  const isMatch = playerMove && bestMove &&
    playerMove.word === bestMove.word &&
    playerMove.score === bestMove.score;

  const isOptimalScore = playerMove && bestMove &&
    playerMove.score === bestMove.score &&
    playerMove.score > 0;

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    startPos.current = { x: e.clientX, y: e.clientY };
    startOffset.current = { ...offset };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  e.preventDefault();
  }, [offset]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    setOffset({
      x: startOffset.current.x + (e.clientX - startPos.current.x),
      y: startOffset.current.y + (e.clientY - startPos.current.y),
    });
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragging.current = false;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  }, []);

  // Reset position when panel reopens
  useEffect(() => { setOffset({ x: 0, y: 0 }); }, []);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 max-w-2xl w-full select-none"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      >
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="flex items-center gap-2 mb-4 cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical size={20} className="text-gray-400" />
          <Award size={24} className="text-amber-500" />
          <h2 className="text-xl font-bold text-gray-800 flex-1">Resultado de la Jugada</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Player's move */}
          <div className={`
            rounded-xl p-4 border-2
            ${isMatch ? 'bg-emerald-50 border-emerald-300' : 'bg-blue-50 border-blue-200'}
          `}>
            <div className="flex items-center gap-2 mb-2">
              <Target size={18} className="text-blue-600" />
              <h3 className="font-semibold text-gray-700">Tu Jugada</h3>
            </div>
            {playerAction === 'play' && playerMove ? (
              <>
                <p className="text-2xl font-bold text-gray-800 mb-1">{playerMove.word}</p>
                <p className="text-sm text-gray-500">
                  {playerMove.wordsFormed.length > 1
                    ? `Palabras: ${playerMove.wordsFormed.join(', ')}`
                    : ''}
                </p>
                <p className="text-3xl font-bold text-blue-600 mt-2">
                  {playerMove.score} pts
                </p>
                {playerMove.isBingo && (
                  <span className="inline-block mt-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                    BINGO +50
                  </span>
                )}
              </>
            ) : playerAction === 'swap' ? (
              <p className="text-gray-500 italic">Cambiaste fichas (0 pts)</p>
            ) : (
              <p className="text-gray-500 italic">
                Pasaste el turno (0 pts)
                {invalidWords && invalidWords.length > 0 && (
                  <span className="not-italic font-semibold text-rose-500"> ({invalidWords.join(', ')})</span>
                )}
              </p>
            )}
          </div>

          {/* Best move */}
          <div className="rounded-xl p-4 border-2 bg-violet-50 border-violet-200">
            <div className="flex items-center gap-2 mb-2">
              <Award size={18} className="text-violet-600" />
              <h3 className="font-semibold text-gray-700">Mejor Jugada</h3>
            </div>
            {bestMove ? (
              <>
                <p className="text-2xl font-bold text-gray-800 mb-1">{bestMove.word}</p>
                <p className="text-sm text-gray-500">
                  {bestMove.wordsFormed.length > 1
                    ? `Palabras: ${bestMove.wordsFormed.join(', ')}`
                    : ''}
                </p>
                <p className="text-3xl font-bold text-violet-600 mt-2">
                  {bestMove.score} pts
                </p>
                {bestMove.isBingo && (
                  <span className="inline-block mt-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                    BINGO +50
                  </span>
                )}
              </>
            ) : (
              <p className="text-gray-500 italic">No hay jugada posible</p>
            )}
          </div>
        </div>

        {/* Comparison */}
        {playerAction === 'play' && bestMove && (
          <div className={`
            flex items-center justify-center gap-3 py-3 rounded-lg mb-4
            ${isMatch || isOptimalScore ? 'bg-emerald-100' : 'bg-rose-50'}
          `}>
            {isMatch || isOptimalScore ? (
              <>
                <CheckCircle2 size={24} className="text-emerald-600" />
                <span className="font-bold text-emerald-700">¡Jugada óptima! Encontraste la mejor opción.</span>
              </>
            ) : (
              <>
                <XCircle size={24} className="text-rose-500" />
                <span className="font-bold text-rose-600">
                  Diferencia: {bestMove.score - (playerMove?.score || 0)} puntos
                </span>
              </>
            )}
          </div>
        )}

        <button
          onClick={onContinue}
          className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {isLastRound ? (
            <>Ver resultado final</>
          ) : (
            <>
              Continuar
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
