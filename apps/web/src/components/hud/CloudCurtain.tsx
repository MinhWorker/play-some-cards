import { useEffect, useRef } from 'react';
import { playSfx } from '@/lib/sound';
import './CloudCurtain.css';
import { imageUrl } from '@/lib/assetUrl';

/**
 * Loading and scene-change screen: two banks of clouds slide in from the sides until they
 * cover everything (canvas and React UI), then part again with a whoosh. It starts closed,
 * so it doubles as the loading screen until `revealCurtain()` is called.
 */
const CLOSE_MS = 550;
const OPEN_MS = 850;
/** Minimum time the screen stays covered, so the new scene has drawn before it shows. */
const HOLD_MS = 250;

let panels: { root: HTMLElement; left: HTMLElement; right: HTMLElement } | null = null;
let closed = true;
let moving = false;

function slide(close: boolean) {
  if (!panels) return Promise.resolve();
  const { root, left, right } = panels;
  root.dataset.open = 'false';
  const moves = (
    [
      [left, -1],
      [right, 1],
    ] as const
  ).map(([el, side]) => {
    const away = `translateX(${side * 100}%)`;
    const anim = el.animate(
      [{ transform: close ? away : 'none' }, { transform: close ? 'none' : away }],
      {
        duration: close ? CLOSE_MS : OPEN_MS,
        easing: close ? 'cubic-bezier(0.3, 0, 0.2, 1)' : 'cubic-bezier(0.6, 0, 0.4, 1)',
        fill: 'forwards',
      },
    );
    return anim.finished.then(() => {
      anim.commitStyles();
      anim.cancel();
    });
  });
  return Promise.all(moves).then(() => {
    closed = close;
    root.dataset.open = String(!close);
  });
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Parts the clouds (with the whoosh). Used once the app has loaded. */
export async function revealCurtain() {
  if (!closed || moving) return;
  moving = true;
  playSfx('cloud-spread');
  await slide(false);
  moving = false;
}

/**
 * Covers the screen, runs `change` (e.g. switch page) while hidden, then reveals it.
 * Ignored while another transition is running, so double taps do nothing.
 */
export async function transition(change: () => void) {
  if (moving) return;
  moving = true;
  if (!closed) await slide(true);
  change();
  await wait(HOLD_MS);
  moving = false;
  await revealCurtain();
}

/** Always mounted above everything else; blocks taps while the clouds are in view. */
export function CloudCurtain() {
  const root = useRef<HTMLDivElement>(null);
  const left = useRef<HTMLDivElement>(null);
  const right = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (root.current && left.current && right.current)
      panels = { root: root.current, left: left.current, right: right.current };
    return () => {
      panels = null;
    };
  }, []);

  return (
    <div ref={root} className="curtain" data-open="false" aria-hidden="true">
      <div ref={left} className="curtain-side curtain-left">
        <img src={imageUrl('cloud-curtain')} alt="" />
      </div>
      <div ref={right} className="curtain-side curtain-right">
        <img src={imageUrl('cloud-curtain')} alt="" />
      </div>
    </div>
  );
}
