# Making a game

A game is one folder, `games/<id>/`. You never edit anything outside it: the app finds every
folder in `games/` by itself.

```
npm run new:game -- my-game "Tên tiếng Việt"
npm run dev
```

That creates a small working game ("race to 21") marked `wip`. Open the home map and it's there.
Turn it into your game step by step, keeping it playable.

## The folder

```
games/<id>/
  src/index.ts        meta (name, players, status) + rules. Runs on the server.
  src/rules.ts        the rules: pure functions, no Phaser, no DOM
  src/rules.test.ts   tests (npm run check runs them)
  src/client.ts       export default defineClient({ scene: MyScene })
  src/<Name>Scene.ts  the board, drawn with Phaser
  assets/             images (.webp/.png) and sounds (.wav/.mp3), used by file name
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

Put finished files in `assets/`. Draw them, generate them, or ask for help; just never draw art
with code (SVG/CSS/Phaser graphics) and never put text inside images (write it with Phaser).
`assets/island.webp` is the game's island on the home map (`meta.portal.image`).

The owner's AI tools write there too: an entry with `"game": "<id>"` in `assets/prompts.json`
(`npm run gen:asset`) or `assets/audio.json` (`npm run audio`) lands in `games/<id>/assets/`.

## Done?

Set `status: 'ready'` in `src/index.ts`. Until then the game is playable in dev and in PR
previews and locked ("sắp có") on the production site, so you can merge unfinished work any
time.
