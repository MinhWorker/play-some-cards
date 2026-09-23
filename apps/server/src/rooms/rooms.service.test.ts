import { describe, expect, it } from 'vitest';
import { RoomsService } from './rooms.service.js';

function setupRoom() {
  const service = new RoomsService();
  const { room, player: host } = service.create('tic-tac-toe', 'Alice');
  const { player: guest } = service.join(room.code, 'Bob');
  return { service, room, host, guest };
}

describe('RoomsService', () => {
  it('creates a room with a 4-letter code', () => {
    const { room } = setupRoom();
    expect(room.code).toMatch(/^[A-Z2-9]{4}$/);
    expect(room.players).toHaveLength(2);
  });

  it('rejects unknown games', () => {
    expect(() => new RoomsService().create('nope', 'Alice')).toThrow('Unknown game');
  });

  it('only lets the host start', () => {
    const { service, room, guest } = setupRoom();
    expect(() => service.start(room.code, guest.id)).toThrow('Only the host');
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
    expect(() => service.move(room.code, host.id, { cell: 'x' })).toThrow('Invalid move');
  });

  it('lets a player rejoin with their session token', () => {
    const { service, room, guest } = setupRoom();
    service.setConnected(room.code, guest.id, false);
    const { player } = service.rejoin(room.code, guest.sessionToken);
    expect(player.id).toBe(guest.id);
    expect(player.connected).toBe(true);
  });
});
