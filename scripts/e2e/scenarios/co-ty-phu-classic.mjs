// Play several turns through the real Phaser controls in the sandbox, switching seats.
import { clickCanvas, DESKTOP, openRooms, PHONE, signUp } from '../lib.mjs';

export const games = ['co-ty-phu-classic'];

export default async function run(t) {
  const page = await t.page(PHONE);
  const url = new URL(t.url);
  url.search = '?play=co-ty-phu-classic&players=2';
  await page.goto(url.toString());
  await page.waitForFunction(() => window.__phaser?.scene.isActive('co-ty-phu-classic'));
  await page.screenshot({ path: t.shot('10-start.png') });
  const ready = await page.evaluate(() => {
    const scene = window.__phaser.scene.getScene('co-ty-phu-classic');
    return {
      phase: scene.visualPhase,
      names: scene.readyNames.filter((text) => text.visible).map((text) => text.text),
      cash: scene.readyCash.filter((text) => text.visible).map((text) => text.text),
    };
  });
  if (
    ready.phase !== 'ready' ||
    ready.names.length !== 2 ||
    ready.cash.some((cash) => cash !== '1500 ₫')
  )
    throw new Error(`Opening table is incomplete: ${JSON.stringify(ready)}`);
  await clickCanvas(page, 'co-ty-phu-classic', (s) => s.readyStart.hit);
  await page.waitForFunction(
    () => window.__phaser.scene.getScene('co-ty-phu-classic').visualPhase === 'decision',
  );
  const tileIcons = await page.evaluate(() => {
    const scene = window.__phaser.scene.getScene('co-ty-phu-classic');
    return [0, 1, 5, 7, 10, 12, 20, 28, 30].map((square) => scene.squareIcons[square].frame.name);
  });
  if (
    JSON.stringify(tileIcons) !==
    JSON.stringify([
      'start',
      'street-empty',
      'station',
      'chance',
      'jail',
      'power',
      'free',
      'water',
      'go-jail',
    ])
  )
    throw new Error(`Board icons do not match square kinds: ${tileIcons.join(', ')}`);

  await clickCanvas(page, 'co-ty-phu-classic', (s) => s.squares[3]);
  const detail = await page.evaluate(
    () => window.__phaser.scene.getScene('co-ty-phu-classic').detail.text,
  );
  if (!detail.includes('Hàng Đào')) throw new Error('Selecting a property did not show its deed');
  await page.screenshot({ path: t.shot('11-deed.png') });

  let purchases = 0;
  for (let i = 0; i < 12; i++) {
    await page.waitForFunction(
      () => window.__phaser.scene.getScene('co-ty-phu-classic').visualPhase === 'decision',
    );
    const state = await page.evaluate(() => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state;
      return { turn: s.turn, phase: s.phase, cash: s.players[s.turn].cash, pending: s.pending };
    });
    await page.getByRole('button', { name: `Người ${state.turn + 1}`, exact: true }).click();
    if (state.phase === 'roll') {
      await clickCanvas(page, 'co-ty-phu-classic', (s) => s.main[0].hit);
      if (i === 0) {
        await page.waitForFunction(() => {
          const scene = window.__phaser.scene.getScene('co-ty-phu-classic');
          return (
            scene.ctx.state.dice &&
            scene.visualPhase === 'rolling' &&
            scene.shownPositions[0] === 0 &&
            !scene.moving[0] &&
            scene.playerPlace[0].text === 'Xuất phát' &&
            scene.main.every((button) => !button.hit.visible)
          );
        });
        await page.screenshot({ path: t.shot('12-dice.png') });
        await page.waitForFunction(() => {
          const scene = window.__phaser.scene.getScene('co-ty-phu-classic');
          return (
            scene.visualPhase === 'result' &&
            scene.dice.settled &&
            scene.dice.values.every((value, die) => value === scene.ctx.state.dice[die])
          );
        });
        await page.screenshot({ path: t.shot('12-dice-result.png') });
        await page.waitForFunction(() => {
          const scene = window.__phaser.scene.getScene('co-ty-phu-classic');
          return (
            scene.visualPhase === 'moving' &&
            scene.moving[0] &&
            scene.playerPlace[0].text === 'Xuất phát'
          );
        });
        await page.screenshot({ path: t.shot('12-hop.png') });
        await page.waitForFunction(() => {
          const scene = window.__phaser.scene.getScene('co-ty-phu-classic');
          return (
            scene.visualPhase === 'landing' &&
            scene.selected === null &&
            scene.heading.text.startsWith('Đến ') &&
            scene.heading.text.slice(4).startsWith(scene.detail.text.replace(/…$/, ''))
          );
        });
        const repeatedCard = await page.evaluate(() => {
          const scene = window.__phaser.scene.getScene('co-ty-phu-classic');
          return scene.card.visible && scene.notice.text === scene.card.text;
        });
        if (repeatedCard) throw new Error('The landing announcement repeats the card message');
        await page.screenshot({ path: t.shot('12-landed.png') });
        await page.waitForFunction(() => {
          const scene = window.__phaser.scene.getScene('co-ty-phu-classic');
          return (
            scene.visualPhase === 'decision' &&
            scene.shownPositions[0] === scene.ctx.state.players[0].position &&
            !scene.dice.visible
          );
        });
      }
    } else if (state.phase === 'buy') {
      const price = await page.evaluate(
        () => window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state.pending,
      );
      if (
        state.cash >=
        (await page.evaluate((n) => {
          const scene = window.__phaser.scene.getScene('co-ty-phu-classic');
          return scene.ctx.state.pending === n
            ? Number(scene.main[0].text.text.match(/\d+/)?.[0])
            : 0;
        }, price))
      ) {
        const iconBefore = await page.evaluate(
          (square) =>
            window.__phaser.scene.getScene('co-ty-phu-classic').squareIcons[square].frame.name,
          price,
        );
        await clickCanvas(page, 'co-ty-phu-classic', (s) => s.main[0].hit);
        if (iconBefore === 'street-empty') {
          await page.waitForFunction(
            (square) =>
              window.__phaser.scene.getScene('co-ty-phu-classic').squareIcons[square].frame.name ===
              'street-owned',
            price,
          );
        }
        purchases++;
      } else {
        await clickCanvas(page, 'co-ty-phu-classic', (s) => s.main[1].hit);
      }
    } else if (state.phase === 'end') {
      await clickCanvas(page, 'co-ty-phu-classic', (s) => s.main[0].hit);
    } else if (state.phase === 'auction') {
      await clickCanvas(page, 'co-ty-phu-classic', (s) => s.main[3].hit);
    } else if (state.phase === 'debt') {
      const enough = await page.evaluate(() => {
        const s = window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state;
        return s.players[s.turn].cash >= s.debt.amount;
      });
      if (enough) await clickCanvas(page, 'co-ty-phu-classic', (s) => s.main[0].hit);
      else break;
    }
    await page.waitForTimeout(160);
  }
  if (purchases < 1) throw new Error('No property was purchased through the board controls');
  await page.screenshot({ path: t.shot('12-played.png') });

  const host = await t.page(DESKTOP);
  await signUp(t, host, 'TyPhu');
  await openRooms(host, 'co-ty-phu-classic');
  await host.getByRole('button', { name: '+ Tạo phòng' }).click();
  await clickCanvas(host, 'co-ty-phu-classic:setup', (s) => s.choices[1].container);
  await host.screenshot({ path: t.shot('20-bot-setup.png') });
  await clickCanvas(host, 'co-ty-phu-classic:setup', (s) => s.submitButton.container);
  await host.waitForTimeout(800);
  await host.screenshot({ path: t.shot('20-bot-room.png') });
  await host.getByText('🤖 Máy', { exact: true }).waitFor({ timeout: 5000 });
  await host.getByRole('button', { name: 'Bắt đầu' }).click();
  await host.waitForFunction(
    () => window.__phaser?.scene.getScene('co-ty-phu-classic')?.ctx?.state,
  );
  await clickCanvas(host, 'co-ty-phu-classic', (s) => s.readyStart.hit);
  await host.waitForFunction(
    () => window.__phaser.scene.getScene('co-ty-phu-classic').visualPhase === 'decision',
  );
  for (let i = 0; i < 8; i++) {
    await host.waitForFunction(
      () => window.__phaser.scene.getScene('co-ty-phu-classic').visualPhase === 'decision',
    );
    const state = await host.evaluate(
      () => window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state,
    );
    if (state.turn === 1) break;
    if (!['roll', 'buy', 'end'].includes(state.phase))
      throw new Error(`Unexpected phase: ${state.phase}`);
    await clickCanvas(host, 'co-ty-phu-classic', (s) => s.main[0].hit);
    await host.waitForTimeout(160);
  }
  await host.waitForFunction(
    () => {
      const s = window.__phaser.scene.getScene('co-ty-phu-classic').ctx.state;
      return s.players[1].position !== 0;
    },
    null,
    { timeout: 10000 },
  );
  await host.screenshot({ path: t.shot('21-bot-played.png') });
}
