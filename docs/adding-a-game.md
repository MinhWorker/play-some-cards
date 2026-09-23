# Adding a game

Use tic-tac-toe as the reference: `packages/shared/src/games/tic-tac-toe/` and
`apps/web/src/games/tic-tac-toe/`.

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
  id: '<id>', name: 'My Game', minPlayers: 2, maxPlayers: 4, moveSchema,
  setup(players, rng) { ... },
  validateMove(state, move, player) { return null /* or an error message */ },
  applyMove(state, move, player, rng) { return { ...state /* new object, no mutation */ } },
  getView(state, player) { ... },   // strip other players' hands, deck order, etc.
  getResult(state) { return null /* or { winners: [...] } */ },
});
```

Card games: shuffle with the `rng` argument (Fisher–Yates), never `Math.random()`.

Then:
- export it from `packages/shared/src/index.ts`
- add it to `games` in `packages/shared/src/registry.ts`
- write `<id>.test.ts` next to it: setup, illegal moves rejected, a game played to the end,
  and that `getView` hides secrets

## 2. Board (apps/web)

Create `apps/web/src/games/<id>/Board.tsx` exporting a component that takes
`BoardProps<MyView, MyMove>` (from `apps/web/src/games/index.ts`), and register it in `boards`.
The board only renders `view` and calls `sendMove(move)`; the server decides if it is legal.
Winner/draw and "Play again" are already handled by `pages/Room.tsx`.

## 3. Verify

`npm run check`, then `npm run dev` and play it in two browser tabs (or one normal + one private
window so they have separate sessions).
