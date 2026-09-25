import { useEffect, useRef, useState } from 'react';
import { applySound, type Channel, isSilent, loadSound, type SoundSettings } from '@/lib/sound';
import './SoundControl.css';
import { imageUrl } from '@/lib/assetUrl';

const CHANNELS: { id: Channel; label: string }[] = [
  { id: 'music', label: 'Nhạc' },
  { id: 'sfx', label: 'Hiệu ứng' },
];

const icon = (silent: boolean) => imageUrl(silent ? 'speaker-off' : 'speaker-on');

/**
 * Speaker button in the top-right corner. Tap it for a panel with a volume slider and a
 * mute toggle for the music and for sound effects separately.
 */
export function SoundControl() {
  const [settings, setSettings] = useState(loadSound);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => applySound(settings), [settings]);

  // Close the panel when tapping anywhere else.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const update = (
    channel: Channel,
    change: (s: SoundSettings[Channel]) => SoundSettings[Channel],
  ) => setSettings((s) => ({ ...s, [channel]: change(s[channel]) }));

  const allSilent = isSilent(settings.music) && isSilent(settings.sfx);

  return (
    <div className="hud sound" ref={ref}>
      <button
        type="button"
        className="sound-btn"
        aria-label="Âm thanh"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <img src={icon(allSilent)} alt="" />
      </button>
      {open && (
        <div className="panel sound-panel">
          {CHANNELS.map(({ id, label }) => {
            const s = settings[id];
            const silent = isSilent(s);
            const percent = s.muted ? 0 : Math.round(s.volume * 100);
            return (
              <div key={id} className="sound-row">
                <span className="sound-label">{label}</span>
                <button
                  type="button"
                  className="sound-btn small"
                  aria-label={`${silent ? 'Bật' : 'Tắt'} ${label.toLowerCase()}`}
                  onClick={() =>
                    // Unmuting at volume 0 would stay silent, so bring it back up.
                    update(id, (c) =>
                      isSilent(c)
                        ? { muted: false, volume: c.volume || 0.5 }
                        : { ...c, muted: true },
                    )
                  }
                >
                  <img src={icon(silent)} alt="" />
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={percent}
                  aria-label={`Âm lượng ${label.toLowerCase()}`}
                  onChange={(e) =>
                    update(id, () => ({ muted: false, volume: Number(e.target.value) / 100 }))
                  }
                />
                <span className="sound-value">{percent}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
