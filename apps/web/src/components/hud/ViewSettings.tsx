import { useState } from 'react';
import { HUD_SIZES, MARGINS, setViewSettings, viewSettings } from '@/lib/frame';

/**
 * The player's view settings, in the settings panel: how big the HUD is (text and buttons, in
 * React and on the canvas) and how far the game keeps from the screen's edges. Steps rather than
 * sliders: the panel itself grows or shrinks with the HUD size, under the player's finger.
 */
export function ViewSettings() {
  const [view, setView] = useState(viewSettings);
  const change = (next: Partial<typeof view>) => {
    setViewSettings(next);
    setView(viewSettings());
  };
  const rows = [
    {
      label: 'Cỡ giao diện',
      steps: HUD_SIZES,
      value: view.hudSize,
      shown: `${Math.round(view.hudSize * 100)}%`,
      set: (hudSize: number) => change({ hudSize }),
    },
    {
      label: 'Lề màn hình',
      steps: MARGINS,
      value: view.margin,
      shown: String(view.margin),
      set: (margin: number) => change({ margin }),
    },
  ];
  return (
    <>
      {rows.map(({ label, steps, value, shown, set }) => {
        const i = steps.indexOf(value);
        const prev = steps[i - 1];
        const next = steps[i + 1];
        return (
          <div key={label} className="sound-row view-row">
            <span className="sound-label view-label">{label}</span>
            <button
              type="button"
              className="icon-btn view-step"
              aria-label={`${label} nhỏ hơn`}
              disabled={prev === undefined}
              onClick={() => prev !== undefined && set(prev)}
            >
              −
            </button>
            <output className="view-value">{shown}</output>
            <button
              type="button"
              className="icon-btn view-step"
              aria-label={`${label} lớn hơn`}
              disabled={next === undefined}
              onClick={() => next !== undefined && set(next)}
            >
              +
            </button>
          </div>
        );
      })}
    </>
  );
}
