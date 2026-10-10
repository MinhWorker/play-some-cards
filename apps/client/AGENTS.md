# Godot client (apps/client)

The Xóm Đảo client: one Godot 4 project in typed GDScript, exported to the web
(`docs/adr/0001-godot-client.md`). Game rules stay in TypeScript on the server; this project only
shows state and sends moves. Folder guide (Vietnamese): `apps/client/README.md`.

## Toolchain

- The Godot version, the editor and template hashes, GUT and gdtoolkit are pinned in
  `tools/godot/version.json`. `npm run setup:godot` installs them into `.tools/` (editor in
  self-contained mode, so its settings stay there too) and GUT into `addons/gut/` (ignored).
  Changing the version means new hashes: the editor zips' from the release's `SHA512-SUMS.txt`,
  the two `web_nothreads_*.zip` from inside the verified `.tpz`.
- `npm run godot -- <args>` runs the pinned Godot on this project (`-- --editor` opens it).
- Never run a Godot from elsewhere on this project: another version rewrites `project.godot`,
  scenes and `.uid` files.

## Layout

```
project.godot       960 × 720 base, canvas_items + expand, landscape, Compatibility renderer
core/               Autoloads: Net (holds the app's XomDaoClient), Session, Wallet, ContentLoader
hub/                The lobby and each platform module's screen (hub/<module>/); main.tscn starts
ui/                 Shared theme and widgets (not yet)
addons/xomdao_sdk/  The only API a game's Godot code uses: XomDaoFrame, XomDaoClient (client.gd)
  generated/        XomDao<Type> classes + XomDaoProtocol from npm run gen:protocol (never edit)
content/<id>        Symlinks to games/<id>/godot, made by npm run godot:link (ignored)
test/               GUT tests of the core (test_*.gd)
export_presets.cfg  The Web preset: single-threaded, PWA
```

## Rules

- Static types everywhere: `debug/gdscript/warnings/untyped_declaration` is an error.
- A game's Godot files (`games/<id>/godot/`) reach only their own folder (`res://content/<id>/`)
  and `res://addons/xomdao_sdk/`: no `uid://` in scripts, no autoloads, no class_name of the core
  or of another game. `godot:check` enforces it.
- A game's tests are `test_*.gd` anywhere in its folder; its `test/` folder is left out of its pack.
- The main scene prints `xomdao:ready`; `godot:smoke` waits for it.
- The server connection is `XomDaoClient` (WebSocket + JSON on `/ws`): `connect_to_server`,
  `login_guest` / `login` / `login_token`, `create_room`, `join_room(code)`, `leave_room`,
  `start_game`, `send(event, payload)`, `request(event, data)`; signals `state_changed`,
  `room_changed`, `rewarded`, `event_received`, `error`, `connected`, `disconnected`. It
  reconnects and resumes by itself. Its header is the API reference.
- Protocol classes come from zod (`packages/shared/src/protocol.ts`): change the schema, then run
  `npm run gen:protocol`. JSON keys stay camelCase; fields are snake_case.
- Commit the `.uid` files Godot writes next to scripts.

## Commands

| Command | What it does |
| --- | --- |
| `npm run godot:check` | gdformat --check, gdlint, the boundary rule, headless import, compile every script and scene, GUT. `npm run check` runs it when Godot is installed |
| `npm run godot:link` | (Re)make the `content/<id>` symlinks; check and export do it too |
| `npm run godot:export` | Web build into `dist/` (`-- --debug` for a debug build) plus `dist/content/<id>.<hash>.pck` and `manifest.json`. Runs on a copy in `.tools/export/` because Godot's export filters do not follow symlinks |
| `npm run godot:net` | Builds and starts a dev server (no database) on a free port, then runs the GUT tests that need it (`test_net.gd`, skipped by `godot:check`) |
| `npm run godot:smoke` | Serves `dist/`, opens it in headless Chromium at 800 × 360, waits for `xomdao:ready`, saves `.shots/godot-800x360.png` |

Format a script with `.tools/gdtoolkit/bin/gdformat <file>`.
