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

// Controls must stay within the viewport and clear every potentially walkable grid center.
const controlsClear = (page) =>
  page.waitForFunction(
    () => {
      const s = window.__phaser.scene.getScene('bom-nguyen-to');
      const topWidth = s.project({ x: 12, y: 0 }).x - s.project({ x: 0, y: 0 }).x;
      const bottomWidth = s.project({ x: 12, y: 10 }).x - s.project({ x: 0, y: 10 }).x;
      if (Math.abs(topWidth - bottomWidth) > 0.01) return false;
      return [...s.pad, ...s.actions].every((c) => {
        const b = c.container.getBounds();
        if (
          b.left < 0 ||
          b.right > s.ctx.screen.width ||
          b.top < s.ctx.screen.top ||
          b.bottom > s.ctx.screen.height
        )
          return false;
        for (let y = 1; y < 10; y++)
          for (let x = 1; x < 12; x++) {
            if (x % 2 === 0 && y % 2 === 0) continue;
            const p = s.project({ x, y });
            if (b.contains(p.x, p.y)) return false;
          }
        return true;
      });
    },
    undefined,
    { timeout: 10000 },
  );

// Observe rendered atlas frames during real gameplay, rather than accepting position tweens
// as character animation. This listener belongs only to the browser scenario.
const observeActor = (page) =>
  page.evaluate(() => {
    const scene = window.__phaser.scene.getScene('bom-nguyen-to');
    const sprite = scene.actors.get(scene.ctx.me.id).sprite;
    if (sprite.type !== 'Sprite' || sprite.texture.getFrameNames().length < 20)
      throw new Error('Fighters must use a real multi-state sprite atlas');
    window.__bomAnimationFrames = [];
    sprite.on('animationupdate', (animation) => {
      window.__bomAnimationFrames.push({
        animation: animation.key,
        frame: sprite.frame.name,
        texture: sprite.texture.key,
      });
    });
  });

const renderedFrames = async (page, state, direction, minimum = 2) => {
  await page.waitForFunction(
    ({ state, direction, minimum }) => {
      const statePattern = new RegExp(`(^|[-:.])${state}([-:.]|$)`);
      const directionPattern = direction && new RegExp(`(^|[-:.])${direction}([-:.]|$)`);
      const frames = window.__bomAnimationFrames.filter(
        (f) =>
          statePattern.test(f.animation) && (!directionPattern || directionPattern.test(f.frame)),
      );
      return new Set(frames.map((f) => `${f.texture}:${f.frame}`)).size >= minimum;
    },
    { state, direction, minimum },
    { timeout: 10000 },
  );
};

const clearAnimationFrames = (page) =>
  page.evaluate(() => {
    window.__bomAnimationFrames = [];
  });

async function spriteLifecycle(t) {
  const page = await t.page(DESKTOP);
  await page.goto(`${t.url}/?play=${id}&players=1`);
  await ready(page);
  // Practice removes random bot combat from the animation and freeze checks.
  await page.getByRole('button', { name: 'Tuỳ chỉnh', exact: true }).click();
  await clickCanvas(page, `${id}:setup`, (s) => s.choices[2].container);
  await clickCanvas(page, `${id}:setup`, (s) => s.choices[16].container);
  await clickCanvas(page, `${id}:setup`, (s) => s.submitButton.container);
  await ready(page);
  await clickCanvas(page, id, (s) => s.readyButton.container);
  await playing(page);
  await observeActor(page);
  await renderedFrames(page, 'idle');
  for (const [key, direction, axis, outward] of [
    ['s', 'down', 'y', true],
    ['w', 'up', 'y', false],
    ['d', 'right', 'x', true],
    ['a', 'left', 'x', false],
  ]) {
    await clearAnimationFrames(page);
    await page.keyboard.down(key);
    await renderedFrames(page, 'walk', direction);
    // Travel a full safe spawn corridor before returning. Short frame-dependent holds can
    // leave too little room for the opposite-direction clip on a slow browser.
    await page.waitForFunction(
      ({ axis, outward }) => {
        const p = window.__phaser.scene.getScene('bom-nguyen-to').ctx.state.fighters[0];
        return outward ? p[axis] >= 2.1 : p[axis] <= 1.1;
      },
      { axis, outward },
    );
    await page.keyboard.up(key);
    await renderedFrames(page, 'idle', direction);
  }
  await clearAnimationFrames(page);
  await page.keyboard.press('e');
  await renderedFrames(page, 'skill');
  await renderedFrames(page, 'idle');
  await clearAnimationFrames(page);
  await page.keyboard.press('Space');
  await renderedFrames(page, 'place');
  // A live bomb must animate its actual fuse frames while remaining anchored to its cell.
  const bombFrames = await page.evaluate(async () => {
    const s = window.__phaser.scene.getScene('bom-nguyen-to');
    const bomb = [...s.bombs.values()][0].image;
    const frames = new Set(),
      positions = new Set();
    const start = performance.now();
    while (performance.now() - start < 500) {
      await new Promise(requestAnimationFrame);
      if (!bomb.scene) break;
      frames.add(bomb.frame.name);
      positions.add(`${bomb.x.toFixed(2)},${bomb.y.toFixed(2)}`);
    }
    return { sprite: bomb.type === 'Sprite', frames: frames.size, positions: positions.size };
  });
  if (!bombFrames.sprite || bombFrames.frames < 2 || bombFrames.positions !== 1)
    throw new Error('Bomb fuse must use atlas frames without moving the bomb off its cell');
  await page.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('bom-nguyen-to').ctx.state;
    return s.fighters[0].hp === 65 && s.fighters[0].frozenUntil > s.time;
  });
  const frozenPosition = await page.evaluate(() => {
    const p = window.__phaser.scene.getScene('bom-nguyen-to').ctx.state.fighters[0];
    return { x: p.x, y: p.y, time: p.frozenUntil };
  });
  await page.keyboard.down('s');
  await page.waitForFunction(({ x, y, time }) => {
    const s = window.__phaser.scene.getScene('bom-nguyen-to').ctx.state,
      p = s.fighters[0];
    return s.time < time && p.dir === 'down' && p.x === x && p.y === y;
  }, frozenPosition);
  await page.keyboard.up('s');
  const explosionFrames = await page.evaluate(async () => {
    const scene = window.__phaser.scene.getScene('bom-nguyen-to');
    const effect = [...scene.flames.values()][0];
    if (effect?.type !== 'Sprite') return 0;
    const frames = new Set();
    const start = performance.now();
    while (performance.now() - start < 250) {
      await new Promise(requestAnimationFrame);
      if (!effect.scene) break;
      frames.add(effect.frame.name);
    }
    return frames.size;
  });
  if (explosionFrames < 2) throw new Error('Explosions must advance genuine atlas frames');
  await renderedFrames(page, 'frozen');
  await page.screenshot({ path: t.shot('08-ice-freeze-atlas.png') });
  await page.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('bom-nguyen-to').ctx.state;
    return s.fighters[0].frozenUntil <= s.time;
  });
  await clearAnimationFrames(page);
  await renderedFrames(page, 'idle');
  // Let empowerment expire: the next hit must play hit rather than the higher-priority freeze.
  await page.waitForFunction(() => {
    const s = window.__phaser.scene.getScene('bom-nguyen-to').ctx.state;
    return s.fighters[0].skillUntil <= s.time;
  });
  for (const hp of [30, 0]) {
    // Placing the next bomb inside the previous lingering blast chains it immediately.
    // Wait until the real danger and hit protection end before testing another self-hit.
    await page.waitForFunction(() => {
      const s = window.__phaser.scene.getScene('bom-nguyen-to').ctx.state;
      return !s.bombs.length && !s.blasts.length && s.fighters[0].invulnerableUntil <= s.time;
    });
    await clearAnimationFrames(page);
    await page.keyboard.press('Space');
    await page.waitForFunction(
      (hp) => window.__phaser.scene.getScene('bom-nguyen-to').ctx.state.fighters[0].hp === hp,
      hp,
    );
    await renderedFrames(page, hp > 0 ? 'hit' : 'ko');
    if (hp > 0) {
      await clearAnimationFrames(page);
      await renderedFrames(page, 'idle');
    }
  }
  await page.waitForFunction(() => {
    const scene = window.__phaser.scene.getScene('bom-nguyen-to');
    return scene.ctx.state.phase === 'ended' && !scene.actors.get('p1').sprite.visible;
  });
  await page.screenshot({ path: t.shot('09-practice-result.png') });
  // New snapshots must show clean idle characters, with no KO, blasts, or old one-shots replayed.
  await page.getByRole('button', { name: 'Ván mới', exact: true }).click();
  await ready(page);
  await page.waitForFunction(() => {
    const scene = window.__phaser.scene.getScene('bom-nguyen-to');
    return (
      scene.ctx.state.phase === 'select' &&
      scene.ctx.state.fighters[0].hp === 100 &&
      scene.actors.get('p1').sprite.visible &&
      /(^|[-:.])idle([-:.]|$)/.test(scene.actors.get('p1').sprite.anims.currentAnim?.key ?? '') &&
      scene.bombs.size === 0 &&
      scene.flames.size === 0
    );
  });
  await page.context().close();
}

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
  await controlsClear(sandbox);
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
  await controlsClear(sandbox);
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
  await guest.context().close();
  await fan.context().close();
  await host.context().close();
  await spriteLifecycle(t);
}
