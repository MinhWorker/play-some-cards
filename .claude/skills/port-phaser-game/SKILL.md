---
name: port-phaser-game
description: Port an existing Phaser game in games/<id>/ to the Godot client (godot/ folder, tests, e2e, docs) without touching its server rules. Use when asked to bring a game to Godot.
---

# Port a Phaser game to Godot

The rules stay as they are: the TypeScript `Game` in `games/<id>/src/game/` is the server's and
already works. A port only adds `games/<id>/godot/` (and small, clearly needed rule fixes). Worked
examples: Caro (`games/tic-tac-toe/godot/`, simple Bàn) and Tiến Lên (`games/tien-len/godot/`:
cards, effects, sounds, art, room options).

Read first: `apps/client/AGENTS.md`, `docs/experience.md` ("Trong trận"), the game's RULES.md,
`src/index.ts`, its model/State and `view`, and its Phaser `src/scenes/*View.ts` to see what the
board shows and which effects matter.

## Steps

1. **Map the view.** List the fields of the game's `view` (what `snapshot.view` holds for you),
   the events and payloads the board sends, the room options and the timers. Note the Phaser
   board's effects worth keeping (deal, play, big words, sounds).
2. **Start from a template.** Copy `scripts/templates/godot/ban/main.gd` (or `hanh-dong/`) and
   `main.tscn` into `games/<id>/godot/`, replacing `__ID__`/`__NAME__`, then rewrite `_show` for
   this view. Keep: `bind(client)`, `state_changed`, `sandbox_options()` (options for
   `?play=<id>` with the computer), `room_setup()` (Tạo phòng rows from `room.options`), seats
   with `XomDaoPlayerSlot` named `Seat_<seat>`, your seat at the bottom, the top-left 88 × 88
   left for ☰, actions bottom right.
3. **Name every node a test taps or reads** (`Cell_<x>_<y>`, `Card_<n>`, `Play`, `Pass`,
   `Status`).
4. **Art and sounds**: copy the files the board needs from `games/<id>/assets/` into
   `godot/art/` and `godot/sounds/` (short names), `preload` them, commit the `.import` files
   Godot writes. Rules mirrored on the client (what is playable) go in a small `rules.gd` with
   a comment pointing at the TS source.
5. **GUT tests** in `godot/test/test_*.gd`: made-up snapshots, as in Caro's
   `test/test_caro.gd`.
6. **E2E**: `scripts/e2e/scenarios/godot-<id>.mjs` with `export const games = ['<id>']`, using
   `scripts/e2e/godot.mjs` (`openGodot`, `onScene`, `tap`, `godotText`, `room`). Play the sandbox
   or a real room to the result. CI picks up every `godot-*` scenario.
7. **Docs**: the game README (its Godot files), `apps/client/README.md` if the hub changed,
   and a line in the issue/PR on what was left out.
8. **Check**: `npm run check`, `npm run godot:export -- --debug`, a dev server on free ports
   with `DATABASE_URL=` empty, `npm run e2e -- <url> --only godot-<id>`, then the `phone-check`
   skill. Ask the owner to play it before calling the port done.

## Pitfalls

- Static types everywhere (untyped declarations fail the build); `npm run godot:check` runs
  gdformat, gdlint (100 columns), the boundary rule and GUT.
- No `uid://` paths, autoloads or other games' classes in a game's scripts.
- Design units: the frame is 720 tall and 960–1600 wide; never place by screen pixels. Read
  `XomDaoFrame.safe_inset(self)` and `XomDaoSettings.current().margin` in `_layout()`.
- `snapshot.view` keys are the server's camelCase; generated protocol classes use snake_case.
