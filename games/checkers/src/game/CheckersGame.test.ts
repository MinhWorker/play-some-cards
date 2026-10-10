import { type StartContext, testGame } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';
import { CheckersGame } from './CheckersGame.js';
import { type Options, optionsSchema, RULES, type Side, type State, type View } from './model.js';
import { boardOf, legalMoves, positionKey } from './rules.js';

/** The game from a made-up board instead of the opening one. */
class FromBoard extends CheckersGame {
  constructor(
    private readonly board: string,
    private readonly first: Side | null = null,
    private readonly quiet = 0,
  ) {
    super();
  }

  override onStart(ctx: StartContext<Options>): State {
    const state = super.onStart(ctx);
    const turn = this.first ?? state.turn;
    return {
      ...state,
      board: this.board,
      turn,
      quiet: this.quiet,
      history: [positionKey(this.board, turn)],
    };
  }
}

/** The part of a `testGame` session the helpers use. */
interface Game {
  readonly state: State;
  send(player: string, event: string, payload?: object): unknown;
}

/** Square of (row, col) on an 8 × 8 board. */
const sq = (row: number, col: number) => row * 8 + col;

/** Plays paths of [row, col] squares, each by whoever's turn it is. */
function moves<G extends Game>(game: G, ...list: [number, number][][]) {
  for (const path of list) {
    const first = RULES.first;
    const player = game.state.players[game.state.turn === first ? 0 : 1];
    game.send(player, 'move', { path: path.map(([r, c]) => sq(r, c)) });
  }
  return game;
}

const fresh = (options: Partial<Options> = {}) => testGame(plugin, ['a', 'b'], { options });
const from = (board: string, options: Partial<Options> = {}, bots: string[] = [], quiet = 0) =>
  testGame(new FromBoard(board, null, quiet), ['a', 'b'], {
    options: { opponent: 'human', level: 'normal', swap: false, ...options },
    bots,
  });

describe('checkers', () => {
  it('starts on the standard board, with Black first and either seat', () => {
    expect(fresh().state).toMatchObject({ players: ['a', 'b'], turn: 'b', end: null });
    expect(fresh().state.board).toHaveLength(64);
    const swapped = fresh({ swap: true });
    expect(swapped.state).toMatchObject({ players: ['b', 'a'], turn: 'b' });
    expect(swapped.state.board).toHaveLength(64);
  });

  it('keeps a single board even when old setup options include a variant', () => {
    const options = optionsSchema.parse({ variant: 'international' });
    expect(options).not.toHaveProperty('variant');
    expect(fresh(options).state.board).toHaveLength(64);
    expect(plugin.meta.status).toBe('ready');
  });

  it('refuses moves out of turn and against the rules', () => {
    const game = fresh();
    expect(game.error('b', 'move', { path: [sq(5, 0), sq(4, 1)] })).toBe('Chưa tới lượt bạn');
    expect(game.error('a', 'move', { path: [sq(5, 0), sq(3, 2)] })).toBe('Nước đi không đúng luật');
    expect(game.error('a', 'move', { path: [sq(5, 0), sq(4, 1)] })).toBeNull();
  });

  it('accepts either a quiet move or a capture when a capture is available', () => {
    const game = from(
      boardOf(
        '........',
        '........',
        '........',
        '........',
        '.w......',
        'b.....b.',
        '........',
        '........',
      ),
    );
    const quiet = from(game.state.board);
    expect(quiet.error('a', 'move', { path: [sq(5, 6), sq(4, 7)] })).toBeNull();
    quiet.send('a', 'move', { path: [sq(5, 6), sq(4, 7)] });
    expect(quiet.state).toMatchObject({ turn: 'w', taken: { b: 0, w: 0 } });
    expect(quiet.state.board[sq(4, 1)]).toBe('w');
    expect(quiet.state.last).toMatchObject({ path: [sq(5, 6), sq(4, 7)], captures: [] });
    expect(game.error('a', 'move', { path: [sq(5, 6), sq(3, 4)] })).toBe('Nước đi không đúng luật');
    moves(game, [
      [5, 0],
      [3, 2],
    ]);
    expect(game.state).toMatchObject({ taken: { b: 1, w: 0 }, quiet: 0 });
    expect(game.state.last).toMatchObject({ captures: [sq(4, 1)], taken: ['w'] });
  });

  it('accepts long king moves and rejects crossing friendly or multiple enemy pieces', () => {
    const cells = Array(64).fill('.');
    cells[sq(7, 0)] = 'B';
    cells[sq(0, 1)] = 'w';
    const game = from(cells.join(''));
    game.send('a', 'move', { path: [sq(7, 0), sq(1, 6)] });
    expect(game.state.board[sq(1, 6)]).toBe('B');
    expect(game.state).toMatchObject({ turn: 'w', quiet: 1 });
    for (const blockers of ['b.', 'ww']) {
      cells[sq(4, 3)] = blockers[0];
      cells[sq(3, 4)] = blockers[1];
      const blocked = from(cells.join(''));
      expect(blocked.error('a', 'move', { path: [sq(7, 0), sq(1, 6)] })).toBe(
        'Nước đi không đúng luật',
      );
    }
  });

  it('crowns a man on the far row, and wins when the other side cannot move', () => {
    const game = from(
      boardOf(
        '........',
        '..b.....',
        '........',
        '........',
        '........',
        '........',
        '........',
        '........',
      ),
    );
    moves(game, [
      [1, 2],
      [0, 1],
    ]);
    expect(game.state.board[sq(0, 1)]).toBe('B');
    expect(game.state.last?.crowned).toBe(true);
    // White has no piece left to move: Black has won.
    expect(game.state.end).toEqual({ reason: 'blocked', winner: 'b' });
    expect(game.result).toEqual({ winners: ['a'] });
  });

  it('draws when a position comes back a third time', () => {
    const game = from(
      boardOf(
        '.B......',
        '........',
        '........',
        '........',
        '........',
        '........',
        '........',
        '......W.',
      ),
    );
    const round: [number, number][][] = [
      [
        [0, 1],
        [1, 2],
      ],
      [
        [7, 6],
        [6, 7],
      ],
      [
        [1, 2],
        [0, 1],
      ],
      [
        [6, 7],
        [7, 6],
      ],
    ];
    moves(game, ...round, ...round);
    expect(game.state.end).toEqual({ reason: 'repetition', winner: null });
  });

  it('draws after the quiet-move limit', () => {
    const game = from(
      boardOf(
        '.B......',
        '........',
        '........',
        '........',
        '........',
        '........',
        '........',
        '......W.',
      ),
      {},
      [],
      RULES.quietLimit - 1,
    );
    moves(game, [
      [0, 1],
      [1, 2],
    ]);
    expect(game.state.end).toEqual({ reason: 'move-limit', winner: null });
  });

  it('handles a draw offer: accept, decline, or a move that turns it down', () => {
    const game = fresh();
    game.send('a', 'offer-draw');
    expect(game.state.drawOffer).toBe('b');
    expect(game.error('a', 'offer-draw')).toBe('Bạn đã xin hoà, chờ đối thủ trả lời');
    moves(game, [
      [5, 0],
      [4, 1],
    ]);
    expect(game.state.drawOffer).toBe('b');
    moves(game, [
      [2, 1],
      [3, 0],
    ]);
    expect(game.state.drawOffer).toBeNull();
    game.send('b', 'offer-draw');
    game.send('a', 'decline-draw');
    expect(game.state.drawOffer).toBeNull();
    game.send('b', 'offer-draw');
    game.send('a', 'offer-draw');
    expect(game.state.end).toEqual({ reason: 'agreement', winner: null });
  });

  it('gives the game to the other side on resigning or leaving', () => {
    const resigned = fresh().send('b', 'resign');
    expect(resigned.state.end).toEqual({ reason: 'resign', winner: 'b' });
    expect(resigned.result).toEqual({ winners: ['a'] });
    const left = fresh().leave('a');
    expect(left.state.end).toEqual({ reason: 'left', winner: 'w' });
  });

  it('shows everything but the repetition bookkeeping, and your moves on your turn', () => {
    const game = fresh();
    const view = game.view(null) as View;
    expect(view).not.toHaveProperty('history');
    expect(view.moves).toEqual([]);
    const mine = game.view('a') as View;
    expect(mine.moves).toEqual(legalMoves(game.state.board, game.state.turn, RULES));
    expect(mine.moves.length).toBeGreaterThan(0);
    expect((game.view('b') as View).moves).toEqual([]);
  });

  it('asks the computer only in rooms against it, and it plays legal moves', () => {
    expect(fresh().bot('b')).toBeNull();
    for (const level of ['easy', 'normal', 'hard'] as const) {
      const game = testGame(plugin, ['a', 'b'], {
        options: { opponent: 'bot', level },
        bots: ['b'],
      });
      expect(game.bot('b')).toBeNull(); // the human moves first
      const first = legalMoves(game.state.board, game.state.turn, RULES)[0];
      game.send('a', 'move', { path: first?.path ?? [] });
      const reply = game.bot('b') as { event: string; payload: { path: number[] } };
      expect(reply.event).toBe('move');
      expect(game.error('b', 'move', reply.payload)).toBeNull();
    }
  });

  it('lets the computer take two pieces rather than one', () => {
    const game = from(
      boardOf(
        '........',
        '........',
        '...w....',
        '........',
        '.w...w..',
        'b...b...',
        '........',
        '........',
      ),
      { opponent: 'bot', level: 'hard' },
      ['a'],
    );
    const reply = game.bot('a') as { payload: { path: number[] } };
    expect(reply.payload.path).toEqual([sq(5, 0), sq(3, 2), sq(1, 4)]);
  });

  it('thinks quickly enough on its hardest level, on the standard board', () => {
    const game = testGame(plugin, ['a', 'b'], {
      options: { opponent: 'bot', level: 'hard' },
      bots: ['b'],
    });
    let slowest = 0;
    for (let i = 0; i < 6 && !game.state.end; i++) {
      const mine = legalMoves(game.state.board, game.state.turn, RULES);
      game.send('a', 'move', { path: mine[Math.floor(mine.length / 2)]?.path ?? [] });
      if (game.state.end) break;
      const started = Date.now();
      const reply = game.bot('b') as { event: string; payload: object };
      slowest = Math.max(slowest, Date.now() - started);
      game.send('b', reply.event, reply.payload);
    }
    expect(slowest).toBeLessThan(1000);
  });
});
