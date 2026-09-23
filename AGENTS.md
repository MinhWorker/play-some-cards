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
apps/web/          @psc/web     React + Vite. Renders lobby, rooms and game boards.
  src/games/<id>/Board.tsx     One board component per game
  src/games/index.ts           gameId -> Board component map
scripts/smoke.mjs  End-to-end check against a running server
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
| `npm run smoke [url]` | Two bots play a full tic-tac-toe game against a running server (default `http://localhost:8033`) |

Run one workspace: `npm run test -w @psc/shared`. Add a dependency: `npm install <pkg> -w @psc/web`.

The owner runs the dev servers themselves in their own terminal. Do not start `npm run dev`
and leave it running. If you need a running app to verify something, start it, check, and stop
it before you finish.

## How it works

- The server is authoritative. Clients send `game:move`; the server validates with the game's
  `moveSchema` (zod) and `validateMove`, applies `applyMove`, then sends each player their own
  `room:state` built from `getView(state, playerId)`.
- **Never send raw game state to clients.** Hidden info (other players' cards, the deck) must be
  removed in `getView`.
- Games are pure functions. Randomness only through the `rng` argument so tests are deterministic.
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
- Keep UI simple and mobile-friendly (friends play on phones). Use the CSS variables in
  `apps/web/src/styles.css`, which already handle dark mode.

## Common tasks

- Add a new game: follow `docs/adding-a-game.md`.
- Deploy / CI: see `docs/deploy.md`. Web = Vercel, server = Render, both auto-deploy from `main`.

## Before finishing

1. `npm run check` passes.
2. For gameplay or protocol changes: start the server (`npm run build && npm start -w @psc/server`)
   and run `npm run smoke`, or play it in the browser with two tabs.
3. Update this file if you changed layout, commands or conventions.
