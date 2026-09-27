# Games and the SDK

Where to look:
- **How to build a game** (Vietnamese, for people): `docs/making-a-game.md`.
- **Every hook**: `games/counter/README.md`.
- **Examples**:
  - `games/counter` is the smallest game.
  - `games/tic-tac-toe` (Caro) adds room options, a computer player and a setup screen.
- **The source of truth for the API** is the headers of `packages/sdk/src/engine.ts` and
  `packages/sdk/src/client/GameView.ts`.

## A game's folder

```
games/<id>/          Only index.ts + client.ts are required
  src/index.ts         export default definePlugin({ meta, game: new MyGame(), room? }); server
  src/client.ts        export default defineClient({ scene, setup?, leaveConfirm?, showsResult?, showsPlayers? }); browser, lazy
  src/game/            Pure logic, no Phaser or DOM: <Name>Game.ts (+ test), model.ts, options.ts, bot.ts
  src/scenes/          Phaser: <Name>View.ts (a GameView), <Name>Setup.ts (a RoomSetupScene for "Tạo phòng")
  assets/              App-ready images/sounds, used by file name (this.image('tile'), this.sfx('move'))
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
- A game imports only these; Biome enforces it, and core never imports a game:
  - `@psc/sdk` and `@psc/sdk/client`;
  - `phaser` and `zod`;
  - its own files.
- Every `Game` has tests with `testGame` (`src/game/<Name>Game.test.ts`).
- When a mechanic or piece of data would help other games too, add it to the SDK instead of the
  game. Examples: a system event, a `ctx` property, a view helper, a test helper.
- Changing an SDK API means, in the same change:
  - updating every game that uses it;
  - documenting it in the engine.ts / GameView.ts headers, `games/counter/README.md` and
    `docs/making-a-game.md`.
- `meta.status: 'wip'` is locked only on the production site (`VERCEL_ENV`), so unfinished games
  can be merged. `'ready'` releases the game.
- The server runs the games' compiled `dist/`, while the web app and typechecks use their
  TypeScript source (export condition `psc-source`). Root scripts build them first
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
- **Boards**: build them from `GameScene` helpers so they fit phones first:
  - `label`, `button`, `sprite` and `avatar(player)`;
  - `hudScale()`, `fitText` and `boardArea()`.

  Setup screens have the same helpers. Anything game-like (pieces, cards, animation, drag and
  drop) is drawn in Phaser.
- **`testGame`** takes a plugin or a `Game`. It offers:
  - `send`, `error`, `view` and `assertHidden`;
  - `bot`, `newGame`, `timer`, `fireTimer` and `leave`;
  - the option `bots`.

Before finishing a game change, also play it in the sandbox.
