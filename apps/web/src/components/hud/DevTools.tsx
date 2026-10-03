import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  DEV_SETTINGS,
  type DevKey,
  type DevSetting,
  devSetting,
  devSettingsSnapshot,
  setDevSetting,
  subscribeDevSettings,
} from '@/lib/devTools';
import './DevTools.css';

const OPEN_KEY = 'psc:dev-open';

function savedOpen() {
  try {
    return localStorage.getItem(OPEN_KEY) === '1';
  } catch {
    return false;
  }
}

/** Dev tools panel (bottom-left, outside production only): one control per DEV_SETTINGS entry. */
export function DevTools() {
  const [open, setOpen] = useState(savedOpen);
  useSyncExternalStore(subscribeDevSettings, devSettingsSnapshot);

  const toggleOpen = () => {
    setOpen(!open);
    try {
      localStorage.setItem(OPEN_KEY, open ? '0' : '1');
    } catch {}
  };

  return (
    <div className="devtools hud">
      {devSetting('fps') && <FpsMeter />}
      {open && (
        <div className="devtools-panel">
          <RuntimeDiagnostics />
          {(Object.keys(DEV_SETTINGS) as DevKey[]).map((key) => (
            <Control key={key} id={key} />
          ))}
        </div>
      )}
      <button type="button" className="devtools-btn" aria-expanded={open} onClick={toggleOpen}>
        DEV
      </button>
    </div>
  );
}

function Control({ id }: { id: DevKey }) {
  // Widened: with a single setting TypeScript would narrow these to that one entry.
  const setting = DEV_SETTINGS[id] as DevSetting;
  const value: unknown = devSetting(id);
  const set = setDevSetting as (key: DevKey, value: unknown) => void;

  if (setting.type === 'toggle')
    return (
      <label className="devtools-row">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => set(id, e.target.checked)}
        />
        {setting.label}
      </label>
    );
  return (
    <label className="devtools-row">
      {setting.label}
      <input
        type={setting.type}
        defaultValue={String(value)}
        onBlur={(e) => {
          const next = setting.type === 'number' ? Number(e.target.value) : e.target.value;
          if (next !== value) set(id, next);
        }}
      />
    </label>
  );
}

/** Frames per second over the last half second (Phaser draws once per browser frame). */
function FpsMeter() {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let frames = 0;
    let since = performance.now();
    let id = requestAnimationFrame(function tick(now) {
      frames++;
      if (now - since >= 500) {
        setFps(Math.round((frames * 1000) / (now - since)));
        frames = 0;
        since = now;
      }
      id = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, []);
  return <output className="devtools-fps">{fps} FPS</output>;
}

/** Read-only metadata; never includes game snapshots or cards. */
function RuntimeDiagnostics() {
  const [snapshot, setSnapshot] = useState('');
  useEffect(() => {
    const read = () => {
      const inspect = (window as Window & { __runtimeDiagnostics?: () => unknown })
        .__runtimeDiagnostics;
      if (inspect) setSnapshot(JSON.stringify(inspect(), null, 2));
    };
    read();
    const id = setInterval(read, 500);
    return () => clearInterval(id);
  }, []);
  return (
    <details>
      <summary>Runtime</summary>
      <pre style={{ maxHeight: 180, overflow: 'auto', fontSize: 11 }}>{snapshot}</pre>
    </details>
  );
}
