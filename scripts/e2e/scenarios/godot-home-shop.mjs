// Nhà and Chợ in the Godot client (#125): Lan gets coins (dev:coins), can't buy what she can't
// pay for, buys the jade frame with a double tap (paid once), wears it at Nhà, and makes a room.
// Hùng joins it at Bến, sees her new frame, and opens her Nhà (read-only). Needs the debug web
// build at /godot/ (npm run godot:export -- --debug) and a dev server (XOMDAO_DEV=1).

import { godotText, launch, onScene, openGodot, room, tap } from '../godot.mjs';
import { DESKTOP, PHONE } from '../lib.mjs';

export const games = ['tic-tac-toe'];
export { launch };

const coinsOf = (page) => page.evaluate(() => window.xomdao.state().balances['core:coin'] ?? 0);

export default async function run(t) {
  const lan = await openGodot(t, await t.page(DESKTOP));
  const hung = await openGodot(t, await t.page(PHONE));
  await onScene(lan, 'lobby');
  await lan.evaluate(() => window.xomdao.request('dev:coins', { amount: 250 }));
  await lan.waitForFunction(() => window.xomdao.reply()?.ok === true);

  await tap(lan, 'Place_cho');
  await onScene(lan, 'cho');
  await godotText(lan, 'Buy_frame-jade', 'Mua 200');
  await lan.screenshot({ path: t.shot('1-shop.png') });
  // 300 coins: refused, nothing paid.
  await tap(lan, 'Buy_frame-sapphire');
  await godotText(lan, 'Toast', 'Không đủ xu');
  if ((await coinsOf(lan)) !== 250) throw new Error('A refused purchase changed the balance');
  // A double tap pays once.
  const buy = await lan.evaluate(() => window.xomdao.rect('Buy_frame-jade'));
  await lan.mouse.click(buy.x + buy.width / 2, buy.y + buy.height / 2, { clickCount: 2 });
  await godotText(lan, 'Owned_frame-jade', 'Đã có');
  await lan.waitForFunction(() => window.xomdao.state().balances['core:coin'] === 50);
  await lan.screenshot({ path: t.shot('2-bought.png') });

  await tap(lan, 'Back');
  await onScene(lan, 'lobby');
  await tap(lan, 'Place_nha');
  await onScene(lan, 'nha');
  await tap(lan, 'Equip_frame-jade');
  await lan.waitForFunction(() => window.xomdao.state().user.frame === 'jade');
  await godotText(lan, 'Equip_frame-jade', 'Đang dùng');
  await lan.screenshot({ path: t.shot('3-home.png') });

  await tap(lan, 'Back');
  await onScene(lan, 'lobby');
  await tap(lan, 'CreateRoom');
  await tap(lan, 'ConfirmCreate');
  await onScene(lan, 'room');
  const code = await godotText(lan, 'RoomCode', /^[A-Z0-9]{4}$/);

  await onScene(hung, 'lobby');
  await tap(hung, 'Place_ben');
  await onScene(hung, 'ben');
  await tap(hung, 'CodeInput');
  await hung.keyboard.type(code.toLowerCase());
  await godotText(hung, 'CodeInput', code.toLowerCase());
  await tap(hung, 'Join');
  await onScene(hung, 'room');
  const lanId = await lan.evaluate(() => window.xomdao.state().user.id);
  const seen = (await room(hung)).players.find((p) => p.id === lanId);
  if (seen?.frame !== 'jade') throw new Error(`Hùng sees Lan's frame as ${seen?.frame}`);
  await hung.screenshot({ path: t.shot('4-room-phone.png') });
  // Lan is the host, in the first seat: her Nhà opens, read-only.
  await tap(hung, 'Seat0');
  await hung.waitForFunction(() => window.xomdao.rect('Item_frame-jade')?.width > 0);
  if (await hung.evaluate(() => window.xomdao.rect('Equip_frame-jade')))
    throw new Error("Someone else's Nhà offers Dùng");
  await hung.screenshot({ path: t.shot('5-her-home-phone.png') });
}
