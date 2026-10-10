/** The Godot transport against the real app: plain WebSocket + JSON next to Socket.IO. */
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PROTOCOL_MISMATCH, PROTOCOL_VERSION, type RoomSnapshot } from '@xomdao/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { AppModule } from '../app.module.js';

let app: INestApplication;
let url: string;

beforeAll(async () => {
  delete process.env.DATABASE_URL;
  app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  url = (await app.getUrl()).replace('http', 'ws');
});

afterAll(async () => {
  await app.close();
});

interface Ack {
  ok: boolean;
  [key: string]: unknown;
}

/** A Godot-like client: numbered requests, and every pushed event kept by name. */
async function connect() {
  const ws = new WebSocket(`${url}/ws`);
  await new Promise((resolve, reject) => ws.once('open', resolve).once('error', reject));
  let next = 0;
  const waiting = new Map<number, (ack: Ack) => void>();
  const pushed: { event: string; data: unknown }[] = [];
  ws.on('message', (raw) => {
    const message = JSON.parse(raw.toString());
    if ('id' in message) waiting.get(message.id)?.(message.ack);
    else pushed.push(message);
  });
  const request = (event: string, data: object = {}) =>
    new Promise<Ack>((resolve) => {
      const id = ++next;
      waiting.set(id, resolve);
      ws.send(JSON.stringify({ id, event, data }));
    });
  const states = () =>
    pushed.filter((m) => m.event === 'room:state').map((m) => m.data as RoomSnapshot);
  return { ws, request, pushed, states };
}

const settle = () => new Promise((r) => setTimeout(r, 100));

describe('WebSocket transport', () => {
  it('refuses another protocol and requests before logging in', async () => {
    const { ws, request } = await connect();
    expect(await request('auth:guest', { protocol: PROTOCOL_VERSION - 1, name: 'Lan' })).toEqual({
      ok: false,
      error: PROTOCOL_MISMATCH,
      protocol: PROTOCOL_VERSION,
    });
    expect(await request('catalog:get')).toEqual({ ok: false, error: 'unauthorized' });
    expect(await request('auth:token', { protocol: PROTOCOL_VERSION, token: 'nope' })).toEqual({
      ok: false,
      error: 'unauthorized',
    });
    ws.close();
  });

  it('lets two guests make a room, join it by code, play and see the state', async () => {
    const lan = await connect();
    const minh = await connect();
    const a = await lan.request('auth:guest', { protocol: PROTOCOL_VERSION, name: 'Lan' });
    const b = await minh.request('auth:guest', { protocol: PROTOCOL_VERSION, name: 'Minh' });
    expect(a).toMatchObject({ ok: true, user: { name: 'Lan' }, token: expect.any(String) });
    expect(await lan.request('session:resume')).toMatchObject({
      ok: true,
      room: null,
      balances: {},
    });

    const created = await lan.request('room:create', { gameId: 'tic-tac-toe' });
    const code = created.roomCode as string;
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
    const joined = await minh.request('room:join', {
      roomCode: ` ${code.toLowerCase()}`,
      role: 'player',
    });
    expect(joined).toMatchObject({ ok: true, roomCode: code });
    expect(await lan.request('game:start')).toEqual({ ok: true });

    const place = (x: number, y: number) => ({ move: { event: 'place', payload: { x, y } } });
    const me = (b.user as { id: string }).id;
    expect(await minh.request('game:move', place(4, 4))).toEqual({
      ok: false,
      error: 'Chưa tới lượt bạn',
    });
    expect(await lan.request('game:move', place(4, 4))).toEqual({ ok: true });
    await settle();
    const seen = minh.states().at(-1);
    expect(seen).toMatchObject({ code, status: 'playing', players: [{ name: 'Lan' }, { id: me }] });
    expect(seen?.view).toMatchObject({ turn: me });
    expect(seen?.last).toMatchObject({ seq: 1, move: { event: 'place' } });

    // Logging in again with the token puts the guest back in the room.
    lan.ws.close();
    await settle();
    const back = await connect();
    const token = a.token as string;
    expect(await back.request('auth:token', { protocol: PROTOCOL_VERSION, token })).toMatchObject({
      ok: true,
      user: { name: 'Lan' },
    });
    expect(await back.request('session:resume')).toMatchObject({ room: { roomCode: code } });
    back.ws.close();
    minh.ws.close();
  });

  it('answers unknown events without closing', async () => {
    const { ws, request } = await connect();
    await request('auth:guest', { protocol: PROTOCOL_VERSION, name: 'Hoa' });
    expect(await request('room:fly')).toEqual({ ok: false, error: 'Không có lệnh room:fly' });
    expect(await request('catalog:get')).toMatchObject({ ok: true, genres: expect.any(Array) });
    ws.close();
  });
});
