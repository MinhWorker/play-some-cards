import {
  type ClientToServerEvents,
  type HandshakeAuth,
  PROTOCOL_VERSION,
  type ServerToClientEvents,
} from '@psc/shared';
import { io, type Socket } from 'socket.io-client';
import { loadToken, serverUrl } from '@/lib/auth';

/**
 * The game connection. It only connects once logged in (useAccount calls `connect()`); the
 * login token is read again on every (re)connect. `useVersionGuard` handles a server that
 * speaks another PROTOCOL_VERSION.
 */
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(serverUrl, {
  autoConnect: false,
  auth: (cb) =>
    cb({ token: loadToken() ?? '', protocol: PROTOCOL_VERSION } satisfies HandshakeAuth),
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
