# Adding a game

Use Caro 3×3 (tic-tac-toe) as the reference:
`packages/shared/src/games/tic-tac-toe/` and `apps/web/src/games/tic-tac-toe/TicTacToeScene.ts`.

## 1. Rules (packages/shared)

Create `packages/shared/src/games/<id>/index.ts`:

```ts
import { z } from 'zod';
import { defineGame, type PlayerId } from '../../game.js';

export interface MyState { /* full state, including secrets */ }
export interface MyView { /* what one player may see */ }
const moveSchema = z.object({ /* ... */ });
export type MyMove = z.infer<typeof moveSchema>;

export const myGame = defineGame<MyState, MyMove, MyView>({
  id: '<id>', name: 'Tên tiếng Việt', minPlayers: 2, maxPlayers: 4, moveSchema,
  setup(players, rng) { ... },
  validateMove(state, move, player) { return null /* or a Vietnamese error message */ },
  applyMove(state, move, player, rng) { return { ...state /* new object, no mutation */ } },
  getView(state, player) { ... },   // strip other players' hands, deck order, etc.
                                    // player === null means a spectator: public info only
  getResult(state) { return null /* or { winners: [...] } */ },
});
```

Card games: shuffle with the `rng` argument (Fisher–Yates), never `Math.random()`.

Then:
- export it from `packages/shared/src/index.ts`
- add it to `games` in `packages/shared/src/registry.ts`
- write `<id>.test.ts` next to it: setup, illegal moves rejected, a game played to the end,
  and that `getView` hides secrets (also from spectators: `getView(state, null)`)

## 2. Art

List what the board needs (board/tiles, pieces or cards, the island for the home map) and
generate each one with `"game": "<id>"` in `assets/prompts.json`, so the files land in
`apps/web/public/games/<id>/`. See "Art" in `AGENTS.md`. The home-map islands for upcoming games already
exist (`island-cards`, `island-dice`, `island-chess`).

## 3. Board scene (apps/web)

Create `apps/web/src/games/<id>/<Name>Scene.ts` extending `BoardScene<MyView, MyMove>`:

- `constructor() { super('<id>') }`: the scene key must equal the game id
- `build()`: create sprites once
- `draw()`: update them from `this.props` (`view`, `me`, `players`, `result`). For a spectator
  `me` is not in `players` and the view is the public one, so never assume `me` is playing. It runs on
  every state change and on resize, so position everything from `this.boardArea()`
- call `this.sendMove(move)` on input; the server decides if it is legal
- animate changes (tweens) so moves feel good

Register it in `apps/web/src/games/index.ts`: add to `boardScenes`, and set `gameId` on its
island in `islands` (this unlocks it on the home map). Winner/draw and "Chơi ván mới" are
already handled by `pages/Room/Room.tsx`.

## 4. Verify

`npm run check`, then extend `scripts/e2e.mjs` (or write a similar headless script) to play the
new game, run it against `npm run dev`, and look at the screenshots in `.e2e/`.
