// End-to-end check against a RUNNING server: two fake players create/join a room from the
// room list and play tic-tac-toe to a win while a third one watches. Usage: node scripts/smoke.mjs [serverUrl]
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
const cam = client();
try {
  const room = await alice.send('room:create', { gameId: 'tic-tac-toe', name: 'Alice' });
  const { rooms } = await bob.send('lobby:watch', { gameId: 'tic-tac-toe' });
  if (!rooms.some((r) => r.code === room.roomCode && r.canJoin))
    throw new Error(`Room missing from list: ${JSON.stringify(rooms)}`);
  await bob.send('room:join', { roomCode: room.roomCode, name: 'Bob', role: 'player' });
  await cam.send('room:join', { roomCode: room.roomCode, name: 'Cam', role: 'spectator' });
  await alice.send('game:start', {});
  const refused = await cam.send('game:move', { move: { cell: 0 } }).catch((e) => e.message);
  if (refused !== 'Bạn đang xem, không đi được')
    throw new Error(`Spectator move was not refused: ${refused}`);
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
  const result = cam.state()?.result;
  if (result?.winners?.[0] !== room.playerId)
    throw new Error(`Unexpected result: ${JSON.stringify(result)}`);
  console.log(`OK: room ${room.roomCode}, Alice won, Cam watched`);
} catch (err) {
  console.error('SMOKE FAILED:', err.message);
  process.exitCode = 1;
} finally {
  alice.socket.close();
  bob.socket.close();
  cam.socket.close();
}
