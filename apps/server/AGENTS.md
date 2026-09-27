# Server (@psc/server) and the socket protocol (@psc/shared)

```
src/rooms/      rooms.service.ts = room logic (unit tested); rooms.gateway.ts = socket events,
                login + protocol check, plays bot moves and game timers
src/accounts/   Username/password (scrypt) and login tokens
src/db/         Drizzle schema; migrations in drizzle/
src/version.ts  For /api/health
packages/shared/src/protocol.ts   Socket events + PROTOCOL_VERSION
packages/shared/src/registry.ts   games/getGame, from the generated (gitignored) src/generated/games.ts
```

## Rooms

- Rooms belong to one game and live in memory, so a restart wipes them.
- From a game's room list you can:
  - create a room;
  - join as a player, when a seat is free and no game is running;
  - watch.
- Leaving means quitting. The next player becomes host, and an empty room is disbanded.
- A player leaving mid-game stops it for everyone unless the game has `onLeave`. The room page
  asks first (`pages/Room/LeaveConfirm.tsx`).
- Rooms keep a score.
- Room options are checked with the game's zod schema and kept for the room's life. The host may
  replace them between games (`room:options`); bots then join or leave to match.
- Bots never host or keep a room alive.

## Accounts and connection

- Everyone plays logged in, with a username and password and no email.
- The socket connects with `auth: { token, protocol }`.
- Being in a room belongs to the account. After every connect, the client sends `session:resume`
  to get back to its seat from any tab or device.
- Accounts and tokens live in Postgres (Neon, `DATABASE_URL`). Without it they live in memory,
  which is fine for local work.

## Changing things

- Nest DI needs the runtime value, so `import` classes that Nest injects as values.
- The server typechecks against built packages. Root scripts run `npm run build -w @psc/shared`
  (= `scripts/libs.mjs`) first.
- **New socket events** go in `protocol.ts` first.
- Web and server deploy separately and compare `PROTOCOL_VERSION` on connect: an old page
  reloads, and a newer page waits for the server. Bump it when old clients or servers would
  break. Details: `docs/deploy.md`.
- **DB**: edit `src/db/schema.ts`, then run `npm run db:generate -w @psc/server`. Migrations apply
  on server start.
- A migration must work with the previous web build: add first, remove later.
