/**
 * Dev tools: settings for trying things out, changed from the DevTools panel (components/hud).
 * Only outside production (dev and PR previews); in production every setting is its default.
 * To add one, add an entry to DEV_SETTINGS and read it with `devSetting(key)`.
 */
declare const __DEV_TOOLS__: boolean;
export const devToolsEnabled = __DEV_TOOLS__;

interface Base {
  label: string;
  /** Reload the page after a change, for settings read once at startup. */
  reload?: boolean;
}
export type DevSetting =
  | (Base & { type: 'toggle'; default: boolean })
  | (Base & { type: 'text'; default: string })
  | (Base & { type: 'number'; default: number });

export const DEV_SETTINGS = {
  prodLocks: {
    label: 'Khoá portal như prod',
    type: 'toggle',
    default: false,
    reload: true,
  },
} satisfies Record<string, DevSetting>;

export type DevKey = keyof typeof DEV_SETTINGS;
type Value<K extends DevKey> = (typeof DEV_SETTINGS)[K]['default'];

const KEY = 'psc:dev';
const listeners = new Set<() => void>();
let values: Partial<Record<DevKey, unknown>> = load();

function load() {
  if (!devToolsEnabled) return {};
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? 'null') ?? {}) as typeof values;
  } catch {
    return {};
  }
}

export function devSetting<K extends DevKey>(key: K): Value<K> {
  const saved = values[key];
  const fallback = DEV_SETTINGS[key].default;
  return (typeof saved === typeof fallback ? saved : fallback) as Value<K>;
}

export function setDevSetting<K extends DevKey>(key: K, value: Value<K>) {
  if (!devToolsEnabled) return;
  values = { ...values, [key]: value };
  try {
    localStorage.setItem(KEY, JSON.stringify(values));
  } catch {}
  if ((DEV_SETTINGS[key] as DevSetting).reload) window.location.reload();
  else for (const fn of listeners) fn();
}

/** For useSyncExternalStore. */
export function subscribeDevSettings(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export const devSettingsSnapshot = () => values;
