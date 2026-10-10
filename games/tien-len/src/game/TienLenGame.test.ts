import { testGame } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';
import { comboOf } from './cards.js';
import { standings } from './match.js';
import { type Options, type State, WIN_COINS } from './model.js';

const PLAYERS = ['a', 'b', 'c', 'd'];
type Session = ReturnType<typeof testGame<State, unknown, Options>>;

/** A match with the deal over (the `begin` timer fired). */
function start(players = PLAYERS, options: Partial<Options> = {}, seed = 1) {
  const game = testGame(plugin, players, { options, seed });
  expect(game.timer?.event).toBe('begin');
  return game.fireTimer();
}

/** The computer plays every seat until the round is over. */
function playRound(game: Session, players: string[]) {
  for (let i = 0; i < 800 && game.state.phase === 'play'; i++) {
    const id = players[game.state.turn] as string;
    const move = game.bot(id);
    if (!move) throw new Error(`the computer had no move for ${id}`);
    game.send(id, move.event, move.payload as object);
  }
  return game;
}

describe('tiến lên', () => {
  it('deals 13 cards each, then the holder of 3♠ leads with it', () => {
    const game = testGame(plugin, PLAYERS);
    expect(game.state).toMatchObject({ round: 1, phase: 'deal' });
    expect(game.state.hands.map((h) => h.length)).toEqual([13, 13, 13, 13]);
    expect(new Set(game.state.hands.flat()).size).toBe(52);
    expect(game.error(PLAYERS[game.state.lead] as string, 'play', { cards: [0] })).toBe(
      'Chưa tới lúc đánh',
    );
    game.fireTimer();
    expect(game.state.phase).toBe('play');
    expect(game.state.hands[game.state.turn]).toContain(0);
    expect(game.state.mustPlay).toBe(0);
  });

  it('checks turn, cards and combinations', () => {
    const game = start();
    const me = PLAYERS[game.state.turn] as string;
    const other = PLAYERS[(game.state.turn + 1) % 4] as string;
    const hand = game.state.hands[game.state.turn] as number[];
    const notMine = game.state.hands[(game.state.turn + 1) % 4]?.[0] as number;
    expect(game.error(other, 'play', { cards: [notMine] })).toBe('Chưa tới lượt bạn');
    expect(game.error(me, 'play', { cards: [notMine] })).toBe('Bạn không có lá đó');
    expect(game.error(me, 'play', { cards: [hand[12] as number] })).toBe(
      'Lượt đầu phải đánh cả lá 3♠',
    );
    expect(game.error(me, 'pass')).toBe('Bạn đang cầm vòng, phải đánh');
    expect(game.error(me, 'play', { cards: [0, hand[12] as number] })).toBe(
      'Các lá này không thành bộ',
    );
    game.send(me, 'play', { cards: [0] });
    expect(game.state.table).toMatchObject({ cards: [0], kind: 'single' });
    expect(game.state.turn).toBe((PLAYERS.indexOf(me) + 1) % 4);
  });

  it('starts a new trick when everyone else passes', () => {
    const game = start();
    const leader = game.state.turn;
    game.send(PLAYERS[leader] as string, 'play', { cards: [0] });
    for (let i = 1; i < 4; i++) game.send(PLAYERS[(leader + i) % 4] as string, 'pass');
    expect(game.state).toMatchObject({ turn: leader, table: null, trick: 1 });
    expect(game.state.passed).toEqual([false, false, false, false]);
  });

  it('shows you only your own cards', () => {
    const game = start();
    const view = game.view('a') as { hand: number[]; counts: number[] };
    expect(view.hand).toEqual(game.state.hands[0]);
    expect(view.counts).toEqual([13, 13, 13, 13]);
    for (const seat of [1, 2, 3]) game.assertHidden('a', game.state.hands[seat]);
    for (const seat of [0, 1, 2, 3]) game.assertHidden(null, game.state.hands[seat]);
  });

  it('ranks everyone before a round ends, and gives points by rank', () => {
    for (const count of [2, 3, 4]) {
      const players = PLAYERS.slice(0, count);
      const game = playRound(start(players, { rounds: 3 }, count), players);
      const [result] = game.state.results;
      expect(game.state.phase).toBe('over');
      expect([...(result?.order ?? [])].sort()).toEqual(players.map((_, s) => s));
      // 4 players: 3, 2, 1, 0 points.
      result?.order.forEach((seat, place) => {
        expect(result.points[seat]).toBe(count - 1 - place);
      });
      expect(result?.leftover.length).toBeGreaterThan(0);
      for (const play of game.state.played) expect(comboOf(play.cards)).not.toBeNull();
      // The next round is dealt after a pause, led by the round's winner.
      expect(game.timer?.event).toBe('next-round');
      game.fireTimer().fireTimer();
      expect(game.state).toMatchObject({ round: 2, phase: 'play', mustPlay: null });
      expect(game.state.turn).toBe(result?.order[0]);
    }
  });

  it('ends the match after its last round, with the most points winning', () => {
    const game = start(PLAYERS, { rounds: 2 });
    playRound(game, PLAYERS).fireTimer().fireTimer();
    playRound(game, PLAYERS);
    expect(game.state.results).toHaveLength(2);
    const best = standings(game.state)[0] as number;
    expect(game.result?.winners).toEqual([PLAYERS[best]]);
    expect(game.result?.rewards).toEqual([
      { player: PLAYERS[best], resource: 'core:coin', amount: WIN_COINS },
    ]);
    expect(game.state.points[best]).toBe(Math.max(...game.state.points));
    expect(game.state.points.reduce((a, b) => a + b)).toBe(2 * (3 + 2 + 1));
  });

  it('counts each chặt as a stat for the "Chặt heo" achievement', () => {
    const chops: string[] = [];
    for (let seed = 1; seed <= 40 && !chops.length; seed++) {
      const game = playRound(start(PLAYERS, { rounds: 1 }, seed), PLAYERS);
      for (const stat of game.result?.stats ?? []) {
        expect(stat).toMatchObject({ name: 'chop', amount: 1 });
        chops.push(stat.player);
      }
    }
    expect(chops.length).toBeGreaterThan(0);
    expect(PLAYERS).toEqual(expect.arrayContaining(chops));
  });

  it('runs a turn clock only with two or more people', () => {
    const people = start(PLAYERS, { turnSeconds: 15 });
    expect(people.timer).toEqual({ event: 'turn-over', ms: 15000 });
    // Time's up while leading: the lowest card (3♠) goes down.
    people.fireTimer();
    expect(people.state.played[0]?.cards).toEqual([0]);
    // Time's up while following: a pass.
    const next = people.state.turn;
    people.fireTimer();
    expect(people.state.passed[next]).toBe(true);

    const withBot = testGame(plugin, ['a', 'bot'], { bots: ['bot'] }).fireTimer();
    expect(withBot.state.phase).toBe('play');
    expect(withBot.timer).toBeNull();
  });

  it('puts who leaves below everyone still holding cards, and plays on', () => {
    const game = start();
    const first = PLAYERS[(game.state.turn + 1) % 4] as string;
    game.leave(first);
    expect(game.state.sunk).toEqual([PLAYERS.indexOf(first)]);
    const second = PLAYERS[(PLAYERS.indexOf(first) + 1) % 4] as string;
    game.leave(second);
    const rest = PLAYERS.filter((p) => p !== first && p !== second);
    playRound(game, PLAYERS);
    const order = game.state.results[0]?.order ?? [];
    expect(order.slice(2)).toEqual([PLAYERS.indexOf(second), PLAYERS.indexOf(first)]);
    expect(game.state.results[0]?.points[PLAYERS.indexOf(second)]).toBe(0);
    // Two people left at the table: the match goes on, dealt to them only.
    expect(game.result).toBeNull();
    game.fireTimer();
    expect(game.state.hands.filter((h) => h.length > 0)).toHaveLength(2);
    expect(standings(game.state).slice(2)).toEqual([
      PLAYERS.indexOf(second),
      PLAYERS.indexOf(first),
    ]);
    expect(rest).toHaveLength(2);
  });

  it('ends the match when fewer than two players are left', () => {
    const game = start(['a', 'b']);
    game.leave('b');
    expect(game.result?.winners).toEqual(['a']);
    // a never emptied their hand: they placed first holding cards, no "thối heo" at the bottom.
    expect(game.state.results[0]).toMatchObject({ order: [0, 1], holder: 0 });
    expect(standings(game.state)).toEqual([0, 1]);
  });

  it('frees the first play when the holder of 3♠ leaves before playing it', () => {
    const game = testGame(plugin, PLAYERS);
    const holder = PLAYERS[game.state.lead] as string;
    game.leave(holder);
    game.fireTimer();
    expect(game.state.mustPlay).toBeNull();
    expect(game.state.turn).not.toBe(PLAYERS.indexOf(holder));
    expect(game.state.hands[game.state.turn]?.length).toBe(13);
  });

  it("a new match is led by the last match's winner", () => {
    const game = start(['a', 'b'], { rounds: 1 });
    playRound(game, ['a', 'b']);
    const winner = game.result?.winners[0] as string;
    game.newGame().fireTimer();
    expect(game.state.turn).toBe(['a', 'b'].indexOf(winner));
    expect(game.state.mustPlay).toBeNull();
  });
});
