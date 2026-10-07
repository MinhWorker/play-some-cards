import { games, HISTORY_LIMIT, type MatchRecord } from '@psc/shared';
import { useEffect, useState } from 'react';
import { AvatarPicture } from '@/components/ui/AvatarPicture';
import { gameAssets } from '@/games';
import { request } from '@/lib/socket';
import './MatchHistory.css';

const OUTCOME = {
  win: 'Thắng',
  loss: 'Thua',
  draw: 'Hoà',
} as const;

/**
 * The player's last games (`history:recent`): a form strip of coloured beads, then one ticket per
 * game with its island, who sat at the table and a stamp for how it ended.
 */
export function MatchHistory() {
  const [matches, setMatches] = useState<MatchRecord[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    request('history:recent', {}).then(
      (res) => live && setMatches(res.matches),
      (err: Error) => live && setError(err.message),
    );
    return () => {
      live = false;
    };
  }, []);

  if (error) return <p className="history-empty error">{error}</p>;
  if (!matches) return <p className="history-empty muted">Đang tải…</p>;
  if (!matches.length) {
    return (
      <div className="history-empty">
        <p className="history-empty-title">Chưa có trận nào</p>
        <p className="muted">{HISTORY_LIMIT} trận gần nhất sẽ hiện ở đây</p>
      </div>
    );
  }

  const count = (outcome: MatchRecord['outcome']) =>
    matches.filter((m) => m.outcome === outcome).length;
  return (
    <div className="history">
      <div className="history-form">
        <div className="history-tally">
          {(['win', 'draw', 'loss'] as const).map((o) => (
            <span key={o} className={`tally ${o}`}>
              <b>{count(o)}</b> {OUTCOME[o]}
            </span>
          ))}
        </div>
        {/* Oldest on the left, so the streak reads towards today. */}
        <ol className="history-beads" aria-label="Phong độ">
          {matches
            .slice()
            .reverse()
            .map((m) => (
              <li key={m.id} className={`bead ${m.outcome}`} title={OUTCOME[m.outcome]} />
            ))}
        </ol>
      </div>
      <ol className="history-list">
        {matches.map((m) => (
          <MatchTicket key={m.id} match={m} />
        ))}
      </ol>
    </div>
  );
}

function MatchTicket({ match }: { match: MatchRecord }) {
  const game = games[match.gameId];
  const island = game && gameAssets(game.id).images[game.portal.image];
  return (
    <li className={`ticket ${match.outcome}`}>
      <div className="ticket-island">{island && <img src={island} alt="" />}</div>
      <div className="ticket-body">
        <p className="ticket-game">{game?.name ?? match.gameId}</p>
        <p className="ticket-when">
          {timeAgo(match.endedAt)} · {duration(match.endedAt - match.startedAt)}
        </p>
        <ul className="ticket-players">
          {match.players.map((p, seat) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: seats never move within a game
              key={seat}
              className={[p.me && 'me', p.won && 'won', p.left && 'left'].filter(Boolean).join(' ')}
              title={p.name}
            >
              {/* The robot's picture comes in its own frame. */}
              <AvatarPicture
                avatar={p.bot ? 'bot' : (p.avatar ?? 'boy')}
                frame={p.bot ? null : p.frame}
              />
              {p.won && <span className="ticket-crown">👑</span>}
            </li>
          ))}
        </ul>
      </div>
      <span className="ticket-stamp">{OUTCOME[match.outcome]}</span>
    </li>
  );
}

/** "vừa xong", "5 phút trước", "hôm qua", or a date for older games. */
function timeAgo(at: number, now = Date.now()) {
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'hôm qua';
  if (days < 7) return `${days} ngày trước`;
  const d = new Date(at);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

/** How long a game took: "45 giây", "12 phút", "1 giờ 5 phút". */
function duration(ms: number) {
  const seconds = Math.max(1, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} giây`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} phút`;
  return `${Math.floor(minutes / 60)} giờ${minutes % 60 ? ` ${minutes % 60} phút` : ''}`;
}
