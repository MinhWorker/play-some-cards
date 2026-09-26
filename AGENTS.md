# AGENTS.md

Technical map of the repo: board games to play with friends in the browser. Humans start with
README.md and CONTRIBUTING.md. Keep this file accurate when you change structure, commands or
conventions.

## Layout

```
games/<id>/        @psc/game-<id>  One game = one folder; adding or changing a game edits nothing
                   else. How to build one: docs/making-a-game.md. games/counter and
                   games/tic-tac-toe are the example layout (and scripts/templates/game); only
                   index.ts + client.ts are required
  src/index.ts       export default definePlugin({ meta, rules, room? }); runs on the server
  src/client.ts      export default defineClient({ scene, setup? }); browser only, loaded lazily
  src/game/          Pure logic, no Phaser: <Name>Game.ts (a Game) + tests, model.ts,
                     options.ts, bot.ts as needed
  src/scenes/        Phaser: <Name>View.ts (a GameView), <Name>Setup.ts (optional "Tạo phòng"
                     screen, extends RoomSetupScene)
  assets/            App-ready images/sounds, used by file name (this.image('tile'), this.sfx('move'))
  sources/           Optional originals (Git LFS), prompts.json (Codex)
packages/sdk/      @psc/sdk     The only API games use. `.`: Game (engine.ts), definePlugin
                                ({ meta, game, room? }), types, rng (shuffle/pick/int/seededRng),
                                testGame. `/client`: defineClient, GameView, GameScene (assets,
                                label/button/sprite, fitText, boardArea), RoomSetupScene,
                                titleStyle, hudScale, props.ts (what the app hands a screen),
                                setClientHost (the app gives scenes asset URLs + sound)
packages/shared/   @psc/shared  Core only, never imported by games: protocol.ts (socket events +
                                PROTOCOL_VERSION), account.ts, registry.ts (`games`/`getGame` from the
                                generated, gitignored src/generated/games.ts)
apps/server/       @psc/server  NestJS + Socket.IO: rooms/ (rooms.service.ts = room logic, unit
                                tested; rooms.gateway.ts = socket events, login + protocol check),
                                accounts/ (username/password, scrypt, login tokens), db/ (Drizzle,
                                migrations in drizzle/), version.ts (for /api/health)
apps/web/          @psc/web     React + Vite + Phaser 4. Folder guide: apps/web/README.md.
                                src/games/index.ts finds games by glob (assets, lazy clients, hub
                                portals, wip lock); pages/Sandbox is `/?play=<id>`
assets/            Originals of the app's own art/audio (Git LFS): prompts.json (style + app
                   prompts), shared/, games/<id>/audio/ (older game audio),
                   audio/ (unsorted experiments)
scripts/           libs.mjs (find games, build sdk + games + shared), new.mjs + templates/,
                   gen-asset.mjs (Codex), assets.mjs (images), lib/media.mjs, smoke.mjs,
                   e2e.mjs
docs/              making-a-game, deploy (CI, versions, hosting), <game>-audio notes (which sound when)
.github/           CI, PR checks, release-please, Dependabot, CODEOWNERS, templates,
                   rulesets/main.json (branch rules, applied by the owner)
```

## Commands (run from repo root)

| Command | What it does |
| --- | --- |
| `npm install` | Install everything (npm workspaces; not pnpm/yarn). Also writes the game list |
| `npm run dev` | Server on :8033, web on :5033 (Vite proxies `/api` and `/socket.io`). `PORT=8133 WEB_PORT=5133` moves them |
| `npm run check` | Lint + typecheck + unit tests. **Must pass before you finish any task.** |
| `npm run format` | Auto-fix formatting and safe lint issues (Biome) |
| `npm run build` | Build sdk, games, shared, server, web |
| `npm run new:game -- <id> "Tên"` | Create `games/<id>/` from the starter game (status `wip`) |
| `npm run new -- logic\|view\|setup <id> [Name]` | Write a `Game` (+ test), `GameView` or setup screen from `scripts/templates/` (inside `games/<id>/`, leave out `<id>`) |
| `/?play=<id>&players=2` | Sandbox: a game's rules + board alone in the browser (dev and PR previews) |
| DEV button (bottom-left) | Dev tools panel outside production (dev and PR previews). Add a toggle/input as one entry in `DEV_SETTINGS` (`apps/web/src/lib/devTools.ts`), read it with `devSetting(key)` |
| `npm run assets [-- <id>]` | Make a game's `assets/` from its `sources/` |
| `npm run smoke [url]` | Bots register and play Caro (one reconnects, one watches) against a running server (default :8033) |
| `npm run e2e [url]` | Headless Chromium plays Caro through the real UI (needs `npm run dev`). Screenshots in `.e2e/` |
| `npm run gen:asset -- <name>` / `<id>/<name>` | Generate an image with Codex CLI (`--missing`; `--edit <name> "<change>"` keeps its style) |
| `npm run db:generate -w @psc/server` | Write a migration after editing `apps/server/src/db/schema.ts` (applied on server start) |

The owner often runs `npm run dev` in their own terminal: don't leave servers running. If you
need a running app, start it (on other ports if 8033/5033 are taken), check, and stop it.
**Browser testing must be headless** (`npm run e2e` or your own headless Playwright script);
never open a visible browser window.

## How it works

- There is one way to write a game: a `Game` (logic, server) and a `GameView` (screen, browser),
  plus an optional `RoomSetupScene`. `definePlugin({ meta, game })` turns the `Game` into
  `GameRules` with `gameRules()` (engine.ts); those plain functions are what the server and the
  sandbox run, never written by games.
- The server is authoritative. A `GameView` calls `send(event, payload)` (`game:move`); the server
  checks the payload against `events`, runs the `on<Event>` hook, and sends each member their own
  `room:state` built from the game's `view(ctx, viewer)`. **Never send raw state**: hide other
  players' cards and the deck in `view`; spectators get `viewer = null`.
- Hooks are pure and return a new state; randomness only through `ctx.rng`.
- Games are plugins. `scripts/libs.mjs` lists `games/*` for the server (through @psc/shared,
  which runs compiled `dist/`); the web and type checks use their TypeScript source (export
  condition `psc-source`). `meta.status: 'wip'` is locked on the production site only
  (`VERCEL_ENV`), so unfinished games can be merged.
- Rooms belong to one game and live in memory (a restart wipes them). From a game's room list you
  create a room, join as a player (free seat, no game running) or watch; leaving means quitting
  (the next player becomes host, an empty room is disbanded). A player leaving mid-game stops it
  for everyone, so the room page asks first (`pages/Room/LeaveConfirm.tsx`; a game changes the
  texts or turns it off with `defineClient({ leaveConfirm })`). Rooms keep a score.
- Room options: a game may ship its own settings screen (a `RoomSetupScene`, shown as the
  `setup` stage for "Tạo phòng" and for the host's "Tuỳ chỉnh" in the room; `pages/RoomSetup`
  forwards what it passes to `submit`). The server checks
  the object with `room.options` (zod) and keeps it for the room's life: `ctx.options` in the
  `Game` and the `GameView`; the host may replace it between games ("Tuỳ chỉnh" or the view's
  `changeOptions` → `room:options`; bots join/leave to match). `room.bots` seats the computer
  (its events come from the `Game`'s `bot(ctx)`, played by the gateway after a short pause);
  bots never host or keep a room alive. Example: Caro (games/tic-tac-toe).
- `Game` (`@psc/sdk`, engine.ts): `events` + `onStart`/`on<Event>`/`onEnd`/`bot`/`view` hooks
  returning new state, plus `onLeave` (a player left mid-game: without it leaving stops the game
  for everyone) and timers (`ctx.setTimer(ms, 'name')` → `onName(ctx)`, one per game, run by the
  gateway; e.g. a turn clock, a pause between rounds). Seats never change during a game: leavers
  stay in `ctx.players` with `left: true` (`Stored.players`, snapshot `seats`). `GameView`
  (`@psc/sdk/client`: `onCreate`/`onLayout`/`onStart`/`on<Event>`/`onState`/`onEnd`/`onUpdate`,
  `send`, `changeOptions`; `label`/`button`/`sprite`/`avatar(player)` come from `GameScene`, so
  setup screens have them too; `ctx.timer` for countdowns). `ctx.lastResult` = how the room's
  previous game ended. `defineClient({ showsResult, showsPlayers })` hides the app's winner title
  / the room bar's player list for games that draw their own. Test with `testGame`
  (a plugin or a `Game`; `send`, `error`, `view`, `assertHidden`, `bot`, `newGame`, `timer`,
  `fireTimer`, `leave`; option `bots`). New files: `npm run new`. Snapshots carry `round` and `last` (the last
  event, hidden from others for `secretEvents`) so screens hear events. Examples:
  games/counter (smallest), games/tic-tac-toe. When a mechanic or data would help other games
  (a system event, a ctx property, a view helper), add it to the SDK rather than the game.
- Everyone plays logged in (username + password, no email). The socket connects with
  `auth: { token, protocol }`. Being in a room belongs to the account: after every connect the
  client sends `session:resume` to get back to its seat from any tab or device.
- Accounts and login tokens are in Postgres (Neon; `DATABASE_URL`). Without it they live in
  memory, which is fine for local work.
- Web: React owns app state and all plain UI (panels, forms, buttons). Phaser draws the world
  (sky, island strip, boards). React passes a `Stage` to `PhaserStage`; Phaser emits events on
  `bridge`. Anything game-like (pieces, cards, animation, drag and drop) is Phaser.
- Web and server deploy separately: they compare `PROTOCOL_VERSION` on connect (old page
  reloads, newer page waits for the server). Details: docs/deploy.md.

## Conventions

- TypeScript strict. Relative imports in `packages/*`, `games/*` and `apps/server` end in `.js`;
  the web app uses extensionless imports and `@/` (= `src/`) outside the current folder.
- A game imports only `@psc/sdk`, `@psc/sdk/client`, `phaser`, `zod` and its own files; core
  never imports a game (Biome enforces both). Grow the SDK only when a second game needs the same
  thing; changing an SDK API means updating every game in the same PR.
- Server: no `import type` for classes Nest injects (DI needs the runtime value).
- The server typechecks against built packages: root scripts run `npm run build -w @psc/shared`
  (= scripts/libs.mjs) first. After adding a game folder: `npm install`, restart `npm run dev`.
- New socket events go in `protocol.ts` first; bump `PROTOCOL_VERSION` when old clients/servers would break.
- **Players see Vietnamese** (UI copy and server/game error messages). No instructional subtext
  ("tap an island to…"); status text is fine.
- **Docs for people are Vietnamese**: README.md, CONTRIBUTING.md, LICENSE-ASSETS.md, `docs/`,
  every README (games, apps, `scripts/templates/game`), `.github` issue/PR templates. Keep code,
  commands, paths and identifiers as they are inside them. **English**: code, comments,
  identifiers, commit messages and PR titles (Conventional Commits), and files for agents
  (AGENTS.md, CLAUDE.md). When you change behavior, update the Vietnamese docs in the same change.
- Every `Game` needs tests with `testGame` (e.g. `games/<id>/src/game/<Name>Game.test.ts`).
- Mobile first: test a phone (390×844) and a desktop size, ideally also 360×640 and 844×390.
  Floating React panels get the `hud` class; boards use `hudScale()`, `fitText` and `boardArea()`.
- Web files: a component's CSS sits next to it. New screen → `pages/<Name>/`; UI on every screen →
  `components/hud/`; React state logic → `hooks/`; plain helpers → `lib/`.
- Look: floating sky islands, polished 3D-cartoon mobile-game style (2015 Vietnamese mobile games),
  wood/paper/yellow-button panels (`apps/web/src/styles/`), "Baloo 2" font (`titleStyle`).

## Art and audio

- A small project for friends and the community: any way to make art or sound is fine
  (Codex, drawn by people, rendered in Blender, drawn or synthesized in code, free resources from
  the web). Pick what looks and sounds best for a card/board game in the app's style. Credit a
  source when it's easy (the game's README, LICENSE-ASSETS.md). Never take paid or clearly
  off-limits assets, and never sell anything.
- Never bake text into images (write it in code: it has to be Vietnamese and fit any size).
- A game's files: `games/<id>/assets/` (used as-is) and optional `games/<id>/sources/`
  (`npm run assets`). The app's own: originals in `assets/`, app-ready files in
  `apps/web/public/shared/` (get URLs with `imageUrl`/`soundUrl`; Phaser images also go in
  `IMAGES` in `apps/web/src/phaser/assets.ts`).
- Codex art: add a prompt to `assets/prompts.json` (app) or `games/<id>/sources/prompts.json`
  (game; its home-map image is `island`), run `npm run gen:asset`, and look at the result.
  `transparent: true` for objects. Prefer `--edit` to tweak an image. Codex sometimes paints a
  fake checkerboard instead of transparency: check alpha. ~1.5 min per image.
  Animation frames sharing one anchor set `preserveCanvas: true` to keep transparent margins.
- `avatar-long.webp` is a real photo (`assets/shared/images/Long-look-at-u.jpg`) in the generated
  `avatar-frame`, not generated art.
- Originals of the current sounds (Veo clips in `assets/**/sfx-selected/`, `psc-*` files,
  downloads in `assets/**/sfx/`) are in `assets/` (Git LFS), kept as an archive. A game's music = every `music*` file in its
  `assets/` (a random one plays on its board); the app's is `APP_MUSIC` in `src/lib/sound.ts`.
- **The app-ready sound files are the real ones** (`apps/web/public/shared/audio/`,
  `games/<id>/assets/`, unsorted in `apps/web/public/audio/`); there is no build step. To change
  a sound, edit that file in place with ffmpeg (cut: `-ss`/`-t` plus a short `afade`; faster at
  the same pitch: `atempo`; louder: `volume`), or make it from an original once. Short effects are
  mono 16-bit WAV (MP3 starts with ~25 ms of padding), music is 128 kbps MP3. Listen/measure with
  ffprobe after editing.
- Originals are Git LFS (`.gitattributes`; a new binary type needs a pattern). App-ready files
  are plain git.
- The app plays effects with `playSfx(name)` (`SFX` in `src/lib/sound.ts`); a board plays
  `this.sfx(name)`. React buttons click/hover by default; change or mute per button
  (`<Button clickSound=… hoverSound=…>`) or per container (`{...buttonSounds({ click: 'none' })}`).

## Git and PRs

- Never push to `main`. Branch, open a PR, squash-merge. Merging deploys (Vercel + Render).
- PR title = Conventional Commit (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, optional scope
  like `feat(xiangqi):`); CI checks it and release-please builds the changelog from it. Never
  edit version numbers or `CHANGELOG.md`.
- DB migrations must work with the previous web build (add first, remove later).

## Before finishing

1. `npm run check` passes.
2. Gameplay, UI or protocol changes: run `npm run e2e` against a running dev server (stop what
   you started) and look at the screenshots. For a game, also try it in the sandbox.
3. Update this file if you changed layout, commands or conventions.
