// __NAME__ in the Godot client: with the server's event clock moved into the event (dev:clock),
// the sandbox (?play=__ID__) picks every bud and the result shows the event's points. Needs the
// debug web build at /godot/ (npm run godot:export -- --debug) and a dev server (XOMDAO_DEV=1).

import { godotText, launch, onScene, openGodot } from '../godot.mjs';
import { PHONE } from '../lib.mjs';

export const games = ['__ID__'];
export { launch };
// It moves the server's event clock: other scenarios with this lock wait for it.
export const lock = 'clock';

const OPEN = '__OPENS__T12:00:00+07:00';
const PICKS = 5;

/** A request through the bridge; its reply. */
async function ask(page, event, data) {
  await page.evaluate(({ event, data }) => window.xomdao.request(event, data), { event, data });
  return (await page.waitForFunction(() => window.xomdao.reply())).jsonValue();
}

export default async function run(t) {
  let page = await openGodot(t, await t.page(PHONE));
  await onScene(page, 'lobby');
  try {
    if (!(await ask(page, 'dev:clock', { at: OPEN })).ok) throw new Error('dev:clock refused');
    page = await openGodot(t, page, '?play=__ID__');
    await onScene(page, '__ID__', 60_000);
    for (let pick = 1; pick <= PICKS; pick++) {
      await page.waitForFunction(() => window.xomdao.click('Pick'), null, { timeout: 10_000 });
      await page.waitForFunction(
        (n) => window.xomdao.state().room?.view?.picked?.length === n,
        pick,
      );
      if (pick === 3) await page.screenshot({ path: t.shot('1-picking.png') });
    }
    await godotText(page, 'ResultTitle', /^\+\d+ điểm sự kiện$/);
    await page.screenshot({ path: t.shot('2-result.png') });
  } finally {
    // Back to the real time before the page closes: other scenarios share the server.
    await ask(page, 'dev:clock', { at: null }).catch(() => {});
  }
}
