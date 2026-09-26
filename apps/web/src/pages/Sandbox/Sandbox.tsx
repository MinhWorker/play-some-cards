import { defaultOptions, games } from '@psc/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SoundControl, Toast } from '@/components/hud';
import { Button } from '@/components/ui/Button';
import { useHasSetup } from '@/hooks/useHasSetup';
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
 * eyes you see the board with ("Khán giả" = a spectator). "Tuỳ chỉnh" opens the game's own
 * settings screen, if it has one, and starts over with its options. Saving a file hot-reloads it.
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
  const [options, setOptions] = useState<unknown>(() => game && defaultOptions(game));
  const [state, setState] = useState<unknown>(() =>
    game?.setup(
      seats.map((s) => s.id),
      Math.random,
      options,
    ),
  );
  const hasSetup = useHasSetup(gameId);
  const [settingUp, setSettingUp] = useState(false);
  const [me, setMe] = useState<string | null>(seats[0]?.id ?? null);
  const [error, setError] = useState('');
  const [score, setScore] = useState({ wins: seats.map(() => 0), draws: 0 });
  const [round, setRound] = useState(1);
  const [last, setLast] = useState<{ seq: number; player: string; move: unknown } | null>(null);
  const bar = useRef<HTMLElement>(null);
  // What the rules get to know about the room, like on the server.
  const room = useMemo(
    () => ({
      players: seats.map((s) => ({ id: s.id, name: s.name, bot: false })),
      hostId: me,
      score,
      options,
    }),
    [seats, me, score, options],
  );
  const result = game && state !== undefined ? game.getResult(state, room) : null;

  const restart = useCallback(
    (next: unknown = options) => {
      if (!game) return;
      setState(
        game.setup(
          seats.map((s) => s.id),
          Math.random,
          next,
          { ...room, options: next },
        ),
      );
      setRound((r) => r + 1);
      setLast(null);
      setError('');
    },
    [game, seats, options, room],
  );

  // The setup screen's options are checked like on the server, then a new game starts with them.
  useEffect(() => {
    const onCreate = (raw: unknown) => {
      const parsed = game?.room?.options.safeParse(raw);
      if (!parsed?.success) return setError('Tuỳ chọn phòng không hợp lệ');
      setOptions(parsed.data);
      restart(parsed.data);
      setSettingUp(false);
    };
    const onCancel = () => setSettingUp(false);
    // The board's option changes (host, between games) apply from the next game.
    const onOptions = (raw: unknown) => {
      const parsed = game?.room?.options.safeParse(raw);
      if (!parsed?.success) return setError('Tuỳ chọn phòng không hợp lệ');
      setOptions(parsed.data);
    };
    bridge.on('setup:submit', onCreate);
    bridge.on('setup:cancel', onCancel);
    bridge.on('board:options', onOptions);
    return () => {
      bridge.off('setup:submit', onCreate);
      bridge.off('setup:cancel', onCancel);
      bridge.off('board:options', onOptions);
    };
  }, [game, restart]);

  // Moves from the board go through the same checks as on the server.
  useEffect(() => {
    const onMove = (move: unknown) => {
      if (!game || state === undefined || !me) return;
      const parsed = game.moveSchema.safeParse(move);
      const problem = parsed.success
        ? game.validateMove(state, parsed.data, me, room)
        : 'Nước đi sai dạng';
      if (problem) return setError(problem);
      setError('');
      const next = game.applyMove(state, parsed.data, me, Math.random, room);
      setLast((l) => ({ seq: (l?.seq ?? 0) + 1, player: me, move: parsed.data }));
      const end = game.getResult(next, room);
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
  }, [game, state, me, seats, room]);

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
    if (settingUp) return { mode: 'setup', gameId, current: options };
    return {
      mode: 'board',
      gameId,
      view: game.getView(state, me, room),
      me: me ?? 'spectator',
      players: seats,
      // Whoever you look through can use the host's controls.
      hostId: me,
      result,
      score,
      options,
      round,
      last,
    };
  }, [game, gameId, state, me, seats, result, score, options, settingUp, room, round, last]);

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
            <Button size="small" variant="secondary" onClick={() => restart()}>
              Ván mới
            </Button>
            {hasSetup && (
              <Button
                size="small"
                variant={settingUp ? 'primary' : 'secondary'}
                onClick={() => setSettingUp((open) => !open)}
              >
                Tuỳ chỉnh
              </Button>
            )}
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
