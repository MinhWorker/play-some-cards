/** Brief room log summaries; details remain in grouped browser DevTools entries. */
import type { DevLogEntry } from '@xomdao/shared';

const icons = {
  move: '▸',
  reject: '✗',
  timer: '⏱',
  bot: '◆',
  command: '›',
  game: '·',
  room: '◇',
  error: '!',
};
export function LogLines({ entries, typing }: { entries: DevLogEntry[]; typing: boolean }) {
  return (
    <>
      {entries.map((entry) => {
        const data = entry.data as { stack?: unknown } | undefined;
        const stack =
          entry.level === 'error' && typeof data?.stack === 'string'
            ? data.stack.split('\n')[1]?.trim()
            : undefined;
        return (
          <div
            key={entry.id}
            className={`dev-log-line dev-log-${entry.level}${typing ? '' : ' dev-log-fade'}`}
            style={
              typing
                ? undefined
                : {
                    animationDuration: entry.level === 'error' ? '30s' : '10s',
                    animationDelay: `-${Math.max(0, Date.now() - entry.t)}ms`,
                  }
            }
          >
            <time>{new Date(entry.t).toLocaleTimeString('vi-VN', { hour12: false })}</time>{' '}
            {icons[entry.kind]} {entry.text}
            {stack ? <div className="dev-log-stack">{stack}</div> : null}
          </div>
        );
      })}
    </>
  );
}
