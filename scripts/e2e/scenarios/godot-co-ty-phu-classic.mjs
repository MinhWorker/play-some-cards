// Cờ tỷ phú Classic in the Godot client (#122): the sandbox (?play=co-ty-phu-classic) plays three
// computer players. You play a few real turns through the buttons (Gieo, then Mua, Xác nhận, Từ
// bỏ, Trả nợ or Hết lượt as the turn asks; Trao đổi once), open the card of a square, then the Dev Console
// leaves one computer player with 10 ₫ in front of your hotel and steps it until it goes
// bankrupt and you win. Needs the debug web build (npm run godot:export -- --debug).

import { DESKTOP, godotText, launch, onScene, openGodot, room, tap } from '../godot.mjs';

export const games = ['co-ty-phu-classic'];
export { launch };

/** Runs a Dev Console line in the room. */
async function cmd(page, line) {
  await page.evaluate((line) => window.xomdao.request('dev:command', { line }), line);
  const reply = await (await page.waitForFunction(() => window.xomdao.reply())).jsonValue();
  if (!reply.ok) throw new Error(`Dev Console ${line}: ${reply.error}`);
}

/** Who the room waits on (decisionSeat in src/game/turnClock.ts). */
function deciding(v) {
  if (v.phase === 'auction') return v.auction?.bidder ?? v.turn;
  if (v.phase === 'trade') return v.trade?.to ?? v.turn;
  if (v.phase === 'debt') return v.debt?.payer ?? v.turn;
  return v.turn;
}

/** The button your turn asks for now. */
function buttonFor(v, me) {
  const cash = v.players[me].cash;
  switch (v.phase) {
    case 'roll':
      return 'Roll';
    case 'buy':
      return cash >= PRICES[v.pending] ? 'Buy' : 'Skip';
    case 'event':
      return 'Confirm';
    case 'auction':
      return 'Pass';
    case 'end':
      return 'EndTurn';
    case 'debt':
      return cash >= v.debt.amount ? 'PayDebt' : 'Bankrupt';
  }
  return null;
}

/** Waits for a button to show (the pawns may still be walking), then taps it. */
async function press(page, name) {
  await page.waitForFunction((name) => window.xomdao.rect(name), name, { timeout: 20_000 });
  const before = (await room(page)).view.moneySequence;
  await tap(page, name);
  await page
    .waitForFunction((before) => window.xomdao.state().room.view.moneySequence !== before, before, {
      timeout: 5000,
    })
    .catch(() => {});
}

const PRICES = [
  0, 200, 150, 180, 0, 200, 280, 0, 320, 350, 0, 220, 150, 260, 240, 200, 270, 0, 260, 170, 0, 270,
  0, 300, 250, 200, 140, 160, 150, 270, 0, 280, 260, 0, 220, 200, 350, 300, 0, 180,
];

export default async function run(t) {
  const page = await openGodot(t, await t.page(DESKTOP), '?play=co-ty-phu-classic');
  await onScene(page, 'co-ty-phu-classic', 60_000);
  const me = await page.evaluate(() => {
    const { room, playerId } = window.xomdao.state();
    return room.seats.findIndex((s) => s.id === playerId);
  });
  const seen = new Set();
  let turns = 0;
  for (let i = 0; i < 2000 && turns < 3; i++) {
    const v = (await room(page)).view;
    if (v.winner !== null) break;
    const button = deciding(v) === me ? buttonFor(v, me) : null;
    if (button === 'Roll' && !seen.has('trade')) {
      // Trao đổi opens the offer board; close it again.
      seen.add('trade');
      await page.waitForFunction(() => window.xomdao.rect('Offer'), null, { timeout: 20_000 });
      await tap(page, 'Offer');
      await tap(page, 'TakeCash');
      await page.screenshot({ path: t.shot('1-trade.png') });
      await tap(page, 'CloseTrade');
    }
    if (button) {
      await press(page, button);
      if (!seen.has(button)) {
        seen.add(button);
        await page.screenshot({ path: t.shot(`1-${button.toLowerCase()}.png`) });
      }
      if (button === 'EndTurn') turns++;
    }
    await page.waitForTimeout(150);
  }
  if (turns < 3) throw new Error(`Only ${turns} turns played`);

  // Stage the end: two players out, the last one with 10 ₫ one step before your hotel.
  await cmd(page, 'bot pause; timer pause');
  await page.waitForTimeout(1500);
  const other = [1, 2, 3].map((k) => (me + k) % 4);
  await cmd(
    page,
    [
      `state set players.${other[0]}.bankrupt true`,
      `state set players.${other[1]}.bankrupt true`,
      `state set properties.3.owner ${me}`,
      'state set properties.3.houses 5',
      'state set properties.3.mortgaged false',
      `state set players.${other[2]}.position 1`,
      `state set players.${other[2]}.cash 10`,
      `state set players.${other[2]}.jailed false`,
      `state set turn ${other[2]}`,
      'state set phase "roll"',
      'state set specialEvent null',
      'state set auction null',
      'state set debt null',
      'state set trade null',
      'state set pending null',
      'dice 1 1',
    ].join('; '),
  );
  await page.waitForTimeout(800);
  await tap(page, 'Square_3');
  await godotText(page, 'CardTitle', 'Việt Trì');
  await page.screenshot({ path: t.shot('2-square.png') });
  await tap(page, 'Square_3');
  for (let i = 0; i < 20 && (await room(page)).view.winner === null; i++) {
    await cmd(page, 'bot step');
    await page.waitForTimeout(500);
  }
  await godotText(page, 'Status', 'Bạn thắng!', 15_000);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: t.shot('3-won.png') });
  await godotText(page, 'ResultTitle', /thắng/, 30_000);
  await page.screenshot({ path: t.shot('4-result.png') });
}
