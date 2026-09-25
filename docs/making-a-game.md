# Making a game

A game is one folder, `games/<id>/`. You never edit anything outside it: the app finds every
folder in `games/` by itself.

```
npm run new:game -- my-game "Tên tiếng Việt"
npm run dev
```

That creates a small working game ("race to 21") marked `wip`. Turn it into your game step by
step, keeping it playable.

- **Alone:** http://localhost:5033/?play=my-game&players=2 runs the rules right in the browser:
  no server, no account. The buttons at the top switch seats (and "Khán giả" shows what a
  spectator sees). Saving a file reloads it. Works in PR previews too, not on the real site.
- **For real:** http://localhost:5033, log in, pick its island; open a second (private) window
  to be the other player.

If `package-lock.json` conflicts when you merge `main` into your branch, run `npm install`.

## The folder

```
games/<id>/
  src/index.ts        meta (name, players, status) + rules. Runs on the server.
  src/rules.ts        the rules: pure functions, no Phaser, no DOM
  src/rules.test.ts   tests (npm run check runs them)
  src/client.ts       export default defineClient({ scene: MyScene })
  src/<Name>Scene.ts  the board, drawn with Phaser
  assets/             images (.webp/.png) and sounds (.wav/.mp3), used by file name
  sources/            optional originals (big PNGs, .psd/.kra, raw audio); see below
  README.md           rules and credits
```

A game may import only `@psc/sdk`, `@psc/sdk/client`, `phaser`, `zod` and its own files; lint
checks it. Relative imports end in `.js` (`./rules.js`), because the server runs compiled JS.

## Rules (`src/rules.ts`)

```ts
export const rules = defineGame<State, Move, View>({
  moveSchema,                              // zod schema; bad shapes never reach your code
  setup(players, rng) { ... },             // the starting state
  validateMove(state, move, player) { },   // null, or a Vietnamese message for the player
  applyMove(state, move, player, rng) { }, // return a NEW state, never mutate
  getView(state, player) { ... },          // what this player may see
  getResult(state) { ... },                // null while playing, then { winners: [...] } ([] = draw)
});
```

- The server runs the rules; players only ever get `getView`. **Hide secrets there**: other
  players' cards, the deck order. `player` is `null` for spectators: public info only.
- Randomness only through `rng` (`shuffle(rng, deck)`, `pick`, `int` from `@psc/sdk`), never
  `Math.random()`, so tests can replay a game.
- Test with `playMoves(plugin, players, moves)`, `moveError(...)` and
  `assertHidden(plugin, state, viewer, secret)` from `@psc/sdk`.

## Board (`src/<Name>Scene.ts`)

Extend `BoardScene<View, Move>` from `@psc/sdk/client`:

- `build()` creates objects once; `draw()` updates them from `this.props` (`view`, `me`,
  `players`, `result`, `score`). `draw()` runs on every change and on resize, so position things
  from `this.boardArea()`.
- `this.sendMove(move)` on input. The server decides whether it's legal and the error is shown
  for you.
- `this.image(x, y, 'card')` shows `assets/card.webp`; `this.texture('card')` for `setTexture`;
  `this.sfx('deal')` plays `assets/deal.wav` at the player's effects volume.
- `titleStyle(size)`, `hudScale()`, `this.fitText(...)`, `this.nameOf(id)` keep the app's look
  and fit small phones. A spectator's `me` is not in `players`.
- Winner/draw panels, "Chơi ván mới", the room bar and sounds for winning are already done by the
  app.

## Art and sound

Put finished files in `assets/` and they are used as they are. Draw them, generate them, or ask
for help; just never draw art with code (SVG/CSS/Phaser graphics) and never put text inside
images (write it with Phaser). `assets/island.webp` is the game's island on the home map
(`meta.portal.image`).

Big originals can go in `sources/` (stored with Git LFS) and `npm run assets -- <id>` makes the
app-ready files: every image in `sources/` becomes a trimmed, resized `assets/<same name>.webp`
(options per image in `sources/prompts.json`: `transparent`, `maxSize`), and sounds listed in
`sources/audio.json` are cut and encoded:

```json
{ "sounds": { "move": { "src": "wood-knock.wav", "start": 0.05, "duration": 0.4, "format": "wav" } } }
```

Use `"format": "wav"` for short effects (MP3 adds a small delay at the start).
Files named `music-*.mp3` in `assets/` are the game's background music: one of them plays at
random on its board.

To generate art with Codex (if you have it), add a prompt to `sources/prompts.json`
(`{ "assets": { "card-back": { "transparent": true, "maxSize": 256, "prompt": "…" } } }`) and run
`npm run gen:asset -- <id>/card-back`.

## Done?

Set `status: 'ready'` in `src/index.ts`. Until then the game is playable in dev and in PR
previews and locked ("sắp có") on the production site, so you can merge unfinished work any
time.
