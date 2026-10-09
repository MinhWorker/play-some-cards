/** Bounded per-room dev logs, synchronous game-console capture and subscriptions. */
import { format } from 'node:util';
import type { DevLogEntry } from '@xomdao/shared';
import type { Room } from '../rooms/rooms.service.js';

export type LogDetails = Omit<DevLogEntry, 'id' | 't'>;
export function logRoom(room: Room, details: LogDetails) {
  const dev = room.dev;
  if (!dev) return;
  let data = details.data;
  if (data instanceof Error) data = { message: data.message, stack: data.stack };
  if (data !== undefined) {
    try {
      const encoded = JSON.stringify(data);
      data =
        Buffer.byteLength(encoded) > 20_000
          ? { note: 'đã cắt', preview: Buffer.from(encoded).subarray(0, 19_900).toString('utf8') }
          : JSON.parse(encoded);
    } catch {
      data = { note: 'Không thể xuất dữ liệu', preview: String(data) };
    }
  }
  const entry: DevLogEntry = {
    ...details,
    text: details.text.slice(0, 2000),
    data,
    id: ++dev.nextLogId,
    t: Date.now(),
  };
  dev.log.push(entry);
  if (dev.log.length > 500) dev.log.shift();
  for (const follow of dev.followers) follow(entry);
  return entry;
}
export function followRoomLog(room: Room, listener: (entry: DevLogEntry) => void) {
  room.dev?.followers.add(listener);
  return () => room.dev?.followers.delete(listener);
}

/** Game hooks are synchronous; restore even if a hook throws. Terminal output is preserved. */
export function captureConsole<T>(room: Room, fn: () => T): T {
  if (!room.dev) return fn();
  const methods = ['log', 'info', 'warn', 'error'] as const;
  const originals = methods.map((method) => console[method]);
  methods.forEach((method, i) => {
    console[method] = (...args: unknown[]) => {
      logRoom(room, {
        kind: 'game',
        level: method === 'error' ? 'error' : method === 'warn' ? 'warn' : 'info',
        text: format(...args),
        data: args,
      });
      originals[i]?.apply(console, args);
    };
  });
  try {
    return fn();
  } finally {
    methods.forEach((method, i) => {
      console[method] = originals[i]!;
    });
  }
}

/** Attach hook failures to their room before the gateway returns its generic error. */
export function runRoomHook<T>(room: Room, name: string, fn: () => T): T {
  try {
    return captureConsole(room, fn);
  } catch (err) {
    logRoom(room, {
      kind: 'error',
      level: 'error',
      text: `Lỗi trong ${name}: ${err instanceof Error ? err.message : String(err)}`,
      data: err,
    });
    throw err;
  }
}
