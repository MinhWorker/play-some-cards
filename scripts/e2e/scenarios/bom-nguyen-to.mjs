// Real input and socket synchronization, including sandbox timer/input races and spectators.
import { canvasPoint, clickCanvas, DESKTOP, leaveRoom, PHONE, signUp } from '../lib.mjs';
export const games = ['bom-nguyen-to'];
const id = 'bom-nguyen-to';
const ready = (page) =>
  page.waitForFunction(() => window.__phaser?.scene.getScene('bom-nguyen-to')?.ctx);
const playing = (page) =>
  page.waitForFunction(
    () => window.__phaser.scene.getScene('bom-nguyen-to').ctx.state.phase === 'playing',
  );

export default async function run(t) {
  const sandbox = await t.page(DESKTOP);
  await sandbox.goto(`${t.url}/?play=${id}&players=1`);
  await ready(sandbox);
  const cameraAligned = await sandbox.evaluate(() => {
    const scene = window.__phaser.scene.getScene('bom-nguyen-to');
    const center = scene.project({ x: 1, y: 1 });
    const right = scene.project({ x: 2, y: 1 });
    const down = scene.project({ x: 1, y: 2 });
    return (
      right.x > center.x &&
      right.y === center.y &&
      down.y > center.y &&
      down.x === center.x &&
      scene.th / scene.tw > 0.75 &&
      scene.th / scene.tw < 1
    );
  });
  if (!cameraAligned)
    throw new Error('Camera must remain top-down with a slight tilt, without diagonal rotation');
  await clickCanvas(sandbox, id, (s) => s.selectChoices[1].container);
  await sandbox.waitForFunction(
    () => window.__phaser.scene.getScene('bom-nguyen-to').ctx.state.fighters[0].element === 'water',
  );
  await sandbox.screenshot({ path: t.shot('01-element-select.png') });
  await clickCanvas(sandbox, id, (s) => s.readyButton.container);
  await playing(sandbox);
  await sandbox.keyboard.down('s');
  await sandbox.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('bom-nguyen-to').ctx.state;
    return s.elapsed >= 500 && s.fighters[0].y > 2;
  });
  await sandbox.keyboard.up('s');
  await sandbox.keyboard.press('e');
  await sandbox.waitForFunction(
    () => window.__phaser.scene.getScene('bom-nguyen-to').ctx.state.fighters[0].skillUntil > 0,
  );
  await sandbox.keyboard.press('Space');
  await sandbox.waitForFunction(() =>
    window.__phaser.scene
      .getScene('bom-nguyen-to')
      .ctx.state.bombs.some((b) => b.owner === 'p1' && b.enhanced && b.element === 'water'),
  );
  await sandbox.screenshot({ path: t.shot('02-water-warning-desktop.png') });
  // Pressing a key continuously must not restore an older timer snapshot.
  const time = await sandbox.evaluate(
    () => window.__phaser.scene.getScene('bom-nguyen-to').ctx.state.time,
  );
  await sandbox.keyboard.down('w');
  await sandbox.waitForFunction(
    (time) => window.__phaser.scene.getScene('bom-nguyen-to').ctx.state.time >= time + 600,
    time,
  );
  await sandbox.keyboard.up('w');
  await sandbox.getByRole('button', { name: 'Khán giả', exact: true }).click();
  await sandbox.keyboard.press('Space');
  const spectator = await sandbox.evaluate(() => {
    const s = window.__phaser.scene.getScene('bom-nguyen-to');
    return s.ctx.me === null && s.direction === 'none' && s.actions.every((c) => !c.enabled);
  });
  if (!spectator) throw new Error('Spectator retained input');
  await sandbox.getByRole('button', { name: 'Ván mới', exact: true }).click();
  await sandbox.getByRole('button', { name: 'Người 1', exact: true }).click();
  await clickCanvas(sandbox, id, (s) => s.selectChoices[4].container);
  await clickCanvas(sandbox, id, (s) => s.readyButton.container);
  await playing(sandbox);
  await sandbox.setViewportSize(PHONE);
  // Exercise held pointer movement, then release globally so movement cannot stick.
  const point = await canvasPoint(sandbox, id, (s) => s.pad[2].container);
  await sandbox.mouse.move(point.x, point.y);
  await sandbox.mouse.down();
  await sandbox.waitForFunction(
    () => window.__phaser.scene.getScene('bom-nguyen-to').ctx.state.fighters[0].y > 1.3,
  );
  await sandbox.mouse.up();
  await sandbox.waitForFunction(
    () => window.__phaser.scene.getScene('bom-nguyen-to').direction === 'none',
  );
  const bounds = await sandbox.evaluate(() => {
    const s = window.__phaser.scene.getScene('bom-nguyen-to');
    return [...s.pad, ...s.actions].every((c) => {
      const b = c.container.getBounds();
      return (
        b.left >= 0 &&
        b.right <= s.ctx.screen.width &&
        b.top >= s.ctx.screen.top &&
        b.bottom <= s.ctx.screen.height
      );
    });
  });
  if (!bounds) throw new Error('Mobile controls clipped');
  await sandbox.screenshot({ path: t.shot('03-match-phone.png') });
  await clickCanvas(sandbox, id, (s) => s.helpButton.container);
  await sandbox.waitForFunction(
    () => window.__phaser.scene.getScene('bom-nguyen-to').helpPanel.visible,
  );
  await sandbox.screenshot({ path: t.shot('04-rules-phone.png') });
  await clickCanvas(sandbox, id, (s) => s.helpClose.container);
  await sandbox.getByRole('button', { name: 'Tuỳ chỉnh', exact: true }).click();
  await clickCanvas(sandbox, `${id}:setup`, (s) => s.choices[1].container);
  await clickCanvas(sandbox, `${id}:setup`, (s) => s.submitButton.container);
  await ready(sandbox);
  const teams = await sandbox.evaluate(() => {
    const s = window.__phaser.scene.getScene('bom-nguyen-to').ctx.state;
    return (
      s.mode === 'teams' &&
      s.fighters.length === 4 &&
      s.fighters.filter((p) => p.team === 0).length === 2
    );
  });
  if (!teams) throw new Error('2v2 missing filled seats');
  await sandbox.setViewportSize({ width: 1024, height: 768 });
  await sandbox.screenshot({ path: t.shot('05-teams-tablet.png') });
  await sandbox.context().close();

  // Two humans in a real room. Internal bots fill missing characters without taking seats.
  const host = await t.page(DESKTOP),
    guest = await t.page(PHONE),
    fan = await t.page(PHONE);
  await signUp({ ...t, url: `${t.url}/?game=${id}` }, host, 'BomHost');
  await host.getByRole('button', { name: '+ Tạo phòng' }).click();
  await clickCanvas(host, `${id}:setup`, (s) => s.choices[3].container); // 1v1
  await clickCanvas(host, `${id}:setup`, (s) => s.choices[6].container); // friends, no lobby bots
  await clickCanvas(host, `${id}:setup`, (s) => s.submitButton.container);
  await signUp({ ...t, url: `${t.url}/?game=${id}` }, guest, 'BomGuest');
  await guest
    .locator('.room-row', { hasText: 'Phòng của BomHost' })
    .getByRole('button', { name: 'Vào chơi' })
    .click();
  await signUp({ ...t, url: `${t.url}/?game=${id}` }, fan, 'BomFan');
  await fan
    .locator('.room-row', { hasText: 'Phòng của BomHost' })
    .getByRole('button', { name: 'Xem' })
    .click();
  await host.getByRole('button', { name: 'Bắt đầu', exact: true }).click();
  await ready(host);
  await ready(guest);
  await ready(fan);
  await clickCanvas(host, id, (s) => s.selectChoices[2].container);
  await clickCanvas(guest, id, (s) => s.selectChoices[3].container);
  await clickCanvas(host, id, (s) => s.readyButton.container);
  await clickCanvas(guest, id, (s) => s.readyButton.container);
  await playing(host);
  await playing(guest);
  await host.keyboard.press('Space');
  for (const page of [guest, fan])
    await page.waitForFunction(() =>
      window.__phaser.scene
        .getScene('bom-nguyen-to')
        .ctx.state.bombs.some((b) => b.element === 'lightning'),
    );
  await guest.screenshot({ path: t.shot('06-synchronized-room-phone.png') });
  await leaveRoom(guest);
  await host.waitForFunction(
    () => window.__phaser.scene.getScene('bom-nguyen-to').ctx.state.phase === 'ended',
  );
  await host.screenshot({ path: t.shot('07-victory-desktop.png') });
  await host.getByRole('button', { name: 'Chơi ván mới', exact: true }).click();
  await host.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('bom-nguyen-to');
    return (
      s.ctx.state.phase === 'select' &&
      s.ctx.state.bombs.length === 0 &&
      s.ctx.state.fighters.every((p) => p.hp === 100)
    );
  });
  await leaveRoom(host);
}
