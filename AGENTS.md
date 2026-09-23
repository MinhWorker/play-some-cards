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
  src/pages/                   React UI floating over the canvas (forms, panels, buttons)
  public/assets/*.webp         Generated art (see "Art" below)
assets/prompts.json  Prompt for every generated image
scripts/gen-asset.mjs  Generates/edits art with Codex CLI
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
| `npm run smoke [url]` | Two bots play a full Caro game against a running server (default `http://localhost:8033`) |
| `npm run e2e [url]` | Headless Chromium: two players play Caro in the real UI (needs `npm run dev`). Screenshots in `.e2e/` |
| `npm run gen:asset -- <name>` | Generate an image from `assets/prompts.json` with Codex CLI (`--missing` for all missing) |
| `npm run gen:asset -- --edit <name> "<change>"` | Ask Codex to edit an existing image, keeping its style |

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
  removed in `getView`.
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
- Codex takes ~1.5 min per image. Output is trimmed and saved as WebP; raw PNGs stay in
  `assets/raw/` (gitignored).

## Common tasks

- Add a new game: follow `docs/adding-a-game.md`.
- Deploy / CI: see `docs/deploy.md`. Web = Vercel, server = Render, both auto-deploy from `main`.

## Before finishing

1. `npm run check` passes.
2. For gameplay, UI or protocol changes: run `npm run e2e` against `npm run dev` (start it only
   if it is not already running, and stop what you started), and look at the screenshots.
3. Update this file if you changed layout, commands or conventions.
