import './RotateHint.css';

/**
 * Covers everything on a phone held upright: the app is played sideways (docs/ui-guide.md).
 * Shown by CSS alone (portrait + touch screen), so it needs no state.
 */
export function RotateHint() {
  return (
    <div className="rotate-hint" role="alert">
      <div className="rotate-phone" aria-hidden="true" />
      <p className="rotate-title">Xoay ngang máy</p>
    </div>
  );
}
