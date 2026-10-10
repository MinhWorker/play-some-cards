# Games and the SDK

Where to look:
- **How to build a game** (Vietnamese, for people): `docs/making-a-game.md`.
- **Every hook**: `docs/making-a-game.md` ("Các hook").
- **Examples**:
  - `scripts/templates/` holds the starters `new:game` / `new:event` fill in: `game/` (rules,
    bot), `event/` (over `game/`), `godot/<layout>/main.gd` (Bàn, Hành động, event),
    `godot/test/`, `e2e/`.
  - `games/tic-tac-toe` (Caro) adds room options (Tạo phòng rows) and a computer player.
  - `games/tien-len` is the fullest Godot table (cards, effects, sounds, art).
- **Skills** in `.claude/skills/`: `new-content` (a game or event from a brief), `make-asset`,
  `phone-check`.
- **The source of truth for the API** is the header of `packages/sdk/src/engine.ts` (rules) and,
  for a game's Godot table, `apps/client/AGENTS.md` and the header of
  `apps/client/addons/xomdao_sdk/client.gd`.

## A game's folder

```
games/<id>/          src/index.ts is required; without godot/main.tscn the card shows "Sắp có"
  RULES.md             Current Vietnamese gameplay rules (non-starter games); the client's Luật board
  README.md            Component map, development commands and asset credits
  src/index.ts         export default definePlugin({ meta, game: new MyGame(), room? }); server
  src/game/            Pure rules, no DOM: <Name>Game.ts (+ test), model.ts, options.ts, bot.ts
  godot/               The Godot table: main.tscn + main.gd, test/test_*.gd (GUT), art/, sounds/,
                       music/ (rules in apps/client/AGENTS.md)
  assets/              Full-size images/sounds, atlases and normals; godot/ copies what it uses
  sources/             Optional originals (Git LFS) + prompts.json (see assets/AGENTS.md)
```

| Command | What it does |
| --- | --- |
| `npm run new:game -- <id> "Tên" --genre <g> [--layout ban\|hanh-dong]` | A working game (status `wip`): rules + bot + tests, a Godot table in that layout + GUT test, RULES.md, README, stand-in card, `scripts/e2e/scenarios/godot-<id>.mjs`. Then `npm run godot:check` writes the `.uid` files to commit |
| `npm run new:event -- <id> "Tên" [--opens YYYY-MM-DD] [--closes YYYY-MM-DD]` | The same for an event (`su-kien`, Hành động layout, dates default to today + 4 weeks, reward tiers) |
| `npm run new -- logic <id> [Name]` | Write a `Game` (+ test) from `scripts/templates/` (leave out `<id>` inside `games/<id>/`) |
| `npm run new -- options <id>` | Write `src/game/options.ts` (the room's options); its Tạo phòng rows come from `room_setup()` in `godot/main.gd` |
| `/?play=<id>` | Sandbox (debug builds: dev and PR previews): a real room with the computer in the other seats (`sandbox_options()`) |

## Rules

- **The server is authoritative.** A game's Godot table calls `client.send(event, payload)`,
  which goes out as `game:move`. The server then:
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
- A game's TypeScript imports only these; Biome enforces it, and core never imports a game:
  - `@xomdao/sdk` and `zod` (and `vitest` in tests);
  - its own files.
- A game's Godot code reaches only its own folder and `res://addons/xomdao_sdk/`
  (`godot:check` enforces it; see `apps/client/AGENTS.md`).
- Every `Game` has tests with `testGame` (`src/game/<Name>Game.test.ts`).
- A game's browser test in the Godot client is `scripts/e2e/scenarios/godot-<id>.mjs` with
  `export const games = ['<id>']` (the generator writes one). CI's `godot` job runs every
  `godot-*` scenario. A scenario that moves the event clock (`dev:clock`) exports
  `lock = 'clock'` so such scenarios run one at a time.
- When a mechanic or piece of data would help other games too, add it to the SDK instead of the
  game. Examples: a system event, a `ctx` property, a view helper, a test helper.
- Changing an SDK API means, in the same change:
  - updating every game that uses it;
  - documenting it in the engine.ts header and `docs/making-a-game.md`.
- `meta` is also the game's hub card: `genre` (an id from `genres` in
  `packages/shared/src/catalog.ts`; none = not in the hub yet), `tagline`, `duration` in minutes,
  optional `kind` (`table`/`event` + `event`), `card` art and `rewardCap`. The registry test
  checks it with `metaProblems`.
- `meta.status: 'wip'` keeps a game out of the catalog on the production server (`RENDER`, which
  PR previews use too; `XOMDAO_SHOW_WIP` overrides), so unfinished games can be merged. `'ready'`
  releases the game.
- The server runs the games' compiled `dist/`, while typechecks and tests use their TypeScript
  source (export condition `xomdao-source`). Root scripts build them first
  (`scripts/libs.mjs`).

## Mechanics worth knowing

- **Seats never change during a game.** A leaver stays in `ctx.players` with `left: true`. Without
  `onLeave`, one player leaving stops the game for everyone.
- **Rewards**: `ctx.reward(playerId, 'core:coin', amount)` when the game ends (Caro, Tiến Lên
  pay `WIN_COINS` from `model.ts`). Declare the most one player can win in `meta.rewardCap`; the
  server refuses more, pays once per game and skips bots. `testGame` shows them in
  `result.rewards`.
- **Events** (`kind: 'event'`, genre `su-kien`, `meta.event`): points go through
  `ctx.reward(player, EVENT_POINTS, n)` within `meta.rewardCap`; the server keeps them per event and
  pays `meta.event.tiers` on claim. `games/trung-thu` is the sample; see "Sự kiện" in
  `docs/making-a-game.md`.
- **Stats and achievements**: `ctx.stat(playerId, 'chop', n = 1)` counts something a player did
  (lowercase-dash names; `played` and `won` are counted by the server). `meta.achievements`
  (`{ id, name, stat, at, xp?, reward? }`) are data: the server unlocks and pays them. Never rename
  or reuse a shipped achievement id. `testGame` shows counts in `result.stats`. See "Thống kê và
  thành tích" in `docs/making-a-game.md`.
- **Timers**: `ctx.setTimer(ms, 'name')` calls `onName(ctx)`. There is one timer per game, and
  the gateway runs it. Use it for a turn clock or a pause between rounds. The table shows
  countdowns from the snapshot's `timer`.
- **Room options and bots**:
  - `room.options` is a zod schema, and `optionsSchema.parse({})` must work.
  - The `Game` reads them as `ctx.options`; the table gets them in the snapshot's `options`.
  - The Tạo phòng board's rows come from `room_setup()` in the game's `godot/main.gd`.
  - `room.bots` seats computer players, whose moves come from `bot(ctx)`.
  - `room.withBots(options, count)` gives the options with the computer in `count` empty seats:
    quick match (CHƠI) fills a room with it when nobody else comes (`QUICK_WAIT_MS`).
  - The host may replace them between games with `room:options` (the hub has no board for it
    yet).
- **Snapshots** carry `round` and `last` (the last event). `ctx.lastResult` is how the room's
  previous game ended.
- **Tables**: the hub draws the ☰ menu, the room, the result and Luật; the game's Godot table
  draws only its board, from `client.snapshot`. Follow `docs/experience.md` (layouts, HUD) and
  `docs/ui-guide.md` (landscape frame, sizes), and build every button and panel from the UI kit in
  `apps/client/addons/xomdao_sdk/ui/` (`apps/client/AGENTS.md`).
- **`testGame`** takes a plugin or a `Game`. It offers:
  - `send`, `error`, `view` and `assertHidden`;
  - `command(line)` for optional game dev commands, catalog references and semicolon chains;
  - `bot`, `newGame`, `timer`, `fireTimer` and `leave`;
  - the option `bots`.

Before finishing a game change, also play it in the sandbox.
