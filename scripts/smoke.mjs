// End-to-end check against a RUNNING server: two fake players create/join a room
// and play tic-tac-toe to a win. Usage: node scripts/smoke.mjs [serverUrl]
import { io } from 'socket.io-client';

const url = process.argv[2] ?? 'http://localhost:8033';

function client() {
  const socket = io(url, { transports: ['websocket'] });
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

const alice = client();
const bob = client();
try {
  const room = await alice.send('room:create', { gameId: 'tic-tac-toe', name: 'Alice' });
  await bob.send('room:join', { roomCode: room.roomCode, name: 'Bob' });
  await alice.send('game:start', {});
  for (const [who, cell] of [
    [alice, 0],
    [bob, 3],
    [alice, 1],
    [bob, 4],
    [alice, 2],
  ]) {
    await who.send('game:move', { move: { cell } });
  }
  await new Promise((r) => setTimeout(r, 200));
  const result = bob.state()?.result;
  if (result?.winners?.[0] !== room.playerId)
    throw new Error(`Unexpected result: ${JSON.stringify(result)}`);
  console.log(`OK: room ${room.roomCode}, Alice won`);
} catch (err) {
  console.error('SMOKE FAILED:', err.message);
  process.exitCode = 1;
} finally {
  alice.socket.close();
  bob.socket.close();
}
