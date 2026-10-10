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
core/               Autoloads: Net (the app's XomDaoClient, server_url()), Session (saved token),
                    Wallet, ContentLoader (game packs), TestBridge (window.xomdao, debug web only)
hub/                main.gd routes the screens: lobby (island ring + HUD), select (game select),
                    ben (Bến), room (waiting room), the game with ☰, the result over it
  lobby/            HubLobby, HubIslandRing (ring layout, swipe/tap), HubIsland (drawn islands)
  select/ ben/ room/  Game select; Bến; waiting room, Tạo phòng board, result, Luật board
  home/ shop/       Nhà (HubHome: profile + shelf, someone else's read-only) and Chợ (HubShop);
                    shelf.gd (HubShelf) is the tabbed shelf of item tiles both use
  gallery/          Every UI kit component on 4 pages: ?gallery=<page> or `-- --gallery=<page>`
addons/xomdao_sdk/  The only API a game's Godot code uses: XomDaoFrame, XomDaoClient (client.gd)
  ui/               The shared UI kit (theme, widgets, fonts, Phosphor icons, UI sounds)
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
- A game's Godot entry is `res://content/<id>/main.tscn`. Its root gets `bind(client:
  XomDaoClient)` once in the tree, draws `client.snapshot` and follows `state_changed`. It may
  define `sandbox_options() -> Dictionary`, the room options for `?play=<id>` (debug builds: a
  real room with the computer in the seats, started at once), and `room_setup() -> Array`, the
  Tạo phòng board's rows (`{key, label, options: [[label, value], …], default?}`: the first
  option is picked, or the one at index `default`), and `result_detail() -> Dictionary`, what
  the result board adds under its title: `{reason: String, rows: [[label, value], …]}` after the
  hub's own Thời gian row.
  A game's `music/` folder (`res://content/<id>/music/`) is its background music: the hub's
  `HubMusic` plays a random track while the game is on, at the settings' music volume.
  The hub draws the ☰ menu, the room, the result (Xem bàn puts it away to look at the final board, Kết quả brings it back) and Luật (the game's RULES.md, which
  `godot:export` puts in its pack); the game draws only its table.
- A catalog card is playable here only when the client has its pack (`ContentLoader.available()`);
  the others show "Sắp có". The game on CHƠI is kept per account in `user://hub.cfg`.
- `ContentLoader.load_game(id)` gives that scene: from the `content/<id>` link in the editor and
  headless, otherwise it downloads `content/<id>.<hash>.pck` (listed in `content/manifest.json`
  next to the page) into `user://content/` once and loads it.
- The server URL: `window.XOMDAO_SERVER` when the export baked it in (`XOMDAO_SERVER_URL` or
  `VITE_SERVER_URL`), else the page's own origin (`npm run dev` proxies `/ws`); off the web
  `XOMDAO_SERVER` or ws://localhost:8033/ws.
- Name every node a test taps or reads (`Cell_<x>_<y>`, `Play`, `RoomCode`, `Island_<genre>`…). The debug
  bridge `window.xomdao` (`core/test_bridge.gd`): `scene()`, `tree(depth)`, `text(name)`,
  `rect(name)` (CSS px), `click(name)`, `state()`. The hub sets `TestBridge.scene`.
  `scripts/e2e/godot.mjs` wraps it for scenarios (`tap` clicks with the real mouse).
- The server connection is `XomDaoClient` (WebSocket + JSON on `/ws`): `connect_to_server`,
  `login_guest` / `login` / `login_token`, `create_room`, `quick_match(game_id)`, `join_room(code)`, `leave_room`,
  `start_game`, `send(event, payload)`, `request(event, data)`; signals `state_changed`,
  `room_changed`, `rewarded`, `event_received`, `error`, `connected`, `disconnected`. It
  reconnects and resumes by itself. Its header is the API reference.
- Protocol classes come from zod (`packages/shared/src/protocol.ts`): change the schema, then run
  `npm run gen:protocol`. JSON keys stay camelCase; fields are snake_case.
- Screens and games build their UI from the kit in `addons/xomdao_sdk/ui/`
  (docs/art-direction.md made into code), never their own buttons, fonts or HUD colours:
  - `XomDaoUi`: palette, fonts, icons (`XomDaoUi.icon("gear")`, Phosphor Fill), `theme()`,
    `money()` / `delta()`, `play()` for the shared sounds, `bounce()`;
  - widgets: `XomDaoButton` (colour by `XomDaoUi.Kind`), `XomDaoIconButton`, `XomDaoBoard`,
    `XomDaoMoney`, `XomDaoDelta`, `XomDaoChip`, `XomDaoAvatar`, `XomDaoPlayerSlot`,
    `XomDaoGameTile`, `XomDaoChoice`, `XomDaoToast`, `XomDaoDot`, `XomDaoDivider`, `XomDaoMenu`;
  - `XomDaoSettings`: sound, HUD scale, margin, picture quality (user://settings.cfg). The
    quality is saved but does not change the rendering yet.
  Each script's header shows its use. Add a new component to the gallery
  (`hub/gallery/gallery.gd`) and check it there.
- Look at a gallery page without a browser:
  `xvfb-run -a npm run godot -- --rendering-driver opengl3 --resolution 1280x720 -- --gallery=2 --save=/tmp/g2.png`.
  For real phone sizes, serve `dist/` after `godot:export` and run
  `npm run shots -- <url> --path '/?gallery=2' --wait 12000`.
- `node scripts/ui-sounds.mjs` synthesizes the UI sounds (tap, panel, coin) again.
- Commit the `.uid` files Godot writes next to scripts.

## Commands

| Command | What it does |
| --- | --- |
| `npm run godot:check` | gdformat --check, gdlint, the boundary rule, headless import, compile every script and scene, GUT. `npm run check` runs it when Godot is installed |
| `npm run godot:link` | (Re)make the `content/<id>` symlinks; check and export do it too |
| `npm run godot:export` | Web build into `dist/` (`-- --debug` for a debug build) plus `dist/content/<id>.<hash>.pck` and `manifest.json`. Runs on a copy in `.tools/export/` because Godot's export filters do not follow symlinks |
| `npm run godot:net` | Builds and starts a dev server (no database) on a free port, then runs the GUT tests that need it (`test_net.gd`, skipped by `godot:check`) |
| `npm run godot:smoke` | Serves `dist/`, opens it in headless Chromium at 800 × 360, waits for `xomdao:ready`, saves `.shots/godot-800x360.png` |
| `npm run godot:measure` | Download size and time to playable, first and repeat visit, on a throttled phone profile (`-- --server <url>` of a running server; `--cpu`, `--net`). Release build for sizes, debug build for every timing. Numbers go in `docs/adr/0001-godot-client.md` |

In the browser: `npm run dev` serves `dist/` at http://localhost:5033/godot/ (export again to see
changes) and proxies `/ws`. `npm run e2e -- --only godot-caro` and
`npm run shots -- --path '/godot/?play=tic-tac-toe'` need a debug export there. CI's `godot` job
runs every `godot-*` scenario (`--only 'godot-*'`); `e2e-plan` skips them. Vercel builds the client too (`tools/godot/vercel.mjs`:
release on production, debug on previews) and serves it at `/godot/`.

Format a script with `.tools/gdtoolkit/bin/gdformat <file>`.
