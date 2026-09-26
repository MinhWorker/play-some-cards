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

`games/tic-tac-toe` is the example game: open its README for a tour and the life cycle of a
game. New games start with the same layout:

```
games/<id>/
  src/index.ts        server entry: meta (name, players, status) + rules (+ room options)
  src/client.ts       browser entry: defineClient({ scene: Board, setup?: Setup })
  src/game/           the game itself: pure TypeScript, no Phaser, no DOM (runs on the server)
    model.ts            State, Move (and Options): read this first
    rules.ts            the rules
    rules.test.ts       tests (npm run check runs them)
  src/scenes/         what players see, drawn with Phaser (browser only)
    Board.ts            the board
  assets/             images (.webp/.png) and sounds (.wav/.mp3), used by file name
  sources/            optional originals (big PNGs, .psd/.kra, raw audio); see below
  README.md           rules and credits
```

Only `src/index.ts` and `src/client.ts` are required; organize the rest as you like. Keep
`game/` free of Phaser: the server loads it.

A game may import only `@psc/sdk`, `@psc/sdk/client`, `phaser`, `zod` and its own files; lint
checks it. Relative imports end in `.js` (`./rules.js`), because the server runs compiled JS.

## Rules (`src/game/rules.ts`)

```ts
export const rules = defineGame<State, Move, View>({
  moveSchema,                              // zod schema; bad shapes never reach your code
  setup(players, rng, options) { ... },    // the starting state (options: see room settings)
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

## Room options and the computer (optional)

A game can show its own settings screen (e.g. "play a friend or the computer?") when someone
taps "Tạo phòng", and again when the host taps "Tuỳ chỉnh" inside the room between games.
Design it however you like in Phaser, then hand over one object: that object is the room's
options. Without a setup screen the room is created right away.

```ts
// src/client.ts
export default defineClient({ scene: Board, setup: Setup });

// src/scenes/Setup.ts: build() / draw() like a board; draw() runs again on resize
export class Setup extends RoomSetupScene<Options> {
  protected build() { /* your buttons, art, sounds */ }
  protected draw() { /* place them; this.safeTop() leaves room for the app's top bar */ }
  // on a tap: this.submit({ opponent: 'bot', level: 'hard' })   (or this.cancel())
  // this.current: the room's options when opened with "Tuỳ chỉnh", null for a new room
}

// src/index.ts
export default definePlugin({
  meta,
  rules: { ...rules, bot: (state, player, rng, options) => ... }, // optional computer player
  room: {
    options: optionsSchema,                                  // zod; the server checks the object
    bots: (options) => (options.opponent === 'bot' ? 1 : 0), // optional: seats for the computer
  },
});
```

Where the options go:

- `setup(players, rng, options)`: copy into the state what the other rules need.
- `bot(state, player, rng, options)`: the computer's move for its seat, or `null` when it has
  nothing to do (not its turn). Pure like the rest of the rules; the server plays it after a
  short pause and checks it like any move. Test it like the rules (Caro: `src/game/bot.test.ts`).
- The board: `this.props.options` (type it with `BoardScene<View, Move, Options>`). Between
  games the host can also change them right on the board with `this.changeOptions({...})`
  (check `this.isHost`; read `this.options`, which includes a change still on its way). The next
  `setup` gets the new ones. Caro uses this for quick board size and color buttons.

`optionsSchema.parse({})` must work: those defaults are used for a room created without the
screen. The computer's seats come after the people. When new options need more or fewer of
them, the computer joins (if a seat is free) or leaves, and the score starts over. The room
closes when its last person leaves. In the sandbox, the "Tuỳ chỉnh" button opens your setup screen and
starts over with its options. Caro (games/tic-tac-toe) is the example (`src/scenes/Setup.ts`, `src/game/bot.ts`).

## Board (`src/scenes/Board.ts`)

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

## Game and View classes (the way to write games)

Games are written as two classes with lifecycle hooks, like Unity scripts: a `Game` (the logic,
on the server) and a `GameView` (the screen, in the browser). They talk through events, and
every hook gets one `ctx` with the whole room (state, players and seats, host, score, options).

- `games/counter` ("Bấm Nút"): the smallest example; its README lists every hook.
- `games/tic-tac-toe` (Caro): the same with room options, a computer player (`bot(ctx)`), a
  settings screen, host controls (`changeOptions`) and tests written with `testGame`.

The sections above describe the older rules/board way that `npm run new:game` and the other
games still use; new games should follow Caro and Bấm Nút.

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
