# Caro

Marks in a row on a square board, against a friend or the computer (Dễ / Vừa / Khó):
3 in a row on 3×3, 4 on 6×6, 5 on 9×9. Between games the host can change the size or swap
colors (red X always starts).

This is the example game: its layout is a good way to organize yours (`npm run new:game` starts
from the same layout). Nothing forces it; the app only needs `src/index.ts` and `src/client.ts`.

## Start here

```
src/
  index.ts          server entry: meta (name, players, island), rules, room options
  client.ts         browser entry: which scenes to show
  game/             the game itself: pure TypeScript, no Phaser (runs on the server)
    model.ts          ★ read first: State, Move, Options
    rules.ts          setup, validateMove, applyMove, getView, getResult
    board.ts          grid helpers (winning line, runs, free cells)
    bot.ts            the computer player
    *.test.ts         tests, next to what they test (npm run check)
  scenes/           what players see: Phaser, browser only
    Setup.ts          settings screen: "Tạo phòng", and "Tuỳ chỉnh" inside the room
    Board.ts          the board, while a game runs
    theme.ts          pieces, colors and tints the scenes share
assets/             images and sounds, used by file name (this.image(x, y, 'tile'), this.sfx('mark-drop'))
sources/            originals of the art (Git LFS) and prompts.json
```

## Life cycle

There is no game loop on the server: it waits for events, and each one turns the state into a
new state with the rules. (Phaser runs a frame loop in the browser, only to animate.)

| Event | Handled in | What happens |
| --- | --- | --- |
| "Tạo phòng", or "Tuỳ chỉnh" in the room | `scenes/Setup.ts` | `submit(options)`; the server checks them with `optionsSchema` and the room keeps them (the computer joins or leaves if needed) |
| "Bắt đầu", "Chơi ván mới" | `game/rules.ts` | `setup(players, rng, options)` → a new `State` |
| A tap on a free cell | `scenes/Board.ts` → `game/rules.ts` | `sendMove({ cell })` → `validateMove` → `applyMove` → new `State` |
| The computer's turn | `game/bot.ts` | after a short pause it picks a move, checked and applied like any other |
| Every new `State` | `game/rules.ts` → `scenes/Board.ts` | `getResult` (over?), `getView` for each player, then `Board.draw()` |
| The host taps a size or ⇄ after a game | `scenes/Board.ts` | `changeOptions(...)`, a shortcut to the same options; the next `setup` uses them |

Try it alone: http://localhost:5033/?play=tic-tac-toe (with `npm run dev`). "Tuỳ chỉnh" in the
sandbox opens the setup screen; the seat buttons switch whose eyes you see the board with.

## Credits

Art generated with Codex (`sources/prompts.json`). Sounds: see `assets/audio.json` in the repo
root.
