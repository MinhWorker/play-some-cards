import { games } from '@xomdao/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { EventClock } from '../events/event-clock.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { CatalogService } from './catalog.service.js';

const acc = (name: string) => ({ id: name.toLowerCase(), name });

describe('CatalogService', () => {
  const caro = games['tic-tac-toe'];
  const status = caro?.status;
  afterEach(() => {
    if (caro && status) caro.status = status;
  });

  it('lists Cờ, Bài and Sự kiện with their games, leaving out games without a genre', () => {
    const { genres, games: cards } = new CatalogService(new RoomsService()).catalog();
    expect(genres.map((g) => g.id)).toEqual(['co', 'bai', 'su-kien']);
    const ids = cards.map((c) => c.id);
    expect(ids).toContain('tic-tac-toe');
    expect(ids).toContain('tien-len');
    expect(ids).not.toContain('bom-nguyen-to');
    expect(cards.find((c) => c.id === 'tien-len')).toMatchObject({
      genre: 'bai',
      kind: 'table',
      card: 'island',
      playing: 0,
      openRooms: 0,
    });
  });

  it('shows an event only while it is open', () => {
    const clock = new EventClock();
    const catalog = new CatalogService(new RoomsService(), true, clock);
    const ids = () => catalog.catalog().games.map((c) => c.id);
    clock.set('2026-09-17T23:59:00+07:00');
    expect(ids()).not.toContain('trung-thu');
    clock.set('2026-09-25T20:00:00+07:00');
    expect(catalog.catalog().games.find((c) => c.id === 'trung-thu')).toMatchObject({
      kind: 'event',
      genre: 'su-kien',
      event: { color: '#B3261E' },
    });
    const left = Date.parse('2026-10-04T00:00:00+07:00') - Date.parse('2026-09-25T20:00:00+07:00');
    const card = catalog.catalog().games.find((c) => c.id === 'trung-thu');
    expect(Math.abs((card?.closesIn ?? 0) - left)).toBeLessThan(1000);
    clock.set('2026-10-04T00:00:00+07:00');
    expect(ids()).not.toContain('trung-thu');
  });

  it('counts people playing and rooms with a free seat', () => {
    const rooms = new RoomsService();
    const { room } = rooms.create('tic-tac-toe', acc('Lan'));
    rooms.setConnected(room.code, 'lan', true);
    const full = rooms.create('tic-tac-toe', acc('Minh')).room;
    rooms.setConnected(full.code, 'minh', true);
    rooms.join(full.code, acc('Hoa'), 'player');
    rooms.setConnected(full.code, 'hoa', true);
    const card = new CatalogService(rooms).catalog().games.find((c) => c.id === 'tic-tac-toe');
    expect(card).toMatchObject({ playing: 3, openRooms: 1 });
  });

  it('hides works in progress when told to', () => {
    if (caro) caro.status = 'wip';
    const shown = new CatalogService(new RoomsService(), true).catalog().games;
    const hidden = new CatalogService(new RoomsService(), false).catalog().games;
    expect(shown.map((c) => c.id)).toContain('tic-tac-toe');
    expect(shown.at(-1)?.id).toBe('tic-tac-toe');
    expect(hidden.map((c) => c.id)).not.toContain('tic-tac-toe');
  });
});
