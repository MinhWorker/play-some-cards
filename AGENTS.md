# AGENTS.md

Board game hub for playing with friends. The owner does not write code; agents do all changes.
Keep this file accurate when you change structure, commands, or conventions.

## Layout

```
games/<id>/        @psc/game-<id>  One game = one folder (see docs/making-a-game.md). Nothing
                   outside it is edited to add or change a game.
  src/index.ts       export default definePlugin({ meta, rules }); server-safe
  src/rules.ts       Pure rules (GameRules) + src/rules.test.ts
  src/client.ts      export default defineClient({ scene }); browser only, loaded lazily
  src/<Name>Scene.ts Board, extends BoardScene from @psc/sdk/client
  assets/            App-ready images/sounds, used by file name (this.image('tile'), this.sfx('move'))
  sources/           Optional originals (Git LFS) + prompts.json (Codex) + audio.json (cuts);
                     `npm run assets` turns them into assets/
games/tsconfig.*.json  Shared configs every game's tsconfig extends
packages/sdk/      @psc/sdk     What games may use. `.`: defineGame/definePlugin, types, rng helpers
                                (shuffle/pick/int/seededRng), test helpers (playMoves, moveError,
                                assertHidden). `/client`: defineClient, BoardScene, titleStyle,
                                hudScale, setClientHost (the app gives scenes asset URLs + sound)
packages/shared/   @psc/shared  Core only (games never import it): socket protocol, accounts, registry
  src/account.ts     Account rules (username/password/name zod schemas) + User/AuthResponse types
  src/game.ts        Re-exports the SDK's game types; AnyGameDefinition = rules + meta
  src/registry.ts    `games` / `getGame` / `gameList` from generated/games.ts (written by
                     scripts/libs.mjs, gitignored)
  src/protocol.ts    Socket.IO event types (client <-> server) + PROTOCOL_VERSION
apps/server/       @psc/server  NestJS + Socket.IO. Owns rooms and game state in memory.
  src/rooms/rooms.service.ts   Room/game logic, no sockets (unit tested)
  src/rooms/rooms.gateway.ts   Socket events -> service calls, broadcasts room:state. Refuses sockets
                               without a valid login token
  src/accounts/                Username + password accounts: auth.controller.ts (POST /api/auth/
                               register|login|logout), accounts.service.ts (scrypt, login tokens),
                               accounts.store.ts (Postgres, or memory without DATABASE_URL)
  src/db/                      Neon Postgres via Drizzle: db.module.ts (inject `DB`, null without
                               DATABASE_URL), schema.ts (users, sessions). Migrations in apps/server/drizzle/
  src/version.ts               App version (root package.json) + deployed commit, for /api/health
apps/web/          @psc/web     React + Vite + Phaser 4. Folder guide for humans: apps/web/README.md
  src/main.tsx                 Entry: global styles, HUD scale, renders <App />
  src/App.tsx                  Top-level state: which page shows, what Phaser draws (`Stage`)
  src/pages/<Page>/            One folder per screen, with its own .css and sub-components:
                               Home (island map), GameRooms (a game's live room list),
                               Room (room bar, lobby panel, result panel), Login (log in / sign up),
                               Sandbox (`/?play=<id>&players=2`: rules run in the browser, seat
                               switcher, no server/login; not on the production site)
  src/components/hud/          Shared HUD shown on every screen (import from '@/components/hud'):
    CloudCurtain.tsx           Loading/transition screen: cloud banks close, then part (cloud-spread
                               sound). Closed at start until Phaser has loaded; `transition(change)`
                               wraps a scene change (used when picking an island)
    ProfileBadge.tsx           Avatar + name (top-left); ProfileModal.tsx edits them, logs out
    SoundControl.tsx           Speaker button (top-right): volume + mute for music and effects
    Toast.tsx                  Toast (middle) and Banner (top) messages
  src/components/ui/           Small building blocks (Button)
  src/hooks/                   useAccount (login state; after each connect asks the server for
                               the user + their room), useRoom (enter/leave + live state),
                               useConnected, useVersionGuard (reload/wait on PROTOCOL_VERSION mismatch),
                               useBrowsingGame (?game= in URL), useBoardMoves, useGameEndSound
  src/lib/                     Plain TS, no React: socket.ts (Socket.IO + `request`), auth.ts
                               (server URL, login token in localStorage, register/login calls),
                               profile.ts (silly names, avatar images), sound.ts (music + effects,
                               Web Audio gain per channel since iOS ignores audio.volume;
                               installButtonSounds() adds click/hover sounds to every button;
                               buttonSounds() changes/mutes them per button or container),
                               hudScale.ts, assetUrl.ts (URLs of files in public/), version.ts
                               (version + commit baked in by vite.config.ts)
  src/styles/                  theme.css (colors, font), base.css (panels, buttons, modals, `.hud`)
  src/phaser/                  Full-screen Phaser canvas: the world (sky, island map, game boards)
    PhaserStage.tsx            Mounts Phaser; React tells it what to show via a `Stage`
    bridge.ts                  The only React <-> Phaser channel (events)
    assets.ts                  The app's own images (not games'); re-exports titleStyle/FONT
    scenes/                    Boot (loads images + game portals), Sky (background, parallax),
                               Hub (horizontal strip of portals: drag with inertia + snap, wheel,
                               arrow buttons, dots; keyboard + hidden a11y buttons in pages/Home;
                               `?portals=12` in dev fills it with copies to test the layout)
    objects/                   Reusable Phaser objects (Title)
  src/games/index.ts           Finds games by glob: their assets' URLs, lazy client loaders,
                               `portals` for the hub, `isPlayable` (wip locked in production)
  public/shared/{images,audio}/        App-ready files of the app itself (committed)
  public/audio/                Sounds whose purpose is not decided yet (`unsorted` in audio.json)
assets/              Source files for the web app's images and audio (see "Art" and "Audio").
                     Committed with Git LFS (.gitattributes); run `git lfs install` once
  prompts.json         Style + prompts for the app's own images (games keep theirs in sources/)
  audio.json           Which original becomes each app sound (+ trims, `game`/`unsorted`)
  shared/images/         Full-size Codex output for shared art
  shared/audio/{music,sfx}/  Originals of shared music and effects
  games/<id>/audio/    Audio originals of existing games (audio.json); new game files go in
                       games/<id>/sources/
  audio/               Not sorted yet: Lyria/Veo experiments and downloaded effects nobody uses
                       yet. Move a file to shared/ or games/<id>/ once it has a job
scripts/libs.mjs   Finds games/*, writes shared's generated/games.ts, builds sdk + games + shared
                   (`npm run build -w @psc/shared` runs it; also on install and in dev --watch)
scripts/new-game.mjs + game-template/  `npm run new:game`: copies the starter game
scripts/gen-asset.mjs  Generates/edits art with Codex CLI (app prompts + games/*/sources/prompts.json)
scripts/assets.mjs     `npm run assets`: games/<id>/sources/ -> assets/ (images + sources/audio.json)
scripts/build-audio.mjs  `npm run audio`: assets/audio.json -> apps/web/public/ or games/<id>/assets/
scripts/lib/media.mjs  Shared WebP / ffmpeg helpers
scripts/generate-tien-len-sfx.py  Generates the Tiến lên cue sources locally (Python + ffmpeg)
scripts/generate-xiangqi-sfx.py  Generates the Xiangqi cue sources locally (Python standard library)
scripts/smoke.mjs  Socket-level check against a running server
scripts/e2e.mjs    Headless browser test of the real app
docs/              How-to guides (making a game, deploying)
.github/           CI (ci.yml, pr.yml), release-please (release.yml), Dependabot, CODEOWNERS,
                   PR/issue templates, rulesets/main.json (branch rules, applied by the owner)
release-please-config.json, .release-please-manifest.json  Versioning (see docs/deploy.md)
CHANGELOG.md       Written by release-please; don't edit by hand
```

## Commands (run from repo root)

| Command | What it does |
| --- | --- |
| `npm install` | Install everything (npm workspaces; do not use pnpm/yarn) |
| `npm run dev` | Server on :8033, web on :5033 (Vite proxies `/socket.io` and `/api` to the server) |
| `npm run dev:web` / `npm run dev:server` | Run only one of the two |
| `PORT=8133 WEB_PORT=5133 npm run dev` | Same, on other ports (e.g. a second checkout next to the first) |
| `npm run check` | Lint + typecheck + unit tests. **Must pass before you finish any task.** |
| `npm run format` | Auto-fix formatting and safe lint issues (Biome) |
| `npm run build` | Build sdk, games, shared, server, web |
| `npm run new:game -- <id> "Tên"` | Create `games/<id>/` from the starter game (status `wip`) |
| `http://localhost:5033/?play=<id>&players=2` | Sandbox: try a game's board alone (dev + PR previews) |
| `npm run assets [-- <id>]` | Make a game's `assets/` from its `sources/` (`--force` redoes all) |
| `npm run smoke [url]` | Three bots register; two play a full Caro game (one reconnects from a new "device" mid-game) while the third watches, against a running server (default `http://localhost:8033`) |
| `npm run e2e [url]` | Headless Chromium: three people sign up, two pick Caro, create/join from the room list and play (one closes the browser and logs back in mid-game) while the third watches (needs `npm run dev`). Screenshots in `.e2e/` |
| `npm run gen:asset -- <name>` | Generate an image with Codex CLI: `<name>` from `assets/prompts.json`, or `<id>/<name>` from a game's `sources/prompts.json` (`--missing` for all missing) |
| `npm run gen:asset -- --edit <name> "<change>"` | Ask Codex to edit an existing image, keeping its style |
| `npm run db:generate -w @psc/server` | Write a migration after editing `apps/server/src/db/schema.ts` (applied on server start) |
| `npm run db:studio -w @psc/server` | Browse the dev database (Drizzle Studio) |
| `npm run audio [-- <name>]` | Re-encode app sounds from `assets/` per `assets/audio.json` (run after replacing a source) |

Run one workspace: `npm run test -w @psc/shared`. Add a dependency: `npm install <pkg> -w @psc/web`.

The owner runs the dev servers themselves in their own terminal. Do not start `npm run dev`
and leave it running. If you need a running app to verify something, start it, check, and stop
it before you finish.

**Browser testing must be headless.** Use `npm run e2e` (or your own headless Playwright script).
Never open a visible browser window (e.g. Playwright MCP tools); it pops up on the owner's screen.

## How it works

- The server is authoritative. Clients send `game:move`; the server validates with the game's
  `moveSchema` (zod) and `validateMove`, applies `applyMove`, then sends each player their own
  `room:state` built from `getView(state, playerId)`.
- **Never send raw game state to clients.** Hidden info (other players' cards, the deck) must be
  removed in `getView`. Spectators get `getView(state, null)`: only public info.
- Rooms belong to one game. Picking an island opens that game's room list (`lobby:watch`; the
  server pushes `lobby:rooms` on every change). From the list you create a room, join as a
  **player** (only while seats are free and no game is running) or as a **spectator** (no limit).
  A spectator can take a free seat later (`room:sit`). Room codes are internal ids, never shown.
- Leaving a room (`room:leave`) means quitting: the seat is freed, a running game is cancelled
  and the room goes back to the lobby. The next player becomes host; when no player is left the
  room is disbanded and spectators get `room:closed`. A dropped connection only marks the
  player offline. Rooms keep a score (`wins` per seat + `draws`) until disbanded.
- Games are pure functions. Randomness only through the `rng` argument so tests are deterministic.
- Games are plugins: `scripts/libs.mjs` lists every `games/<id>` for the server (through
  @psc/shared), the web globs their `assets/` and `src/client.ts`. The server runs games'
  compiled `dist/`; the web and type checks use their TypeScript source (package export
  condition `psc-source`). `meta.status: 'wip'` = locked on the production site only.
- Web: React owns app state (session, room snapshot) and all forms/buttons. Phaser only draws
  the world. React sends a `Stage` (`hub` | `sky` | `board` with view/me/players/result) to
  `PhaserStage`; Phaser emits `hub:select`, `hub:locked`, `board:move` on `bridge`.
  Use Phaser for anything game-like (boards, cards, pieces, animation, drag and drop, sound);
  use React/CSS only for plain UI panels.
- Everyone plays logged in. Account = unique `username` (letters/digits, stored lowercase) +
  password; no email or password reset (forgot it → make a new account). The in-game `name` is
  separate: it can repeat and change any time. Register/login is HTTP (`/api/auth/*`) and
  returns a token; the socket connects with `auth: { token }` and is refused otherwise.
- Being in a room belongs to the **account**, not the browser: a member's id is the user id, an
  account is in at most one room (entering another room quits the old one), and after every
  connect the client sends `session:resume` to get back into its room from any tab or device.
- Postgres (Neon) stores accounts and login tokens (hashed). Local dev uses Neon branch `dev`
  (`apps/server/.env`), production uses branch `main` (see `docs/deploy.md`). Without
  `DATABASE_URL` accounts live in memory and vanish on restart.
- Rooms live in memory. Restarting the server wipes them.

## Conventions

- TypeScript strict everywhere. ESM: relative imports in `packages/*`, `games/*` and
  `apps/server` need the `.js` extension (`./foo.js`). The web app uses extensionless imports.
- A game imports only `@psc/sdk`, `@psc/sdk/client`, `phaser`, `zod` and its own files; core
  never imports a game (Biome `noRestrictedImports` enforces both). Grow the SDK only when a
  second game needs the same thing; changing an SDK API means updating every game in that PR.
- Server: do **not** use `import type` for classes injected by Nest (DI needs the runtime value).
- `npm run build -w @psc/shared` (= scripts/libs.mjs) must run before the server typechecks;
  root scripts already do this. If an editor shows "cannot find @psc/shared" or a game package,
  run it. After adding a game folder, run `npm install` and restart `npm run dev`.
- Game rules need tests in `games/<id>/src/rules.test.ts` (helpers in `@psc/sdk`).
- New socket events go in `protocol.ts` first; TypeScript then shows every place to update.
- **All user-facing text is Vietnamese**: web UI copy, and server/game error messages
  (they are shown to players). Code, comments, docs and identifiers stay in English.
- No instructional subtext ("tap an island to…", "enter your name first"). Figuring out the UI
  is part of the fun. Status text (whose turn, waiting for host) is fine.
- Keep UI mobile-friendly (friends play on phones). Test both a phone (390×844) and a desktop size,
  and ideally a small phone (360×640) and a phone held sideways (844×390).
- Floating React UI shrinks on small screens: give a floating panel the `hud` class
  (`zoom: var(--hud)`, see `styles/base.css`). Board scenes scale text by `hudScale()`, cut long
  names with `fitText`, and place the board below the real room bar (`hudTop` in the registry).
- Web code: imports outside the current folder use `@/` (= `src/`), e.g. `@/lib/socket`.
  A component's CSS sits next to it (`Room.tsx` + `Room.css`) and is imported by it; shared
  styles are in `src/styles/`. New screen → `pages/<Name>/`; UI shown on every screen →
  `components/hud/`; reusable logic with React state → `hooks/`; plain helpers → `lib/`.
- Theme: floating sky islands, polished 3D-cartoon mobile-game look (like 2015 Vietnamese mobile
  games). React panels use the wood/paper/yellow-button styles and CSS variables in
  `apps/web/src/styles/`; text uses the "Baloo 2" font (`FONT`/`titleStyle` in Phaser).

## Art

- Art is generated or drawn by people; never draw art with code (SVG/CSS/Phaser graphics).
- Every image and sound has an owner: `shared` (the app) or one game id. App-ready files:
  `apps/web/public/shared/…` or `games/<id>/assets/`; originals: `assets/shared/…` or
  `games/<id>/sources/` (older game audio: `assets/games/<id>/audio/`). In app code, get URLs from `imageUrl(name)` / `soundUrl(…)` in
  `src/lib/assetUrl.ts`; in a game, use file names (`this.image('tile')`, `this.sfx('move')`).
- Add an entry to `assets/prompts.json` (the shared `style` is prepended automatically; set
  `transparent: true` for objects, `game: "<id>"` for art only one game uses), run
  `npm run gen:asset -- <name>`, and look at the result before using it. A game's prompts go in
  `games/<id>/sources/prompts.json` (no `game` field; run `gen:asset -- <id>/<name>`; raw PNG in
  sources/, WebP in assets/; its home-map image is `island`). App images used by Phaser also go in `IMAGES`
  in `apps/web/src/phaser/assets.ts`; images used only by React (e.g. `speaker-on`) are loaded
  with `<img src={imageUrl('speaker-on')}>`. A game's images need no list.
- To tweak an image, prefer `--edit` over regenerating so it keeps the same look.
- Never bake text into images (Vietnamese diacritics come out wrong). Put text on top in code.
- `avatar-long.webp` is not generated: it is the photo `assets/shared/images/Long-look-at-u.jpg`,
  cropped round and placed inside the generated `avatar-frame` (composited with sharp).
- Codex sometimes paints a fake grey checkerboard instead of real transparency; check alpha
  (e.g. with sharp) and clear it if needed.
- Codex takes ~1.5 min per image. Output is trimmed and saved as WebP; raw PNGs stay in
  `assets/shared/images/` or `games/<id>/sources/` (Git LFS).

## Audio

- Generate original music and short musical cues with Google Cloud Lyria; see
  [docs/generating-music.md](docs/generating-music.md). For other sound effects, the owner can
  download sources into `assets/audio/sfx/` (unsorted) and you move the ones you use into
  `assets/shared/audio/sfx/` or `assets/games/<id>/audio/`.
- The web app never reads `assets/` directly. `assets/audio.json` maps each app sound
  (a short, purpose-based name) to an original (`src`, relative to `assets/`), with optional
  `start`/`duration` trims, `speed`, and `game` (owner). `npm run audio` writes
  `apps/web/public/shared/audio/<name>.mp3|wav` or `games/<id>/assets/<name>.mp3|wav`. Entries marked `unsorted` (purpose not
  decided) stay in `assets/audio/` and `apps/web/public/audio/`; don't wire them into the app
  until they are sorted. When the owner replaces or renames an original, update the mapping and
  rerun it. Trim quiet lead-ins so UI sounds feel instant, and use `"format": "wav"` for short
  effects (MP3 always starts with ~25 ms of encoder padding; `playSfx` loads `<name>.wav`).
- Originals in `assets/` are committed through Git LFS (patterns in `.gitattributes`); a new
  binary type needs a pattern there. App-ready files in `apps/web/public/` are plain git.
- The app plays its effects with `playSfx(name)` from `src/lib/sound.ts` (add the name to `SFX`
  there); a game's board plays `this.sfx(name)` for `games/<id>/assets/<name>.wav`. Every React button clicks/hovers by default; change or mute that per button
  (`<Button clickSound=… hoverSound=…>`) or for all buttons inside an element
  (`{...buttonSounds({ click: 'none', hover: 'none' })}`; the nearest setting wins). The login
  form is quiet except its submit click. Hover sounds are mouse-only (on touch, "hover" fires on every tap).

## Common tasks

- Make a new game: `npm run new:game`, then `docs/making-a-game.md`.
- Deploy / CI: see `docs/deploy.md`. Web = Vercel, server = Render, both auto-deploy from `main`.
  Database = Neon Postgres (free plan).

## Git and PRs

- Never push to `main`. Work on a branch and open a PR; it is squash-merged.
- The PR title is a Conventional Commit (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, …,
  optional scope like `feat(xiangqi):`); CI checks it and release-please builds the changelog
  from it. Never edit version numbers or `CHANGELOG.md`.
- Changing `protocol.ts` in a way old clients/servers can't handle: bump `PROTOCOL_VERSION`.
- DB migrations must keep working with the previous web build (add first, remove later).

## Before finishing

1. `npm run check` passes.
2. For gameplay, UI or protocol changes: run `npm run e2e` against `npm run dev` (start it only
   if it is not already running, and stop what you started), and look at the screenshots.
3. Update this file if you changed layout, commands or conventions.
