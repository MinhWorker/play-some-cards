/** Dynamic suggestions follow each game's JSON Schema and preserve source replacement spans. */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { commandUsage, completeConsoleLine } from './completion.js';
import { catalog } from './definitions.js';
import type { DevConsoleSchema } from './parser.js';

const schema: DevConsoleSchema = {
  commands: [
    ...['help', 'state', 'as', 'snapshot', 'timer'].map((name) => ({
      name,
      usage: name,
      description: name,
      kind: 'engine' as const,
    })),
    {
      name: 'dice',
      kind: 'game',
      usage: 'dice',
      description: 'Xúc xắc',
      parameters: z.toJSONSchema(z.object({ a: z.int().min(1).max(6), b: z.int().min(1).max(6) })),
    },
    {
      name: 'tp',
      kind: 'game',
      usage: 'tp',
      description: 'Đưa tới ô',
      parameters: z.toJSONSchema(z.object({ seat: z.int(), square: catalog('square') })),
    },
    {
      name: 'as bid',
      kind: 'event',
      usage: 'as bid',
      description: 'Đấu giá',
      parameters: z.toJSONSchema(
        z.object({ amount: z.literal([10, 20]), ready: z.boolean().default(true) }),
      ),
    },
  ],
  catalogs: { square: ['san-bay'] },
  catalogLabels: { square: { 'san-bay': 'Sân bay' } },
  statePaths: ['players.0.position'],
  snapshots: ['x'],
};
const seats = [{ name: 'An' }, { name: 'Bình' }];
const complete = (line: string) => completeConsoleLine(line, schema, seats);
describe('console completion', () => {
  it('suggests names, seats, catalog labels and numeric limits in positional order', () => {
    expect(complete('di').suggestions[0]?.value).toBe('dice');
    expect(complete('dice 1 ').parameter).toBe('b');
    expect(complete('dice 1 ').suggestions.map((s) => s.value)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
    ]);
    expect(complete('tp ').suggestions[1]?.label).toContain('Bình');
    expect(complete('tp 1 @square:s').suggestions[0]).toMatchObject({
      value: '@square:san-bay',
      label: '@square:san-bay · Sân bay',
    });
    expect(commandUsage(schema.commands.find((c) => c.name === 'dice')!)).toContain('<b: 1–6>');
  });
  it('suggests named arguments and game event enums/booleans', () => {
    expect(complete('dice b=').suggestions[0]?.value).toBe('b=1');
    expect(complete('dice b=2 a=').parameter).toBe('a');
    expect(complete('as 1 ').suggestions[0]?.value).toBe('bid');
    expect(complete('as 1 bid ').suggestions.map((s) => s.value)).toEqual(['10', '20']);
    expect(complete('as 1 bid 10 ').suggestions.map((s) => s.value)).toEqual(['true', 'false']);
  });
  it('completes engine paths and snapshot names, and handles chains and incomplete JSON', () => {
    expect(complete('state get p').suggestions[0]?.value).toBe('players.0.position');
    expect(complete('snapshot load ').suggestions[0]?.value).toBe('x');
    expect(complete('help; tp 1 @square:s').suggestions[0]?.from).toBe(11);
    expect(complete('help; ').suggestions.some((s) => s.value === 'dice')).toBe(true);
    expect(complete('dice {').suggestions).toEqual([]);
  });
});
