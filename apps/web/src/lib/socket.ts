import {
  type ClientToServerEvents,
  type HandshakeAuth,
  PROTOCOL_VERSION,
  type ServerToClientEvents,
} from '@xomdao/shared';
import { io, type Socket } from 'socket.io-client';
import { loadToken, serverUrl } from '@/lib/auth';
import { devSetting, devToolsEnabled, subscribeDevSettings } from '@/lib/devTools';

/**
 * The game connection. It only connects once logged in (useAccount calls `connectSocket()`); the
 * login token is read again on every (re)connect. `useVersionGuard` handles a server that
 * speaks another PROTOCOL_VERSION. Connect through `connectSocket()`, never `socket.connect()`.
 */
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(serverUrl, {
  autoConnect: false,
  auth: (cb) =>
    cb({ token: loadToken() ?? '', protocol: PROTOCOL_VERSION } satisfies HandshakeAuth),
});

/** Connects when logged in, unless the dev tools' "Ngắt kết nối server" is on. */
export function connectSocket() {
  if (loadToken() && !devSetting('offline')) socket.connect();
}

// Dev tools: switching "Ngắt kết nối server" closes the socket or connects it again.
if (devToolsEnabled)
  subscribeDevSettings(() => {
    if (devSetting('offline')) socket.disconnect();
    else if (!socket.active) connectSocket();
  });

type Events = ClientToServerEvents;
type Req<E extends keyof Events> = Parameters<Events[E]>[0];
type AckOf<E extends keyof Events> = Parameters<Parameters<Events[E]>[1]>[0];
type Success<E extends keyof Events> = Omit<Extract<AckOf<E>, { ok: true }>, 'ok'>;

/** Sends an event and resolves with the server's reply, or throws with its error message. */
export function request<E extends keyof Events>(event: E, payload: Req<E>): Promise<Success<E>> {
  return new Promise((resolve, reject) => {
    // biome-ignore lint/suspicious/noExplicitAny: socket.io's emit typing can't follow the generic E
    (socket.emit as any)(event, payload, (res: AckOf<E>) => {
      if (res.ok) resolve(res as Success<E>);
      else reject(new Error(res.error));
    });
  });
}
