import { type StartContext, testGame } from '@psc/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';
import { type Cell, type Options, QUIET_LIMIT, type Side, type State, type View } from './model.js';
import { boardOf, legalTargets, positionKey, START, square } from './rules.js';
import { XiangqiGame } from './XiangqiGame.js';

/** The game from a made-up position instead of the opening one. */
class FromPosition extends XiangqiGame {
  constructor(
    private readonly board: Cell[],
    private readonly first: Side = 'r',
    private readonly quiet = 0,
  ) {
    super();
  }

  override onStart(ctx: StartContext<Options>): State {
    const key = positionKey(this.board, this.first);
    return {
      ...super.onStart(ctx),
      board: this.board,
      turn: this.first,
      quiet: this.quiet,
      history: [{ key, check: false, chase: false }],
    };
  }
}

/** The part of a `testGame` session the helpers use. */
interface Game {
  readonly state: State;
  send(player: string, event: string, payload?: object): unknown;
}

/** Plays moves as [row, col] → [row, col], each by whoever's turn it is. */
function moves<G extends Game>(game: G, ...list: [[number, number], [number, number]][]) {
  for (const [[fr, fc], [tr, tc]] of list) {
    const player = game.state.players[game.state.turn === 'r' ? 0 : 1];
    game.send(player, 'move', { from: square(fr, fc), to: square(tr, tc) });
  }
  return game;
}

const fresh = (options: Partial<Options> = {}) => testGame(plugin, ['a', 'b'], { options });
const from = (board: Cell[], options: Partial<Options> = {}, bots: string[] = []) =>
  testGame(new FromPosition(board), ['a', 'b'], {
    options: { opponent: 'human', level: 'normal', swap: false, ...options },
    bots,
  });

describe('xiangqi', () => {
  it('starts with a as Red to move, or b after a swap', () => {
    expect(fresh().state).toMatchObject({ players: ['a', 'b'], turn: 'r', end: null });
    expect(fresh({ swap: true }).state).toMatchObject({ players: ['b', 'a'], turn: 'r' });
  });

  it('refuses moves out of turn, of the wrong pieces and against the rules', () => {
    const game = fresh();
    const cannon = square(7, 1);
    expect(game.error('b', 'move', { from: square(3, 0), to: square(4, 0) })).toBe(
      'Chưa tới lượt bạn',
    );
    expect(game.error('a', 'move', { from: square(3, 0), to: square(4, 0) })).toBe(
      'Hãy chọn quân của bạn',
    );
    expect(game.error('a', 'move', { from: cannon, to: square(6, 1) })).toBeNull();
    expect(game.error('a', 'move', { from: cannon, to: square(7, 2) })).toBeNull();
    expect(game.error('a', 'move', { from: cannon, to: square(5, 2) })).toBe(
      'Nước đi không đúng luật',
    );
    expect(game.error('a', 'move', { from: cannon, to: 90 })).toBe('Nước đi không hợp lệ');
  });

  it('plays a capture and remembers it', () => {
    // The red cannon on (7,1) jumps the black cannon on (2,1) and takes the horse behind it.
    const game = moves(fresh(), [
      [7, 1],
      [0, 1],
    ]);
    expect(game.state.board[square(0, 1)]).toBe('C');
    expect(game.state).toMatchObject({
      turn: 'b',
      captured: ['n'],
      quiet: 0,
      plies: 1,
      last: { from: square(7, 1), to: square(0, 1), captured: 'n' },
    });
  });

  it('ends in checkmate for the side that mated', () => {
    const game = moves(
      from(
        boardOf(
          '....k....',
          '........R',
          '.........',
          '.........',
          '.........',
          'R........',
          '.........',
          '.........',
          '.........',
          '...K.....',
        ),
      ),
      [
        [5, 0],
        [0, 0],
      ],
    );
    expect(game.result).toEqual({ winners: ['a'] });
    expect(game.state.end).toEqual({ reason: 'checkmate', winner: 'r' });
    expect(game.state.check).toBe(true);
    expect(game.error('b', 'resign')).toBe('Ván đã kết thúc');
  });

  it('makes a side with no legal move lose even when not in check', () => {
    const game = moves(
      from(
        boardOf(
          '....k....',
          '.........',
          '.........',
          '....P....',
          '.........',
          '...R.R...',
          '.........',
          '.........',
          '.........',
          '....K....',
        ),
      ),
      [
        [3, 4],
        [2, 4],
      ],
    );
    expect(game.state.end).toEqual({ reason: 'stalemate', winner: 'r' });
    expect(game.result).toEqual({ winners: ['a'] });
  });

  it('draws when the same position comes back a third time with no checks or chases', () => {
    const shuffle: [[number, number], [number, number]][] = [
      [
        [9, 1],
        [7, 2],
      ],
      [
        [0, 1],
        [2, 2],
      ],
      [
        [7, 2],
        [9, 1],
      ],
      [
        [2, 2],
        [0, 1],
      ],
    ];
    const game = moves(fresh(), ...shuffle, ...shuffle.slice(0, 3));
    expect(game.result).toBeNull();
    moves(game, ...shuffle.slice(3));
    expect(game.state.end).toEqual({ reason: 'repetition', winner: null });
    expect(game.result).toEqual({ winners: [] });
  });

  it('makes the side that checks forever lose', () => {
    const game = from(
      boardOf(
        '....k....',
        '.........',
        '.........',
        '.........',
        '.........',
        'R........',
        '.........',
        '.........',
        '.........',
        '...K.....',
      ),
    );
    const round: [[number, number], [number, number]][] = [
      [
        [0, 0],
        [1, 0],
      ],
      [
        [1, 4],
        [0, 4],
      ],
      [
        [1, 0],
        [0, 0],
      ],
      [
        [0, 4],
        [1, 4],
      ],
    ];
    moves(
      game,
      [
        [5, 0],
        [0, 0],
      ],
      [
        [0, 4],
        [1, 4],
      ],
      ...round,
    );
    moves(game, ...round.slice(0, 2));
    expect(game.result).toBeNull();
    // Red's third arrival at the same checking position ends it.
    moves(game, ...round.slice(2, 3));
    expect(game.state.end).toEqual({ reason: 'perpetual-check', winner: 'b' });
    expect(game.result).toEqual({ winners: ['b'] });
  });

  it('draws after 60 moves each without a capture', () => {
    const game = testGame(new FromPosition(START, 'r', QUIET_LIMIT - 1), ['a', 'b'], {
      options: { opponent: 'human', level: 'normal', swap: false },
    });
    moves(game, [
      [9, 1],
      [7, 2],
    ]);
    expect(game.state.end).toEqual({ reason: 'move-limit', winner: null });
  });

  it('handles a draw offer: accept, decline, or a move that turns it down', () => {
    const game = fresh();
    game.send('a', 'offer-draw');
    expect(game.state.drawOffer).toBe('r');
    expect(game.error('a', 'offer-draw')).toBe('Bạn đã xin hoà, chờ đối thủ trả lời');
    expect(game.error('a', 'decline-draw')).toBe('Không có lời xin hoà nào');
    // Red's offer outlives Red's own move; Black's move turns it down.
    moves(game, [
      [9, 1],
      [7, 2],
    ]);
    expect(game.state.drawOffer).toBe('r');
    moves(game, [
      [0, 1],
      [2, 2],
    ]);
    expect(game.state.drawOffer).toBeNull();
    game.send('b', 'offer-draw');
    game.send('a', 'decline-draw');
    expect(game.state.drawOffer).toBeNull();
    game.send('b', 'offer-draw');
    game.send('a', 'offer-draw');
    expect(game.state.end).toEqual({ reason: 'agreement', winner: null });
    expect(game.result).toEqual({ winners: [] });
  });

  it('gives the game to the other side on resigning or leaving', () => {
    const resigned = fresh().send('b', 'resign');
    expect(resigned.state.end).toEqual({ reason: 'resign', winner: 'r' });
    expect(resigned.result).toEqual({ winners: ['a'] });
    const left = fresh().leave('a');
    expect(left.state.end).toEqual({ reason: 'left', winner: 'b' });
    expect(left.result).toEqual({ winners: ['b'] });
  });

  it('shows everything but the repetition bookkeeping', () => {
    const view = fresh().view(null) as View;
    expect(view).not.toHaveProperty('history');
    expect(view.board).toHaveLength(90);
  });

  it('asks the computer only in rooms against it, and it plays legal moves', () => {
    expect(fresh().bot('b')).toBeNull();
    for (const level of ['easy', 'normal', 'hard'] as const) {
      const game = testGame(plugin, ['a', 'b'], {
        options: { opponent: 'bot', level },
        bots: ['b'],
      });
      expect(game.bot('b')).toBeNull(); // Red moves first
      moves(game, [
        [7, 7],
        [7, 4],
      ]);
      const reply = game.bot('b') as { event: string; payload: { from: number; to: number } };
      expect(reply.event).toBe('move');
      expect(legalTargets(game.state.board, reply.payload.from)).toContain(reply.payload.to);
      game.send('b', 'move', reply.payload);
    }
  });

  it('lets the computer take a hanging chariot', () => {
    const game = from(
      boardOf(
        '....k....',
        '.........',
        '.........',
        '.........',
        '....r....',
        '.........',
        '.........',
        '....R....',
        '.........',
        '...K.....',
      ),
      { opponent: 'bot', level: 'easy' },
      ['a'],
    );
    expect(game.bot('a')).toEqual({
      event: 'move',
      payload: { from: square(7, 4), to: square(4, 4) },
    });
  });
});
