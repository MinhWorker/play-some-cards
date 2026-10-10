---
name: new-content
description: Make a new Xóm Đảo game or event from a brief (rules, Godot table, tests, e2e, docs). Use when asked to add a game, a mini-game or a seasonal event.
---

# New game or event from a brief

Read first: `games/AGENTS.md`, `apps/client/AGENTS.md`, `docs/experience.md` ("HUD trong ván",
"Sự kiện"), `docs/making-a-game.md`.

## 1. Pin down the brief

Write down, before any code (ask only for what changes the game itself; pick defaults for the rest
and say which):

- id (kebab-case, Vietnamese without accents: `bau-cua`), Vietnamese name, one-line tagline;
- genre: an id from `genres` in `packages/shared/src/catalog.ts` (`co`, `bai`; events are
  `su-kien`). A new genre is its own change to that list plus island art;
- players (min–max), whether the computer plays, minutes per game, coins for a win;
- layout: **Bàn** (board/cards: board in the middle, seats round it, actions bottom right) or
  **Hành động** (a scene: goal top left under ☰, counter top right, controls bottom);
- events: dates (Vietnam time), reward tiers, colour.

## 2. Generate

```
npm run new:game -- <id> "Tên" --genre <g> [--layout ban|hanh-dong]
npm run new:event -- <id> "Tên" [--opens YYYY-MM-DD] [--closes YYYY-MM-DD]
```

This writes a small working game (race to 21, or "hái lộc" for an event) that already plays in
the lobby: `games/<id>/` (rules + tests, `godot/` table + GUT test, RULES.md, README, stand-in
card art) and `scripts/e2e/scenarios/godot-<id>.mjs`. Run `npm run godot:check` once so Godot
writes the `.uid` files, and commit them.

## 3. Replace the starter, in this order

1. **Rules** (`src/game/<Name>Game.ts`, split into `model.ts`, `bot.ts` when it grows): State,
   events with zod payloads, `on<Event>` hooks, `view` hiding secrets, `bot` if the computer
   plays, rewards (`ctx.reward`, within `meta.rewardCap`), stats/achievements if the brief has
   them. Tests with `testGame` for every rule and every rejection message (Vietnamese).
2. **Meta** (`src/index.ts`): tagline, duration, players, `room.options` + `bots`/`withBots`.
3. **Godot table** (`godot/main.gd`): keep the layout's places and the named nodes tests use;
   draw `snapshot.view`, send events with `_client.send`. Use the UI kit (`XomDaoButton`,
   `XomDaoPlayerSlot`, `XomDaoChip`, `XomDaoUi` colours and fonts), never your own. Leave the top
   left 88 × 88 for the hub's ☰. Update `sandbox_options()` and `room_setup()` to match the
   options. Split helpers into more scripts in `godot/` and `preload("res://content/<id>/x.gd")`
   them; never reach outside the game's folder or `addons/xomdao_sdk`.
4. **GUT test** (`godot/test/test_main.gd`): build a snapshot by hand, check what is shown and
   which buttons are enabled.
5. **E2E** (`scripts/e2e/scenarios/godot-<id>.mjs`): play the sandbox to the end through named
   nodes. CI runs every `godot-*` scenario.
6. **Art and sound**: see the `make-asset` skill; the starter card art is a stand-in.
7. **Docs**: RULES.md (current rules only, for players), the game README (layout of the folder,
   credits).

## 4. Check

- `npm run check` and `npm run godot:check`; `npm run godot:export -- --debug`, a dev server
  (`DATABASE_URL= PORT=8133 WEB_PORT=5133 BOT_DELAY_MS=200 npm run dev`) and
  `npm run e2e -- http://localhost:5133 --only godot-<id>`.
- Look at the table on phones: the `phone-check` skill.
- Leave `status: 'wip'` until the owner has played it; set `'ready'` only when asked.
