import { games } from '@psc/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SoundControl, Toast } from '@/components/hud';
import { Button } from '@/components/ui/Button';
import { bridge, type Stage } from '@/phaser/bridge';
import { PhaserStage } from '@/phaser/PhaserStage';
import '@/pages/Room/Room.css';
import './Sandbox.css';

interface Props {
  gameId: string;
  players: number;
}

const seatName = (i: number) => `Người ${i + 1}`;

/**
 * Try a game alone, without the server or an account: `/?play=<id>&players=2` (dev and PR
 * previews only). The rules run right here in the browser, and the seat buttons switch whose
 * eyes you see the board with ("Khán giả" = a spectator). Saving a file hot-reloads it.
 */
export function Sandbox({ gameId, players: count }: Props) {
  const game = games[gameId];
  const seats = useMemo(() => {
    const n = game ? Math.min(game.maxPlayers, Math.max(game.minPlayers, count)) : 0;
    return Array.from({ length: n }, (_, i) => ({
      id: `p${i + 1}`,
      name: seatName(i),
      connected: true,
    }));
  }, [game, count]);
  const [state, setState] = useState<unknown>(() =>
    game?.setup(
      seats.map((s) => s.id),
      Math.random,
    ),
  );
  const [me, setMe] = useState<string | null>(seats[0]?.id ?? null);
  const [error, setError] = useState('');
  const [score, setScore] = useState({ wins: seats.map(() => 0), draws: 0 });
  const bar = useRef<HTMLElement>(null);
  const result = game && state !== undefined ? game.getResult(state) : null;

  const restart = useCallback(() => {
    if (!game) return;
    setState(
      game.setup(
        seats.map((s) => s.id),
        Math.random,
      ),
    );
    setError('');
  }, [game, seats]);

  // Moves from the board go through the same checks as on the server.
  useEffect(() => {
    const onMove = (move: unknown) => {
      if (!game || state === undefined || !me) return;
      const parsed = game.moveSchema.safeParse(move);
      const problem = parsed.success
        ? game.validateMove(state, parsed.data, me)
        : 'Nước đi sai dạng';
      if (problem) return setError(problem);
      setError('');
      const next = game.applyMove(state, parsed.data, me, Math.random);
      const end = game.getResult(next);
      if (end) {
        setScore((s) => ({
          wins: s.wins.map((w, i) => (end.winners.includes(seats[i]?.id ?? '') ? w + 1 : w)),
          draws: s.draws + (end.winners.length ? 0 : 1),
        }));
      }
      setState(next);
    };
    bridge.on('board:move', onMove);
    return () => {
      bridge.off('board:move', onMove);
    };
  }, [game, state, me, seats]);

  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const report = () => bridge.emit('hud:top', el.getBoundingClientRect().bottom);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const stage = useMemo<Stage>(() => {
    if (!game || state === undefined) return { mode: 'sky' };
    return {
      mode: 'board',
      gameId,
      view: game.getView(state, me),
      me: me ?? 'spectator',
      players: seats,
      result,
      score,
    };
  }, [game, gameId, state, me, seats, result, score]);

  return (
    <>
      <PhaserStage stage={stage} />
      <main className="ui">
        <header ref={bar} className="hud hud-top room-bar sandbox-bar">
          <div className="room-title">
            <div className="muted">
              {result
                ? result.winners.length
                  ? `${result.winners.map((id) => seats.find((s) => s.id === id)?.name).join(', ')} thắng!`
                  : 'Hoà!'
                : 'Chơi thử'}
            </div>
            <div className="room-code">{game?.name ?? gameId}</div>
          </div>
          <div className="sandbox-seats">
            {[
              ...seats.map((s) => ({ id: s.id as string | null, name: s.name })),
              { id: null, name: 'Khán giả' },
            ].map((s) => (
              <Button
                key={s.name}
                size="small"
                variant={s.id === me ? 'primary' : 'secondary'}
                onClick={() => setMe(s.id)}
              >
                {s.name}
              </Button>
            ))}
            <Button size="small" variant="secondary" onClick={restart}>
              Ván mới
            </Button>
          </div>
        </header>
        {!game && <Toast>Không có game "{gameId}"</Toast>}
        {error && <Toast>{error}</Toast>}
        <SoundControl />
      </main>
    </>
  );
}

/** `?play=<id>&players=<n>` when the sandbox is allowed here (not on the production site). */
export function sandboxFromUrl(allowed: boolean): Props | null {
  if (!allowed) return null;
  const params = new URLSearchParams(window.location.search);
  const gameId = params.get('play');
  if (!gameId) return null;
  return { gameId, players: Number(params.get('players')) || 2 };
}
