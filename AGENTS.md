# AGENTS.md

Board game hub for playing with friends. The owner does not write code; agents do all changes.
Keep this file accurate when you change structure, commands, or conventions.

## Layout

```
packages/shared/   @psc/shared  Game rules + socket protocol types. Pure TS, no I/O. Used by both apps.
  src/game.ts        GameDefinition contract every game implements
  src/games/<id>/    One folder per game (rules + tests)
  src/registry.ts    List of playable games
  src/protocol.ts    Socket.IO event types (client <-> server)
apps/server/       @psc/server  NestJS + Socket.IO. Owns rooms and game state in memory.
  src/rooms/rooms.service.ts   Room/game logic, no sockets (unit tested)
  src/rooms/rooms.gateway.ts   Socket events -> service calls, broadcasts room:state
apps/web/          @psc/web     React + Vite + Phaser 4.
  src/phaser/                  Full-screen Phaser canvas: the world (sky, island map, game boards)
    PhaserStage.tsx            Mounts Phaser; React tells it what to show via a `Stage`
    bridge.ts                  The only React <-> Phaser channel (events)
    BoardScene.ts              Base class for game boards
    scenes/                    Boot (loads images), Sky (background), Hub (island map)
  src/games/<id>/<Name>Scene.ts  One Phaser board scene per game
  src/games/index.ts           gameId -> scene map, and the islands shown on the home map
  src/pages/                   React UI floating over the canvas: Home (island map),
                               GameRooms (a game's live room list), Room (lobby/board/result)
  src/profile.ts               Nickname + avatar (boy/girl/long) in localStorage; random silly name by default
  src/ProfileBadge.tsx         Avatar + name (top-left) with a pencil that opens the edit modal
  src/sound.ts                 Music + UI sound effects (Web Audio gain per channel; iOS ignores
                               audio.volume). installButtonSounds() adds click/hover sounds to every button
  src/SoundControl.tsx         Speaker button (top-right): volume + mute for music and effects separately
  public/images/*.webp         Generated art, served at /images/<name>.webp (see "Art" below)
  public/audio/                music.mp3 + effects as .wav (list in assets/audio.json); see "Audio"
assets/              Source files for the web app's images and audio
  prompts.json         Prompt for every generated image
  audio.json           Which original audio file becomes each app sound (+ trims)
  images/*.png         Full-size Codex output (gitignored); gen-asset trims them into public/images
  audio/music/         Downloaded music, e.g. from Suno (gitignored)
  audio/sfx/           Downloaded sound effects, original file names (gitignored, not used yet)
scripts/gen-asset.mjs  Generates/edits art with Codex CLI
scripts/build-audio.mjs  Encodes assets/audio/* into apps/web/public/audio/ (from assets/audio.json)
scripts/smoke.mjs  Socket-level check against a running server
scripts/e2e.mjs    Headless browser test of the real app
docs/              How-to guides (adding a game, deploying)
```

## Commands (run from repo root)

| Command | What it does |
| --- | --- |
| `npm install` | Install everything (npm workspaces; do not use pnpm/yarn) |
| `npm run dev` | Server on :8033, web on :5033 (Vite proxies `/socket.io` and `/api` to the server) |
| `npm run dev:web` / `npm run dev:server` | Run only one of the two |
| `npm run check` | Lint + typecheck + unit tests. **Must pass before you finish any task.** |
| `npm run format` | Auto-fix formatting and safe lint issues (Biome) |
| `npm run build` | Build shared, server, web |
| `npm run smoke [url]` | Two bots play a full Caro game while a third watches, against a running server (default `http://localhost:8033`) |
| `npm run e2e [url]` | Headless Chromium: two players pick Caro, create/join from the room list and play while a third watches (needs `npm run dev`). Screenshots in `.e2e/` |
| `npm run gen:asset -- <name>` | Generate an image from `assets/prompts.json` with Codex CLI (`--missing` for all missing) |
| `npm run gen:asset -- --edit <name> "<change>"` | Ask Codex to edit an existing image, keeping its style |
| `npm run audio [-- <name>]` | Re-encode app sounds from `assets/audio/` per `assets/audio.json` (run after replacing an original) |

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
  player offline (they can rejoin). Rooms keep a score (`wins` per seat + `draws`) until disbanded.
- Games are pure functions. Randomness only through the `rng` argument so tests are deterministic.
- Web: React owns app state (session, room snapshot) and all forms/buttons. Phaser only draws
  the world. React sends a `Stage` (`hub` | `sky` | `board` with view/me/players/result) to
  `PhaserStage`; Phaser emits `hub:select`, `hub:locked`, `board:move` on `bridge`.
  Use Phaser for anything game-like (boards, cards, pieces, animation, drag and drop, sound);
  use React/CSS only for plain UI panels.
- Rooms live in memory. Restarting the server wipes them; clients auto-rejoin by session token
  while the room still exists.

## Conventions

- TypeScript strict everywhere. ESM: relative imports in `packages/shared` and `apps/server`
  need the `.js` extension (`./foo.js`). The web app uses extensionless imports.
- Server: do **not** use `import type` for classes injected by Nest (DI needs the runtime value).
- `packages/shared` must build before the others typecheck; root scripts already do this.
  If an editor shows "cannot find @psc/shared", run `npm run build -w @psc/shared`.
- New game logic needs tests in `packages/shared/src/games/<id>/<id>.test.ts`.
- New socket events go in `protocol.ts` first; TypeScript then shows every place to update.
- **All user-facing text is Vietnamese**: web UI copy, and server/game error messages
  (they are shown to players). Code, comments, docs and identifiers stay in English.
- No instructional subtext ("tap an island to…", "enter your name first"). Figuring out the UI
  is part of the fun. Status text (whose turn, waiting for host) is fine.
- Keep UI mobile-friendly (friends play on phones). Test both a phone (390×844) and a desktop size.
- Theme: floating sky islands, polished 3D-cartoon mobile-game look (like 2015 Vietnamese mobile
  games). React panels use the wood/paper/yellow-button styles and CSS variables in
  `apps/web/src/styles.css`; text uses the "Baloo 2" font (`FONT`/`titleStyle` in Phaser).

## Art

- All game art is **generated**, not hand-drawn: never draw art with SVG/CSS/Phaser graphics.
- Add an entry to `assets/prompts.json` (the shared `style` is prepended automatically; set
  `transparent: true` for objects), run `npm run gen:asset -- <name>`, add the key to
  `IMAGE_KEYS` in `apps/web/src/phaser/assets.ts`, and look at the result before using it.
- To tweak an image, prefer `--edit` over regenerating so it keeps the same look.
- Never bake text into images (Vietnamese diacritics come out wrong). Put text on top in code.
- `avatar-long.webp` is not generated: it is the photo `assets/images/Long-look-at-u.jpg`,
  cropped round and placed inside the generated `avatar-frame` (composited with sharp).
- Codex sometimes paints a fake grey checkerboard instead of real transparency; check alpha
  (e.g. with sharp) and clear it if needed.
- Images used only by React (e.g. `speaker-on`/`speaker-off`) are loaded with `<img src="/images/<name>.webp">`
  and do not need to be in `IMAGE_KEYS`.
- Codex takes ~1.5 min per image. Output is trimmed and saved as WebP; raw PNGs stay in
  `assets/images/` (gitignored).

## Audio

- Codex cannot generate audio. The owner downloads music/sound effects and drops them in
  `assets/audio/music/` or `assets/audio/sfx/`.
- The web app never reads `assets/audio/` directly. `assets/audio.json` maps each app sound
  (a short, purpose-based name) to an original file, with optional `start`/`duration` trims and `speed`;
  `npm run audio` writes `apps/web/public/audio/<name>.mp3|wav`. When the owner replaces or renames
  an original, update the mapping and rerun it. Trim quiet lead-ins so UI sounds feel instant, and use `"format": "wav"` for short effects
  (MP3 always starts with ~25 ms of encoder padding; `playSfx` loads `<name>.wav`).
- Only the files in `apps/web/public/audio/` are committed; the originals are local only.
- Play effects with `playSfx(name)` from `src/sound.ts` (add the name to `Sfx`/`SFX` there).
  Hover sounds are mouse-only (on touch, "hover" fires on every tap).

## Common tasks

- Add a new game: follow `docs/adding-a-game.md`.
- Deploy / CI: see `docs/deploy.md`. Web = Vercel, server = Render, both auto-deploy from `main`.

## Before finishing

1. `npm run check` passes.
2. For gameplay, UI or protocol changes: run `npm run e2e` against `npm run dev` (start it only
   if it is not already running, and stop what you started), and look at the screenshots.
3. Update this file if you changed layout, commands or conventions.
