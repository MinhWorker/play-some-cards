/** Persistent dev snapshots, scoped by game, with safe file names and seat-id remapping. */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Stored } from '@xomdao/sdk';
import { type Room, RoomError } from '../rooms/rooms.service.js';
import { type DevFrame, frameOf } from './room-dev.js';

interface Snapshot {
  version: 1;
  gameId: string;
  seats: string[];
  frame: DevFrame;
}
export const DEV_SNAPSHOT_ROOT = Symbol('DEV_SNAPSHOT_ROOT');
@Injectable()
export class DevSnapshots {
  constructor(
    @Optional()
    @Inject(DEV_SNAPSHOT_ROOT)
    private readonly root = resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../../../.dev/snapshots',
    ),
  ) {}
  private file(gameId: string, name: string) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(name))
      throw new RoomError('Tên snapshot chỉ gồm chữ, số, - và _ (tối đa 80 ký tự)');
    return join(this.root, gameId, `${name}.json`);
  }
  list(room: Room) {
    const dir = join(this.root, room.game.id);
    return existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => f.endsWith('.json'))
          .map((f) => f.slice(0, -5))
          .sort()
      : [];
  }
  save(room: Room, name: string) {
    const path = this.file(room.game.id, name);
    const seats = room.state
      ? room.game.seats(room.state).map((s) => s.id)
      : room.players.map((p) => p.id);
    const snapshot: Snapshot = { version: 1, gameId: room.game.id, seats, frame: frameOf(room) };
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(snapshot, null, 2));
  }
  load(room: Room, name: string): DevFrame {
    try {
      const saved: Snapshot = JSON.parse(readFileSync(this.file(room.game.id, name), 'utf8'));
      if (saved.version !== 1 || saved.gameId !== room.game.id)
        throw new RoomError('Snapshot không cùng game hoặc không đúng phiên bản');
      if (saved.seats.length !== room.players.length)
        throw new RoomError('Snapshot không cùng số ghế');
      if (!saved.frame || !['lobby', 'playing', 'finished'].includes(saved.frame.status))
        throw new RoomError('Snapshot không đúng định dạng');
      const ids = new Map(saved.seats.map((id, i) => [id, room.players[i]!.id]));
      const remap = (v: unknown): unknown => {
        if (typeof v === 'string') return ids.get(v) ?? v;
        if (Array.isArray(v)) return v.map(remap);
        if (v && typeof v === 'object')
          return Object.fromEntries(Object.entries(v).map(([k, x]) => [ids.get(k) ?? k, remap(x)]));
        return v;
      };
      const frame = remap(saved.frame) as DevFrame;
      if (frame.state !== null) {
        const stored = frame.state as Stored<unknown>;
        stored.players = room.players.map((p) => ({
          id: p.id,
          name: p.name,
          bot: Boolean(p.bot),
          avatar: p.avatar,
          frame: p.frame,
        }));
        // Reject stale snapshots before replacing the live room.
        room.game.seats(stored);
        room.game.getView(stored, room.players[0]!.id, {
          players: room.players.map((p) => ({ ...p, bot: Boolean(p.bot) })),
          hostId: room.hostId,
          score: frame.score,
          options: room.options,
          lastResult: frame.lastResult,
        });
      }
      return frame;
    } catch (err) {
      if (err instanceof RoomError) throw err;
      throw new RoomError(`Không nạp được snapshot "${name}": file thiếu, hỏng hoặc state đã cũ`);
    }
  }
  delete(room: Room, name: string) {
    const path = this.file(room.game.id, name);
    if (!existsSync(path)) throw new RoomError(`Không có snapshot "${name}"`);
    unlinkSync(path);
  }
}
