import { testGame } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';
import { CHANCE } from './cards.js';
import { BOARD, GROUP_COLORS, groupSquares } from './model.js';
import { move } from './rules.js';

describe('clockwise Vietnamese board', () => {
  it('has six correctly priced streets on every side and two squares for each deck', () => {
    const sides = [
      [
        ['Phú Quốc', 200],
        ['Lào Cai', 150],
        ['Việt Trì', 180],
        ['Hạ Long', 280],
        ['Hải Phòng', 320],
        ['Hà Nội', 350],
      ],
      [
        ['Hải Dương', 220],
        ['Thái Bình', 260],
        ['Nam Định', 240],
        ['Thanh Hóa', 270],
        ['Vinh', 260],
        ['Hà Tĩnh', 170],
      ],
      [
        ['Huế', 270],
        ['Đà Nẵng', 300],
        ['Hội An', 250],
        ['Kon Tum', 140],
        ['Pleiku', 160],
        ['Đà Lạt', 270],
      ],
      [
        ['Nha Trang', 280],
        ['Vũng Tàu', 260],
        ['Biên Hòa', 220],
        ['Tp. HCM', 350],
        ['Cần Thơ', 300],
        ['Cà Mau', 180],
      ],
    ];
    sides.forEach((expected, side) => {
      const streets = BOARD.slice(side * 10 + 1, side * 10 + 10).filter(
        (cell) => cell.kind === 'street',
      );
      expect(streets.map((cell) => [cell.name, cell.price])).toEqual(expected);
    });
    expect(BOARD.flatMap((cell, i) => (cell.kind === 'chest' ? [i] : []))).toEqual([17, 33]);
    expect(BOARD.flatMap((cell, i) => (cell.kind === 'chance' ? [i] : []))).toEqual([7, 22]);
    for (const group of Object.keys(GROUP_COLORS) as (keyof typeof GROUP_COLORS)[]) {
      const squares = groupSquares(group);
      expect(squares).toHaveLength(3);
    }
    for (const card of CHANCE) {
      if (card.kind === 'move' && card.target !== 0)
        expect(card.text).toBe(`Tới ${BOARD[card.target]!.name}.`);
    }
  });

  it('preserves the original position of every named square', () => {
    expect(BOARD.map((cell) => cell.name)).toEqual([
      'Xuất phát',
      'Phú Quốc',
      'Lào Cai',
      'Việt Trì',
      'Thuế thu nhập',
      'Bến Bắc',
      'Hạ Long',
      'Cơ hội',
      'Hải Phòng',
      'Hà Nội',
      'Nhà tù',
      'Hải Dương',
      'Điện lực',
      'Thái Bình',
      'Nam Định',
      'Bến Tây',
      'Thanh Hóa',
      'Khí vận',
      'Vinh',
      'Hà Tĩnh',
      'Sân bay',
      'Huế',
      'Cơ hội',
      'Đà Nẵng',
      'Hội An',
      'Bến Nam',
      'Kon Tum',
      'Pleiku',
      'Cấp nước',
      'Đà Lạt',
      'Vào tù',
      'Nha Trang',
      'Vũng Tàu',
      'Khí vận',
      'Biên Hòa',
      'Bến Đông',
      'Tp. HCM',
      'Cần Thơ',
      'Thuế xa xỉ',
      'Cà Mau',
    ]);
    expect(
      Object.keys(GROUP_COLORS).map((group) => groupSquares(group as keyof typeof GROUP_COLORS)),
    ).toEqual([
      [1, 2, 3],
      [6, 8, 9],
      [11, 13, 14],
      [16, 18, 19],
      [21, 23, 24],
      [26, 27, 29],
      [31, 32, 34],
      [36, 37, 39],
    ]);
  });

  it('charges more for building and rent at every level when the purchase price is higher', () => {
    const streets = BOARD.filter((cell) => cell.kind === 'street');
    for (const cheaper of streets) {
      expect(cheaper.rent).toHaveLength(6);
      for (let level = 1; level < 6; level++)
        expect(cheaper.rent![level]).toBeGreaterThan(cheaper.rent![level - 1]!);
      for (const dearer of streets) {
        if (cheaper.price! >= dearer.price!) continue;
        expect(dearer.houseCost).toBeGreaterThan(cheaper.houseCost!);
        cheaper.rent!.forEach((amount, level) => {
          expect(dearer.rent![level]).toBeGreaterThan(amount);
        });
      }
    }
  });

  it.each([2, 36])(
    'lets players buy the new street %s and build only on a return visit',
    (square) => {
      const game = testGame(plugin, ['a', 'b']);
      const cell = BOARD[square]!;
      move(game.state, 0, square, false, 7);
      expect(game.state.phase).toBe('buy');
      game.send('a', 'buy');
      expect(game.state.players[0]!.cash).toBe(1000 - cell.price!);
      expect(game.error('a', 'build', { square })).toBeTruthy();
      move(game.state, 0, square, false, 7);
      game.send('a', 'build', { square });
      expect(game.state.players[0]!.cash).toBe(1000 - cell.price! - cell.houseCost!);
      const before = game.state.players[0]!.cash;
      move(game.state, 1, square, false, 7);
      expect(game.state.players[0]!.cash).toBe(before + cell.rent![1]!);
    },
  );
});
