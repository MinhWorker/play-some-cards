import { Home } from './pages/Home';
import { Room } from './pages/Room';
import { useRoom } from './useRoom';

export function App() {
  const { session, snapshot, enter, leave } = useRoom();

  return (
    <main className="app">
      <h1 className="logo">Play Some Cards</h1>
      {session ? (
        <Room session={session} snapshot={snapshot} onLeave={leave} />
      ) : (
        <Home onEnter={enter} />
      )}
    </main>
  );
}
