# AGENTS.md

Board games to play with friends in the browser. This is an npm-workspaces monorepo:
- a NestJS server speaking WebSocket + JSON;
- a Godot 4 client exported to the web;
- one folder per game.

Humans start with README.md and CONTRIBUTING.md.

**Direction:** Xóm Đảo is a hub of islands with a Godot client while game rules stay in
TypeScript on the server. Read `docs/vision.md`, `docs/roadmap.md`, `docs/experience.md` (the HUD
and UX frame every game must fit) and `docs/adr/` before planning work on the hub, the client or
shared player data.

## Read first when working on

| Working on | Read |
| --- | --- |
| A game or the SDK (`games/`, `packages/sdk/`) | `games/AGENTS.md` |
| The Godot client: hub screens, HUD, UI kit, a game's `godot/` folder, the Godot toolchain (`apps/client/`, `tools/godot/`) | `apps/client/AGENTS.md` |
| The server, rooms, accounts, DB, socket protocol (`apps/server/`, `packages/shared/`) | `apps/server/AGENTS.md` |
| Images or sounds, for the app or a game | `assets/AGENTS.md` |
| A new game or event, an asset, a phone-size check | the skills in `.claude/skills/` |

## Layout

```
games/<id>/        @xomdao/game-<id>  One game = one folder; adding or changing a game edits nothing else
packages/sdk/      @xomdao/sdk        The only API games use
packages/shared/   @xomdao/shared     Core only, never imported by games: socket protocol, accounts, game registry
apps/server/       @xomdao/server     NestJS, WebSocket + JSON on /ws, the HTTP API
apps/client/                          Godot 4 client (GDScript), not an npm workspace; its web export is the site
assets/            The app's own art and audio: originals (Git LFS), ready files in app/ (plain git), prompts.json
scripts/           Build helpers (libs.mjs), the dev web server (web.mjs), generators (new.mjs), asset tools, smoke/e2e
tools/blender/     Shared Python/bpy sprite baking helpers (xomdao_bake), setup:blender
tools/godot/       Pinned Godot toolchain (version.json) and the godot:* scripts
.tools/            What setup:godot / setup:blender install (ignored)
docs/              Shared guides for people: making-a-game, ui-guide, deploy
```

## Commands (run from repo root)

| Command | What it does |
| --- | --- |
| `npm install` | Install (npm only, not pnpm/yarn). Also writes the game list: rerun it and restart dev after adding a game folder |
| `npm run dev` | Server on :8033; `scripts/web.mjs` on :5033 serves the Godot export (`apps/client/dist`) at `/` and forwards `/api` and `/ws`. Export first: `npm run godot:export -- --debug`. `PORT=8133 WEB_PORT=5133` moves them |
| `npm run check` | Lint + typecheck + `gen:protocol --check` + unit tests, plus `godot:check` when Godot is installed |
| `npm run gen:protocol` | Regenerate the Godot protocol classes from the zod schemas in `packages/shared/src/protocol.ts` |
| `npm run format` | Auto-fix formatting and safe lint issues (Biome) |
| `npm run setup:godot` | Install the pinned Godot, web templates, gdtoolkit and GUT into `.tools/` (Linux, macOS) |
| `npm run godot -- <args>` | The pinned Godot on `apps/client`; `godot:check`, `godot:link`, `godot:export`, `godot:smoke`, `godot:measure` in `apps/client/AGENTS.md` |
| `npm run setup:blender` | Install bpy + Pillow into `.tools/blender` (needs Python 3.13) |
| `npm run blender -- <id> [names…]` | Bake game art with the `.tools/blender` bpy, Blender or `XOMDAO_BLENDER_PYTHON`; see `assets/AGENTS.md` |
| `npm run e2e [url]` | Headless Chromium plays every `godot-*` scenario in `scripts/e2e/scenarios/` through the Godot client's debug build, side by side (needs a running dev server and `godot:export -- --debug`). `-- --only <names>` (`godot-*` works), `-- --changed origin/main`; flags at the top of `scripts/e2e.mjs`. Screenshots in `.e2e/<scenario>/` |
| `npm run shots [url]` | Headless screenshots of one page (default `/`, the lobby; `-- --path '/?play=<id>'` for a game's sandbox) on real phone/tablet/desktop sizes held sideways, at their pixel density and with notch insets. Prints the canvas density against the screen's. `.shots/<device>.png` + a 1:1 `-crop.png`; flags at the top of `scripts/shots.mjs` |
| `npm run smoke [url]` | Bots play Caro over the `/ws` WebSocket against a running server |

Commands for games, assets and the DB are in the topic files above.

The owner often runs `npm run dev` in their own terminal. If you need a running app:
- start your own on free ports (move them if 8033/5033 are taken);
- check what you need;
- stop it when you are done.

Test the browser headless only: `npm run e2e`, `npm run shots` or your own headless Playwright
script. Judge sharpness on the `-crop.png` files: the full shots are scaled down when viewed.

## Conventions

- TypeScript strict. Relative imports in `packages/*`, `games/*` and `apps/server` end in `.js`.
- GDScript (`apps/client`, `games/<id>/godot/`) is statically typed; rules in
  `apps/client/AGENTS.md`.
- **Players see Vietnamese**: UI copy and server/game error messages. Status text is fine, but
  write no instructional subtext ("tap an island to…").
- **Docs for people are Vietnamese**, while code, commands, paths and identifiers inside them stay
  as they are. This covers:
  - README.md, CONTRIBUTING.md and LICENSE-ASSETS.md;
  - `docs/`;
  - every README;
  - the `.github` templates.
- **English**: code, comments, identifiers, commit messages, PR titles, and agent files
  (`AGENTS.md`, `CLAUDE.md`).
- Current gameplay rules live in `games/<id>/RULES.md` for non-starter games; link them from
  the game README. Describe the current rules without change history or implementation plans.
- When you change behavior, update the Vietnamese docs in the same change.

## Git and PRs

- Never push to `main`. Branch, open a PR and squash-merge. Merging deploys (Vercel + Render).
- The PR title is a Conventional Commit: `feat:`, `fix:`, `docs:`, `refactor:` or `chore:`, with an
  optional scope such as `feat(xiangqi):`. CI checks it, and release-please builds the changelog
  from it.
- Leave version numbers and `CHANGELOG.md` to release-please.

## Before finishing

Test what the change needs, no more (e2e is slow):

- **Assets only** (an image, a sound, a prompt): look at the file itself, for example one headless
  screenshot where it is used. Skip `npm run check` and e2e.
- **Small UI tweaks**: `npm run godot:check`, plus `npm run shots` of that screen.
- **Other code changes**: `npm run check` passes.
- **Godot changes** (`apps/client/`, `games/<id>/godot/`, `tools/godot/`): `npm run godot:check`, and
  `npm run godot:export && npm run godot:smoke` when the build or a screen changed.
- **Gameplay, room/lobby flow, protocol or socket changes**: also run
  `npm run e2e -- --changed origin/main` against a running dev server (with a debug export) and
  look at the screenshots; CI's `godot` job runs every scenario. Run it once, at the end of the
  task, not after every small follow-up edit. For a game, also try it in the sandbox.

Keep the AGENTS.md files accurate when you change layout, commands or conventions. This file
holds what every session needs; a topic file holds the rest.
