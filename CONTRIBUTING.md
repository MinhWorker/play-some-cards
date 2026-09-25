# Contributing

Thanks for helping! Use whatever editor, art tool or AI assistant you like. You own your PR:
make sure it works and that you understand it.

## The flow

1. **Pick or open an issue** so nobody does the same thing twice. Small first tasks are labelled
   `good first issue`.
2. **Branch** from `main` (`feat/xiangqi-board`, `fix/room-list`, anything readable).
3. **Open a PR** early if you like. Its **title** is a
   [Conventional Commit](https://www.conventionalcommits.org), because it becomes the commit on
   `main` and the changelog line:
   - `feat: …` something players notice, `fix: …` a bug fix
   - `docs:`, `refactor:`, `test:`, `chore:`, `ci:` for the rest
   - optional scope for one game: `feat(xiangqi): cannon captures`

   Commits inside the branch can be anything; they are squashed.
4. **CI** runs lint, type checks, unit tests, the build and a headless browser test. Vercel posts
   a preview link where you can play your branch. For UI changes, add screenshots at phone and
   desktop size.
5. **Review, then squash merge.** Merging to `main` deploys to production.

Before pushing, `npm run check` runs the same checks locally.

## Versions

Nobody edits version numbers. A bot keeps a "release" PR open listing everything merged since the
last release. Merging it bumps the version, updates `CHANGELOG.md` and tags `vX.Y.Z`. The running
version shows at the bottom of the sound panel.

## Rules that CI can't check

- Players see Vietnamese; code, comments and docs are English.
- The server is authoritative, and hidden information (other players' cards) never leaves it:
  filter it in the game's `getView`.
- Art is generated or drawn by people, never drawn with code (SVG/CSS/Phaser graphics). Don't put
  text inside images.
- Test UI on a phone size (390×844) and a desktop size.
- Database migrations must keep working with the previous web build (add first, remove later).
- A change to the socket protocol that breaks old clients bumps `PROTOCOL_VERSION`
  (`packages/shared/src/protocol.ts`); CI reminds you.

## License

Your code is shared under MIT and your art/audio under CC BY-NC 4.0
([LICENSE-ASSETS.md](LICENSE-ASSETS.md)). Only add art or sounds you have the right to share.

## Making a game

`npm run new:game -- <id> "Tên"` creates a small working game in `games/<id>/`; everything about
your game stays in that folder, so several people can build games at once without conflicts.
Try it alone at `http://localhost:5033/?play=<id>&players=2` (no server or account needed).
See [docs/making-a-game.md](docs/making-a-game.md).
