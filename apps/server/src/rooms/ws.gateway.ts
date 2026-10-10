import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import {
  type AuthResponse,
  PROTOCOL_MISMATCH,
  PROTOCOL_VERSION,
  type WsClientMessage,
  type WsServerMessage,
} from '@xomdao/shared';
import { type WebSocket, WebSocketServer } from 'ws';
import { AccountError, AccountsService } from '../accounts/accounts.service.js';
import { type Client, type Result, RoomsGateway, type SocketData } from './rooms.gateway.js';

/** The path the Godot client connects to. */
export const WS_PATH = '/ws';
/** Pings this often; a connection that missed the last one is dropped. */
const PING_MS = 25_000;
/** Bigger messages are refused (a move or a profile is a few hundred bytes). */
const MAX_PAYLOAD = 64 * 1024;

type AuthEvent = 'auth:token' | 'auth:login' | 'auth:guest';

/**
 * The client transport: plain WebSocket + JSON on `/ws`, on the HTTP server's port (protocol in
 * packages/shared/src/protocol.ts, "WebSocket transport"). It only translates: after an `auth:*`
 * request logs the connection in, every request runs its `RoomsGateway` handler.
 */
@Injectable()
export class WsGateway implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('WsGateway');
  private wss?: WebSocketServer;
  private pinger?: NodeJS.Timeout;

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly gateway: RoomsGateway,
    private readonly accounts: AccountsService,
  ) {}

  onApplicationBootstrap() {
    const http = this.adapterHost.httpAdapter?.getHttpServer();
    if (!http) return;
    this.wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD });
    // Only /ws upgrades; anything else is left alone (and times out).
    http.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      if (new URL(req.url ?? '/', 'http://x').pathname !== WS_PATH) return;
      this.wss?.handleUpgrade(req, socket, head, (ws) => this.accept(ws));
    });
    const alive = new WeakSet<WebSocket>();
    this.wss.on('connection', (ws) => {
      alive.add(ws);
      ws.on('pong', () => alive.add(ws));
    });
    this.pinger = setInterval(() => {
      for (const ws of this.wss?.clients ?? []) {
        if (!alive.has(ws)) ws.terminate();
        else {
          alive.delete(ws);
          ws.ping();
        }
      }
    }, PING_MS).unref();
  }

  onApplicationShutdown() {
    clearInterval(this.pinger);
    for (const ws of this.wss?.clients ?? []) ws.terminate();
    this.wss?.close();
  }

  /** Serves one connection. */
  accept(ws: WebSocket) {
    this.wss?.emit('connection', ws);
    const client = {
      data: {} as SocketData,
      emit: (event: string, data: unknown) => {
        this.send(ws, { event, data });
        return true;
      },
    } as unknown as Client;
    ws.on('message', (raw, isBinary) => {
      void this.onMessage(client, ws, isBinary ? '' : raw.toString());
    });
    ws.on('close', () => {
      if (!client.data.user) return;
      this.gateway.handleDisconnect(client);
      this.gateway.detach(client);
    });
    ws.on('error', (err) => this.logger.warn(`WebSocket error: ${err.message}`));
  }

  private async onMessage(client: Client, ws: WebSocket, raw: string) {
    let message: WsClientMessage;
    try {
      message = JSON.parse(raw);
    } catch {
      return ws.close(1003, 'json');
    }
    const { id, event, data } = message ?? {};
    if (typeof id !== 'number' || typeof event !== 'string') return ws.close(1003, 'message');
    const ack = await this.answer(client, event, data ?? {});
    this.send(ws, { id, ack });
  }

  private async answer(client: Client, event: string, data: unknown): Promise<Result> {
    if (event.startsWith('auth:')) return this.login(client, event as AuthEvent, data);
    if (!client.data.user) return { ok: false, error: 'unauthorized' };
    const handler = this.gateway.handlerFor(event);
    if (!handler) return { ok: false, error: `Không có lệnh ${event}` };
    return handler(client, data);
  }

  /** `auth:token`, `auth:login`, `auth:guest`: checks the protocol, then logs the client in. */
  private async login(client: Client, event: AuthEvent, data: unknown): Promise<Result> {
    const req = (data ?? {}) as Record<string, unknown>;
    if (req.protocol !== PROTOCOL_VERSION) {
      return { ok: false, error: PROTOCOL_MISMATCH, protocol: PROTOCOL_VERSION } as Result;
    }
    if (client.data.user) return { ok: false, error: 'Bạn đã đăng nhập rồi' };
    try {
      let auth: AuthResponse | null = null;
      if (event === 'auth:token') {
        const user = await this.accounts.authenticate(req.token);
        if (user) auth = { token: String(req.token), user };
      } else if (event === 'auth:login') auth = await this.accounts.login(req);
      else if (event === 'auth:guest') auth = await this.accounts.guest(req.name);
      else return { ok: false, error: `Không có lệnh ${event}` };
      if (!auth) return { ok: false, error: 'unauthorized' };
      client.data.user = auth.user;
      this.gateway.attach(client);
      return { ok: true, ...auth };
    } catch (err) {
      if (err instanceof AccountError) return { ok: false, error: err.message };
      this.logger.error(err);
      return { ok: false, error: 'Server gặp lỗi, thử lại sau' };
    }
  }

  private send(ws: WebSocket, message: WsServerMessage) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
  }
}
