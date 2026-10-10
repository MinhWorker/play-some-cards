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

/**
 * Types `text` into a LineEdit by name. Under load Godot can miss the tap's focus or some keys,
 * so it checks the field and, cleared, types again (three tries).
 */
export async function typeInto(page, name, text) {
  for (let i = 0; ; i++) {
    await tap(page, name);
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.type(text, { delay: 20 });
    try {
      // Godot takes the keys on its next frames.
      return await godotText(page, name, text, 5000);
    } catch (err) {
      if (i === 2) throw err;
    }
  }
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

/** A balance as the hub shows it: "2.450". */
export const coins = (amount) => String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/**
 * Plays Caro as X until the game ends, against a computer that plays anywhere near the pieces:
 * each turn extends the row with the most X and no O (rows of five cells on the board).
 */
export async function caroPlayToEnd(page) {
  for (let turn = 0; turn < 60; turn++) {
    const state = await page.evaluate(() => window.xomdao.state().room);
    if (state.status !== 'playing') return;
    const { board } = state.view;
    const at = (x, y) => board.cells[(y - board.top) * board.cols + (x - board.left)];
    let best = null;
    for (let y = board.top; y < board.top + board.rows; y++) {
      for (let x = board.left; x + 4 < board.left + board.cols; x++) {
        const line = [0, 1, 2, 3, 4].map((i) => at(x + i, y));
        if (line.some((c) => c !== null && c !== 'X')) continue;
        const mine = line.filter((c) => c === 'X').length;
        if (!best || mine > best.mine) best = { mine, x: x + line.indexOf(null), y };
      }
    }
    if (!best) throw new Error('No open row left for X');
    await caroTap(page, best.x, best.y);
    await page.waitForFunction(
      () => {
        const r = window.xomdao.state().room;
        return r.status !== 'playing' || window.xomdao.text('Status') === 'Lượt bạn';
      },
      null,
      { timeout: 30_000 },
    );
  }
  throw new Error('Caro did not end');
}
