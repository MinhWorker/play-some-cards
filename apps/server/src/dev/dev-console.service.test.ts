/** Engine commands exercise real registered games, without a socket or fake game server. */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Stored } from '@psc/sdk';
import { afterEach, describe, expect, it } from 'vitest';
import { RoomsService } from '../rooms/rooms.service.js';
import { DevConsoleService } from './dev-console.service.js';
import { DevSnapshots } from './dev-snapshots.js';
import { rngOf } from './room-dev.js';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function setup(gameId = 'tic-tac-toe', options: unknown = { opponent: 'bot' }) {
  const root = mkdtempSync(join(tmpdir(), 'psc-dev-'));
  dirs.push(root);
  const rooms = new RoomsService(true);
  const { room } = rooms.create(gameId, { id: 'a', name: 'A' }, options);
  rooms.join(room.code, { id: 'watcher', name: 'X' }, 'spectator');
  rooms.start(room.code, 'a');
  rooms.syncTimer(room);
  const service = new DevConsoleService(rooms, new DevSnapshots(root));
  const cmd = (line: string) =>
    service.execute(room.code, 'watcher', line, (r) => rooms.syncTimer(r)).output;
  const state = () => (room.state as Stored<Record<string, unknown>>).state;
  return { root, rooms, room, service, cmd, state };
}

describe('DevConsoleService', () => {
  it('denies commands when dev is off and when the caller is not a member', () => {
    const rooms = new RoomsService(false);
    const service = new DevConsoleService(rooms, new DevSnapshots());
    expect(() => service.execute('NONE', 'a', 'help')).toThrow('Server không bật chế độ dev');
    const dev = setup();
    expect(() => dev.service.execute(dev.room.code, 'stranger', 'help')).toThrow(
      'Bạn chưa ở trong phòng',
    );
    expect(rooms.create('counter', { id: 'a', name: 'A' }).room.dev).toBeUndefined();
  });
  it('lists help, events and schemas', () => {
    const { cmd, service, room } = setup();
    expect(cmd('help')).toContain('snapshot');
    expect(cmd('help as')).toContain('<ghế>');
    expect(cmd('events')).toContain('place');
    expect(service.schema(room).commands.filter((c) => c.kind === 'engine')).toHaveLength(12);
    expect(() => cmd('hep')).toThrow('Có phải "help"');
  });
  it('reads, writes and dumps raw state without changing last', () => {
    const { cmd, state, room } = setup();
    const last = room.last;
    expect(cmd('state get turn')).toBe('"a"');
    expect(cmd('state set turn "bot:1"')).toContain('bot:1');
    expect(state().turn).toBe('bot:1');
    expect(room.last).toBe(last);
    expect(cmd('state dump')).toContain('players');
    expect(() => cmd('state set __proto__.x 1')).toThrow('không hợp lệ');
  });
  it('runs events as seats through validation and stops a chain at the first rejection', () => {
    const { cmd, state, room } = setup();
    expect(() => cmd('as 1 place 0 0')).toThrow('Chưa tới lượt');
    cmd('as 0 place x=0 y=0');
    expect(room.last?.player).toBe('a');
    expect(() => cmd('state set turn "a"; as 0 place 0 0; state set turn "bot:1"')).toThrow();
    expect(state().turn).toBe('a');
    expect(() => cmd('as 9 place 0 0')).toThrow('Không có ghế');
  });
  it('undo restores moves, score, timers and random state and keeps only fifty frames', () => {
    const { cmd, state, room } = setup();
    cmd('seed 42; rng push 0 0.5');
    const frame = structuredClone(room.state);
    cmd('as 0 place 0 0');
    cmd('finish 1');
    expect(room.score.wins[1]).toBe(1);
    cmd('undo 2');
    expect(room.state).toEqual(frame);
    expect(room.status).toBe('playing');
    expect(room.score.wins[1]).toBe(0);
    expect(state().turn).toBe('a');
    for (let i = 0; i < 55; i++) cmd(`state set turn "a"`);
    expect(room.dev?.history).toHaveLength(50);
    expect(() => cmd('undo 51')).toThrow('50 thay đổi');
  });
  it('has isolated room RNG queues and reproducible seeds', () => {
    const a = setup(),
      b = setup();
    a.cmd('seed 42');
    b.cmd('seed 42');
    expect(rngOf(a.room)()).toBe(rngOf(b.room)());
    a.cmd('rng push 0 0.5');
    expect(rngOf(a.room)()).toBe(0);
    expect(rngOf(a.room)()).toBe(0.5);
    a.cmd('rng push 0.2; rng clear; seed off');
    expect(a.room.dev?.queue).toEqual([]);
    expect(a.room.dev?.random).toBeNull();
    expect(() => a.cmd('rng push 1')).toThrow('dưới 1');
  });
  it('pauses, resumes and fires a real game timer, which is undoable', () => {
    const { cmd, room, state } = setup('tien-len', { bots: 1 });
    expect(cmd('timer info')).toContain('begin');
    cmd('timer pause');
    expect(room.dev?.remaining).toBeGreaterThan(0);
    expect(room.dev?.timerPaused).toBe(true);
    cmd('timer resume');
    expect(room.dev?.timerPaused).toBe(false);
    cmd('timer fire');
    expect(state().phase).toBe('play');
    cmd('undo');
    expect(state().phase).toBe('deal');
    expect(room.timer).not.toBeNull();
  });
  it('pauses bots, steps once and resumes', () => {
    const { cmd, room, rooms } = setup();
    cmd('bot pause; as 0 place 0 0');
    expect(rooms.botMove(room.code)).toBeNull();
    expect(cmd('bot step')).toContain('đã đi');
    expect(room.last?.player).toBe('bot:1');
    cmd('bot resume');
    expect(room.dev?.botsPaused).toBe(false);
  });
  it('undo restores RNG before a bot chooses its move', () => {
    const { cmd, room } = setup('tic-tac-toe', { opponent: 'bot', level: 'easy' });
    cmd('seed 42; as 0 place 0 0');
    const random = room.dev?.random;
    cmd('bot step');
    expect(room.dev?.random).not.toBe(random);
    cmd('undo');
    expect(room.dev?.random).toBe(random);
  });

  it('a replacement timer gets its own duration while paused', () => {
    const { cmd, room, rooms } = setup('tien-len', { bots: 1 });
    room.timer!.endsAt = Date.now() + 1000;
    cmd('timer pause');
    const stored = room.state as Stored<unknown>;
    room.state = {
      ...stored,
      timer: { id: stored.timers + 1, ms: 5000, event: 'begin' },
      timers: stored.timers + 1,
    };
    expect(rooms.syncTimer(room)).toBeNull();
    expect(room.dev?.remaining).toBe(5000);
    cmd('timer resume');
    expect(room.timer?.endsAt).toBeGreaterThan(Date.now() + 4500);
  });

  it('finishes as a draw or seat win, then restarts with normal setup', () => {
    const { cmd, room } = setup();
    cmd('finish');
    expect(room.result).toEqual({ winners: [] });
    expect(room.score.draws).toBe(1);
    cmd('restart');
    expect(room.round).toBe(2);
    expect(room.status).toBe('playing');
    cmd('restart');
    expect(room.round).toBe(3);
    cmd('undo');
    expect(room.round).toBe(2);
    cmd('finish 0');
    expect(room.result).toEqual({ winners: ['a'] });
  });
  it('persists snapshots across service restarts and remaps raw game and engine player ids', () => {
    const { cmd, room, root } = setup();
    cmd('as 0 place 0 0; snapshot save x');
    expect(cmd('snapshot list')).toBe('x');
    const rooms = new RoomsService(true);
    const next = rooms.create('tic-tac-toe', { id: 'new', name: 'Mới' }, { opponent: 'bot' }).room;
    const service = new DevConsoleService(rooms, new DevSnapshots(root));
    service.execute(next.code, 'new', 'snapshot load x');
    const stored = next.state as Stored<{ players: string[] }>;
    expect(stored.players[0]).toMatchObject({ id: 'new', name: 'Mới' });
    expect(stored.state.players).toContain('new');
    expect(next.last?.player).toBe('new');
    expect(room.last?.player).toBe('a');
    expect(() => cmd('snapshot save ../outside')).toThrow('Tên snapshot');
    service.execute(next.code, 'new', 'snapshot delete x');
    expect(cmd('snapshot list')).toContain('Chưa có');
    expect(() => cmd('snapshot load x')).toThrow('Không nạp được');
  });
});
