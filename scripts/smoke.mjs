// End-to-end check against a RUNNING server: three fake accounts register; two create/join a
// room from the room list and play tic-tac-toe to a win while the third one watches. Mid-game
// Bob closes his "browser" and logs in on another "device": he must be put back in his seat.
// Usage: node scripts/smoke.mjs [serverUrl]
import { io } from 'socket.io-client';

const url = process.argv[2] ?? 'http://localhost:8033';

const tag = Date.now().toString(36);

async function auth(path, body) {
  const res = await fetch(`${url}/api/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message);
  return data.token;
}

/** Registers a throwaway account (username = name + run tag) and returns its login token. */
const signUp = (name) =>
  auth('register', { username: `${name}${tag}`, password: 'smoke123', name, avatar: 'boy' });

function client(token) {
  const socket = io(url, { transports: ['websocket'], auth: { token } });
  const send = (event, payload) =>
    new Promise((resolve, reject) =>
      socket.emit(event, payload, (res) => (res.ok ? resolve(res) : reject(new Error(res.error)))),
    );
  let last = null;
  socket.on('room:state', (s) => {
    last = s;
  });
  return { socket, send, state: () => last };
}

const alice = client(await signUp('Alice'));
let bob = client(await signUp('Bob'));
const cam = client(await signUp('Cam'));
try {
  const room = await alice.send('room:create', { gameId: 'tic-tac-toe' });
  const { rooms } = await bob.send('lobby:watch', { gameId: 'tic-tac-toe' });
  if (!rooms.some((r) => r.code === room.roomCode && r.canJoin))
    throw new Error(`Room missing from list: ${JSON.stringify(rooms)}`);
  await bob.send('room:join', { roomCode: room.roomCode, role: 'player' });
  await cam.send('room:join', { roomCode: room.roomCode, role: 'spectator' });
  await alice.send('game:start', {});
  const refused = await cam.send('game:move', { move: { cell: 0 } }).catch((e) => e.message);
  if (refused !== 'Bạn đang xem, không đi được')
    throw new Error(`Spectator move was not refused: ${refused}`);
  await alice.send('game:move', { move: { cell: 0 } });
  await bob.send('game:move', { move: { cell: 3 } });

  // Bob closes the browser without leaving, then logs in elsewhere: same seat, same game.
  bob.socket.close();
  await new Promise((r) => setTimeout(r, 200));
  if (alice.state()?.players[1]?.connected !== false) throw new Error('Bob should be offline');
  bob = client(await auth('login', { username: `BOB${tag}`, password: 'smoke123' }));
  const resumed = await bob.send('session:resume', {});
  if (resumed.room?.roomCode !== room.roomCode) throw new Error('Bob was not put back in his room');
  await new Promise((r) => setTimeout(r, 200));
  if (alice.state()?.players[1]?.connected !== true) throw new Error('Bob should be back online');

  for (const [who, cell] of [
    [alice, 1],
    [bob, 4],
    [alice, 2],
  ]) {
    await who.send('game:move', { move: { cell } });
  }
  await new Promise((r) => setTimeout(r, 200));
  const result = cam.state()?.result;
  if (result?.winners?.[0] !== room.playerId)
    throw new Error(`Unexpected result: ${JSON.stringify(result)}`);
  console.log(
    `OK: room ${room.roomCode}, Bob came back from another device, Alice won, Cam watched`,
  );
} catch (err) {
  console.error('SMOKE FAILED:', err.message);
  process.exitCode = 1;
} finally {
  alice.socket.close();
  bob.socket.close();
  cam.socket.close();
}
