/** Optional console schemas and stable references to board squares and cards. */
import { catalog } from '@xomdao/sdk';
import { z } from 'zod';
import { CHANCE, CHEST } from './cards.js';
import { BOARD } from './model.js';

const squareIds = [
  'xuat-phat',
  'phu-quoc',
  'lao-cai',
  'viet-tri',
  'thue-thu-nhap',
  'ben-bac',
  'ha-long',
  'co-hoi-7',
  'hai-phong',
  'ha-noi',
  'nha-tu',
  'hai-duong',
  'dien-luc',
  'thai-binh',
  'nam-dinh',
  'ben-tay',
  'thanh-hoa',
  'khi-van-17',
  'vinh',
  'ha-tinh',
  'san-bay',
  'hue',
  'co-hoi-22',
  'da-nang',
  'hoi-an',
  'ben-nam',
  'kon-tum',
  'pleiku',
  'cap-nuoc',
  'da-lat',
  'vao-tu',
  'nha-trang',
  'vung-tau',
  'khi-van-33',
  'bien-hoa',
  'ben-dong',
  'tp-hcm',
  'can-tho',
  'thue-xa-xi',
  'ca-mau',
];
const chanceIds = [
  'start',
  'nearest-station',
  'nearest-utility',
  'ca-mau',
  'vinh',
  'bank-interest',
  'dividend',
  'speeding',
  'repairs',
  'jail',
  'free',
  'prize',
  'power-shortage',
  'water-shortage',
];
const chestIds = [
  'start',
  'bank-profit',
  'tax-refund',
  'gift',
  'medical',
  'tuition',
  'shares',
  'inheritance',
  'repairs',
  'jail',
  'free',
  'prize',
];
const cardRef = z.object({ deck: z.enum(['chance', 'chest']), index: z.int().nonnegative() });
export type CardRef = z.infer<typeof cardRef>;
export const catalogs = {
  square: BOARD.map((square, value) => ({ id: squareIds[value]!, value, label: square.name })),
  card: [
    ...CHANCE.map((card, index) => ({
      id: `chance-${chanceIds[index]}`,
      value: { deck: 'chance', index },
      label: `Cơ hội: ${card.text}`,
    })),
    ...CHEST.map((card, index) => ({
      id: `chest-${chestIds[index]}`,
      value: { deck: 'chest', index },
      label: `Khí vận: ${card.text}`,
    })),
  ],
};
export const commands = {
  dice: z
    .object({ a: z.int().min(1).max(6), b: z.int().min(1).max(6) })
    .describe('Đặt kết quả xúc xắc lần đổ tới'),
  tp: z
    .object({ seat: z.int().min(0).max(3), square: catalog('square', z.int().min(0).max(39)) })
    .describe('Đưa một người chơi tới một ô'),
  cash: z
    .object({ seat: z.int().min(0).max(3), amount: z.int().min(0).max(1_000_000_000) })
    .describe('Đặt số tiền của một người chơi'),
  card: z
    .object({ card: catalog('card', cardRef) })
    .describe('Rút một lá định trước cho người đang tới lượt'),
};
