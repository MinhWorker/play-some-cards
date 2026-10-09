import { defaultOptions, type GameResult, games } from '@psc/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SoundControl, Toast } from '@/components/hud';
import { Button } from '@/components/ui/Button';
import { useGameClient } from '@/hooks/useGameClient';
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
 * A board that draws its own room bar (`hud.nav`) keeps the whole height: the seat buttons fold
 * into a "Chơi thử" button at the bottom.
 */
export function Sandbox({ gameId, players: count }: Props) {
  const game = games[gameId];
  const seats = useMemo(() => {
    const n = game ? Math.min(game.maxPlayers, Math.max(game.minPlayers, count)) : 0;
    return Array.from({ length: n }, (_, i) => ({
      id: `p${i + 1}`,
      name: seatName(i),
      connected: true,
      avatar: i % 2 ? 'girl' : 'boy',
      frame: 'gold',
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
  // Phaser input and timers can arrive before React commits the next render. Keep one
  // synchronous current snapshot so an input never restores an older timer or position.
  const stateRef = useRef(state);
  const replaceState = useCallback((next: unknown) => {
    stateRef.current = next;
    setState(next);
  }, []);
  const client = useGameClient(gameId);
  const hasSetup = Boolean(client?.setup);
  const boardNav = Boolean(client?.hud?.nav);
  const [docked, setDocked] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const [me, setMe] = useState<string | null>(seats[0]?.id ?? null);
  const [error, setError] = useState('');
  const [score, setScore] = useState({ wins: seats.map(() => 0), draws: 0 });
  const [round, setRound] = useState(1);
  const [last, setLast] = useState<{ seq: number; player: string; move: unknown } | null>(null);
  const [lastResult, setLastResult] = useState<GameResult | null>(null);
  const bar = useRef<HTMLElement>(null);
  // What the rules get to know about the room, like on the server.
  const room = useMemo(
    () => ({
      players: seats.map(({ id, name, avatar, frame }) => ({
        id,
        name,
        bot: false,
        avatar,
        frame,
      })),
      hostId: me,
      score,
      options,
      lastResult,
    }),
    [seats, me, score, options, lastResult],
  );
  const result = game && state !== undefined ? game.getResult(state, room) : null;

  // The game's timer (`ctx.setTimer`) runs here like on the server; a new key = a new timer.
  const timer = game && state !== undefined ? game.timer(state) : null;
  const timerKey = timer ? `${round}:${timer.id}` : null;
  const timerMs = timer?.ms ?? 0;
  const [timerEnd, setTimerEnd] = useState(0);
  const roomRef = useRef(room);
  roomRef.current = room;
  useEffect(() => {
    if (!game || timerKey === null) return;
    setTimerEnd(Date.now() + timerMs);
    const handle = setTimeout(
      () => replaceState(game.fireTimer(stateRef.current, Math.random, roomRef.current)),
      timerMs,
    );
    return () => clearTimeout(handle);
  }, [game, timerKey, timerMs, replaceState]);

  // How long the game has lasted, like the server's `played`.
  const [startedAt, setStartedAt] = useState(Date.now);
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const over = Boolean(result);
  useEffect(() => {
    setEndedAt(over ? Date.now() : null);
  }, [over]);

  const restart = useCallback(
    (next: unknown = options) => {
      if (!game) return;
      // Like the server: the next game hears how this one ended (e.g. the winner leads).
      setLastResult(result);
      replaceState(
        game.setup(
          seats.map((s) => s.id),
          Math.random,
          next,
          { ...room, options: next, lastResult: result },
        ),
      );
      setRound((r) => r + 1);
      setStartedAt(Date.now());
      setLast(null);
      setError('');
    },
    [game, seats, options, room, result, replaceState],
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
      const current = stateRef.current;
      if (!game || current === undefined || !me) return;
      const parsed = game.moveSchema.safeParse(move);
      const problem = parsed.success
        ? game.validateMove(current, parsed.data, me, room)
        : 'Nước đi sai dạng';
      if (problem) return setError(problem);
      setError('');
      const next = game.applyMove(current, parsed.data, me, Math.random, room);
      setLast((l) => ({ seq: (l?.seq ?? 0) + 1, player: me, move: parsed.data }));
      const end = game.getResult(next, room);
      if (end) {
        setScore((s) => ({
          wins: s.wins.map((w, i) => (end.winners.includes(seats[i]?.id ?? '') ? w + 1 : w)),
          draws: s.draws + (end.winners.length ? 0 : 1),
        }));
      }
      replaceState(next);
    };
    bridge.on('board:move', onMove);
    return () => {
      bridge.off('board:move', onMove);
    };
  }, [game, me, seats, room, replaceState]);

  useEffect(() => {
    const el = bar.current;
    if (boardNav) {
      bridge.emit('hud:top', null);
      return () => {
        bridge.emit('hud:top', undefined);
      };
    }
    if (!el) return;
    const report = () => bridge.emit('hud:top', el.getBoundingClientRect().bottom);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [boardNav]);

  // A board's own room controls: no room to leave here, so leaving goes to the app.
  useEffect(() => {
    const onRoom = (action: unknown) => {
      if (action === 'leave' || action === 'home') window.location.assign('/');
      else if (action === 'new-game') restart();
      else if (action === 'customize') setSettingUp(true);
    };
    bridge.on('board:room', onRoom);
    return () => {
      bridge.off('board:room', onRoom);
    };
  }, [restart]);

  const stage = useMemo<Stage>(() => {
    if (!game || state === undefined) return { mode: 'sky' };
    if (settingUp)
      return { mode: 'setup', instance: `sandbox:${gameId}`, gameId, current: options };
    return {
      mode: 'board',
      instance: `sandbox:${gameId}`,
      gameId,
      view: game.getView(state, me, room),
      me: me ?? 'spectator',
      players: game.seats(state, room).map((s) => ({ ...s, connected: true })),
      // Whoever you look through can use the host's controls.
      hostId: me,
      result,
      score,
      options,
      round,
      last,
      timer: timer && {
        event: timer.event,
        ms: timer.ms,
        left: Math.max(0, timerEnd - Date.now()),
      },
      played: { ms: (endedAt ?? Date.now()) - startedAt, running: endedAt === null },
      // Whoever you look through is the host; nobody else watches.
      room: {
        newGame: me !== null && Boolean(result),
        customize: me !== null && hasSetup && Boolean(result),
        sit: false,
        watchers: 0,
      },
    };
  }, [
    hasSetup,
    game,
    gameId,
    state,
    me,
    result,
    score,
    options,
    settingUp,
    room,
    round,
    last,
    timer,
    timerEnd,
    startedAt,
    endedAt,
  ]);

  const winner = result && !client?.showsResult && (
    <div className="room-title">
      {result.winners.length
        ? `${result.winners.map((id) => seats.find((s) => s.id === id)?.name).join(', ')} thắng!`
        : 'Hoà!'}
    </div>
  );
  const controls = (
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
  );

  return (
    <>
      <PhaserStage stage={stage} />
      <main className="ui">
        {boardNav ? (
          <div className="hud sandbox-dock">
            {docked && winner}
            {/* Picking a seat or an action folds the buttons away again. */}
            {docked && (
              // biome-ignore lint/a11y/noStaticElementInteractions: the buttons inside are the controls
              // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard presses on them bubble as clicks
              <div onClick={() => setDocked(false)}>{controls}</div>
            )}
            <Button
              size="small"
              variant={docked ? 'primary' : 'secondary'}
              aria-expanded={docked}
              onClick={() => setDocked((open) => !open)}
            >
              Chơi thử
            </Button>
          </div>
        ) : (
          <header ref={bar} className="hud hud-top room-bar sandbox-bar">
            {/* No "Chơi thử" or game name: the seat buttons say it is the sandbox. */}
            {winner}
            {controls}
          </header>
        )}
        {!game && <Toast>Không có game "{gameId}"</Toast>}
        {error && <Toast>{error}</Toast>}
        <SoundControl button={!(client?.hud?.settings && !settingUp)} />
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
