import { useEffect, useState } from 'react';
import { imageUrl } from '@/lib/assetUrl';
import './WarmupOverlay.css';

/** Poke cycle: stick back, halfway in, deep in, halfway, then a short rest. */
const POKE = ['warmup', 'warmup-2', 'warmup-3', 'warmup-2', 'warmup', 'warmup', 'warmup'];
const SCENES = [...new Set(POKE)];
const FLAMES = ['flame-1', 'flame-2', 'flame-3', 'flame-4'];

/** Index of the current frame, stepping every `ms`. */
function useFrame(count: number, ms: number) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % count), ms);
    return () => clearInterval(id);
  }, [count, ms]);
  return frame;
}

/**
 * Full-screen scene while the socket is down (the hosted server sleeps when idle): a sleepy
 * programmer pokes the fire under a pot that is cooking the server. Every frame stays mounted
 * (only the current one is visible) so switching frames never waits for a download.
 */
export function WarmupOverlay() {
  const scene = POKE[useFrame(POKE.length, 170)];
  const flame = FLAMES[useFrame(FLAMES.length, 110)];
  return (
    <div className="warmup" role="status">
      <p className="warmup-title">Đang hâm nóng server… có thể mất 1 phút.</p>
      <div className="warmup-scene">
        {SCENES.map((name) => (
          <img key={name} src={imageUrl(name)} alt="" data-on={name === scene} />
        ))}
        <div className="warmup-fire">
          {FLAMES.map((name) => (
            <img key={name} src={imageUrl(name)} alt="" data-on={name === flame} />
          ))}
        </div>
      </div>
    </div>
  );
}
