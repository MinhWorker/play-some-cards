/** Room-local random state and bounded undo frames; allocated only in dev mode. */

import { seededRng } from '@xomdao/sdk';
import type { DevLogEntry } from '@xomdao/shared';
import type { Room } from '../rooms/rooms.service.js';

export interface DevFrame {
  state: unknown;
  last: Room['last'];
  status: Room['status'];
  result: Room['result'];
  lastResult: Room['lastResult'];
  score: Room['score'];
  round: number;
  timer: Room['timer'];
  startedAt: number | null;
  endedAt: number | null;
  remaining: number | null;
  random: number | null;
  queue: number[];
  timerPaused: boolean;
  botsPaused: boolean;
}
export interface RoomDev {
  history: DevFrame[];
  log: DevLogEntry[];
  nextLogId: number;
  followers: Set<(entry: DevLogEntry) => void>;
  random: number | null;
  queue: number[];
  timerPaused: boolean;
  botsPaused: boolean;
  remaining: number | null;
}
export const newRoomDev = (): RoomDev => ({
  history: [],
  log: [],
  nextLogId: 0,
  followers: new Set(),
  random: null,
  queue: [],
  timerPaused: false,
  botsPaused: false,
  remaining: null,
});

export function rngOf(room: Room): () => number {
  return () => {
    const dev = room.dev;
    if (!dev) return Math.random();
    if (dev.queue.length) return dev.queue.shift()!;
    if (dev.random === null) return Math.random();
    const next = seededRng(dev.random)();
    dev.random = (dev.random + 0x6d2b79f5) >>> 0;
    return next;
  };
}
export function frameOf(room: Room): DevFrame {
  return structuredClone({
    state: room.state,
    last: room.last,
    status: room.status,
    result: room.result,
    lastResult: room.lastResult,
    score: room.score,
    round: room.round,
    timer: room.timer,
    startedAt: room.startedAt,
    endedAt: room.endedAt,
    remaining: room.dev?.timerPaused
      ? room.dev.remaining
      : room.timer
        ? Math.max(0, room.timer.endsAt - Date.now())
        : null,
    random: room.dev?.random ?? null,
    queue: room.dev?.queue ?? [],
    timerPaused: room.dev?.timerPaused ?? false,
    botsPaused: room.dev?.botsPaused ?? false,
  });
}
export function remember(room: Room) {
  if (!room.dev) return;
  room.dev.history.push(frameOf(room));
  if (room.dev.history.length > 50) room.dev.history.shift();
}
export function restoreFrame(room: Room, frame: DevFrame) {
  const { remaining, random, queue, timerPaused, botsPaused, ...game } = structuredClone(frame);
  Object.assign(room, game);
  if (room.dev) Object.assign(room.dev, { remaining, random, queue, timerPaused, botsPaused });
  // A restored timer needs a fresh handle even when its hook id matches the current timer.
  if (room.timer)
    room.timer = {
      ...room.timer,
      key: `restore:${crypto.randomUUID()}`,
      endsAt: Date.now() + (remaining ?? room.timer.ms),
    };
}
