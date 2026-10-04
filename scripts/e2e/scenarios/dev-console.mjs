// Console keyboard, schema suggestions, persistence, subscriptions and restoration in a real room.
import { canvasPoint, clickCanvas, cmd, DESKTOP, openRooms, PHONE, signUp } from '../lib.mjs';
export const games = ['co-ty-phu-classic'];
export const always = true;
const assert = (value, message) => {
  if (!value) throw new Error(message);
};
export default async function run(t) {
  const page = await t.page(DESKTOP);
  await signUp(t, page, 'Console');
  await openRooms(page, 'co-ty-phu-classic');
  await page.getByRole('button', { name: '+ Tạo phòng' }).click();
  await clickCanvas(page, 'co-ty-phu-classic:setup', (s) => s.choices[1].container);
  await clickCanvas(page, 'co-ty-phu-classic:setup', (s) => s.submitButton.container);
  await page.getByRole('button', { name: 'Bắt đầu' }).click();
  await page.waitForFunction(
    () => window.__phaser?.scene.getScene('co-ty-phu-classic')?.ctx?.state,
  );
  await cmd(page, 'bot pause; timer pause; seed 42');
  await page.getByRole('button', { name: 'DEV', exact: true }).click();
  await page.getByLabel('Dev Console', { exact: true }).check();
  await page.getByRole('button', { name: 'DEV', exact: true }).click();
  const overlay = page.locator('.dev-console');
  await overlay.waitFor({ state: 'attached' });
  await page.keyboard.press('Control+Backquote');
  assert(await overlay.isHidden(), 'Toggle did not hide console');
  await page.keyboard.press('Control+/');
  const input = page.getByLabel('Lệnh dev');
  await input.waitFor();
  await input.focus();
  await page.evaluate(() => {
    window.__consoleKeys = 0;
    window.__phaser.scene
      .getScene('co-ty-phu-classic')
      .input.keyboard.on('keydown', () => window.__consoleKeys++);
  });
  await page.keyboard.type('dice 1 ');
  await page.keyboard.press('Tab');
  assert((await input.inputValue()) === 'dice 1 1', 'Numeric Tab suggestion failed');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('[data-dev-console-input]').value === '');
  assert(
    await page.evaluate(
      () => window.__consoleKeys === 0 && !window.__phaser.input.keyboard.enabled,
    ),
    'Console keys reached Phaser',
  );
  await page.keyboard.type('tp ');
  await page.keyboard.press('Tab');
  await page.keyboard.type(' @square:s');
  await page.keyboard.press('Tab');
  assert(
    (await input.inputValue()) === 'tp 0 @square:san-bay',
    'Seat/catalog Tab suggestion failed',
  );
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    () => window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state.players[0].position === 20,
  );
  await page.waitForFunction(() => document.querySelector('[data-dev-console-input]').value === '');
  await page.keyboard.type('dise');
  await page.keyboard.press('Enter');
  await page.locator('.dev-command-error').filter({ hasText: 'Có phải "dice"' }).waitFor();
  assert(
    (await page.locator('.dev-command-error-span').textContent()) === 'dise',
    'Error span did not match the typo',
  );
  await input.fill('');
  await page.keyboard.press('Shift+/');
  await page.locator('.dev-console-help').waitFor();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__phaser.input.keyboard.enabled);
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        code: 'Slash',
        ctrlKey: true,
        isComposing: true,
        bubbles: true,
      }),
    ),
  );
  assert((await input.count()) === 0, 'IME composition opened the console');
  await page.getByRole('button', { name: 'Cài đặt', exact: true }).click();
  await page.getByLabel('Âm lượng nhạc').focus();
  await page.keyboard.press('Control+/');
  assert((await input.count()) === 0, 'Shortcut stole focus from the settings input');
  await page.keyboard.press('Escape');

  await cmd(page, '.pin 1 tp 0 18; dice 1 1');
  for (let i = 0; i < 3; i++) await cmd(page, '!1');
  const pinned = await cmd(page, 'state get players.0.position');
  assert(pinned === '18', 'Chained pin did not rebuild position');
  await cmd(page, 'state set players.0.position 19; rng push 0 0');
  // Drop the dice override so this roll consumes the queued RNG instead.
  await cmd(page, 'state set devDice null; as 0 roll');
  await page.waitForFunction(
    () => window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state.players[0].position === 21,
  );
  await cmd(page, 'undo');
  await page.waitForFunction(
    () => window.__phaser.scene.getScene('co-ty-phu-classic').shownPositions[0] === 19,
  );
  await cmd(page, 'as 0 roll');
  await page.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('co-ty-phu-classic');
    return s.visualPhase === 'rolling' || s.visualPhase === 'moving';
  });
  await cmd(page, 'undo');
  await cmd(page, 'snapshot save console; restart; snapshot load console');
  await page.waitForFunction(
    () => window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state.players[0].position === 19,
  );
  assert(
    (await cmd(page, 'snapshot list')).split('\n').includes('console'),
    'Saved snapshot is missing',
  );

  const rejected = await page.evaluate(() => window.__devCommand('as 1 roll'));
  assert(
    !rejected.ok && rejected.error.includes('Chưa tới lượt'),
    'Illegal event bypassed validation',
  );
  // Command mode keeps old entries visible while view mode deliberately fades them.
  await page.keyboard.press('Control+/');
  await input.waitFor();
  await cmd(page, '.filter reject; .find "bị từ chối"');
  await page.locator('.dev-log-line').filter({ hasText: 'bị từ chối' }).waitFor();
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await cmd(page, '.copy 1');
  assert(
    (await page.evaluate(() => navigator.clipboard.readText())).includes('bị từ chối'),
    'Filtered copy omitted rejection',
  );
  await cmd(page, '.find; .filter all; .clear');
  assert((await page.locator('.dev-log-line').count()) === 0, 'Clear retained log lines');
  await cmd(page, '.dock tr; .opacity 75; help dice');
  await page.reload();
  await page.waitForFunction(
    () => window.__phaser?.scene.getScene('co-ty-phu-classic')?.ctx?.state,
  );
  await overlay.waitFor({ state: 'attached' });
  assert((await overlay.getAttribute('class')).includes('dev-console-tr'), 'Dock did not persist');
  assert(
    (await overlay.evaluate((e) => getComputedStyle(e).opacity)) === '0.75',
    'Opacity did not persist',
  );
  await cmd(page, '!1');
  await cmd(page, 'help dice');
  await page.keyboard.press('Control+/');
  await input.waitFor();
  await page.keyboard.press('ArrowUp');
  assert((await input.inputValue()) === 'help dice', 'Command history did not persist');
  await input.fill('');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await cmd(page, '.dock tl; .opacity 85; help');
  await page.keyboard.press('Control+/');
  await input.waitFor();
  const hitTags = await page.evaluate(() =>
    ['.dev-console-log', '[data-dev-console-input]'].map((q) => {
      const r = document.querySelector(q).getBoundingClientRect();
      return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.tagName;
    }),
  );
  assert(
    hitTags.every((v) => v === 'CANVAS'),
    `Overlay intercepted hit testing: ${hitTags}`,
  );
  assert(
    await overlay.evaluate((e) =>
      [e, ...e.querySelectorAll('*')].every((n) => getComputedStyle(n).pointerEvents === 'none'),
    ),
    'A console descendant receives pointer events',
  );
  await page.screenshot({ path: t.shot('console-typing-desktop.png') });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await cmd(page, '.dock br; tp 0 0; dice 1 2; state set phase "roll"; as 0 roll');
  await page
    .waitForFunction(() => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic');
      return (
        s.visualPhase === 'decision' &&
        s.ctx.state.phase === 'buy' &&
        !s.runtime.busy('turn') &&
        !s.activeMoney &&
        s.main.some((button) => button.hit.visible && button.text.text.startsWith('Mua '))
      );
    })
    .catch(async (error) => {
      const details = await page.evaluate(() => {
        const s = window.__phaser.scene.getScene('co-ty-phu-classic');
        return {
          state: s.ctx.state,
          phase: s.visualPhase,
          me: s.ctx.me,
          activeRoll: s.activeRoll,
          payments: s.payments,
          changingTurn: s.changingTurn,
          runtime: s.runtime.inspect(),
        };
      });
      throw new Error(
        `Purchase fixture did not settle: ${error.message}: ${JSON.stringify(details)}`,
      );
    });
  await cmd(page, 'help');
  await page.keyboard.press('Control+/');
  await input.waitFor();
  const buy = await canvasPoint(
    page,
    'co-ty-phu-classic',
    (s) => s.main.find((button) => button.hit.visible && button.text.text.startsWith('Mua ')).hit,
  );
  const beneath = await overlay.evaluate((e, p) => {
    const r = e.getBoundingClientRect();
    return p.x >= r.x && p.x <= r.right && p.y >= r.y && p.y <= r.bottom;
  }, buy);
  assert(beneath, 'Buy button is not beneath the overlay in this fixture');
  await clickCanvas(
    page,
    'co-ty-phu-classic',
    (s) => s.main.find((button) => button.hit.visible && button.text.text.startsWith('Mua ')).hit,
  );
  await page.waitForFunction(
    () => window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state.properties[3].owner === 0,
  );
  assert((await input.count()) === 0, 'Game click did not leave command mode');
  await cmd(page, '.dock tl; help dice');
  await page.screenshot({ path: t.shot('console-view-desktop.png') });
  await page.setViewportSize(PHONE);
  await page.screenshot({ path: t.shot('console-view-phone.png') });

  await page.evaluate(async () => {
    const { socket } = await import('/src/lib/socket.ts');
    window.__serverLogs = 0;
    socket.on('dev:log', () => window.__serverLogs++);
  });
  await page.getByRole('button', { name: 'DEV', exact: true }).click();
  await page.getByLabel('Dev Console', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'DEV', exact: true }).click();
  await overlay.waitFor({ state: 'detached' });
  const before = await page.evaluate(() => window.__serverLogs);
  await cmd(page, 'help');
  assert(
    (await page.evaluate(() => window.__serverLogs)) === before,
    'Master switch off still received dev:log',
  );
  await page.getByRole('button', { name: 'DEV', exact: true }).click();
  await page.getByLabel('Dev Console', { exact: true }).check();
  await page.getByRole('button', { name: 'DEV', exact: true }).click();
  await overlay.waitFor({ state: 'attached' });
  await page.evaluate(async () => {
    const { socket, connectSocket } = await import('/src/lib/socket.ts');
    socket.disconnect();
    connectSocket();
  });
  await page.waitForFunction(async () => {
    const { request } = await import('/src/lib/socket.ts');
    return await request('dev:schema', {}).then(
      () => true,
      () => false,
    );
  });
  await cmd(page, 'help');
  await page.waitForFunction(() => window.__serverLogs > 0);
  await cmd(page, '.unpin 1');
  const noPin = await page.evaluate(() => window.__devCommand('!1'));
  assert(!noPin.ok, 'Unpin kept the command');
  await cmd(page, 'snapshot delete console; .console off');
  await overlay.waitFor({ state: 'detached' });
}
