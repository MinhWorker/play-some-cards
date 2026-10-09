/**
 * Moves browser storage saved under the old project prefix (`psc:`/`psc.`) to `xomdao`, so
 * players stay logged in and keep their settings after the rename. Imported first in main.tsx,
 * before any module reads storage.
 */
const OLD = /^psc([:.])/;

function migrate(storage: Storage): void {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && OLD.test(key)) keys.push(key);
  }
  for (const key of keys) {
    const next = key.replace(OLD, 'xomdao$1');
    const value = storage.getItem(key);
    if (value !== null && storage.getItem(next) === null) storage.setItem(next, value);
    storage.removeItem(key);
  }
}

try {
  migrate(localStorage);
  migrate(sessionStorage);
} catch {
  // Storage may be blocked (private mode); there is nothing to move then.
}
