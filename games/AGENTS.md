# Games and the SDK

Where to look:
- **How to build a game** (Vietnamese, for people): `docs/making-a-game.md`.
- **Every hook**: `docs/making-a-game.md` ("Các hook").
- **Examples**:
  - `scripts/templates/game/` is the minimal starter.
  - `games/tic-tac-toe` (Caro) adds room options, a computer player and a setup screen.
- **The source of truth for the API** is the headers of `packages/sdk/src/engine.ts` and
  `packages/sdk/src/client/GameView.ts`.

## A game's folder

```
games/<id>/          Only index.ts + client.ts are required
  RULES.md             Current Vietnamese gameplay rules (non-starter games)
  README.md            Component map, development commands and asset credits
  src/index.ts         export default definePlugin({ meta, game: new MyGame(), room? }); server
  src/client.ts        export default defineClient({ scene, setup?, background?, leaveConfirm?, showsResult?, showsPlayers?, hud? }); browser, lazy
  src/game/            Pure logic, no Phaser or DOM: <Name>Game.ts (+ test), model.ts, options.ts, bot.ts
  src/scenes/          Phaser: <Name>View.ts (a GameView), <Name>Setup.ts (a RoomSetupScene for "Tạo phòng")
  assets/              App-ready images/sounds, used by file name (this.image('tile'), this.sfx('move'));
                       same-name .json = atlas; <name>.normal.webp = raw normals for image/atlas <name>
  sources/             Optional originals (Git LFS) + prompts.json (see assets/AGENTS.md)
```

| Command | What it does |
| --- | --- |
| `npm run new:game -- <id> "Tên"` | Create `games/<id>/` from the starter game (`scripts/templates/game`, status `wip`) |
| `npm run new -- logic\|view\|setup <id> [Name]` | Write a `Game` (+ test), a `GameView` or a setup screen from `scripts/templates/` (leave out `<id>` inside `games/<id>/`) |
| `/?play=<id>&players=2` | Sandbox: the game's rules + board alone in the browser, in dev and PR previews |

## Rules

- **The server is authoritative.** A `GameView` calls `send(event, payload)`, which goes out as
  `game:move`. The server then:
  1. checks the payload against `events`;
  2. runs `on<Event>`;
  3. sends each member a `room:state` built by `view(ctx, viewer)`.
- **Never send raw state.** Hide other players' cards and the deck in `view`. Spectators get
  `viewer = null`, and events listed in `secretEvents` stay hidden from others.
- Hooks are pure and return a new state. Randomness goes only through `ctx.rng`.
- Optional `override readonly commands` declares `z.object` schemas; each needs a `cmd<Name>`
  hook (`move-token` → `cmdMoveToken`). `CommandContext<State, Options, Args>` adds validated
  `args` and `reject` to the normal game context. Positional arguments follow object key order.
- Optional `override readonly catalogs` lists `{ id, value, label }` entries. IDs are unique
  kebab-case; labels are Vietnamese. `catalog(name)` defaults to numeric values; pass a zod
  schema as the second argument for other types. Console `@catalog:id` resolves to `value`.
- `gameRules` and registry tests reject reserved command names, missing command hooks,
  invalid/duplicate catalog IDs and references to unknown catalogs. Existing games need no
  commands or catalogs.
- Synchronous `console.log/info/warn/error` in hooks reaches the room log with `XOMDAO_DEV=1`
  and still prints in the terminal. SDK declares these methods for pure game builds.
- A game imports only these; Biome enforces it, and core never imports a game:
  - `@xomdao/sdk` and `@xomdao/sdk/client`;
  - `phaser` and `zod`;
  - its own files.
- Cờ tỷ phú Classic groups scene helpers under `src/scenes/board/`, `effects/`, `hud/` and
  `presentation/`; see `co-ty-phu-classic/AGENTS.md`. Its depth-specific Biome override still
  prevents imports outside the game's `src/`.
- Every `Game` has tests with `testGame` (`src/game/<Name>Game.test.ts`).
- A game's browser test is a scenario, `scripts/e2e/scenarios/<id>.mjs` with
  `export const games = ['<id>']` (copy `tien-len.mjs`). CI runs it on its own machine whenever
  `games/<id>/` changes; see "E2E trong CI" in `docs/deploy.md`.
- When a mechanic or piece of data would help other games too, add it to the SDK instead of the
  game. Examples: a system event, a `ctx` property, a view helper, a test helper.
- Changing an SDK API means, in the same change:
  - updating every game that uses it;
  - documenting it in the engine.ts / GameView.ts headers and `docs/making-a-game.md`.
- `meta.status: 'wip'` is locked only on the production site (`VERCEL_ENV`), so unfinished games
  can be merged. `'ready'` releases the game.
- The server runs the games' compiled `dist/`, while the web app and typechecks use their
  TypeScript source (export condition `xomdao-source`). Root scripts build them first
  (`scripts/libs.mjs`).

## Mechanics worth knowing

- **Seats never change during a game.** A leaver stays in `ctx.players` with `left: true`. Without
  `onLeave`, one player leaving stops the game for everyone.
- **Timers**: `ctx.setTimer(ms, 'name')` calls `onName(ctx)`. There is one timer per game, and
  the gateway runs it. Use it for a turn clock or a pause between rounds. The view shows
  countdowns with `ctx.timer`.
- **Room options and bots**:
  - `room.options` is a zod schema, and `optionsSchema.parse({})` must work.
  - A game reads the options as `ctx.options` in both the `Game` and the `GameView`.
  - `room.bots` seats computer players, whose moves come from `bot(ctx)`.
  - The host changes options between games through "Tuỳ chỉnh" or `changeOptions`.
- **Snapshots** carry `round` and `last` (the last event). `ctx.lastResult` is how the room's
  previous game ended.
- **Boards**: follow `docs/ui-guide.md` (landscape frame, table filling the height, sizes), and
  build them from `GameScene` helpers:
  - `label`, `button`, `sprite` and `avatar(player)`;
  - `hudScale()`, `fitText` and `boardArea()`.
  - `rasterizeGraphics(scene, graphics, key, bounds, image?)` from the client SDK caches static
    Graphics as an image with scene-owned textures. Include outlines/shadows in local bounds;
    refresh only when the drawing changes, never on every frame.
- **Room HUD**: optional `defineClient({ hud: { nav, settings, result } })` lets the board draw the
  room bar, settings button and result buttons in its own art. The board reads `ctx.room` and
  calls `leaveRoom`, `openSettings`, `newGame`, `customize`, `takeSeat` (GameView header). The app
  hides its versions while the board shows; errors and the leave question stay the app's.
- **Backgrounds**: optional `defineClient({ background: false | MyBackground })` hides/replaces
  the app sky for boards/sandboxes. `GameBackgroundScene` has scene lifetime, no room state/input,
  and `onCreate`, `onLayout`, `onUpdate(dt)` hooks; `this.tiled(name)` covers the bleed with a
  seamless tile at one texel per canvas pixel. Setups retain the app sky.
- **Presentation**: `this.runtime.run` owns scoped async flows; `fx.tween`, `wait`, `sound`,
  `animate`, `frame` and `parallel` use its clock and cancellation. Use `fx.defer` for temporary
  objects and `fx.checkpoint` before direct side effects after await. Reset display fields in
  `onCreate`; rebuild silently in `onResync`. Games with multiple visual rounds per match call
  `runtime.newRound('game-round')` before replacing cards. Never mix managed and raw Phaser
  tweens on a target. See the presentation/runtime sections of `docs/making-a-game.md`.
- **Coordinates are design units** on a landscape frame 720 tall and 960–1600 wide
  (`this.view`, `ctx.screen`), never screen pixels: the camera scales the frame to the screen at
  its pixel density. `this.bleed` is how far the screen reaches beyond it (backgrounds only).
  Read taps with `pointer.worldX/worldY`; `pointer.x/y` are canvas pixels.

  Setup screens have the same helpers. Anything game-like (pieces, cards, animation, drag and
  drop) is drawn in Phaser.
- **`testGame`** takes a plugin or a `Game`. It offers:
  - `send`, `error`, `view` and `assertHidden`;
  - `command(line)` for optional game dev commands, catalog references and semicolon chains;
  - `bot`, `newGame`, `timer`, `fireTimer` and `leave`;
  - the option `bots`.

Before finishing a game change, also play it in the sandbox.
