import { Home } from './pages/Home';
import { Room } from './pages/Room';
import { useConnected } from './useConnected';
import { useRoom } from './useRoom';

export function App() {
  const { session, snapshot, enter, leave } = useRoom();
  const connected = useConnected();

  return (
    <main className="app">
      <h1 className="logo">Chơi Chút Bài</h1>
      {!connected && (
        <p className="banner">Đang kết nối tới server… lần đầu có thể mất tới 1 phút.</p>
      )}
      {session ? (
        <Room session={session} snapshot={snapshot} onLeave={leave} />
      ) : (
        <Home onEnter={enter} />
      )}
    </main>
  );
}
