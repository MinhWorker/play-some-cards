import { testGame } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';
import { bestRows } from './arrange.js';
import type { Rows } from './cards.js';
import { standings } from './match.js';
import { type Options, revealMs, type State, type View } from './model.js';

const PLAYERS = ['a', 'b', 'c', 'd'];

/** A match with the deal over (the `begin` timer fired): everyone is arranging. */
function start(players = PLAYERS, options: Partial<Options> = {}, seed = 1) {
  const game = testGame(plugin, players, { options, seed });
  expect(game.state.phase).toBe('deal');
  expect(game.timer?.event).toBe('begin');
  return game.fireTimer();
}

type Session = ReturnType<typeof start>;
const handOf = (game: Session, id: string) => game.state.hands[PLAYERS.indexOf(id)] ?? [];
/** Everyone in `players` hands in the computer's rows. */
function submitAll(game: Session, players: string[]) {
  for (const id of players) game.send(id, 'submit', { rows: bestRows(handOf(game, id)) });
  return game;
}

describe('mậu binh', () => {
  it('deals 13 cards each and waits for the deal before arranging', () => {
    const game = testGame(plugin, PLAYERS);
    expect(game.state.hands.map((h) => h.length)).toEqual([13, 13, 13, 13]);
    expect(new Set(game.state.hands.flat()).size).toBe(52);
    const rows = bestRows(game.state.hands[0] ?? []);
    expect(game.error('a', 'submit', { rows })).toBe('Chưa tới lúc xếp bài');
    game.fireTimer();
    expect(game.state.phase).toBe('arrange');
    expect(game.timer).toEqual({ event: 'arrange-over', ms: 90_000 });
  });

  it('only takes rows made of your own 13 cards', () => {
    const game = start();
    const mine = bestRows(handOf(game, 'a'));
    const theirs = bestRows(handOf(game, 'b'));
    expect(game.error('a', 'submit', { rows: theirs })).toBe('Bài xếp không đúng');
    const twice = [mine[0], mine[0], mine[2]];
    expect(game.error('a', 'submit', { rows: twice })).toBe('Bài xếp không đúng');
    expect(game.error('a', 'cancel')).toBe('Bạn chưa xếp xong');
    game.send('a', 'submit', { rows: mine });
    expect((game.view('a') as View).mine).toEqual(mine);
    game.send('a', 'cancel');
    expect((game.view('a') as View).ready).toEqual([false, false, false, false]);
  });

  it('keeps hands and rows secret until everyone is done', () => {
    const game = start();
    const rows = bestRows(handOf(game, 'a'));
    game.send('a', 'submit', { rows });
    expect((game.view('b') as View).ready).toEqual([true, false, false, false]);
    for (const other of ['b', 'c', 'd', null]) {
      game.assertHidden(other, handOf(game, 'a'), rows[0], rows[1], rows[2]);
    }
    game.assertHidden(null, handOf(game, 'b'));
    submitAll(game, ['b', 'c', 'd']);
    expect(game.state.phase).toBe('show');
    // Shown now: everyone's rows are in the result.
    expect(game.state.results[0]?.rows[0]).toEqual(rows);
  });

  it('scores the round when everyone is done, then deals the next one', () => {
    const game = submitAll(start(PLAYERS, { rounds: 3 }), PLAYERS);
    const result = game.state.results[0];
    expect(result?.duels).toHaveLength(6);
    expect(result?.points.reduce((a, b) => a + b)).toBe(0);
    expect(game.state.points).toEqual(result?.points);
    expect(game.timer?.event).toBe('next-round');
    expect(game.timer?.ms).toBeGreaterThan(revealMs(result as State['results'][number]));
    game.fireTimer();
    expect(game.state).toMatchObject({ round: 2, phase: 'deal' });
    expect(game.state.rows).toEqual([null, null, null, null]);
  });

  it("gives who runs out of time the computer's rows", () => {
    const game = start(['a', 'b'], { arrangeSeconds: 60 });
    game.send('a', 'submit', { rows: bestRows(handOf(game, 'a')) });
    game.fireTimer();
    expect(game.state.phase).toBe('show');
    expect(game.state.results[0]).toMatchObject({ auto: [false, true], fouls: [false, false] });
  });

  it('lets binh lủng be handed in, and it loses 6 to everyone', () => {
    const game = start(['a', 'b', 'c']);
    const [one, two, three] = bestRows(handOf(game, 'a'));
    // The weaker chi 2 on the bottom: binh lủng (unless both are equal).
    game.send('a', 'submit', { rows: [two, one, three] as Rows });
    submitAll(game, ['b', 'c']);
    const result = game.state.results[0];
    if (result?.specials.some(Boolean)) return;
    if (result?.fouls[0]) expect(result.points[0]).toBe(-12);
  });

  it('computer players hand in valid rows at once', () => {
    const game = testGame(plugin, ['a', 'bot1', 'bot2'], { bots: ['bot1', 'bot2'] }).fireTimer();
    for (const bot of ['bot1', 'bot2']) {
      const move = game.bot(bot);
      expect(move?.event).toBe('submit');
      game.send(bot, 'submit', move?.payload as object);
      expect(game.bot(bot)).toBeNull();
    }
    expect(game.state.phase).toBe('arrange');
  });

  it('ends the match after its last round, the most points winning (ties share)', () => {
    const game = start(PLAYERS, { rounds: 2 });
    submitAll(game, PLAYERS).fireTimer().fireTimer();
    submitAll(game, PLAYERS);
    expect(game.result).toBeNull();
    expect(game.timer?.event).toBe('finish');
    game.fireTimer();
    const best = Math.max(...game.state.points);
    const expected = PLAYERS.filter((_, s) => game.state.points[s] === best);
    expect(game.result?.winners).toEqual(expected);
  });

  it('makes who leaves lose the round, and plays on without them', () => {
    const game = start(PLAYERS, { rounds: 2 });
    game.leave('b');
    submitAll(game, ['a', 'c', 'd']);
    const result = game.state.results[0];
    expect(result?.forfeits).toEqual([false, true, false, false]);
    // b loses 6 to each of the three (unless someone has tới trắng).
    if (!result?.specials.some(Boolean)) expect(result?.points[1]).toBe(-18);
    game.fireTimer();
    expect(game.state.inRound).toEqual([true, false, true, true]);
    expect(standings(game.state).at(-1)).toBe(1);
  });

  it('ends the match when fewer than two players are left', () => {
    const game = start(['a', 'b']);
    game.leave('b');
    expect(game.state.phase).toBe('show');
    game.fireTimer();
    expect(game.result?.winners).toEqual(['a']);
  });
});
