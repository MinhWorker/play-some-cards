/** Three-state translucent overlay: hidden, fading room logs, and focused keyboard commands. */
import type { RoomSnapshot } from '@psc/shared';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  consoleSnapshot,
  filteredConsoleEntries,
  setConsoleRoom,
  startConsole,
  subscribeConsole,
} from '@/lib/devConsole';
import { installConsoleKeys } from '@/lib/devConsoleKeys';
import { bridge } from '@/phaser/bridge';
import { CommandInput } from './CommandInput';
import { LogLines } from './LogLines';
import './DevConsole.css';
export default function DevConsole({ room }: { room: RoomSnapshot | null }) {
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'hidden' | 'view' | 'typing'>('view');
  const [, refreshView] = useState(0);
  const state = useSyncExternalStore(subscribeConsole, consoleSnapshot);
  const initialRoom = useRef(room);
  const exit = useCallback(() => {
    input.current?.blur();
    setMode((value) => (value === 'hidden' ? 'hidden' : 'view'));
  }, []);
  useEffect(() => startConsole(initialRoom.current), []);
  useEffect(() => setConsoleRoom(room), [room]);
  useEffect(
    () =>
      installConsoleKeys(
        () => setMode((value) => (value === 'hidden' ? 'view' : 'hidden')),
        () => setMode('typing'),
        () => input.current,
      ),
    [],
  );
  const typing = mode === 'typing';
  useEffect(() => {
    bridge.emit('dev:typing', typing);
    if (typing) input.current?.focus();
    else input.current?.blur();
    return () => {
      bridge.emit('dev:typing', false);
    };
  }, [typing]);
  useEffect(() => {
    const blur = () => {
      if (typing) exit();
    };
    document.addEventListener('pointerdown', blur, true);
    return () => document.removeEventListener('pointerdown', blur, true);
  }, [typing, exit]);
  const entries = filteredConsoleEntries().filter(
    (entry) => typing || Date.now() - entry.t < (entry.level === 'error' ? 30_000 : 10_000),
  );
  useEffect(() => {
    if (mode !== 'view' || entries.length === 0) return;
    const expiresAt = Math.min(
      ...entries.map((entry) => entry.t + (entry.level === 'error' ? 30_000 : 10_000)),
    );
    const timer = window.setTimeout(
      () => refreshView((value) => value + 1),
      Math.max(0, expiresAt - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [mode, entries]);
  const latest = state.entries.at(-1)?.id;
  useEffect(() => {
    if (latest !== undefined && log.current)
      log.current.scrollTop = typing ? log.current.scrollHeight : 0;
  }, [latest, typing]);
  const { dock, opacity } = state.preferences;
  return (
    <div
      className={`dev-console dev-console-${dock}`}
      data-mode={mode}
      hidden={mode === 'hidden' || (!typing && entries.length === 0)}
      style={{ opacity: opacity / 100 }}
    >
      <div className="dev-console-log" ref={log}>
        <LogLines entries={entries.slice(typing ? -20 : -8)} typing={typing} />
      </div>
      {typing ? (
        <CommandInput
          input={input}
          onExit={exit}
          onScroll={(direction) =>
            log.current?.scrollBy(0, direction * (log.current.clientHeight || 120) * 0.8)
          }
        />
      ) : null}
    </div>
  );
}
