// Headless browser test of the real app: three people create accounts, two (desktop + phone)
// pick Caro on the island map, create/join a room from the room list and play to a win while a
// third person watches. Mid-game the phone player closes the browser and logs in again on a new
// one: they must land back in their seat. Then the host plays a room against the computer. Screenshots go to .e2e/ so you can look at them.
// Needs `npm run dev` running (the owner usually has it open). Never opens a visible window.
//   npm run e2e [webUrl]      default http://localhost:5033
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:5033';
const out = '.e2e';
mkdirSync(out, { recursive: true });

/** Screen position of a Phaser object, read from the dev-only window.__phaser handle. */
async function canvasPoint(page, sceneKey, pick) {
  await page.waitForFunction((key) => window.__phaser?.scene.isActive(key), sceneKey);
  return page.evaluate(
    ({ key, pickSrc }) => {
      const scene = window.__phaser.scene.getScene(key);
      const obj = new Function('scene', `return (${pickSrc})(scene)`)(scene);
      const m = obj.getWorldTransformMatrix();
      return { x: m.tx, y: m.ty };
    },
    { key: sceneKey, pickSrc: pick.toString() },
  );
}

async function clickCanvas(page, sceneKey, pick) {
  const { x, y } = await canvasPoint(page, sceneKey, pick);
  await page.mouse.click(x, y);
}

const tag = Date.now().toString(36);
const PASSWORD = 'e2e-pass';
/** Unique per run so the accounts never clash with earlier runs. */
const usernameOf = (name) => `${name}${tag}`;

const browser = await chromium.launch({ headless: true });
try {
  const host = await (
    await browser.newContext({ viewport: { width: 1280, height: 760 } })
  ).newPage();
  const phone = () => browser.newContext({ viewport: { width: 390, height: 844 } });
  let guest = await (await phone()).newPage();
  const fan = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errors = [];
  const watchErrors = (p) => p.on('pageerror', (e) => errors.push(e.message));
  for (const p of [host, guest, fan]) watchErrors(p);

  /** Opens the app and creates an account whose in-game name is `name`. */
  async function signUp(page, name, shot) {
    await page.goto(url);
    await page.getByRole('button', { name: 'Tạo tài khoản' }).first().click();
    await page.getByLabel('Tên đăng nhập').fill(usernameOf(name));
    await page.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Tên trong game').fill(name);
    if (shot) await page.screenshot({ path: `${out}/${shot}` });
    await page.getByRole('button', { name: 'Tạo tài khoản' }).last().click();
    await page.getByRole('button', { name: 'Sửa hồ sơ' }).waitFor();
  }

  /**
   * Picks a game on the island strip by id: the arrows step it into focus (it may be off
   * screen), then a tap opens its room list.
   */
  async function openRooms(page, gameId) {
    const create = page.getByRole('button', { name: '+ Tạo phòng' });
    for (let i = 0; i < 8 && !(await create.count()); i++) {
      await page.waitForTimeout(800); // let the strip settle
      await page.waitForFunction(() => window.__phaser?.scene.isActive('hub'));
      const off = await page.evaluate((id) => {
        const hub = window.__phaser.scene.getScene('hub');
        return hub.views.findIndex((v) => v.portal.gameId === id) - hub.focus;
      }, gameId);
      const pick = off
        ? `(s) => s.arrows[${off > 0 ? 1 : 0}]`
        : `(s) => s.views.find((v) => v.portal.gameId === '${gameId}').container`;
      await clickCanvas(page, 'hub', new Function(`return ${pick}`)());
      // The room list opens after the cloud transition; tapping again meanwhile would wait on a
      // hub that is closing.
      if (!off) await create.waitFor({ timeout: 10000 }).catch(() => {});
    }
    await create.waitFor();
  }
  const openCaroRooms = (page) => openRooms(page, 'tic-tac-toe');

  /** "← Rời phòng", confirming "Bỏ dở ván này?" when a game is running. */
  async function leaveRoom(page) {
    await page.getByRole('button', { name: '← Rời phòng' }).click();
    const confirm = page.getByRole('alertdialog');
    await confirm.waitFor({ timeout: 1000 }).catch(() => {});
    if (await confirm.count()) {
      await confirm.getByRole('button', { name: 'Rời phòng', exact: true }).click();
    }
  }

  // Wrong password is refused with a message; usernames with special characters too.
  await guest.goto(url);
  await guest.getByLabel('Tên đăng nhập').fill(usernameOf('nobody'));
  await guest.getByLabel('Mật khẩu', { exact: true }).fill('wrong-pass');
  await guest.getByRole('button', { name: 'Vào chơi' }).click();
  await guest.getByText('Sai tên đăng nhập hoặc mật khẩu').waitFor();
  await guest.getByRole('button', { name: 'Hiện mật khẩu' }).click();
  if ((await guest.getByLabel('Mật khẩu', { exact: true }).getAttribute('type')) !== 'text')
    throw new Error('"Hiện mật khẩu" did not reveal the password');
  await guest.screenshot({ path: `${out}/0-login-phone.png` });
  await guest.getByRole('button', { name: 'Tạo tài khoản' }).first().click();
  await guest.getByLabel('Tên đăng nhập').fill('lan_ơi');
  await guest.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD);
  await guest.getByRole('button', { name: 'Tạo tài khoản' }).last().click();
  await guest.getByText('chỉ gồm chữ không dấu và số').waitFor();

  await signUp(guest, 'Lan', '0-register-phone.png');
  await guest.getByRole('button', { name: 'Sửa hồ sơ' }).click();
  await guest.getByRole('button', { name: 'Bạn nữ' }).click();
  await guest.getByRole('button', { name: 'Tên ngẫu nhiên' }).click();
  await guest.screenshot({ path: `${out}/0-profile-phone.png` });
  await guest.getByLabel('Tên', { exact: true }).fill('Lan');
  await guest.getByRole('button', { name: 'Xong' }).click();
  await guest.waitForTimeout(800);
  // Taps on the modal must not reach the islands underneath.
  if (
    (await guest.getByText('Game này sắp có').count()) ||
    (await guest.getByRole('button', { name: '+ Tạo phòng' }).count())
  )
    throw new Error('A tap on the profile modal reached an island');
  await guest.screenshot({ path: `${out}/1-hub-phone.png` });
  await signUp(host, 'Minh');
  await openCaroRooms(host);
  await host.getByRole('button', { name: 'Về đảo' }).click();
  await host.waitForTimeout(800);
  await host.screenshot({ path: `${out}/1-hub.png` });
  await openCaroRooms(host);
  await host.getByRole('button', { name: '+ Tạo phòng' }).click();
  // Caro has its own setup screen (a Phaser scene): "Bạn bè" creates a room for people.
  const pickSetup = async (page, pick) => {
    await page.waitForTimeout(500);
    await clickCanvas(page, 'tic-tac-toe:setup', new Function(`return (s) => s.${pick}.tile`)());
  };
  await pickSetup(host, 'opponents[0]');
  await pickSetup(host, 'sizes[0]');
  await host.getByText('Phòng của Minh').waitFor();

  // The guest finds Minh's room in the live list and takes the free seat.
  await openCaroRooms(guest);
  const row = guest.locator('.room-row', { hasText: 'Phòng của Minh' }).last();
  await row.waitFor();
  await guest.screenshot({ path: `${out}/2-room-list-phone.png` });
  await row.getByRole('button', { name: 'Vào chơi' }).click();
  await host.getByText('Lan').waitFor();

  // Full room: the fan can't take a seat, only watch.
  await signUp(fan, 'Hoa');
  await openCaroRooms(fan);
  const fanRow = fan.locator('.room-row', { hasText: 'Phòng của Minh' }).last();
  await fanRow.getByText('👤 2/2').waitFor();
  if (await fanRow.getByRole('button', { name: 'Vào chơi' }).isEnabled())
    throw new Error('Full room still offers "Vào chơi"');
  await fanRow.getByRole('button', { name: 'Xem' }).click();
  await host.getByText('👀 1 đang xem').waitFor();
  await host.screenshot({ path: `${out}/3-lobby.png` });
  await host.getByRole('button', { name: 'Bắt đầu' }).click();

  // Host is X. X takes the top row.
  const play = async (page, cell) => {
    await clickCanvas(page, 'tic-tac-toe', new Function(`return (s) => s.tiles[${cell}]`)());
    await page.waitForTimeout(400);
  };
  await play(host, 0);
  await play(guest, 4);

  // Lan closes her browser without leaving, then logs in on a fresh one: back in her seat.
  await guest.context().close();
  guest = await (await phone()).newPage();
  watchErrors(guest);
  await guest.goto(url);
  await guest.getByLabel('Tên đăng nhập').fill(usernameOf('Lan').toUpperCase());
  await guest.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD);
  await guest.getByRole('button', { name: 'Vào chơi' }).click();
  await guest.getByRole('button', { name: '← Rời phòng' }).waitFor();
  await guest.waitForTimeout(800);
  await guest.screenshot({ path: `${out}/3b-back-in-seat-phone.png` });

  const moves = [
    [host, 1],
    [guest, 8],
    [host, 2],
  ];
  for (const [page, cell] of moves) await play(page, cell);
  await host.getByText('Bạn thắng!').waitFor();
  await guest.getByText('Minh thắng!').waitFor();
  await fan.getByText('Minh thắng!').waitFor();
  await host.screenshot({ path: `${out}/4-result-desktop.png` });
  await guest.screenshot({ path: `${out}/5-result-phone.png` });
  await fan.screenshot({ path: `${out}/6-result-spectator.png` });
  const score = await host.evaluate(() =>
    window.__phaser.scene.getScene('tic-tac-toe').score.numbers.text.replace(/\s+/g, ' '),
  );
  if (score !== '1 – 0') throw new Error(`Scoreboard shows "${score}", expected "1 – 0"`);

  // Between games the host picks a 6×6 board (4 in a row) and swaps colors: Lan is red X now.
  await clickCanvas(host, 'tic-tac-toe', (s) => s.next.sizes[1]);
  await host.waitForTimeout(300);
  await clickCanvas(host, 'tic-tac-toe', (s) => s.next.swap);
  await host.waitForTimeout(300);
  await host.screenshot({ path: `${out}/6b-next-game-options.png` });
  await host.getByRole('button', { name: 'Chơi ván mới' }).click();
  await guest.waitForFunction(() => {
    const { state, me } = window.__phaser.scene.getScene('tic-tac-toe').ctx;
    return (
      state.board.length === 36 &&
      state.win === 4 &&
      state.players[0] === me.id &&
      state.turn === me.id
    );
  });
  await play(guest, 14);
  await guest.screenshot({ path: `${out}/6c-6x6-phone.png` });

  // Host quits: Lan becomes host. Then Lan quits: no players left, the room is disbanded
  // and the spectator is sent back to the room list.
  await leaveRoom(host);
  await guest.getByText('👑 Lan').waitFor();
  await guest.getByRole('button', { name: 'Bắt đầu' }).waitFor();
  await guest.getByRole('button', { name: '← Rời phòng' }).click();
  await fan.getByText('Phòng đã giải tán').waitFor();
  await fan.getByRole('button', { name: '+ Tạo phòng' }).waitFor();
  await fan.screenshot({ path: `${out}/7-disbanded-spectator.png` });

  // Against the computer: Minh picks "Máy", then "Khó" on the setup screen, starts, and the
  // computer answers each move on its own.
  await host.goto(url);
  await openCaroRooms(host);
  await host.getByRole('button', { name: '+ Tạo phòng' }).click();
  await pickSetup(host, 'opponents[1]');
  await host.waitForTimeout(300);
  await host.screenshot({ path: `${out}/8-create-bot-room.png` });
  await pickSetup(host, 'levels[2]');
  await pickSetup(host, 'sizes[0]');
  await host.getByText('🤖 Máy').waitFor();

  // "Tuỳ chỉnh" reopens the settings screen inside the room: switching to "Bạn bè" sends the
  // computer away (a seat opens), and back to "Máy" brings it back. No new room.
  const roomCode = await host.evaluate(() => new URLSearchParams(location.search).toString());
  await host.getByRole('button', { name: 'Tuỳ chỉnh' }).click();
  await host.waitForTimeout(300);
  await host.screenshot({ path: `${out}/8b-customize-in-room.png` });
  await pickSetup(host, 'opponents[0]');
  await pickSetup(host, 'sizes[1]');
  await host.getByText('👤 1/2').waitFor();
  if (await host.getByText('🤖 Máy').count()) throw new Error('The computer stayed in the room');
  await host.getByRole('button', { name: 'Tuỳ chỉnh' }).click();
  await pickSetup(host, 'opponents[1]');
  await pickSetup(host, 'levels[2]');
  await pickSetup(host, 'sizes[0]');
  await host.getByText('🤖 Máy').waitFor();
  if ((await host.evaluate(() => new URLSearchParams(location.search).toString())) !== roomCode)
    throw new Error('Customizing left the room');
  await host.getByRole('button', { name: 'Bắt đầu' }).click();
  const marks = () =>
    host.evaluate(
      () => window.__phaser.scene.getScene('tic-tac-toe').ctx.state.board.filter(Boolean).length,
    );
  await play(host, 4);
  await host.waitForFunction(
    () =>
      window.__phaser.scene.getScene('tic-tac-toe').ctx.state.board.filter(Boolean).length === 2,
  );
  if ((await marks()) !== 2) throw new Error('The computer did not answer');
  await host.screenshot({ path: `${out}/9-bot-game.png` });
  // Leaving mid-game asks first; "Ở lại chơi tiếp" keeps the game going.
  await host.getByRole('button', { name: '← Rời phòng' }).click();
  await host.getByRole('alertdialog').waitFor();
  await host.screenshot({ path: `${out}/9b-leave-confirm.png` });
  await host.getByRole('button', { name: 'Ở lại chơi tiếp' }).click();
  if (await host.getByRole('alertdialog').count()) throw new Error('"Ở lại" kept the dialog open');
  if (!(await host.evaluate(() => window.__phaser.scene.isActive('tic-tac-toe'))))
    throw new Error('"Ở lại" left the game');
  await leaveRoom(host);
  await host.getByRole('button', { name: '+ Tạo phòng' }).waitFor();
  if (await host.locator('.room-row', { hasText: 'Phòng của Minh' }).count())
    throw new Error('The computer room stayed open after Minh left');

  // Sandbox: a win, then "Ván mới" on the same board size leaves a clean board (no pieces, no
  // gold tiles from the old winning line).
  const sandbox = await (await phone()).newPage();
  watchErrors(sandbox);
  await sandbox.goto(`${url}/?play=tic-tac-toe`);
  for (const [seat, cell] of [
    ['Người 1', 0],
    ['Người 2', 3],
    ['Người 1', 1],
    ['Người 2', 4],
    ['Người 1', 2],
  ]) {
    await sandbox.getByRole('button', { name: seat, exact: true }).click();
    await play(sandbox, cell);
  }
  await sandbox.getByRole('button', { name: 'Ván mới' }).click();
  await sandbox.waitForTimeout(400);
  const leftovers = await sandbox.evaluate(() => {
    const s = window.__phaser.scene.getScene('tic-tac-toe');
    return {
      pieces: s.pieces.filter(Boolean).length,
      tinted: s.tiles.filter((t) => t.isTinted).length,
    };
  });
  if (leftovers.pieces || leftovers.tinted)
    throw new Error(`"Ván mới" left ${JSON.stringify(leftovers)} on the board`);

  // Tiến Lên: a 3-round match against three computer players, set up in one form. Each round is
  // dealt and announced, Minh plays his lowest card when he may (or passes), the computers play
  // on; the round's ranking shows between rounds and the final standings at the end.
  await host.goto(url);
  await openRooms(host, 'tien-len');
  await host.getByRole('button', { name: '+ Tạo phòng' }).click();
  await clickCanvas(host, 'tien-len:setup', (s) => s.rows[0].chips[3].container);
  await clickCanvas(host, 'tien-len:setup', (s) => s.rows[1].chips[1].container);
  await clickCanvas(host, 'tien-len:setup', (s) => s.rows[2].chips[1].container);
  await host.waitForTimeout(300);
  await host.screenshot({ path: `${out}/10-tien-len-setup.png` });
  await clickCanvas(host, 'tien-len:setup', (s) => s.submitButton.container);
  await host.getByText('🤖 Máy 3').waitFor();
  await host.getByRole('button', { name: 'Bắt đầu' }).click();
  await host.waitForFunction(() => window.__phaser.scene.getScene('tien-len')?.hand?.size === 13);
  await host.screenshot({ path: `${out}/11-tien-len-dealt.png` });
  const shots = new Set();
  for (let i = 0; i < 600; i++) {
    const s = await host.evaluate(() => {
      const scene = window.__phaser.scene.getScene('tien-len');
      const { state, me, result } = scene.ctx;
      // The visible left edge of each card in the fan (the next card covers the rest).
      const hand = [...scene.hand.entries()].map(([card, sp]) => ({
        card,
        x: sp.x - sp.width / 2 + 8,
        y: sp.y - 25,
      }));
      const at = (b) => ({ x: b.container.x, y: b.container.y });
      return {
        over: Boolean(result),
        round: state.round,
        board: scene.board.visible,
        played: state.played.length,
        mine: state.phase === 'play' && state.turn === me.seat && !scene.dealing,
        table: state.table,
        mustPlay: state.mustPlay,
        selected: [...scene.selected],
        hand,
        play: at(scene.playButton),
        pass: at(scene.passButton),
      };
    });
    if (s.over) break;
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
      // first, or the picked cards never make a combination and Minh (no clock with one
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
      await host.screenshot({ path: `${out}/12-tien-len-pile.png` });
    }
    if (s.board && !shots.has('round')) {
      shots.add('round');
      await host.screenshot({ path: `${out}/13-tien-len-round-over.png` });
    }
    await host.waitForTimeout(500);
  }
  if (!shots.has('round')) throw new Error('No round ranking was shown between rounds');
  await host.getByRole('button', { name: 'Chơi ván mới' }).waitFor();
  await host.waitForFunction(() => window.__phaser.scene.getScene('tien-len')?.board?.visible);
  await host.waitForTimeout(1500);
  await host.screenshot({ path: `${out}/14-tien-len-standings.png` });

  if (errors.length) throw new Error(`Page errors:\n${errors.join('\n')}`);
  console.log(
    `OK: Lan came back after closing her browser, Minh won 1–0, 6×6 with swapped colors, host passed to Lan, room disbanded, the computer answered, a new game starts clean, a 3-round Tiến Lên match against three computers played to the end. Screenshots in ${out}/`,
  );
} catch (err) {
  console.error(
    'E2E FAILED:',
    err.message,
    err.stack
      ?.split('\n')
      .filter((l) => l.includes('e2e.mjs'))
      .join(' ← '),
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
