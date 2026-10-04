/** Dispatches synchronous console lines through the real room and game rules. */
import { Injectable } from '@nestjs/common';
import {
  type ConsoleCommand,
  ConsoleError,
  consoleArgs,
  type DevCommandInfo,
  ENGINE_COMMANDS,
  getStatePath,
  parseConsoleLine,
  resolveValue,
  type Stored,
  setStatePath,
} from '@psc/sdk';
import { z } from 'zod';
import { type Room, RoomError, RoomsService } from '../rooms/rooms.service.js';
import { DevSnapshots } from './dev-snapshots.js';
import { remember, restoreFrame } from './room-dev.js';
import { logRoom } from './room-log.js';

const descriptions: Record<string, [string, string]> = {
  help: ['Liệt kê lệnh hoặc xem cách dùng', 'help [lệnh]'],
  state: ['Đọc hoặc sửa state đầy đủ', 'state get [đường-dẫn] | set <đường-dẫn> <giá-trị> | dump'],
  snapshot: ['Lưu và khôi phục ván ra file', 'snapshot save|load|delete <tên> | list'],
  undo: ['Quay lại các thay đổi gần nhất', 'undo [n]'],
  seed: ['Đặt bộ số ngẫu nhiên lặp lại được', 'seed <n> | off'],
  rng: ['Đặt trước các lần gọi rng()', 'rng push <số...> | clear'],
  timer: ['Điều khiển bộ đếm giờ', 'timer info|fire|pause|resume'],
  bot: ['Điều khiển máy', 'bot pause|resume|step'],
  finish: ['Kết thúc ván (trống = hoà)', 'finish [ghế...]'],
  restart: ['Bắt đầu một ván mới', 'restart'],
  events: ['Liệt kê sự kiện và tham số', 'events'],
  as: ['Gửi sự kiện thay một ghế, theo luật thật', 'as <ghế> <sự-kiện> [tham số]'],
};
const json = (value: unknown) => JSON.stringify(value, null, 2) ?? 'undefined';
@Injectable()
export class DevConsoleService {
  constructor(
    private readonly rooms: RoomsService,
    private readonly snapshots: DevSnapshots,
  ) {}

  schema(room: Room): { commands: DevCommandInfo[]; catalogs: Record<string, string[]> } {
    return {
      commands: ENGINE_COMMANDS.map((name) => ({
        name,
        description: descriptions[name]![0],
        usage: descriptions[name]![1],
      })),
      catalogs: {},
    };
  }
  execute(
    code: string,
    member: string,
    line: string,
    afterChange: (room: Room) => void = () => {},
  ) {
    const room = this.rooms.devRoom(code, member);
    if (typeof line !== 'string' || line.length > 16384)
      throw new RoomError('Dòng lệnh quá dài hoặc không hợp lệ');
    const outputs: string[] = [];
    for (const command of parseConsoleLine(line)) {
      const text = line.slice(
        command.at,
        command.tokens.at(-1)?.end ?? command.at + command.name.length,
      );
      try {
        outputs.push(this.run(room, command));
        logRoom(room, { kind: 'command', level: 'info', text: `${text} → xong` });
      } catch (err) {
        logRoom(room, {
          kind: 'command',
          level: 'error',
          text: `${text} → ${err instanceof Error ? err.message : String(err)}`,
          data: err,
        });
        throw err;
      }
      // Each command settles and schedules independently, even when the following command fails.
      afterChange(room);
    }
    return { output: outputs.join('\n') };
  }
  private run(room: Room, command: ConsoleCommand): string {
    const { name, tokens } = command;
    const values = tokens.map((t) => resolveValue(t.value));
    const [a, b, c] = values;
    const dev = room.dev!;
    const stored = () => {
      if (!room.state) throw new RoomError('Ván chưa bắt đầu');
      return room.state as Stored<unknown>;
    };
    const count = (min: number, max = min) => {
      if (tokens.length < min || tokens.length > max)
        throw new ConsoleError({
          message: `Cách dùng: ${descriptions[name]?.[1] ?? name}`,
          at: command.at,
          end: tokens.at(-1)?.end,
        });
    };
    const seat = (v: unknown) => {
      if (!Number.isInteger(v) || typeof v !== 'number')
        throw new RoomError('Ghế phải là số nguyên');
      const id = room.state ? room.game.seats(room.state)[v]?.id : room.players[v]?.id;
      if (!id) throw new RoomError(`Không có ghế ${v}`);
      return id;
    };
    switch (name) {
      case 'help': {
        count(0, 1);
        const commands = this.schema(room).commands;
        if (a !== undefined && !commands.some((x) => x.name === a))
          throw new RoomError(`Không có lệnh "${a}"`);
        return commands
          .filter((x) => a === undefined || x.name === a)
          .map((x) => `${x.usage} · ${x.description}${x.example ? ` · ${x.example}` : ''}`)
          .join('\n');
      }
      case 'state':
        if (a === 'get') {
          count(1, 2);
          return json(getStatePath(stored().state, b === undefined ? undefined : String(b)));
        }
        if (a === 'dump') {
          count(1);
          return json(stored());
        }
        if (a === 'set') {
          count(3);
          const state = setStatePath(stored().state, String(b), c);
          remember(room);
          room.state = { ...stored(), state };
          this.rooms.settle(room);
          return `${b} = ${json(c)}`;
        }
        break;
      case 'snapshot':
        if (a === 'list') {
          count(1);
          return this.snapshots.list(room).join('\n') || 'Chưa có snapshot';
        }
        if (typeof b === 'string' && ['save', 'load', 'delete'].includes(String(a))) {
          count(2);
          if (a === 'save') this.snapshots.save(room, b);
          if (a === 'load') {
            const frame = this.snapshots.load(room, b);
            remember(room);
            restoreFrame(room, frame);
          }
          if (a === 'delete') this.snapshots.delete(room, b);
          return `Snapshot ${b}: ${a}`;
        }
        break;
      case 'undo': {
        count(0, 1);
        const n = a ?? 1;
        if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > dev.history.length)
          throw new RoomError(`Chỉ có ${dev.history.length} thay đổi để undo`);
        const frame = dev.history[dev.history.length - n]!;
        dev.history.splice(dev.history.length - n);
        restoreFrame(room, frame);
        return `Đã quay lại ${n} thay đổi`;
      }
      case 'seed':
        count(1);
        if (a !== 'off' && (typeof a !== 'number' || !Number.isSafeInteger(a)))
          throw new RoomError('Seed phải là số nguyên hoặc off');
        remember(room);
        dev.random = a === 'off' ? null : (a as number) >>> 0;
        return `Seed: ${a}`;
      case 'rng':
        if (a === 'clear') {
          count(1);
          remember(room);
          dev.queue = [];
          return 'Đã xoá hàng đợi rng';
        }
        if (a === 'push') {
          count(2, 1000);
          const numbers = values.slice(1);
          if (numbers.some((n) => typeof n !== 'number' || n < 0 || n >= 1))
            throw new RoomError('rng nhận số từ 0 tới dưới 1');
          remember(room);
          dev.queue.push(...(numbers as number[]));
          return `rng: ${json(dev.queue)}`;
        }
        break;
      case 'timer':
        count(1);
        if (a === 'info')
          return json({ timer: room.timer, paused: dev.timerPaused, remaining: dev.remaining });
        if (a === 'fire') {
          this.rooms.syncTimer(room);
          if (!room.timer) throw new RoomError('Không có timer');
          this.rooms.fireTimer(room.code, room.timer.key);
          return 'Timer đã chạy';
        }
        if (a === 'pause' || a === 'resume') {
          if (dev.timerPaused === (a === 'pause')) return `Timer: ${a}`;
          remember(room);
          if (a === 'pause')
            dev.remaining = room.timer ? Math.max(0, room.timer.endsAt - Date.now()) : null;
          else room.timer = null;
          dev.timerPaused = a === 'pause';
          return `Timer: ${a}`;
        }
        break;
      case 'bot':
        count(1);
        if (a === 'step')
          return this.rooms.botMove(room.code, true) ? 'Máy đã đi một nước' : 'Máy chưa có nước đi';
        if (a === 'pause' || a === 'resume') {
          remember(room);
          dev.botsPaused = a === 'pause';
          return `Máy: ${a}`;
        }
        break;
      case 'finish': {
        const winners = [...new Set(values.map(seat))];
        const state = stored();
        if (room.status !== 'playing') throw new RoomError('Ván chưa bắt đầu');
        remember(room);
        room.state = { ...state, result: { winners }, timer: null };
        this.rooms.settle(room);
        return winners.length ? 'Ván đã kết thúc' : 'Ván hoà';
      }
      case 'restart':
        count(0);
        if (!room.hostId) throw new RoomError('Phòng chưa có chủ');
        // start keeps setup, seat checks and bookkeeping on the regular path.
        if (room.status === 'playing') {
          remember(room);
          const frame = dev.history.pop()!;
          room.status = 'finished';
          try {
            this.rooms.start(room.code, room.hostId);
            dev.history[dev.history.length - 1] = frame;
          } catch (err) {
            restoreFrame(room, frame);
            throw err;
          }
        } else this.rooms.start(room.code, room.hostId);
        return 'Đã bắt đầu ván mới';
      case 'events':
        count(0);
        return Object.entries(room.game.events)
          .map(
            ([event, schema]) =>
              `${event}: ${json(z.toJSONSchema(schema, { unrepresentable: 'any' }))}`,
          )
          .join('\n');
      case 'as': {
        count(2, 1000);
        const id = seat(a);
        const event = String(b);
        const schema = room.game.events[event];
        if (!schema)
          throw new RoomError(`Không có sự kiện "${event}". Gõ events để xem danh sách.`);
        const payload = consoleArgs(schema, tokens.slice(2), {}, event);
        this.rooms.move(room.code, id, { event, payload });
        return `Ghế ${a}: ${event}`;
      }
      default: {
        const guess = ENGINE_COMMANDS.find((n) => n.startsWith(name.slice(0, 2)));
        throw new ConsoleError({
          message: `Không có lệnh "${name}".${guess ? ` Có phải "${guess}"?` : ' Gõ help để xem danh sách.'}`,
          at: command.at,
          end: command.at + name.length,
          suggestion: guess,
        });
      }
    }
    throw new ConsoleError({
      message: `Cách dùng: ${descriptions[name]![1]}`,
      at: command.at,
      end: tokens.at(-1)?.end,
    });
  }
}
