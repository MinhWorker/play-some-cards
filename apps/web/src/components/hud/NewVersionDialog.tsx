import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useServerReady } from '@/hooks/useServerReady';
import type { NewBuild } from '@/lib/newBuild';
import { WarmupOverlay } from './WarmupOverlay';
import './NewVersionDialog.css';

const UPDATE_JOKES = [
  'Để server cook. Bản mới sắp ra lò rồi.',
  'Server đang respawn. Đồng đội đừng AFK nhé.',
  'Fact: xúc xắc có 6 mặt, nhưng bug có thể có 7.',
  'Bản mới đang loading. Vận may thì vẫn RNG.',
  'Plot twist: server cũng cần một nhịp thở.',
  'Chờ chút… server đang thoát chế độ potato.',
];

/** Blocks play while the production backend is still deploying. */
export function UpdateLoading() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  // A playful meter, never deployment progress. Readiness alone decides when to continue.
  const energy = Math.min(95, Math.floor(95 * (1 - Math.exp(-seconds / 18))));
  return (
    <div className="update-loading">
      <div className="update-scene" aria-hidden="true">
        <span className="update-cloud update-cloud-left" />
        <span className="update-cloud update-cloud-right" />
        <span className="update-spark update-spark-left">✦</span>
        <span className="update-spark update-spark-right">✦</span>
        <span className="update-spark update-spark-top">✦</span>
        <span className="update-shadow" />
        <div className="update-card update-card-left">
          <span>
            A<br />♠
          </span>
          <b>♠</b>
        </div>
        <div className="update-card update-card-right">
          <span>
            A<br />♦
          </span>
          <b>♦</b>
        </div>
        <div className="update-card update-card-front">
          <span>
            A<br />♥
          </span>
          <b>♥</b>
        </div>
        <div className="update-die">
          {[1, 3, 5, 7, 9].map((cell) => (
            <i
              key={cell}
              style={{ gridArea: `${Math.ceil(cell / 3)} / ${((cell - 1) % 3) + 1}` }}
            />
          ))}
        </div>
      </div>
      <div role="status" aria-live="polite" aria-busy="true">
        <h2>Đang cập nhật…</h2>
        <p>Chờ server cập nhật xong…</p>
      </div>
      <div className="update-energy" aria-hidden="true">
        <div className="update-energy-label">
          <span>Nạp năng lượng</span>
          <span>{energy}%</span>
        </div>
        <div className="update-energy-track">
          <span style={{ width: `${energy}%` }} />
        </div>
      </div>
      <p className="update-joke">{UPDATE_JOKES[Math.floor(seconds / 6) % UPDATE_JOKES.length]}</p>
    </div>
  );
}

/**
 * The old page cannot open newly deployed game chunks. After confirmation, wait for the
 * matching backend before reloading; existing in-memory rooms cannot survive its restart.
 */
export function NewVersionDialog({
  target,
  deploying = false,
}: {
  target: NewBuild;
  deploying?: boolean;
}) {
  const reload = useRef<HTMLButtonElement>(null);
  const [updating, setUpdating] = useState(false);
  const readiness = useServerReady(target.build, updating);
  useEffect(() => reload.current?.focus(), []);
  useEffect(() => {
    if (updating && readiness === 'ready') window.location.reload();
  }, [updating, readiness]);
  if (updating)
    return readiness === 'waiting' && !deploying ? <WarmupOverlay shown /> : <UpdateLoading />;
  return (
    <div className="modal-backdrop">
      <div
        className="hud panel modal"
        role="alertdialog"
        aria-modal="true"
        aria-label="Đã có phiên bản mới"
      >
        <h2>Đã có phiên bản mới</h2>
        <Button ref={reload} onClick={() => setUpdating(true)}>
          Tải lại
        </Button>
      </div>
    </div>
  );
}
