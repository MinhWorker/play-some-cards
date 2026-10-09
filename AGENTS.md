# AGENTS.md

Board games to play with friends in the browser. This is an npm-workspaces monorepo:
- a NestJS + Socket.IO server;
- a React + Vite + Phaser 4 web app;
- one folder per game.

Humans start with README.md and CONTRIBUTING.md.

**Direction:** the project is becoming Xóm Đảo, a hub of islands with a Godot client while game
rules stay in TypeScript on the server. Read `docs/vision.md`, `docs/roadmap.md`,
`docs/experience.md` (the HUD and UX frame every game must fit) and `docs/adr/` before planning work
on the hub, the client or shared player data. Until Phase 1 lands, the layout and commands below
describe the current React + Phaser app.

## Read first when working on

| Working on | Read |
| --- | --- |
| A game or the SDK (`games/`, `packages/sdk/`) | `games/AGENTS.md` |
| The web app: screens, HUD, Phaser world, dev tools (`apps/web/`) | `apps/web/AGENTS.md` |
| The server, rooms, accounts, DB, socket protocol (`apps/server/`, `packages/shared/`) | `apps/server/AGENTS.md` |
| Images or sounds, for the app or a game | `assets/AGENTS.md` |

## Layout

```
games/<id>/        @xomdao/game-<id>  One game = one folder; adding or changing a game edits nothing else
packages/sdk/      @xomdao/sdk        The only API games use
packages/shared/   @xomdao/shared     Core only, never imported by games: socket protocol, accounts, game registry
apps/server/       @xomdao/server     NestJS + Socket.IO
apps/web/          @xomdao/web        React + Vite + Phaser 4
assets/            Originals of the app's own art and audio (Git LFS), prompts.json
scripts/           Build helpers (libs.mjs), generators (new.mjs), asset tools, smoke/e2e
tools/blender/     Shared Python/bpy sprite baking helpers (xomdao_bake)
docs/              Shared guides for people: making-a-game, ui-guide, deploy
```

## Commands (run from repo root)

| Command | What it does |
| --- | --- |
| `npm install` | Install (npm only, not pnpm/yarn). Also writes the game list: rerun it and restart dev after adding a game folder |
| `npm run dev` | Server on :8033, web on :5033 (Vite proxies `/api` and `/socket.io`). `PORT=8133 WEB_PORT=5133` moves them |
| `npm run check` | Lint + typecheck + unit tests |
| `npm run format` | Auto-fix formatting and safe lint issues (Biome) |
| `npm run blender -- <id> [names…]` | Bake game art with Blender or `XOMDAO_BLENDER_PYTHON` (Python+bpy); see `assets/AGENTS.md` |
| `npm run e2e [url]` | Headless Chromium plays every scenario in `scripts/e2e/scenarios/` through the real UI, side by side (needs a running dev server). `-- --only <names>`, `-- --changed origin/main`; flags at the top of `scripts/e2e.mjs`. Screenshots in `.e2e/<scenario>/` |
| `npm run shots [url]` | Headless screenshots of one page (`-- --path '/?play=<id>'`, `-- --login`) on real phone/tablet/desktop sizes held sideways, at their pixel density and with notch insets. Prints the canvas density against the screen's; `-- --audit` also lists images drawn bigger than their pixels. `.shots/<device>.png` + a 1:1 `-crop.png`; flags at the top of `scripts/shots.mjs` |
| `npm run smoke [url]` | Bots play Caro over sockets against a running server |

Commands for games, assets and the DB are in the topic files above.

The owner often runs `npm run dev` in their own terminal. If you need a running app:
- start your own on free ports (move them if 8033/5033 are taken);
- check what you need;
- stop it when you are done.

Test the browser headless only: `npm run e2e`, `npm run shots` or your own headless Playwright
script. Judge sharpness on the `-crop.png` files: the full shots are scaled down when viewed.

## Conventions

- TypeScript strict. Relative imports in `packages/*`, `games/*` and `apps/server` end in `.js`.
  The web app uses extensionless imports, and `@/` (= `src/`) outside the current folder.
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
- **Small UI/CSS tweaks**: `npm run check`, plus `npm run shots` of that screen.
- **Other code changes**: `npm run check` passes.
- **Gameplay, room/lobby flow, protocol or socket changes**: also run
  `npm run e2e -- --changed origin/main` (the scenarios CI will pick) against a running dev
  server and look at the screenshots. Run it once, at the end of the task, not after every small
  follow-up edit. For a game, also try it in the sandbox.

Keep the AGENTS.md files accurate when you change layout, commands or conventions. This file
holds what every session needs; a topic file holds the rest.
