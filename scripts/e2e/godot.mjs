// Helpers for scenarios that play the Godot client (/godot/, a debug build from
// `npm run godot:export -- --debug`). They go through its test bridge, window.xomdao
// (apps/client/core/test_bridge.gd): nodes are found by name and tapped with the real mouse.

/** Chromium flags: Godot needs WebGL 2, which headless Chromium gives through SwiftShader. */
export const launch = { args: ['--use-gl=angle', '--use-angle=swiftshader'] };

/** Opens the Godot client (with a query such as `?room=K7M2`) and waits for its first screen. */
export async function openGodot(t, page, query = '') {
  await page.goto(new URL(`/godot/${query}`, t.url).href);
  await page.waitForFunction(() => window.xomdao, null, { timeout: 60_000 });
  return page;
}

/** Waits until the screen (xomdao.scene()) is `scene`. */
export async function onScene(page, scene, timeout = 30_000) {
  await page.waitForFunction((s) => window.xomdao.scene() === s, scene, { timeout });
}

/** Waits until a node's text is `text` (or matches it, for a RegExp; any text when left out).
 * Returns the text. */
export async function godotText(page, name, text, timeout = 30_000) {
  const handle = await page.waitForFunction(
    ({ name, exact, source, flags }) => {
      const now = window.xomdao.text(name);
      if (now === null) return false;
      if (exact !== null) return now === exact ? now : false;
      if (source !== null) return new RegExp(source, flags).test(now) ? now : false;
      return now;
    },
    {
      name,
      exact: typeof text === 'string' ? text : null,
      source: text instanceof RegExp ? text.source : null,
      flags: text instanceof RegExp ? text.flags : '',
    },
    { timeout },
  );
  return handle.jsonValue();
}

/** Taps a visible node by name with the mouse, once it is there and enabled. */
export async function tap(page, name, timeout = 30_000) {
  const box = await (
    await page.waitForFunction(
      (n) => {
        const r = window.xomdao.rect(n);
        return r && r.width > 0 ? r : false;
      },
      name,
      { timeout },
    )
  ).jsonValue();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/** The latest room snapshot the client has (the protocol's RoomSnapshot), or null. */
export function room(page) {
  return page.evaluate(() => window.xomdao.state().room);
}

/** Plays a Caro cell (board coordinates) on your turn. */
export async function caroTap(page, x, y) {
  await godotText(page, 'Status', 'Lượt bạn');
  await tap(page, `Cell_${x}_${y}`);
  await page.waitForFunction(
    ({ x, y }) => {
      const { board } = window.xomdao.state().room.view;
      return board.cells[(y - board.top) * board.cols + (x - board.left)] !== null;
    },
    { x, y },
  );
}
