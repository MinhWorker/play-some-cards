import { z } from 'zod';

export const ELEMENTS = ['fire', 'water', 'lightning', 'ice', 'wind'] as const;
export type Element = (typeof ELEMENTS)[number];
export type Direction = 'up' | 'down' | 'left' | 'right' | 'none';
export const DIRECTIONS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  none: { x: 0, y: 0 },
};
export const WIDTH = 13;
export const HEIGHT = 11;
export const TICK = 100;
export const FUSE = 2500;
export const MATCH_TIME = 180000;
export const SELECT_TIME = 20000;
export const ELEMENT_INFO: Record<
  Element,
  { name: string; skill: string; color: number; hex: string; description: string }
> = {
  fire: {
    name: 'Hỏa',
    skill: 'Thiêu Đốt',
    color: 0xff8256,
    hex: '#ff8256',
    description: '6 giây · Bom +1 tầm nổ, +15 sát thương',
  },
  water: {
    name: 'Thủy',
    skill: 'Thủy Vực',
    color: 0x56bcff,
    hex: '#56bcff',
    description: '6 giây · Bom hình chữ nhật, làm chậm 2 giây',
  },
  lightning: {
    name: 'Lôi',
    skill: 'Lôi Kích',
    color: 0xb895ff,
    hex: '#b895ff',
    description: '6 giây · Bom thẳng dài; nhảy điện hoặc choáng',
  },
  ice: {
    name: 'Băng',
    skill: 'Băng Bộc',
    color: 0xa9edff,
    hex: '#a9edff',
    description: '6 giây · Đóng băng đối thủ và trì hoãn bom',
  },
  wind: {
    name: 'Phong',
    skill: 'Cuồng Phong',
    color: 0x6ce7c2,
    hex: '#6ce7c2',
    description: 'Đẩy bom và đối thủ phía trước · 20 sát thương',
  },
};
export const optionsSchema = z.object({
  mode: z.enum(['solo', 'teams']).default('solo'),
  total: z.number().int().min(1).max(4).default(4),
  bots: z.number().int().min(0).max(3).default(3),
  level: z.enum(['easy', 'normal', 'hard']).default('normal'),
  element: z.enum(ELEMENTS).default('fire'),
  friendlyFire: z.boolean().default(false),
});
export type Options = z.infer<typeof optionsSchema>;
export interface Point {
  x: number;
  y: number;
}
export interface Fighter extends Point {
  id: string;
  name: string;
  seat: number;
  bot: boolean;
  team: number;
  element: Element;
  hp: number;
  ready: boolean;
  dir: Direction;
  facing: Exclude<Direction, 'none'>;
  inputUntil: number;
  target: Point | null;
  nextBomb: number;
  nextThink: number;
  capacity: number;
  range: number;
  speed: number;
  skillUntil: number;
  skillReady: number;
  dashUntil: number;
  dashReady: number;
  frozenUntil: number;
  slowUntil: number;
  stunUntil: number;
  invulnerableUntil: number;
  kills: number;
  crates: number;
}
export interface Bomb extends Point {
  id: number;
  owner: string;
  team: number;
  element: Element;
  enhanced: boolean;
  range: number;
  damage: number;
  axis: 'x' | 'y';
  explodeAt: number;
  frozenUntil: number;
  pass: string[];
}
export interface Blast {
  id: number;
  cells: Point[];
  owner: string;
  team: number;
  element: Element;
  enhanced: boolean;
  damage: number;
  expires: number;
  hit: string[];
}
export interface Pickup extends Point {
  kind: 'heal' | 'range' | 'capacity' | 'speed';
}
export interface State {
  phase: 'select' | 'playing' | 'ended';
  time: number;
  elapsed: number;
  cells: ('floor' | 'wall' | 'crate')[];
  fighters: Fighter[];
  bombs: Bomb[];
  blasts: Blast[];
  pickups: Pickup[];
  nextId: number;
  ring: number;
  winners: string[];
  reason: string;
  mode: Options['mode'];
  friendlyFire: boolean;
}
export const cellOf = (p: Point): Point => ({ x: Math.round(p.x), y: Math.round(p.y) });
export const keyOf = (p: Point) => `${p.x},${p.y}`;
export const indexOf = (p: Point) => p.y * WIDTH + p.x;
export const inside = (p: Point) => p.x >= 0 && p.y >= 0 && p.x < WIDTH && p.y < HEIGHT;
export const tileAt = (s: State, p: Point) => (inside(p) ? s.cells[indexOf(p)] : 'wall');
export const distance = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const enemies = (s: State, a: Fighter, b: Fighter) =>
  a.id !== b.id && (s.mode === 'solo' || a.team !== b.team);
export const cloneState = (s: State): State => ({
  ...s,
  cells: [...s.cells],
  fighters: s.fighters.map((p) => ({ ...p })),
  bombs: s.bombs.map((b) => ({ ...b, pass: [...b.pass] })),
  blasts: s.blasts.map((b) => ({ ...b, cells: b.cells.map((p) => ({ ...p })), hit: [...b.hit] })),
  pickups: s.pickups.map((p) => ({ ...p })),
  winners: [...s.winners],
});
