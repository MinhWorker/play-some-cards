import { type StartContext, testGame } from '@psc/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';
import { ChessGame } from './ChessGame.js';
import { type Options, type Position, QUIET_LIMIT, type State, type View } from './model.js';
import { fromFen, legalMovesFrom, positionKey, squareOf } from './rules.js';

/** The game from a made-up position (FEN) instead of the opening one. */
class FromPosition extends ChessGame {
  private readonly pos: Position;
  constructor(
    fen: string,
    private readonly quiet = 0,
  ) {
    super();
    this.pos = fromFen(fen);
  }

  override onStart(ctx: StartContext<Options>): State {
    return {
      ...super.onStart(ctx),
      ...this.pos,
      quiet: this.quiet,
      history: [positionKey(this.pos)],
    };
  }
}

/** The part of a `testGame` session the helpers use. */
interface Game {
  readonly state: State;
  send(player: string, event: string, payload?: object): unknown;
}

/** The payload of a move written as "e2e4" (and "e7e8q" for a promotion). */
const move = (text: string) => ({
  from: squareOf(text.slice(0, 2)),
  to: squareOf(text.slice(2, 4)),
  ...(text[4] ? { promotion: text[4] } : {}),
});

/** Plays moves, each by whoever's turn it is. */
function moves<G extends Game>(game: G, ...list: string[]) {
  for (const text of list) {
    const player = game.state.players[game.state.turn === 'w' ? 0 : 1];
    game.send(player, 'move', move(text));
  }
  return game;
}

const fresh = (options: Partial<Options> = {}) => testGame(plugin, ['a', 'b'], { options });
const from = (fen: string, options: Partial<Options> = {}, bots: string[] = [], quiet = 0) =>
  testGame(new FromPosition(fen, quiet), ['a', 'b'], {
    options: { opponent: 'human', level: 'normal', swap: false, ...options },
    bots,
  });

describe('chess', () => {
  it('starts with a as White to move, or b after a swap', () => {
    expect(fresh().state).toMatchObject({ players: ['a', 'b'], turn: 'w', end: null });
    expect(fresh({ swap: true }).state).toMatchObject({ players: ['b', 'a'], turn: 'w' });
  });

  it('refuses moves out of turn, of the wrong pieces and against the rules', () => {
    const game = fresh();
    expect(game.error('b', 'move', move('e7e5'))).toBe('Chưa tới lượt bạn');
    expect(game.error('a', 'move', move('e7e5'))).toBe('Hãy chọn quân của bạn');
    expect(game.error('a', 'move', move('e2e5'))).toBe('Nước đi không đúng luật');
    expect(game.error('a', 'move', { ...move('e2e4'), promotion: 'q' })).toBe(
      'Nước đi không đúng luật',
    );
    expect(game.error('a', 'move', { from: 52, to: 64 })).toBe('Nước đi không hợp lệ');
    expect(game.error('a', 'move', move('e2e4'))).toBeNull();
  });

  it('plays a capture and remembers it', () => {
    const game = moves(fresh(), 'e2e4', 'd7d5', 'e4d5');
    expect(game.state.board[squareOf('d5')]).toBe('P');
    expect(game.state).toMatchObject({
      turn: 'b',
      captured: ['p'],
      quiet: 0,
      plies: 3,
      last: { ...move('e4d5'), captured: 'p', castle: false, enPassant: false },
    });
  });

  it('marks castling and en passant on the last move', () => {
    const castled = moves(from('r3k2r/8/8/8/8/8/8/R3K2R w KQkq -'), 'e1g1');
    expect(castled.state.last).toMatchObject({ castle: true, captured: null });
    const game = moves(fresh(), 'e2e4', 'a7a6', 'e4e5', 'd7d5', 'e5d6');
    expect(game.state.last).toMatchObject({ enPassant: true, captured: 'p' });
    expect(game.state.board[squareOf('d5')]).toBeNull();
  });

  it('needs a piece for a pawn reaching the last rank', () => {
    const game = from('8/4P3/8/8/8/8/k7/4K3 w - -');
    expect(game.error('a', 'move', move('e7e8'))).toBe('Hãy chọn quân để phong cấp');
    moves(game, 'e7e8r');
    expect(game.state.board[squareOf('e8')]).toBe('R');
  });

  it("ends in checkmate for the side that mated (fool's mate)", () => {
    const game = moves(fresh(), 'f2f3', 'e7e5', 'g2g4', 'd8h4');
    expect(game.state.end).toEqual({ reason: 'checkmate', winner: 'b' });
    expect(game.state.check).toBe(true);
    expect(game.result).toEqual({ winners: ['b'] });
    expect(game.error('a', 'resign')).toBe('Ván đã kết thúc');
  });

  it('draws by stalemate', () => {
    const game = moves(from('7k/8/6K1/8/8/8/8/5Q2 w - -'), 'f1f7');
    expect(game.state.end).toEqual({ reason: 'stalemate', winner: null });
    expect(game.result).toEqual({ winners: [] });
  });

  it('draws when nobody can mate any more', () => {
    const game = moves(from('8/8/4k3/8/8/3K4/4q3/8 w - -'), 'd3e2');
    expect(game.state.end).toEqual({ reason: 'material', winner: null });
  });

  it('draws when a position comes back a third time', () => {
    const game = fresh();
    const round = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];
    moves(game, ...round, ...round.slice(0, 3));
    expect(game.result).toBeNull();
    moves(game, 'f6g8');
    expect(game.state.end).toEqual({ reason: 'repetition', winner: null });
  });

  it('draws after 50 moves each without a capture or a pawn move', () => {
    const game = from('4k3/8/8/8/8/8/8/R3K3 w - -', {}, [], QUIET_LIMIT - 1);
    moves(game, 'a1a2');
    expect(game.state.end).toEqual({ reason: 'move-limit', winner: null });
  });

  it('handles a draw offer: accept, decline, or a move that turns it down', () => {
    const game = fresh();
    game.send('a', 'offer-draw');
    expect(game.state.drawOffer).toBe('w');
    expect(game.error('a', 'offer-draw')).toBe('Bạn đã xin hoà, chờ đối thủ trả lời');
    expect(game.error('a', 'decline-draw')).toBe('Không có lời xin hoà nào');
    // White's offer outlives White's own move; Black's move turns it down.
    moves(game, 'e2e4');
    expect(game.state.drawOffer).toBe('w');
    moves(game, 'e7e5');
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
    expect(resigned.state.end).toEqual({ reason: 'resign', winner: 'w' });
    expect(resigned.result).toEqual({ winners: ['a'] });
    const left = fresh().leave('a');
    expect(left.state.end).toEqual({ reason: 'left', winner: 'b' });
    expect(left.result).toEqual({ winners: ['b'] });
  });

  it('shows everything but the repetition bookkeeping', () => {
    const view = fresh().view(null) as View;
    expect(view).not.toHaveProperty('history');
    expect(view.board).toHaveLength(64);
  });

  it('asks the computer only in rooms against it, and it plays legal moves', () => {
    expect(fresh().bot('b')).toBeNull();
    for (const level of ['easy', 'normal', 'hard'] as const) {
      const game = testGame(plugin, ['a', 'b'], {
        options: { opponent: 'bot', level },
        bots: ['b'],
      });
      expect(game.bot('b')).toBeNull(); // White moves first
      moves(game, 'e2e4');
      const reply = game.bot('b') as { event: string; payload: { from: number; to: number } };
      expect(reply.event).toBe('move');
      expect(legalMovesFrom(game.state, reply.payload.from)).toContainEqual(reply.payload);
      game.send('b', 'move', reply.payload);
    }
  });

  it('lets the computer take a hanging queen and find a mate in one', () => {
    const hanging = from('4k3/8/8/3q4/8/8/3R4/4K3 w - -', { opponent: 'bot', level: 'easy' }, [
      'a',
    ]);
    expect(hanging.bot('a')).toEqual({ event: 'move', payload: move('d2d5') });
    const mate = from('6k1/5ppp/8/8/8/8/8/R5K1 w - -', { opponent: 'bot', level: 'normal' }, ['a']);
    expect(mate.bot('a')).toEqual({ event: 'move', payload: move('a1a8') });
  });

  it('thinks quickly enough on its hardest level', () => {
    const game = testGame(plugin, ['a', 'b'], {
      options: { opponent: 'bot', level: 'hard' },
      bots: ['b'],
    });
    moves(game, 'e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'd2d3');
    const started = Date.now();
    expect(game.bot('b')).not.toBeNull();
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
