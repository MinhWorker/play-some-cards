# __NAME__

Rules of the game, and credits for art and sounds.

- `src/rules.ts`: the rules (runs on the server; test them in `src/rules.test.ts`)
- `src/__Name__Scene.ts`: the board (Phaser, runs in the browser)
- `assets/`: images (`.webp`/`.png`) and sounds (`.wav`/`.mp3`), used by file name
- `sources/` (optional): originals; `npm run assets -- __ID__` turns them into `assets/`

Try it alone: http://localhost:5033/?play=__ID__&players=2 (with `npm run dev` running).
