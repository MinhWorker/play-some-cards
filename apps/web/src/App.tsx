import { Home } from './pages/Home';
import { Room } from './pages/Room';
import { useConnected } from './useConnected';
import { useRoom } from './useRoom';

export function App() {
  const { session, snapshot, enter, leave } = useRoom();
  const connected = useConnected();

  return (
    <main className="app">
      <h1 className="logo">Play Some Cards</h1>
      {!connected && (
        <p className="banner">Connecting to the game server… this can take up to a minute.</p>
      )}
      {session ? (
        <Room session={session} snapshot={snapshot} onLeave={leave} />
      ) : (
        <Home onEnter={enter} />
      )}
    </main>
  );
}
