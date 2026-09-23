import { gameList, type JoinedRoom } from '@psc/shared';
import { type FormEvent, useState } from 'react';
import { loadName, saveName } from '../session';
import { request } from '../socket';

export function Home({ onEnter }: { onEnter: (joined: JoinedRoom) => void }) {
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState(
    () => new URLSearchParams(window.location.search).get('room') ?? '',
  );
  const [gameId, setGameId] = useState(gameList[0]?.id ?? '');
  const [error, setError] = useState('');

  async function run(action: () => Promise<JoinedRoom>) {
    setError('');
    saveName(name);
    try {
      onEnter(await action());
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const create = (e: FormEvent) => {
    e.preventDefault();
    void run(() => request('room:create', { gameId, name }));
  };

  const join = (e: FormEvent) => {
    e.preventDefault();
    void run(() => request('room:join', { roomCode: code.trim().toUpperCase(), name }));
  };

  return (
    <div className="stack">
      <label className="field">
        Tên của bạn
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} />
      </label>

      <form className="card stack" onSubmit={join}>
        <h2>Vào phòng</h2>
        <input
          placeholder="Mã phòng"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={4}
          className="code-input"
        />
        <button type="submit" disabled={!name.trim() || code.trim().length !== 4}>
          Vào
        </button>
      </form>

      <form className="card stack" onSubmit={create}>
        <h2>Tạo phòng</h2>
        <select value={gameId} onChange={(e) => setGameId(e.target.value)}>
          {gameList.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} (
              {g.minPlayers === g.maxPlayers ? g.minPlayers : `${g.minPlayers}–${g.maxPlayers}`}{' '}
              người)
            </option>
          ))}
        </select>
        <button type="submit" disabled={!name.trim()}>
          Tạo
        </button>
      </form>

      {error && <p className="error">{error}</p>}
    </div>
  );
}
