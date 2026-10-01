import { z } from 'zod';
import type { Card, Deck } from './cards.js';

export const optionsSchema = z.object({
  bots: z.number().int().min(0).max(3).default(0),
});
export type Options = z.infer<typeof optionsSchema>;

export type Group = 'nau' | 'xanh-nhat' | 'hong' | 'cam' | 'do' | 'vang' | 'xanh-la' | 'xanh-dam';
export type DeedKind = 'street' | 'station' | 'utility';
export type SquareKind =
  | DeedKind
  | 'start'
  | 'chance'
  | 'chest'
  | 'tax'
  | 'jail'
  | 'free'
  | 'go-jail';

export interface Square {
  name: string;
  kind: SquareKind;
  price?: number;
  group?: Group;
  rent?: readonly number[];
  houseCost?: number;
  tax?: number;
}

export interface Property {
  owner: number | null;
  /** 0–4 houses; 5 is a hotel. */
  houses: number;
  mortgaged: boolean;
}

export interface TycoonPlayer {
  cash: number;
  position: number;
  jailed: boolean;
  jailRolls: number;
  freeCards: ('chance' | 'chest')[];
  bankrupt: boolean;
}

export type Phase = 'roll' | 'buy' | 'auction' | 'debt' | 'trade' | 'event' | 'end';

export interface Auction {
  square: number;
  bidder: number;
  highest: number;
  leader: number | null;
  passed: number[];
}

export interface Debt {
  amount: number;
  creditor: number | null;
  reason: string;
  /** The phase to continue after payment; a double may grant another roll. */
  after: 'roll' | 'end';
  /** Third failed jail roll moves after the bail is paid. */
  moveAfter?: number;
}

export interface Trade {
  from: number;
  to: number;
  give: number | null;
  take: number | null;
  giveCash: number;
  takeCash: number;
  resume: Phase;
}

export interface MoneyTransfer {
  /** null represents the bank. */
  from: number | null;
  to: number | null;
  amount: number;
  reason: string;
}

export const SPECIAL_EVENT_TIMEOUT = 8000;

export type SpecialEventEffect =
  | { kind: 'card'; card: Card; deck: Deck; roll: number }
  | { kind: 'tax'; amount: number; reason: string }
  | { kind: 'jail'; reason: string };

export type SpecialEvent = SpecialEventEffect & { id: number; ready: boolean };

export interface State {
  specialEvent: SpecialEvent | null;
  moneySequence: number;
  transfers: MoneyTransfer[];
  players: TycoonPlayer[];
  properties: Property[];
  turn: number;
  phase: Phase;
  /** The phase a resolved landing/auction should lead to. */
  after: 'roll' | 'end';
  doubles: number;
  dice: [number, number] | null;
  pending: number | null;
  /** One building upgrade after landing on an already-owned street. */
  buildable: number | null;
  auction: Auction | null;
  debt: Debt | null;
  trade: Trade | null;
  chance: number[];
  chest: number[];
  /** A public sentence about the last resolved action. */
  notice: string;
  lastCard: string | null;
  winner: number | null;
}

/** Deck order is server-only. */
export type View = Omit<State, 'chance' | 'chest'>;

const street = (
  name: string,
  group: Group,
  price: number,
  rent: readonly number[],
  houseCost: number,
): Square => ({ name, kind: 'street', group, price, rent, houseCost });
const station = (name: string): Square => ({ name, kind: 'station', price: 200 });
const utility = (name: string): Square => ({ name, kind: 'utility', price: 150 });

/** Original Vietnamese place names, with the classic 40-square price and rent ladder. */
export const BOARD: readonly Square[] = [
  { name: 'Xuất phát', kind: 'start' },
  street('Phố Cổ', 'nau', 60, [2, 10, 30, 90, 160, 250], 50),
  { name: 'Cộng đồng', kind: 'chest' },
  street('Hàng Đào', 'nau', 60, [4, 20, 60, 180, 320, 450], 50),
  { name: 'Thuế thu nhập', kind: 'tax', tax: 200 },
  station('Ga Bắc'),
  street('Bến Thành', 'xanh-nhat', 100, [6, 30, 90, 270, 400, 550], 50),
  { name: 'Cơ hội', kind: 'chance' },
  street('Đồng Khởi', 'xanh-nhat', 100, [6, 30, 90, 270, 400, 550], 50),
  street('Nguyễn Huệ', 'xanh-nhat', 120, [8, 40, 100, 300, 450, 600], 50),
  { name: 'Nhà tù / Thăm', kind: 'jail' },
  street('Cầu Rồng', 'hong', 140, [10, 50, 150, 450, 625, 750], 100),
  utility('Điện lực'),
  street('Biển Mỹ Khê', 'hong', 140, [10, 50, 150, 450, 625, 750], 100),
  street('Sông Hàn', 'hong', 160, [12, 60, 180, 500, 700, 900], 100),
  station('Ga Trung'),
  street('Đại Nội', 'cam', 180, [14, 70, 200, 550, 750, 950], 100),
  { name: 'Cộng đồng', kind: 'chest' },
  street('Tràng Tiền', 'cam', 180, [14, 70, 200, 550, 750, 950], 100),
  street('Sông Hương', 'cam', 200, [16, 80, 220, 600, 800, 1000], 100),
  { name: 'Bãi đỗ miễn phí', kind: 'free' },
  street('Hồ Xuân Hương', 'do', 220, [18, 90, 250, 700, 875, 1050], 150),
  { name: 'Cơ hội', kind: 'chance' },
  street('Chợ Đà Lạt', 'do', 220, [18, 90, 250, 700, 875, 1050], 150),
  street('Đồi Thông', 'do', 240, [20, 100, 300, 750, 925, 1100], 150),
  station('Ga Nam'),
  street('Chợ Nổi', 'vang', 260, [22, 110, 330, 800, 975, 1150], 150),
  street('Bến Ninh Kiều', 'vang', 260, [22, 110, 330, 800, 975, 1150], 150),
  utility('Cấp nước'),
  street('Cù Lao', 'vang', 280, [24, 120, 360, 850, 1025, 1200], 150),
  { name: 'Vào tù', kind: 'go-jail' },
  street('Vịnh Hạ Long', 'xanh-la', 300, [26, 130, 390, 900, 1100, 1275], 200),
  street('Đảo Cát Bà', 'xanh-la', 300, [26, 130, 390, 900, 1100, 1275], 200),
  { name: 'Cộng đồng', kind: 'chest' },
  street('Bãi Cháy', 'xanh-la', 320, [28, 150, 450, 1000, 1200, 1400], 200),
  station('Ga Đông'),
  { name: 'Cơ hội', kind: 'chance' },
  street('Hồ Gươm', 'xanh-dam', 350, [35, 175, 500, 1100, 1300, 1500], 200),
  { name: 'Thuế xa xỉ', kind: 'tax', tax: 100 },
  street('Phố Đi Bộ', 'xanh-dam', 400, [50, 200, 600, 1400, 1700, 2000], 200),
];

export const GROUP_COLORS: Record<Group, number> = {
  nau: 0x895135,
  'xanh-nhat': 0x73c4df,
  hong: 0xe07bba,
  cam: 0xe89b43,
  do: 0xcd5249,
  vang: 0xe9ce63,
  'xanh-la': 0x5da968,
  'xanh-dam': 0x416fbd,
};

export const isDeed = (square: Square): square is Square & { price: number } =>
  square.kind === 'street' || square.kind === 'station' || square.kind === 'utility';

export const groupSquares = (group: Group): number[] =>
  BOARD.flatMap((square, i) => (square.group === group ? [i] : []));
