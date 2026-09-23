import type { TicTacToeMove, TicTacToeState } from '@psc/shared';
import type { BoardProps } from '..';
import './board.css';

export function TicTacToeBoard({
  view,
  me,
  players,
  sendMove,
}: BoardProps<TicTacToeState, TicTacToeMove>) {
  const myTurn = view.turn === me;
  const turnName = players.find((p) => p.id === view.turn)?.name;

  return (
    <div className="stack">
      <p className="muted">{myTurn ? 'Tới lượt bạn' : `Lượt của ${turnName}`}</p>
      <div className="ttt-grid">
        {view.board.map((cell, i) => (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: cells are fixed positions
            key={i}
            type="button"
            className="ttt-cell"
            disabled={!myTurn || cell !== null}
            onClick={() => sendMove({ cell: i })}
          >
            {cell}
          </button>
        ))}
      </div>
    </div>
  );
}
