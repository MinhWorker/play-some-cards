import { expect, it } from 'vitest';
import { BOARD } from '../../game/model.js';
import { monopolyMarks } from './MonopolySymbols.js';

const deeds = () =>
  BOARD.map(() => ({ owner: null as number | null, houses: 0, mortgaged: false }));

it('lights exactly one moon/sun pair for two same-owner streets, then both pairs for a full set', () => {
  const properties = deeds();
  const lit = () =>
    monopolyMarks(properties)
      .filter((mark) => mark.lit)
      .map(({ square, kind }) => [square, kind]);
  expect(lit()).toEqual([]);
  properties[1]!.owner = 0;
  expect(lit()).toEqual([]);
  properties[2]!.owner = 0;
  expect(lit()).toEqual([
    [1, 'sun'],
    [2, 'moon'],
  ]);
  properties[3]!.owner = 0;
  expect(lit()).toEqual([
    [1, 'sun'],
    [2, 'sun'],
    [2, 'moon'],
    [3, 'moon'],
  ]);
  properties[2]!.owner = 1;
  expect(lit()).toEqual([
    [1, 'sun'],
    [3, 'moon'],
  ]);
});

it('connects separated group members and clears links after a sale', () => {
  const properties = deeds();
  properties[6]!.owner = properties[8]!.owner = 1;
  expect(
    monopolyMarks(properties)
      .filter((mark) => mark.lit)
      .map((mark) => mark.square),
  ).toEqual([6, 8]);
  properties[8]!.owner = null;
  expect(monopolyMarks(properties).some((mark) => mark.lit)).toBe(false);
});
