import { games, type JoinedRoom } from '@psc/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { bridge } from '../phaser/bridge';
import { loadName, saveName } from '../session';
import { request } from '../socket';

export function Home({ onEnter }: { onEnter: (joined: JoinedRoom) => void }) {
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState(
    () => new URLSearchParams(window.location.search).get('room') ?? '',
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const onSelect = (gameId: string) => {
      setError('');
      setSelected(gameId);
    };
    const onLocked = () => {
      setToast('Game này sắp có, bạn chờ nhé!');
      setTimeout(() => setToast(''), 2000);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', onKey);
    bridge.on('hub:select', onSelect);
    bridge.on('hub:locked', onLocked);
    return () => {
      bridge.off('hub:select', onSelect);
      bridge.off('hub:locked', onLocked);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  async function run(action: () => Promise<JoinedRoom>) {
    setError('');
    saveName(name);
    try {
      onEnter(await action());
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const join = (e: FormEvent) => {
    e.preventDefault();
    void run(() => request('room:join', { roomCode: code.trim().toUpperCase(), name }));
  };

  const game = selected ? games[selected] : undefined;
  const players = game
    ? game.minPlayers === game.maxPlayers
      ? `${game.minPlayers}`
      : `${game.minPlayers}–${game.maxPlayers}`
    : '';

  return (
    <>
      <header className="hud-top">
        <h1 className="logo">Chơi Chút Bài</h1>
        <label className="name-field">
          <span>Tên của bạn</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} />
        </label>
      </header>

      <form className="hud-bottom panel join" onSubmit={join}>
        <input
          aria-label="Mã phòng"
          placeholder="Mã phòng"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={4}
          className="code-input"
        />
        <button type="submit" className="btn" disabled={!name.trim() || code.trim().length !== 4}>
          Vào phòng
        </button>
      </form>

      {!selected && !code && <p className="hint">Chọn một hòn đảo để tạo phòng chơi</p>}
      {toast && <p className="toast">{toast}</p>}

      {game && (
        <div className="modal-backdrop">
          <div className="panel modal" role="dialog" aria-label={game.name}>
            <h2>{game.name}</h2>
            <p className="muted">{players} người chơi</p>
            {!name.trim() && <p className="muted">Nhập tên ở góc trên trước đã nhé.</p>}
            <button
              type="button"
              className="btn"
              disabled={!name.trim()}
              onClick={() => run(() => request('room:create', { gameId: game.id, name }))}
            >
              Tạo phòng
            </button>
            <button type="button" className="btn secondary" onClick={() => setSelected(null)}>
              Đóng
            </button>
            {error && <p className="error">{error}</p>}
          </div>
        </div>
      )}
      {!game && error && <p className="toast error">{error}</p>}
    </>
  );
}
