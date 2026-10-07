/** Socket handlers gate every dev event and stop a room's stream on leave/disconnect. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountsService } from '../accounts/accounts.service.js';
import { MemoryAccountsStore } from '../accounts/accounts.store.js';
import { MatchesService } from '../matches/matches.service.js';
import { MemoryMatchesStore } from '../matches/matches.store.js';
import { RoomsGateway } from '../rooms/rooms.gateway.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { DevConsoleService } from './dev-console.service.js';
import { DevSnapshots } from './dev-snapshots.js';
import { logRoom } from './room-log.js';

afterEach(() => vi.restoreAllMocks());
function setup(dev: boolean) {
  const rooms = new RoomsService(dev);
  const { room } = rooms.create('tic-tac-toe', { id: 'a', name: 'A' }, { opponent: 'bot' });
  const gateway = new RoomsGateway(
    rooms,
    new AccountsService(new MemoryAccountsStore()),
    new DevConsoleService(rooms, new DevSnapshots()),
    new MatchesService(new MemoryMatchesStore()),
  );
  const socket = {
    data: { user: { id: 'a', name: 'A' }, roomCode: room.code },
    emit: vi.fn(),
    leave: vi.fn(),
  } as unknown as Parameters<RoomsGateway['devLogs']>[0];
  gateway.server = {
    sockets: { sockets: new Map([['a', socket]]) },
    to: () => ({ emit: vi.fn() }),
  } as unknown as RoomsGateway['server'];
  return { room, rooms, gateway, socket };
}
describe('dev gateway', () => {
  it('rejects command, schema and logs with dev disabled, even before requiring membership', async () => {
    const { gateway, socket } = setup(false);
    socket.data.roomCode = undefined;
    const replies = await Promise.all([
      gateway.devCommand(socket, { line: 'help' }),
      gateway.devSchema(socket),
      gateway.devLogs(socket, { on: true }),
    ]);
    expect(replies).toEqual(Array(3).fill({ ok: false, error: 'Server không bật chế độ dev' }));
    expect(socket.emit).not.toHaveBeenCalled();
  });
  it('returns existing logs and sends only while subscribed', async () => {
    const { gateway, socket, room } = setup(true);
    expect(await gateway.devLogs(socket, { on: true })).toMatchObject({
      ok: true,
      entries: [expect.objectContaining({ kind: 'room' })],
    });
    logRoom(room, { kind: 'game', level: 'info', text: 'x' });
    expect(socket.emit).toHaveBeenCalledWith('dev:log', expect.objectContaining({ text: 'x' }));
    await gateway.devLogs(socket, { on: false });
    vi.mocked(socket.emit).mockClear();
    logRoom(room, { kind: 'game', level: 'info', text: 'y' });
    expect(socket.emit).not.toHaveBeenCalled();
    await gateway.devLogs(socket, { on: true });
    gateway.handleDisconnect(socket);
    vi.mocked(socket.emit).mockClear();
    logRoom(room, { kind: 'game', level: 'info', text: 'z' });
    expect(socket.emit).not.toHaveBeenCalled();
    expect(room.dev?.followers.size).toBe(0);
  });
  it('removes the subscription on explicit room leave', async () => {
    const { gateway, socket, room } = setup(true);
    await gateway.devLogs(socket, { on: true });
    await gateway.leave(socket);
    expect(socket.data.roomCode).toBeUndefined();
    expect(room.dev?.followers.size).toBe(0);
  });
  it('keeps live logs subscribed across schema, commands and regular moves', async () => {
    const { gateway, socket, room, rooms } = setup(true);
    rooms.start(room.code, 'a');
    await gateway.devLogs(socket, { on: true });
    expect(await gateway.devSchema(socket)).toMatchObject({ ok: true });
    expect(room.dev?.followers.size).toBe(1);
    expect(await gateway.devCommand(socket, { line: 'help' })).toMatchObject({ ok: true });
    expect(socket.emit).toHaveBeenCalledWith(
      'dev:log',
      expect.objectContaining({ kind: 'command', text: 'help → xong' }),
    );
    expect(
      await gateway.move(socket, { move: { event: 'place', payload: { x: 0, y: 0 } } }),
    ).toMatchObject({
      ok: true,
    });
    expect(socket.emit).toHaveBeenCalledWith(
      'dev:log',
      expect.objectContaining({ kind: 'move', text: expect.stringContaining('gửi place') }),
    );
    expect(room.dev?.followers.size).toBe(1);
  });
});
