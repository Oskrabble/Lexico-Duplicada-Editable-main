import { Move, RoundResult } from '@/game/types';
import { CheckCircle2, XCircle, Award, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ScorePanelProps {
  totalScore: number;
  bestPossibleScore: number;
  rounds: RoundResult[];
  currentRound: number;
  tilesLeft: number;
}

export function ScorePanel({ totalScore, bestPossibleScore, rounds, currentRound, tilesLeft }: ScorePanelProps) {
  const efficiency = bestPossibleScore > 0 ? Math.round((totalScore / bestPossibleScore) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 bg-white rounded-xl shadow-lg p-4 w-full">
      {/* Score summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 rounded-lg p-3 text-center">
          <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Tu Puntaje</p>
          <p className="text-3xl font-bold text-emerald-700">{totalScore}</p>
        </div>
        <div className="bg-violet-50 rounded-lg p-3 text-center">
          <p className="text-xs text-violet-600 font-medium uppercase tracking-wide">Mejor Posible</p>
          <p className="text-3xl font-bold text-violet-700">{bestPossibleScore}</p>
        </div>
      </div>

      {/* Efficiency bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Eficiencia</span>
          <span className="font-bold">{efficiency}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
            style={{ width: `${Math.min(efficiency, 100)}%` }}
          />
        </div>
      </div>

      {/* Tiles remaining */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">Fichas en bolsa</span>
        <span className="font-bold text-amber-700">{tilesLeft}</span>
      </div>

      {/* Round history */}
      <div className="border-t pt-3">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Historial de Jugadas</h3>
        <div className="max-h-64 overflow-y-auto space-y-1.5">
          {rounds.length === 0 && (
            <p className="text-xs text-gray-400 italic">Aún no hay jugadas</p>
          )}
          {rounds.map((round, i) => (
            <RoundRow key={i} round={round} roundNum={i + 1} />
          ))}
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400 py-1">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Ronda {currentRound} en curso...</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoundRow({ round, roundNum }: { round: RoundResult; roundNum: number }) {
  const matched = round.playerMove && round.bestMove &&
    round.playerMove.word === round.bestMove.word &&
    round.playerMove.score === round.bestMove.score;

  const diff = round.playerScore - round.bestScore;
  const isPerfect = diff === 0 && round.playerAction === 'play';

  return (
    <div className={`
      flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs
      ${isPerfect ? 'bg-emerald-50' : 'bg-gray-50'}
    `}>
      <span className="font-mono text-gray-400 w-6">#{roundNum}</span>

      {round.playerAction === 'play' && round.playerMove ? (
        <>
          <span className="font-bold text-gray-700 flex-1 truncate">
            {round.playerMove.word}
            {round.bestMove && (
              <>
                <span className="text-gray-300 font-normal mx-1">/</span>
                <span className="font-bold text-violet-600">{round.bestMove.word}</span>
              </>
            )}
          </span>
          <span className="font-bold text-emerald-600">{round.playerScore}</span>
          <span className="text-gray-300">/</span>
          <span className="font-bold text-violet-600">{round.bestScore}</span>
          {isPerfect ? (
            <CheckCircle2 size={14} className="text-emerald-500" />
          ) : (
            <XCircle size={14} className="text-rose-400" />
          )}
        </>
      ) : round.playerAction === 'swap' ? (
        <>
          <span className="text-gray-400 italic flex-1 truncate">
            Cambio de fichas
            {round.bestMove && (
              <span className="not-italic">
                <span className="text-gray-300 font-normal mx-1">/</span>
                <span className="font-bold text-violet-600">{round.bestMove.word}</span>
              </span>
            )}
          </span>
          <span className="text-gray-400">0</span>
          <span className="text-gray-300">/</span>
          <span className="font-bold text-violet-600">{round.bestScore}</span>
          <TrendingDown size={14} className="text-amber-400" />
        </>
      ) : (
        <>
          <span className="text-gray-400 italic flex-1 truncate">
            Paso
            {round.invalidWords && round.invalidWords.length > 0 && (
              <span className="not-italic font-semibold text-rose-500"> ({round.invalidWords.join(', ')})</span>
            )}
            {round.bestMove && (
              <span className="not-italic">
                <span className="text-gray-300 font-normal mx-1">/</span>
                <span className="font-bold text-violet-600">{round.bestMove.word}</span>
              </span>
            )}
          </span>
          <span className="text-gray-400">0</span>
          <span className="text-gray-300">/</span>
          <span className="font-bold text-violet-600">{round.bestScore}</span>
          <Minus size={14} className="text-gray-400" />
        </>
      )}
    </div>
  );
}
