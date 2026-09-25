import './Toast.css';

/** A short message floating in the middle of the screen. `error` shows it in red. */
export function Toast({ children, error = false }: { children: React.ReactNode; error?: boolean }) {
  return <p className={`hud toast${error ? ' error' : ''}`}>{children}</p>;
}

/** A message pinned near the top of the screen (e.g. "connecting to the server…"). */
export function Banner({ children }: { children: React.ReactNode }) {
  return <p className="hud banner">{children}</p>;
}
