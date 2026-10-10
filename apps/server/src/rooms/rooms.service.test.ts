import { describe, expect, it, vi } from 'vitest';
import { RoomsService } from './rooms.service.js';

/** A logged-in account (id = lowercase name, for readable tests). */
const acc = (name: string) => ({ id: name.toLowerCase(), name });

/** A Caro move: mark the cell at x, y. */
const place = (x: unknown, y = 4) => ({ event: 'place', payload: { x, y } });

/** Caro's own state inside what the room keeps (games written with `Game` wrap it). */
const caro = (state: unknown) => (state as { state: Record<string, unknown> }).state;

/** Caro moves where `x` (who plays X) makes five in a row on row 4 while `o` plays row 6. */
const fiveInARow = (x: string, o: string) =>
  [2, 3, 4, 5, 6]
    .flatMap((col) => [
      [x, col, 4],
      [o, col, 6],
    ])
    .slice(0, -1) as [string, number, number][];

/**
 * Caro moves for a drawn game: the board grows once on each side to 15×15 (x, y from -3 to 11)
 * and X / O fill it in a pattern with at most two in a row, until the game calls the draw.
 */
function playToDraw(
  service: RoomsService,
  room: ReturnType<typeof setupRoom>['room'],
  x: string,
  o: string,
) {
  const markOf = (col: number, row: number) => ((((col + 2 * row + 1) % 4) + 4) % 4 < 2 ? x : o);
  const todo: [number, number][] = [
    [0, 4],
    [8, 5],
    [3, 0],
    [5, 8],
  ];
  for (let row = -3; row <= 11; row++) {
    for (let col = -3; col <= 11; col++) {
      if (!todo.some(([a, b]) => a === col && b === row)) todo.push([col, row]);
    }
  }
  while (room.status !== 'finished') {
    const { turn, board } = caro(room.state) as {
      turn: string;
      board: { left: number; top: number; cols: number; rows: number };
    };
    const i = todo.findIndex(
      ([col, row]) =>
        markOf(col, row) === turn &&
        col >= board.left &&
        row >= board.top &&
        col < board.left + board.cols &&
        row < board.top + board.rows,
    );
    const [move] = todo.splice(i, 1);
    if (!move) throw new Error('no move left');
    service.move(room.code, turn, place(...move));
  }
}

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
    for (const [id, x, y] of fiveInARow(host.id, guest.id)) {
      service.move(room.code, id, place(x, y));
    }
    expect(room.status).toBe('finished');
    expect(room.result?.winners).toEqual([host.id]);
  });

  it('tells its listeners when a game ends', () => {
    const { service, room, host, guest } = setupRoom();
    const finished = vi.fn();
    service.onFinished(finished);
    service.start(room.code, host.id);
    for (const [id, x, y] of fiveInARow(host.id, guest.id)) {
      service.move(room.code, id, place(x, y));
    }
    expect(finished).toHaveBeenCalledOnce();
    expect(finished.mock.calls[0]?.[0]).toMatchObject({
      gameId: 'tic-tac-toe',
      seats: [
        { id: host.id, name: 'Alice', bot: false, left: false },
        { id: guest.id, name: 'Bob', bot: false, left: false },
      ],
      result: { winners: [host.id] },
    });
  });

  it('rejects malformed moves', () => {
    const { service, room, host } = setupRoom();
    service.start(room.code, host.id);
    expect(() => service.move(room.code, host.id, place('x'))).toThrow('Nước đi không hợp lệ');
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
    expect(service.rename('bob', { name: 'Bobby', avatar: 'girl' })).toBe(room);
    expect(service.snapshotFor(room, 'alice').players.map((p) => p.name)).toEqual([
      'Alice',
      'Bobby',
    ]);
    expect(service.snapshotFor(room, 'alice').players[1]?.avatar).toBe('girl');
    expect(service.rename('nobody', { name: 'X' })).toBeUndefined();
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
    expect(() => service.move(room.code, fan.id, place(0))).toThrow('Bạn đang xem');
    expect(service.snapshotFor(room, fan.id).view).toEqual(caro(room.state));
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
    for (const [id, x, y] of fiveInARow(host.id, guest.id)) {
      service.move(room.code, id, place(x, y));
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
    // X (host, seat 0) wins.
    service.start(room.code, host.id);
    for (const [id, x, y] of fiveInARow(host.id, guest.id))
      service.move(room.code, id, place(x, y));
    // Draw.
    service.start(room.code, host.id);
    playToDraw(service, room, host.id, guest.id);
    expect(service.snapshotFor(room, guest.id).score).toEqual({ wins: [1, 0], draws: 1 });
  });

  describe('against the computer', () => {
    const botRoom = (level = 'hard') => {
      const service = new RoomsService();
      const { room, player } = service.create('tic-tac-toe', acc('Alice'), {
        opponent: 'bot',
        level,
      });
      return { service, room, player };
    };

    it('seats the computer when the options ask for it', () => {
      const { service, room, player } = botRoom();
      expect(service.snapshotFor(room, player.id).players).toEqual([
        { id: 'alice', name: 'Alice', connected: true },
        { id: 'bot:1', name: 'Máy', connected: true, bot: true },
      ]);
      expect(service.list('tic-tac-toe')[0]?.canJoin).toBe(false);
    });

    it('creates a normal room without options', () => {
      const service = new RoomsService();
      const { room } = service.create('tic-tac-toe', acc('Alice'));
      expect(room.players).toHaveLength(1);
      expect(room.options).toEqual({ opponent: 'human', level: 'easy', swap: false });
    });

    it('rejects options the game does not know', () => {
      expect(() =>
        new RoomsService().create('tic-tac-toe', acc('Alice'), { opponent: 'robot' }),
      ).toThrow('Tuỳ chọn phòng không hợp lệ');
    });

    it('moves only on its turn', () => {
      const { service, room, player } = botRoom();
      service.start(room.code, player.id);
      expect(service.botMove(room.code)).toBeNull();
      service.move(room.code, player.id, place(0));
      expect(service.botMove(room.code)).toBe(room);
      expect(caro(room.state).turn).toBe(player.id);
      expect(service.botMove(room.code)).toBeNull();
    });

    it('closes the room when the last person leaves', () => {
      const { service, room, player } = botRoom();
      expect(service.leave(room.code, player.id).closed).toBe(true);
      expect(service.list('tic-tac-toe')).toEqual([]);
      expect(service.botMove(room.code)).toBeNull();
    });
  });

  describe('quick match', () => {
    it('puts the next player in the waiting room, which is then full', () => {
      const service = new RoomsService();
      const first = service.quickMatch('tic-tac-toe', acc('Alice'));
      expect(first.created).toBe(true);
      expect(service.isFull(first.room)).toBe(false);
      // A room made by hand is not offered to quick match.
      service.create('tic-tac-toe', acc('Carol'));
      const second = service.quickMatch('tic-tac-toe', acc('Bob'));
      expect(second).toMatchObject({ created: false, room: first.room });
      expect(service.isFull(first.room)).toBe(true);
      expect(service.fillQuick(first.room.code)?.status).toBe('playing');
      expect(first.room.players.map((p) => p.id)).toEqual(['alice', 'bob']);
      // Started: a third player gets a new room.
      expect(service.quickMatch('tic-tac-toe', acc('Dan')).created).toBe(true);
    });

    it('lets the computer take the seats nobody came for, then starts', () => {
      const service = new RoomsService();
      const { room } = service.quickMatch('tien-len', acc('Alice'));
      service.quickMatch('tien-len', acc('Bob'));
      service.fillQuick(room.code);
      expect(room.status).toBe('playing');
      expect(room.players.map((p) => p.id)).toEqual(['alice', 'bob', 'bot:1', 'bot:2']);
      expect(room.options).toMatchObject({ bots: 2 });
      expect(service.fillQuick(room.code)).toBeUndefined();
    });

    it('plays Caro against the computer when alone', () => {
      const service = new RoomsService();
      const { room } = service.quickMatch('tic-tac-toe', acc('Alice'));
      service.fillQuick(room.code);
      expect(room.options).toMatchObject({ opponent: 'bot' });
      expect(room.players.map((p) => p.id)).toEqual(['alice', 'bot:1']);
      expect(room.status).toBe('playing');
    });
  });

  describe('changing options between games', () => {
    it('lets the host change them before the next game', () => {
      const { service, room, host, guest } = setupRoom();
      expect(() => service.setOptions(room.code, guest.id, { swap: true })).toThrow(
        'Chỉ chủ phòng',
      );
      service.setOptions(room.code, host.id, { swap: true });
      service.start(room.code, host.id);
      expect(caro(room.state)).toMatchObject({ players: [guest.id, host.id], turn: guest.id });
      expect(() => service.setOptions(room.code, host.id, { swap: false })).toThrow('hết ván');
    });

    it('lets the computer leave or join the room', () => {
      const service = new RoomsService();
      const { room, player } = service.create('tic-tac-toe', acc('Alice'), { opponent: 'bot' });
      // A finished game Alice won (the computer plays at random, so set it up directly).
      service.start(room.code, player.id);
      room.status = 'finished';
      room.score.wins = [1, 0];
      // Now play people: the computer leaves, a seat opens, the tally starts over.
      service.setOptions(room.code, player.id, { opponent: 'human' });
      expect(room.players.map((p) => p.id)).toEqual(['alice']);
      expect(room).toMatchObject({ status: 'lobby', state: null, score: { wins: [0, 0] } });
      expect(service.list('tic-tac-toe')[0]?.canJoin).toBe(true);
      // Someone takes the seat: no room for the computer any more.
      service.join(room.code, acc('Bob'), 'player');
      expect(() => service.setOptions(room.code, player.id, { opponent: 'bot' })).toThrow(
        'Phòng đủ người',
      );
      service.leave(room.code, 'bob');
      service.setOptions(room.code, player.id, { opponent: 'bot', swap: true });
      service.start(room.code, player.id);
      // The computer is X now: it moves first.
      expect(service.botMove(room.code)).toBe(room);
    });
  });

  describe('games with timers and onLeave (Tiến Lên)', () => {
    function tienLen() {
      const service = new RoomsService();
      const { room, player: host } = service.create('tien-len', acc('Alice'), { bots: 1 });
      service.join(room.code, acc('Bob'), 'player');
      service.start(room.code, host.id);
      return { service, room };
    }

    it("starts the game's timer once and runs its hook when it goes off", () => {
      const { service, room } = tienLen();
      const timer = service.syncTimer(room);
      expect(timer?.ms).toBeGreaterThan(1000);
      expect(service.syncTimer(room)).toBeNull(); // already started
      expect(service.snapshotFor(room, 'alice').timer?.event).toBe('begin');
      expect(service.fireTimer(room.code, 'old')).toBeNull();
      service.fireTimer(room.code, timer?.key as string);
      expect(caro(room.state).phase).toBe('play');
      // Two people at the table: the turn clock runs.
      expect(service.syncTimer(room)).toMatchObject({ ms: 20000 });
    });

    it('lets the others play on when someone leaves, keeping their seat', () => {
      const { service, room } = tienLen();
      const { closed } = service.leave(room.code, 'bob');
      expect(closed).toBe(false);
      expect(room.status).toBe('playing');
      const snapshot = service.snapshotFor(room, 'alice');
      expect(snapshot.players.map((p) => p.id)).toEqual(['alice', 'bot:1']);
      expect(snapshot.seats?.map((p) => [p.id, Boolean(p.left)])).toEqual([
        ['alice', false],
        ['bot:1', false],
        ['bob', true],
      ]);
      expect(caro(room.state).gone).toEqual([2]);
    });
  });
});
