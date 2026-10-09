import { type StartContext, testGame } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';
import { GoGame } from './GoGame.js';
import { KOMI, type Options, optionsSchema, type State, type View } from './model.js';
import { boardOf, hashOf, place, point } from './rules.js';

/** The game from a made-up board instead of an empty one. */
class FromBoard extends GoGame {
  constructor(
    private readonly rows: string[],
    /** Positions seen before this one. */
    private readonly seen: number[] = [],
  ) {
    super();
  }

  override onStart(ctx: StartContext<Options>): State {
    const { size, board } = boardOf(...this.rows);
    const history = [...this.seen, hashOf(board)];
    return { ...super.onStart(ctx), size: size as State['size'], board, history };
  }
}

/** The part of a `testGame` session the helpers use. */
interface Game {
  readonly state: State;
  send(player: string, event: string, payload?: object): unknown;
}

/** Plays stones given as [row, col] (or 'pass'), each by whoever's turn it is. */
function moves<G extends Game>(game: G, ...list: ([number, number] | 'pass')[]) {
  for (const move of list) {
    const player = game.state.players[game.state.turn === 'b' ? 0 : 1];
    if (move === 'pass') game.send(player, 'pass');
    else game.send(player, 'place', { point: point(game.state.size, ...move) });
  }
  return game;
}

const fresh = (options: Partial<Options> = {}) => testGame(plugin, ['a', 'b'], { options });
const from = (
  rows: string[],
  options: Partial<Options> = {},
  bots: string[] = [],
  seen: number[] = [],
) =>
  testGame(new FromBoard(rows, seen), ['a', 'b'], {
    options: { opponent: 'human', level: 'normal', swap: false, ...options },
    bots,
  });

/** Black owns the three columns on the left, White the four on the right, walls touching. */
const HALVES = [
  '...bw....',
  '...bw....',
  '...bw....',
  '...bw....',
  '...bw....',
  '...bw....',
  '...bw....',
  '...bw....',
  '...bw....',
];

describe('go', () => {
  it('always starts on the standard 19 × 19 board, including old room options', () => {
    expect(fresh().state).toMatchObject({ size: 19, players: ['a', 'b'], turn: 'b', end: null });
    expect(fresh().state.board).toBe('.'.repeat(361));
    expect(fresh({ swap: true }).state).toMatchObject({ size: 19, players: ['b', 'a'] });
    for (const size of [9, 13, 19]) {
      const options = optionsSchema.parse({ size });
      expect(options).not.toHaveProperty('size');
      expect(fresh(options).state.board).toHaveLength(361);
    }
  });

  it('refuses moves out of turn, on stones, off the board and suicide', () => {
    const game = from(['.b...', 'b....', '.....', '.....', '.....']);
    expect(game.error('b', 'place', { point: 3 })).toBe('Chưa tới lượt bạn');
    expect(game.error('a', 'place', { point: 1 })).toBe('Chỗ này đã có quân');
    expect(game.error('a', 'place', { point: 25 })).toBe('Nước đi không hợp lệ');
    game.send('a', 'place', { point: 3 });
    expect(game.error('b', 'place', { point: 0 })).toBe(
      'Không được đặt quân vào chỗ không còn khí',
    );
  });

  it('takes stones and counts them as prisoners', () => {
    const game = moves(fresh(), [0, 1], [0, 0], [1, 0]);
    expect(game.state.board[0]).toBe('.');
    expect(game.state.prisoners).toEqual({ b: 1, w: 0 });
    expect(game.state.last).toEqual({ side: 'b', point: 19, captured: [0] });
  });

  it('forbids taking a ko straight back, and allows it after a move elsewhere', () => {
    const game = from(['.bw..', 'bw.w.', '.bw..', '.....', '.....']);
    moves(game, [1, 2]);
    expect(game.state.ko).toBe(point(5, 1, 1));
    expect(game.error('b', 'place', { point: point(5, 1, 1) })).toBe(
      'Chưa được ăn lại ngay: đánh chỗ khác trước (cướp)',
    );
    moves(game, [4, 4], [4, 0]);
    expect(game.state.ko).toBeNull();
    expect(game.error('b', 'place', { point: point(5, 1, 1) })).toBeNull();
  });

  it('forbids bringing back an earlier position (superko)', () => {
    const rows = ['.bw..', 'bw.w.', '.bw..', '.....', '.....'];
    // The position after Black's move, as if it had come up before.
    const after = place(rows.join(''), 5, point(5, 1, 2), 'b');
    const game = from(rows, {}, [], [hashOf(after?.board ?? '')]);
    expect(game.error('a', 'place', { point: point(5, 1, 2) })).toBe(
      'Không được lặp lại thế cờ cũ',
    );
  });

  it('counts after two passes, with the dead stones marked and both agreeing', () => {
    const game = from(HALVES);
    moves(game, [2, 1], [4, 7], 'pass');
    expect(game.state.phase).toBe('play');
    moves(game, 'pass');
    expect(game.state.phase).toBe('scoring');
    expect(game.state.dead).toEqual([]);
    expect(game.error('a', 'place', { point: 0 })).toBe('Đang đếm điểm');
    // Nobody is dead (each extra stone sits in its own side's area): 4 columns against 5.
    game.send('a', 'accept');
    expect(game.error('a', 'accept')).toBe('Bạn đã đồng ý, chờ đối thủ');
    game.send('b', 'accept');
    expect(game.state.end).toEqual({
      reason: 'score',
      winner: 'w',
      score: { b: 36, w: 45 + KOMI },
    });
    expect(game.result).toEqual({ winners: ['b'] });
  });

  it('lets either player mark chains dead, which starts the agreeing over', () => {
    const game = from(HALVES);
    moves(game, 'pass', 'pass');
    game.send('a', 'accept');
    game.send('a', 'mark', { point: point(9, 0, 4) });
    // The whole white wall is marked, and Black's agreement is gone.
    expect(game.state.dead).toHaveLength(9);
    expect(game.state.accepted).toEqual([]);
    game.send('b', 'mark', { point: point(9, 8, 4) });
    expect(game.state.dead).toEqual([]);
    expect(game.error('a', 'mark', { point: 0 })).toBe('Hãy chạm vào quân');
  });

  it('goes back to playing when a player resumes', () => {
    const game = from(HALVES);
    moves(game, 'pass', 'pass');
    game.send('b', 'resume');
    expect(game.state).toMatchObject({ phase: 'play', passes: 0, dead: [], turn: 'b' });
    moves(game, [0, 0]);
    expect(game.state.board[0]).toBe('b');
  });

  it('gives the game to the other side on resigning or leaving', () => {
    const resigned = fresh().send('b', 'resign');
    expect(resigned.state.end).toEqual({ reason: 'resign', winner: 'b', score: null });
    expect(resigned.result).toEqual({ winners: ['a'] });
    const left = fresh().leave('a');
    expect(left.state.end).toEqual({ reason: 'left', winner: 'w', score: null });
  });

  it('shows everything but the position history', () => {
    const view = fresh().view(null) as View;
    expect(view).not.toHaveProperty('history');
    expect(view.board).toHaveLength(361);
  });

  it('asks the computer only in rooms against it, and it plays legal points', () => {
    expect(fresh().bot('b')).toBeNull();
    for (const level of ['easy', 'normal', 'hard'] as const) {
      const game = testGame(plugin, ['a', 'b'], {
        options: { opponent: 'bot', level },
        bots: ['b'],
      });
      expect(game.bot('b')).toBeNull(); // Black moves first
      moves(game, [2, 2]);
      const reply = game.bot('b') as { event: string; payload: { point: number } };
      expect(reply.event).toBe('place');
      expect(game.error('b', 'place', reply.payload)).toBeNull();
    }
  });

  it('lets the computer take stones in atari and save its own', () => {
    const take = from(
      ['.........', '...b.....', '..bwb....', '.........', ...Array(5).fill('.........')],
      { opponent: 'bot', level: 'hard' },
      ['a'],
    );
    expect(take.bot('a')).toEqual({ event: 'place', payload: { point: point(9, 3, 3) } });
    const save = from(
      ['.........', '...w.....', '..wbw....', '.........', ...Array(5).fill('.........')],
      { opponent: 'bot', level: 'hard' },
      ['a'],
    );
    expect(save.bot('a')).toEqual({ event: 'place', payload: { point: point(9, 3, 3) } });
  });

  it('lets the computer pass on a settled board, and hold to its guess while counting', () => {
    const game = from(HALVES, { opponent: 'bot', level: 'hard' }, ['b']);
    moves(game, 'pass');
    expect(game.bot('b')).toEqual({ event: 'pass' });
    game.send('b', 'pass');
    expect(game.state.phase).toBe('scoring');
    // Black marks White's living wall dead: the computer marks it alive again, then agrees.
    game.send('a', 'mark', { point: point(9, 0, 4) });
    const fix = game.bot('b') as { event: string; payload: { point: number } };
    expect(fix.event).toBe('mark');
    game.send('b', 'mark', fix.payload);
    expect(game.state.dead).toEqual([]);
    expect(game.bot('b')).toEqual({ event: 'accept' });
    game.send('b', 'accept');
    expect(game.bot('b')).toBeNull();
  });

  it('thinks quickly enough on a big board, and counts quickly too', () => {
    const game = testGame(plugin, ['a', 'b'], {
      options: { opponent: 'bot', level: 'hard' },
      bots: ['b'],
    });
    let slowest = 0;
    for (let i = 0; i < 15; i++) {
      // A quick opponent for the computer: the first empty point that is legal.
      const p = [...game.state.board].findIndex(
        (c, at) => c === '.' && !game.error('a', 'place', { point: at }),
      );
      game.send('a', 'place', { point: p });
      const started = Date.now();
      const reply = game.bot('b') as { event: string; payload?: object };
      slowest = Math.max(slowest, Date.now() - started);
      game.send('b', reply.event, reply.payload);
    }
    expect(slowest).toBeLessThan(800);
    const started = Date.now();
    moves(game, 'pass', 'pass');
    expect(game.state.phase).toBe('scoring');
    expect(Date.now() - started).toBeLessThan(3000);
  });
});
