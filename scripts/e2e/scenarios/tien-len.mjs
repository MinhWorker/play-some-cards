// Tiến Lên: a 3-round match against three computer players, set up in one form. Each round is
// dealt and announced, Hung plays his lowest card when he may (or passes), the computers play
// on; the round's ranking shows between rounds and the final standings at the end.
import { clickCanvas, DESKTOP, openRooms, signUp } from '../lib.mjs';

export const games = ['tien-len'];

export default async function run(t) {
  const host = await t.page(DESKTOP);
  await signUp(t, host, 'Hung');
  await openRooms(host, 'tien-len');
  await host.getByRole('button', { name: '+ Tạo phòng' }).click();
  await clickCanvas(host, 'tien-len:setup', (s) => s.rows[0].chips[3].container);
  await clickCanvas(host, 'tien-len:setup', (s) => s.rows[1].chips[1].container);
  await clickCanvas(host, 'tien-len:setup', (s) => s.rows[2].chips[1].container);
  await host.waitForTimeout(300);
  await host.screenshot({ path: t.shot('10-tien-len-setup.png') });
  await clickCanvas(host, 'tien-len:setup', (s) => s.submitButton.container);
  await host.getByText('🤖 Máy 3').waitFor();
  await host.getByRole('button', { name: 'Bắt đầu' }).click();
  await host.waitForFunction(() => window.__phaser.scene.getScene('tien-len')?.hand?.size === 13);
  await host.screenshot({ path: t.shot('11-tien-len-dealt.png') });
  const shots = new Set();
  // The game must keep moving: a stall fails in 30 s with what the screen was showing, rather
  // than at the scenario's timeout with nothing to go on.
  let progress = { key: '', at: Date.now() };
  for (let i = 0; i < 600; i++) {
    const s = await host.evaluate(() => {
      const scene = window.__phaser.scene.getScene('tien-len');
      const { state, me, result } = scene.ctx;
      // The visible left edge of each card in the fan (the next card covers the rest), turned
      // from design units into page pixels.
      const page = (x, y) => window.__toScreen('tien-len', x, y);
      const hand = [...scene.hand.entries()].map(([card, sp]) => ({
        card,
        ...page(sp.x - sp.width / 2 + 8, sp.y - 25),
      }));
      const at = (b) => page(b.container.x, b.container.y);
      return {
        over: Boolean(result),
        round: state.round,
        board: scene.board.visible,
        played: state.played.length,
        mine: state.phase === 'play' && state.turn === me.seat && !scene.dealing,
        table: state.table,
        mustPlay: state.mustPlay,
        dealing: Boolean(scene.dealing),
        turn: state.turn,
        phase: state.phase,
        selected: [...scene.selected],
        hand,
        play: at(scene.playButton),
        pass: at(scene.passButton),
      };
    });
    if (s.over) break;
    const key = JSON.stringify([s.round, s.phase, s.turn, s.played, s.table]);
    if (key !== progress.key) progress = { key, at: Date.now() };
    else if (Date.now() - progress.at > 30000) {
      await host.screenshot({ path: t.shot('stalled.png') });
      const { hand, play, pass, ...shown } = s;
      throw new Error(`Tiến Lên stalled for 30 s: ${JSON.stringify(shown)}`);
    }
    if (s.mine) {
      const top = s.table ? Math.max(...s.table.cards) : -1;
      const pick =
        s.mustPlay !== null
          ? s.hand.find((h) => h.card === s.mustPlay)
          : !s.table
            ? s.hand[0]
            : s.table.cards.length === 1
              ? s.hand.find((h) => h.card > top)
              : null;
      // A click that landed on a card while the hand was moving leaves it picked: put it back
      // first, or the picked cards never make a combination and Hung (no clock with one
      // person at the table) holds the game forever.
      for (const card of s.selected) {
        const h = s.hand.find((c) => c.card === card);
        if (h && card !== pick?.card) await host.mouse.click(h.x, h.y);
      }
      if (pick) {
        if (!s.selected.includes(pick.card)) await host.mouse.click(pick.x, pick.y);
        await host.mouse.click(s.play.x, s.play.y);
      } else await host.mouse.click(s.pass.x, s.pass.y);
      // Wait for the move to land before reading the hand again (its cards shift once it does).
      await host
        .waitForFunction(
          () => {
            const { state, me } = window.__phaser.scene.getScene('tien-len').ctx;
            return state.phase !== 'play' || state.turn !== me.seat;
          },
          null,
          { timeout: 3000 },
        )
        .catch(() => {});
    }
    if (s.played >= 8 && !shots.has('pile')) {
      shots.add('pile');
      await host.screenshot({ path: t.shot('12-tien-len-pile.png') });
    }
    if (s.board && !shots.has('round')) {
      shots.add('round');
      await host.screenshot({ path: t.shot('13-tien-len-round-over.png') });
    }
    // Sleep until there is something to do: Hung's turn, the match over, or a ranking board
    // not photographed yet. The computers set the pace; polling on a timer only adds to it.
    await host
      .waitForFunction(
        (roundShot) => {
          const scene = window.__phaser.scene.getScene('tien-len');
          const { state, me, result } = scene.ctx;
          return (
            Boolean(result) ||
            (state.phase === 'play' && state.turn === me.seat && !scene.dealing) ||
            (!roundShot && scene.board.visible)
          );
        },
        shots.has('round'),
        { timeout: 5000, polling: 100 },
      )
      .catch(() => {});
  }
  if (!shots.has('round')) throw new Error('No round ranking was shown between rounds');
  await host.getByRole('button', { name: 'Chơi ván mới' }).waitFor();
  await host.waitForFunction(() => window.__phaser.scene.getScene('tien-len')?.board?.visible);
  await host.waitForTimeout(1500);
  await host.screenshot({ path: t.shot('14-tien-len-standings.png') });
}
