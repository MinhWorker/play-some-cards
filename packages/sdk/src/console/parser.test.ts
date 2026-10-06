/** The tokenizer keeps source locations and handles typed values without eval. */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  ConsoleError,
  consoleArgs,
  getStatePath,
  parseConsoleLine,
  resolveValue,
  setStatePath,
} from './parser.js';

describe('console parser', () => {
  it('keeps semicolons inside quoted strings and JSON', () => {
    const commands = parseConsoleLine('state set x {"a": [true, null, "a;b"]}; help "a b"');
    expect(commands).toHaveLength(2);
    expect(commands[0]?.tokens[2]?.value).toEqual({ a: [true, null, 'a;b'] });
    expect(commands[1]?.tokens[0]?.value).toBe('a b');
  });
  it('parses primitives and escaped quotes', () => {
    expect(
      parseConsoleLine('x 1 -2.5 false null "a\\"b" bare')[0]?.tokens.map((t) => t.value),
    ).toEqual([1, -2.5, false, null, 'a"b', 'bare']);
  });
  it('rejects broken JSON and gives the offending span', () => {
    for (const line of ['x [1}', 'x "unfinished', 'x {bad}'])
      expect(() => parseConsoleLine(line)).toThrow(ConsoleError);
    try {
      parseConsoleLine('help; x "open');
    } catch (err) {
      expect((err as ConsoleError).issue.at).toBe(8);
    }
  });
  it('maps positional and named fields, applies defaults and rejects extras and duplicates', () => {
    const schema = z.object({
      seat: z.int(),
      amount: z.int().min(1).max(6),
      note: z.string().default(''),
    });
    const args = (line: string) =>
      consoleArgs(schema, parseConsoleLine(line)[0]!.tokens, {}, 'dice');
    expect(args('dice 1 amount=3 note="a b"')).toEqual({ seat: 1, amount: 3, note: 'a b' });
    expect(args('dice 1 2')).toEqual({ seat: 1, amount: 2, note: '' });
    expect(() => args('dice 1 0')).toThrow('từ 1 tới 6');
    for (const line of ['dice 1 seat=2', 'dice unknown=1', 'dice 1 2 x extra'])
      expect(() => args(line)).toThrow(ConsoleError);
  });
  it('resolves catalogs recursively and explains unknown ids', () => {
    const catalogs = { square: [{ id: 'san-bay', value: 20, label: 'Sân bay' }] };
    expect(resolveValue(['@square:san-bay', { target: '@square:san-bay' }], catalogs)).toEqual([
      20,
      { target: 20 },
    ]);
    expect(() => resolveValue('@square:sanbay', catalogs)).toThrow('bấm Tab');
  });
  it('copies state and blocks prototype traversal and array overflow', () => {
    const state = { players: [{ cash: 2 }] };
    expect(setStatePath(state, 'players.0.cash', 5)).toEqual({ players: [{ cash: 5 }] });
    expect(getStatePath(state, 'players.0.cash')).toBe(2);
    for (const path of [
      '__proto__.x',
      'constructor.prototype.x',
      'players.9.cash',
      'players.-1',
      'players..cash',
    ])
      expect(() => setStatePath(state, path, 1)).toThrow(ConsoleError);
    expect(() => getStatePath(state, 'missing')).toThrow('Không có đường dẫn');
  });
});
