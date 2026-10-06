/** Capture cleanup, room isolation and subscription bounds protect dev logs. */
import { describe, expect, it, vi } from 'vitest';
import { RoomsService } from '../rooms/rooms.service.js';
import { captureConsole, followRoomLog, logRoom, runRoomHook } from './room-log.js';

const room = (dev = true) =>
  new RoomsService(dev).create('tic-tac-toe', { id: 'a', name: 'A' }).room;
describe('room logs', () => {
  it('bounds the buffer, increases ids and unsubscribes cleanly', () => {
    const r = room(),
      other = room();
    const receive = vi.fn();
    const stop = followRoomLog(r, receive);
    for (let i = 0; i < 510; i++) logRoom(r, { kind: 'move', level: 'info', text: String(i) });
    expect(r.dev?.log).toHaveLength(500);
    expect(r.dev?.log.at(-1)?.id).toBe(511);
    expect(receive).toHaveBeenCalledTimes(510);
    expect(other.dev?.log).toHaveLength(1);
    stop();
    logRoom(r, { kind: 'room', level: 'info', text: 'Rời phòng' });
    expect(receive).toHaveBeenCalledTimes(510);
  });
  it('truncates large details and serializes error stacks', () => {
    const r = room();
    logRoom(r, { kind: 'error', level: 'error', text: 'Lỗi', data: new Error('boom') });
    expect(r.dev?.log.at(-1)?.data).toMatchObject({
      message: 'boom',
      stack: expect.stringContaining('boom'),
    });
    logRoom(r, { kind: 'game', level: 'info', text: 'State', data: { huge: 'x'.repeat(40_000) } });
    expect(r.dev?.log.at(-1)?.data).toMatchObject({ note: 'đã cắt' });
    expect(JSON.stringify(r.dev?.log.at(-1)?.data).length).toBeLessThan(20_100);
  });
  it('captures each console method, still prints, and restores after exceptions', () => {
    const r = room();
    const original = console.log;
    const terminal = vi.spyOn(console, 'log').mockImplementation(() => {});
    const saved = console.log;
    try {
      expect(() =>
        captureConsole(r, () => {
          console.log('landed %d', 20);
          throw new Error('boom');
        }),
      ).toThrow('boom');
      expect(console.log).toBe(saved);
      expect(terminal).toHaveBeenCalledWith('landed %d', 20);
      expect(r.dev?.log.at(-1)).toMatchObject({ kind: 'game', text: 'landed 20' });
      expect(() =>
        runRoomHook(r, 'onRoll', () => {
          throw new Error('bad hook');
        }),
      ).toThrow('bad hook');
      expect(r.dev?.log.at(-1)).toMatchObject({
        kind: 'error',
        text: 'Lỗi trong onRoll: bad hook',
      });
    } finally {
      terminal.mockRestore();
    }
    expect(console.log).toBe(original);
  });
  it('allocates and sends no logs with dev disabled', () => {
    const r = room(false);
    const receive = vi.fn();
    followRoomLog(r, receive);
    logRoom(r, { kind: 'room', level: 'info', text: 'x' });
    captureConsole(r, () => 3);
    expect(r.dev).toBeUndefined();
    expect(receive).not.toHaveBeenCalled();
  });
});
