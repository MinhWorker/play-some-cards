import { z } from 'zod';
import type { Card, Deck } from './cards.js';

export const optionsSchema = z.object({
  bots: z.number().int().min(0).max(3).default(0),
  turnSeconds: z.number().int().min(15).max(120).default(30),
});
export type Options = z.infer<typeof optionsSchema>;

export const STARTING_CASH = 1000;

export type Group = 'nau' | 'xanh-nhat' | 'hong' | 'cam' | 'do' | 'vang' | 'xanh-la' | 'xanh-dam';
export type DeedKind = 'street' | 'station';
export type SquareKind =
  | DeedKind
  | 'utility'
  | 'start'
  | 'chance'
  | 'chest'
  | 'tax'
  | 'jail'
  | 'airport'
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

/** How long each bidder has to raise or pass in an auction (ms). */
export const AUCTION_TURN_MS = 10_000;

export interface Auction {
  square: number;
  bidder: number;
  highest: number;
  leader: number | null;
  passed: number[];
  bids: number[];
}

/** Deposits and withdrawals persist between visits to this station. */
export type StationAuction = Omit<Auction, 'bidder'>;

export const STATION_CONTRIBUTION_STEP = 50;
export const STATION_BASE_FEE = 50;

export interface Debt {
  /** A station winner may owe the bank during another player's turn. */
  payer?: number;
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
  | { kind: 'airport'; roll: number; reason: string }
  | { kind: 'jail'; reason: string };

export type SpecialEvent = SpecialEventEffect & { id: number; ready: boolean };

export interface State {
  /** Last server timeout action, so every viewer can animate its roll exactly once. */
  lastAutoAction: { id: number; seat: number; event: string } | null;
  specialEvent: SpecialEvent | null;
  moneySequence: number;
  transfers: MoneyTransfer[];
  players: TycoonPlayer[];
  properties: Property[];
  turn: number;
  round: number;
  shortages: { square: number; round: number }[];
  phase: Phase;
  /** The phase a resolved landing/auction should lead to. */
  after: 'roll' | 'end';
  doubles: number;
  dice: [number, number] | null;
  /** Dev console override, consumed by the next roll and hidden from player views. */
  devDice?: [number, number];
  pending: number | null;
  /** One building upgrade after landing on an already-owned street. */
  buildable: number | null;
  auction: Auction | null;
  stationAuctions: Record<number, StationAuction>;
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
export type View = Omit<State, 'chance' | 'chest' | 'devDice'>;

/** Every street uses the same price-based building and rent ladder. */
const street = (name: string, group: Group, price: number): Square => ({
  name,
  kind: 'street',
  group,
  price,
  houseCost: price / 2,
  rent: [0.1, 0.4, 1.1, 3, 4, 5].map((rate) => Math.round(price * rate)),
});
const station = (name: string): Square => ({ name, kind: 'station', price: 200 });
const utility = (name: string): Square => ({ name, kind: 'utility', tax: 100 });

/** Clockwise from Start: six streets per side, with two Chance and two Chest squares. */
export const BOARD: readonly Square[] = [
  { name: 'Xuất phát', kind: 'start' },
  street('Phú Quốc', 'nau', 200),
  street('Lào Cai', 'nau', 150),
  street('Việt Trì', 'xanh-la', 180),
  { name: 'Thuế thu nhập', kind: 'tax', tax: 100 },
  station('Bến Bắc'),
  street('Hạ Long', 'hong', 280),
  { name: 'Cơ hội', kind: 'chance' },
  street('Hải Phòng', 'vang', 320),
  street('Hà Nội', 'do', 350),
  { name: 'Nhà tù', kind: 'jail' },
  street('Hải Dương', 'xanh-nhat', 220),
  utility('Điện lực'),
  street('Thái Bình', 'xanh-dam', 260),
  street('Nam Định', 'hong', 240),
  station('Bến Tây'),
  street('Thanh Hóa', 'vang', 270),
  { name: 'Khí vận', kind: 'chest' },
  street('Vinh', 'nau', 260),
  street('Hà Tĩnh', 'xanh-nhat', 170),
  { name: 'Sân bay', kind: 'airport' },
  street('Huế', 'do', 270),
  { name: 'Cơ hội', kind: 'chance' },
  street('Đà Nẵng', 'xanh-la', 300),
  street('Hội An', 'cam', 250),
  station('Bến Nam'),
  street('Kon Tum', 'xanh-dam', 140),
  street('Pleiku', 'xanh-nhat', 160),
  utility('Cấp nước'),
  street('Đà Lạt', 'vang', 270),
  { name: 'Vào tù', kind: 'go-jail' },
  street('Nha Trang', 'xanh-la', 280),
  street('Vũng Tàu', 'hong', 260),
  { name: 'Khí vận', kind: 'chest' },
  street('Biên Hòa', 'cam', 220),
  station('Bến Đông'),
  street('Tp. HCM', 'xanh-dam', 350),
  street('Cần Thơ', 'do', 300),
  { name: 'Thuế xa xỉ', kind: 'tax', tax: 200 },
  street('Cà Mau', 'cam', 180),
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
  square.kind === 'street' || square.kind === 'station';

export const groupSquares = (group: Group): number[] =>
  BOARD.flatMap((square, i) => (square.group === group ? [i] : []));
