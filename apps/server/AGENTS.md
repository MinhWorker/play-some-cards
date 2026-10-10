# Server (@xomdao/server) and the socket protocol (@xomdao/shared)

The server is only the API: rooms over the `/ws` WebSocket and `/api` over HTTP. It serves no web
files; Vercel serves the Godot client (`docs/deploy.md`).

```
src/rooms/      rooms.service.ts = room logic (unit tested); rooms.gateway.ts = the `@On(event)`
                handlers, broadcasts, bot moves and game timers; ws.gateway.ts = the transport:
                plain WebSocket + JSON on /ws, login + protocol check, then RoomsGateway's handlers
src/dev/        gated console commands, snapshots, undo/RNG frames and per-room logs
src/accounts/   Username/password (scrypt) and login tokens
src/catalog/    The hub's catalog (`catalog:get`): core genres + a card per game with a genre
src/ledger/     Ledger: the only module that changes balances (`ledger_entries`, `balances`)
src/inventory/  Túi đồ: what each account owns (`inventory_items`), equipping looks, profiles
src/shop/       Chợ: `shop:list` and `shop:buy`, paid through the Ledger
src/events/     Sự kiện: event points (`event_points`), claimed tiers (`event_claims`), EventClock
src/stats/      Stats, achievements, rankings (`player_stats`, `stat_matches`, `achievements`)
src/matches/    Match history: finished games (fed by RoomsService.onFinished), `history:recent`
src/db/         Drizzle schema; migrations in drizzle/
src/version.ts  For /api/health
packages/shared/src/protocol.ts   The protocol as zod schemas (types, requests, events) + PROTOCOL_VERSION
packages/shared/src/catalog.ts    Genre list (core data), GameCard, metaProblems (registry test)
packages/shared/src/items.ts      Item catalog (ITEMS: id, slot, look, name, price), card backs
packages/shared/src/achievements.ts  ACHIEVEMENTS (the hub's own + each game's), levels, boards
packages/shared/src/registry.ts   games/getGame, from the generated (gitignored) src/generated/games.ts
```

## Rooms

- Rooms belong to one game and live in memory, so a restart wipes them.
- From a game's room list you can:
  - create a room;
  - join as a player, when a seat is free and no game is running;
  - watch.
- Leaving means quitting. The next player becomes host, and an empty room is disbanded.
- A player leaving mid-game stops it for everyone unless the game has `onLeave`. The client asks
  first (Rời ván? in `apps/client/hub/main.gd`).
- Rooms keep a score.
- Room options are checked with the game's zod schema and kept for the room's life. The host may
  replace them between games (`room:options`); bots then join or leave to match.
- Bots never host or keep a room alive.

## Accounts and connection

- Everyone plays logged in, with a username and password and no email.
- The client speaks plain WebSocket + JSON on `/ws` (same port as `/api`): `{ id, event, data }`
  requests, `{ id, ack }` replies, `{ event, data }` pushes. It logs in first with `auth:token`,
  `auth:login` or `auth:guest` (a new account with only a name), each carrying `protocol`.
  `WsGateway` then runs the matching `RoomsGateway` handler (`handlerFor`);
  `RoomsGateway.clients()` lists every connected client for broadcasts.
- Room codes are 4 characters without 0/O/1/I; `room:join` takes them in any case.
- Being in a room belongs to the account. After every connect, the client sends `session:resume`
  to get back to its seat from any tab or device.
- Accounts, tokens and match history live in Postgres (Neon, `DATABASE_URL`). Without it they
  live in memory, which is fine for local work.

## Catalog

- `catalog:get` returns the genres (`genres` in `packages/shared/src/catalog.ts`, in `order`)
  and one card per game whose `meta.genre` is set, with `playing` (connected people seated in
  its rooms) and `openRooms` (`RoomsService.activity`).
- `wip` games are hidden where `RENDER` is set (production); `XOMDAO_SHOW_WIP=1|0` overrides it.

## Ledger

- Tables `ledger_entries` (one row per change, unique `key`) and `balances` (per account and
  namespaced resource, `core:coin`). Memory store without `DATABASE_URL`.
- `LedgerService.apply({ userId, resource, amount, reason, key })` is how other modules pay or
  charge: a used key changes nothing (`duplicate`), a balance never goes below 0
  (`insufficient`). No other module touches these tables.
- Game rewards: games call `ctx.reward(player, resource, amount)`; the totals land in
  `result.rewards`. The gateway hands every `RoomsService.onFinished` game to
  `LedgerService.rewardMatch`, which pays accounts (never bots) once per game (key
  `match:<matchId>:<user>:<resource>`) and refuses totals above the game's `meta.rewardCap`.
  Each paid player's sockets get `reward` with the new balances; `session:resume` returns
  `balances`.

## Inventory and Shop

- Items are data in `packages/shared/src/items.ts` (`core:frame-<look>`,
  `core:card-back-<look>`). Append new ones; never reuse or rename an id. Price 0 = everyone has
  it, so free items are never stored.
- `InventoryService` owns `inventory_items` (user, item). `inventory:get { userId? }` returns a
  `Profile` (yours, or anyone's, read-only); `inventory:equip { itemId }` sets `users.frame` or
  `users.card_back` through `AccountsService.setLooks`, then the gateway refreshes the user's
  rooms so everyone sees the new look. `profile:update` also refuses a frame you don't own.
- `ShopService.buy` charges through `LedgerService.apply` with key `shop:<user>:<item>`, so a
  repeated buy is never charged twice; `insufficient` becomes "Không đủ xu", owned "Bạn đã có
  món này".
- `dev:coins { amount }` (dev mode only) adds coins, for tests and the sandbox.

## Events

- An event is a game with `meta.kind: 'event'` in the `su-kien` genre and `meta.event`
  (`opensAt`, `closesAt`, `tiers`, `color`). `EventClock` is the time events go by: real time,
  moved by `XOMDAO_NOW` at start or `dev:clock { at }` (dev mode; `null` = real time).
- `CatalogService` lists an event only while it is open (`eventOpen`), with `closesIn` (ms). The
  gateway refuses `room:create` / `room:quick` of a closed event ("Sự kiện chưa mở hoặc đã kết
  thúc"); rooms already playing finish.
- Points: an event's game gives `ctx.reward(player, EVENT_POINTS, n)`. `LedgerService.rewardMatch`
  skips `event:point`; `EventsService.recordMatch` (on `RoomsService.onFinished`) adds it to
  `event_points`, once per match, within `rewardCap`, only while the event is open.
- `event:get { eventId }` returns `EventProgress` (points, claimed tier indexes);
  `event:claim { eventId, tier }` pays the tier's `reward` through `LedgerService.apply` with key
  `event:<event>:<user>:<tier>:<resource>` and records it in `event_claims`, so it pays once
  ("Chưa đủ điểm", "Bạn đã nhận mốc này").

## Stats

- `StatsService.recordMatch` (on `RoomsService.onFinished`, after the ledger paid the game) counts
  once per match and person (`stat_matches`): `played`, `won`, the game's `result.stats`
  (`ctx.stat`) into `player_stats` by game, and `XP_PER_GAME` into game `core`, stat `xp`.
- Then every `ACHIEVEMENTS` entry the counts reach (the hub's own sum over all games) is unlocked
  (`achievements`), adds its `xp` and pays its `reward` through `LedgerService.apply` with key
  `achievement:<user>:<id>:<resource>`. The gateway pushes `achievement { achievements, balances }`.
- `stats:get { userId? }` returns `PlayerStats` (level from `levelOf(xp)`, totals, every
  achievement with progress, ranks). `ranking:get { board }` returns the top `RANKING_LIMIT`:
  `core` by `xp`, a game's id by `won`; ties share a rank; `me` is your row when you are on it.

## Match history

- `RoomsService` knows nothing about storage: `onFinished(listener)` hears each game that ends
  with a result (a stopped game is not one). The gateway hands it to `MatchesService.record`.
- A game is kept only when an account sat at it. Players are stored as they were when it began
  (name, avatar, frame); bots have no `user_id`.
- `history:recent` returns the caller's last `HISTORY_LIMIT` (20) games, newest first, each with
  the caller's own `outcome`.

## Changing things

- New platform features (wallet, shop, inventory, achievements…) are separate Nest modules
  (`docs/adr/0002-modules.md`). A module owns its tables and never reads another module's tables:
  it calls that module's service, or listens to events such as `RoomsService.onFinished`.

- Nest DI needs the runtime value, so `import` classes that Nest injects as values.
- The server typechecks against built packages. Root scripts run `npm run build -w @xomdao/shared`
  (= `scripts/libs.mjs`) first.
- **New socket events** go in `protocol.ts` first, as zod schemas in `requests` / `events`
  (and `types` for a new named shape). Then run `npm run gen:protocol` to regenerate the GDScript
  in `apps/client/addons/xomdao_sdk/generated/`; `npm run check` fails when you forget.
- Client (Vercel) and server (Render) deploy separately and compare `PROTOCOL_VERSION` on
  login (`ws.gateway.ts` refuses another version with `protocol-mismatch`); the client then shows
  "Đã có bản mới" with Tải lại. Bump it when old clients or servers would break. Details:
  `docs/deploy.md`.
- **DB**: edit `src/db/schema.ts`, then run `npm run db:generate -w @xomdao/server`. Migrations apply
  on server start.
- A migration must work with the previous server build: add first, remove later.

## Dev Console

- `DEV_MODE` reads `XOMDAO_DEV === '1'` once at startup. `scripts/dev-server.mjs` enables it for
  `npm run dev`; never set it on Render. Disabled servers reject every `dev:*` request and
  allocate no room dev state or log followers.
- `dev:command`, `dev:schema`, `dev:logs` and server `dev:log` are additive protocol events.
  Any room member, including spectators, may use them only when dev is enabled.
- `src/dev/dev-console.service.ts` dispatches engine and optional game commands. `as` uses
  the regular move validation and broadcast path. Other mutations leave `room.last` alone.
- `room-dev.ts` owns room RNG, queued numbers, the 50-frame undo history and pause flags.
  Frames include scores, RNG state and timer remaining time; restoring a timer replaces its
  gateway handle. Remember bot RNG before its decision as well as before its move.
- `dev-snapshots.ts` writes `.dev/snapshots/<gameId>/<name>.json` at the repo root. Loads require
  the same game and seat count, remap player IDs by seat and validate the resulting view.
- `room-log.ts` retains 500 entries per room, truncates details near 20 KB, and captures
  synchronous game `console.log/info/warn/error` calls while still printing to the terminal.
  Always restore console methods in `finally`. Socket followers stop on leave/disconnect.
- Use `npm run dev` with memory accounts (`DATABASE_URL=''`) for local e2e. Scenarios run a
  console line with `window.xomdao.request('dev:command', { line })` (a `cmd(page, line)` helper in
  the scenarios that need it).
