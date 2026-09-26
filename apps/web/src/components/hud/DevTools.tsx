import { useState, useSyncExternalStore } from 'react';
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
      {open && (
        <div className="devtools-panel">
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
