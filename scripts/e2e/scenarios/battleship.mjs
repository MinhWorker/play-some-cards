// Bắn Tàu against the computer on a phone: the one-form setup, a ship picked and turned (or
// moved) on the big sea, "Sẵn sàng", a few shots at the other sea, then "Đầu hàng" (tapped
// twice) ends the game.
import { clickCanvas, openRooms, PHONE, signUp } from '../lib.mjs';

export const games = ['battleship'];

/** Page point of cell `c` on the big sea (the scene knows where it drew it, in design units). */
const pointOf = (page, c) =>
  page.evaluate((cell) => {
    const { x, y } = window.__phaser.scene.getScene('battleship').pointXY(cell);
    return window.__toScreen('battleship', x, y);
  }, c);

const scene = (page, fn, arg) =>
  page.evaluate(
    ({ src, a }) =>
      new Function('s', 'a', `return (${src})(s, a)`)(
        window.__phaser.scene.getScene('battleship'),
        a,
      ),
    { src: fn.toString(), a: arg },
  );

export default async function run(t) {
  const page = await t.page(PHONE);
  await signUp(t, page, 'Hai');
  await openRooms(page, 'battleship');
  await page.getByRole('button', { name: '+ Tạo phòng' }).click();
  await clickCanvas(page, 'battleship:setup', (s) => s.rows[0].chips[1].container);
  await page.waitForTimeout(300);
  await page.screenshot({ path: t.shot('10-battleship-setup.png') });
  await clickCanvas(page, 'battleship:setup', (s) => s.submitButton.container);
  await page.getByRole('button', { name: 'Bắt đầu' }).click();
  await page.waitForFunction(
    () => window.__phaser.scene.getScene('battleship')?.draft?.length === 5,
  );

  // Pick the smallest ship and tap it again: it turns if it fits, else it stays.
  const ship = await scene(page, (s) => s.draft[4].cells[0]);
  const at = await pointOf(page, ship);
  await page.mouse.click(at.x, at.y);
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(400);
  await page.screenshot({ path: t.shot('11-battleship-arrange.png') });
  const fleet = await scene(page, (s) => s.ctx.state.waters[s.mySeat(s.ctx)].ships.length);
  if (fleet !== 5) throw new Error(`The fleet has ${fleet} ships after arranging`);

  await clickCanvas(page, 'battleship', (s) => s.buttons.ready.container);
  await page.waitForFunction(
    () => window.__phaser.scene.getScene('battleship').ctx.state.phase === 'battle',
  );

  let fired = 0;
  for (let cell = 0; fired < 6 && cell < 100; cell += 11) {
    await page.waitForFunction(
      () => {
        const s = window.__phaser.scene.getScene('battleship');
        return s.ctx.result || s.ctx.state.turn === s.mySeat(s.ctx);
      },
      null,
      { timeout: 15000 },
    );
    const before = await scene(page, (s) => s.ctx.state.waters[1].shots.length);
    const target = await pointOf(page, cell);
    await page.mouse.click(target.x, target.y);
    await page.waitForFunction(
      (n) => window.__phaser.scene.getScene('battleship').ctx.state.waters[1].shots.length > n,
      before,
    );
    fired++;
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: t.shot('12-battleship-battle.png') });

  await page.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('battleship');
    return s.buttons.resign.container.visible;
  });
  await clickCanvas(page, 'battleship', (s) => s.buttons.resign.container);
  await clickCanvas(page, 'battleship', (s) => s.buttons.resign.container);
  await page.waitForFunction(() => window.__phaser.scene.getScene('battleship').ctx.state.end);
  const status = await page.evaluate(
    () => window.__phaser.scene.getScene('battleship').status.text,
  );
  if (!status.includes('đầu hàng')) throw new Error(`After resigning the status says "${status}"`);
  await page.getByRole('button', { name: 'Chơi ván mới' }).waitFor();
  await page.screenshot({ path: t.shot('13-battleship-resigned.png') });
}
