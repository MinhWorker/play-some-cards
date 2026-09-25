import { describe, expect, it } from 'vitest';
import { RoomsService } from './rooms.service.js';

/** A logged-in account (id = lowercase name, for readable tests). */
const acc = (name: string) => ({ id: name.toLowerCase(), name });

function setupRoom() {
  const service = new RoomsService();
  const { room, player: host } = service.create('tic-tac-toe', acc('Alice'));
  const { player: guest } = service.join(room.code, acc('Bob'), 'player');
  return { service, room, host, guest };
}

describe('RoomsService', () => {
  it('creates a room with a 4-letter code', () => {
    const { room } = setupRoom();
    expect(room.code).toMatch(/^[A-Z2-9]{4}$/);
    expect(room.players).toHaveLength(2);
  });

  it('rejects unknown games', () => {
    expect(() => new RoomsService().create('nope', acc('Alice'))).toThrow('Không có game');
  });

  it('only lets the host start', () => {
    const { service, room, guest } = setupRoom();
    expect(() => service.start(room.code, guest.id)).toThrow('Chỉ chủ phòng');
  });

  it('plays a full game to a win', () => {
    const { service, room, host, guest } = setupRoom();
    service.start(room.code, host.id);
    for (const [player, cell] of [
      [host, 0],
      [guest, 3],
      [host, 1],
      [guest, 4],
      [host, 2],
    ] as const) {
      service.move(room.code, player.id, { cell });
    }
    expect(room.status).toBe('finished');
    expect(room.result).toEqual({ winners: [host.id] });
  });

  it('rejects malformed moves', () => {
    const { service, room, host } = setupRoom();
    service.start(room.code, host.id);
    expect(() => service.move(room.code, host.id, { cell: 'x' })).toThrow('Nước đi không hợp lệ');
  });

  it('puts an account back in its place when it joins its own room again', () => {
    const { service, room, guest } = setupRoom();
    service.setConnected(room.code, guest.id, false);
    expect(service.roomOf('bob')).toBe(room);
    const { player } = service.join(room.code, acc('Bob'), 'spectator');
    expect(player.id).toBe(guest.id);
    expect(player.connected).toBe(true);
    expect(room.players).toHaveLength(2);
    expect(room.spectators).toHaveLength(0);
  });

  it('renames an account inside its room', () => {
    const { service, room } = setupRoom();
    expect(service.rename('bob', 'Bobby')).toBe(room);
    expect(service.snapshotFor(room, 'alice').players.map((p) => p.name)).toEqual([
      'Alice',
      'Bobby',
    ]);
    expect(service.rename('nobody', 'X')).toBeUndefined();
  });

  it('lists only rooms of the requested game', () => {
    const { service, room } = setupRoom();
    expect(service.list('tic-tac-toe').map((r) => r.code)).toEqual([room.code]);
    expect(service.list('other-game')).toEqual([]);
  });

  it('limits players to the seats but lets anyone watch', () => {
    const { service, room } = setupRoom();
    expect(() => service.join(room.code, acc('Cam'), 'player')).toThrow('đủ người');
    service.join(room.code, acc('Cam'), 'spectator');
    service.join(room.code, acc('Dao'), 'spectator');
    expect(room.spectators).toHaveLength(2);
    expect(service.list('tic-tac-toe')[0]).toMatchObject({
      players: 2,
      maxPlayers: 2,
      spectators: 2,
      canJoin: false,
    });
  });

  it('does not let a new player join a running game', () => {
    const { service, room, host, guest } = setupRoom();
    service.start(room.code, host.id);
    service.setConnected(room.code, guest.id, false); // dropped connection keeps the seat
    expect(room.players).toHaveLength(2);
    expect(() => service.join(room.code, acc('Cam'), 'player')).toThrow('Ván đang chơi');
  });

  it('cancels the game when a player quits, and they can come back for a new one', () => {
    const { service, room, host, guest } = setupRoom();
    service.start(room.code, host.id);
    service.leave(room.code, guest.id);
    expect(room.status).toBe('lobby');
    expect(room.state).toBeNull();
    expect(room.players.map((p) => p.id)).toEqual([host.id]);
    service.join(room.code, acc('Bob'), 'player');
    service.start(room.code, host.id);
    expect(room.status).toBe('playing');
  });

  it('stops spectators from moving and gives them the public view', () => {
    const { service, room, host } = setupRoom();
    const { player: fan } = service.join(room.code, acc('Cam'), 'spectator');
    service.start(room.code, host.id);
    expect(() => service.move(room.code, fan.id, { cell: 0 })).toThrow('Bạn đang xem');
    expect(service.snapshotFor(room, fan.id).view).toEqual(room.state);
  });

  it('lets a spectator take a free seat', () => {
    const { service, room, guest } = setupRoom();
    const { player: fan } = service.join(room.code, acc('Cam'), 'spectator');
    service.leave(room.code, guest.id);
    service.sit(room.code, fan.id);
    expect(room.players.map((p) => p.name)).toEqual(['Alice', 'Cam']);
  });

  it('makes the next player host when the host leaves, back in the lobby', () => {
    const { service, room, host, guest } = setupRoom();
    service.start(room.code, host.id);
    for (const [id, cell] of [
      [host.id, 0],
      [guest.id, 3],
      [host.id, 1],
      [guest.id, 4],
      [host.id, 2],
    ] as const) {
      service.move(room.code, id, { cell });
    }
    const { closed } = service.leave(room.code, host.id);
    expect(closed).toBe(false);
    expect(room.hostId).toBe(guest.id);
    expect(room.status).toBe('lobby');
    expect(room.score.wins).toEqual([1, 0]); // the score stays with the room
  });

  it('disbands the room when no player is left, even with spectators inside', () => {
    const service = new RoomsService();
    const { room, player } = service.create('tic-tac-toe', acc('Alice'));
    service.join(room.code, acc('Cam'), 'spectator');
    expect(service.leave(room.code, player.id).closed).toBe(true);
    expect(service.list('tic-tac-toe')).toEqual([]);
    expect(() => service.join(room.code, acc('Dao'), 'spectator')).toThrow('Phòng không còn nữa');
  });

  it('keeps score per seat across games', () => {
    const { service, room, host, guest } = setupRoom();
    const play = (moves: [string, number][]) => {
      service.start(room.code, host.id);
      for (const [id, cell] of moves) service.move(room.code, id, { cell });
    };
    // X (host, seat 0) wins the top row.
    play([
      [host.id, 0],
      [guest.id, 3],
      [host.id, 1],
      [guest.id, 4],
      [host.id, 2],
    ]);
    // Draw.
    play([
      [host.id, 0],
      [guest.id, 1],
      [host.id, 2],
      [guest.id, 4],
      [host.id, 3],
      [guest.id, 5],
      [host.id, 7],
      [guest.id, 6],
      [host.id, 8],
    ]);
    expect(service.snapshotFor(room, guest.id).score).toEqual({ wins: [1, 0], draws: 1 });
  });
});
