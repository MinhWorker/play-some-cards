# Caro

Marks in a row on a square board, against a friend or the computer (Dễ / Vừa / Khó):
3 in a row on 3×3, 4 on 6×6, 5 on 9×9. Between games the host can change the size or swap
colors (red X always starts).

Written with the `Game` (server) and `GameView` (browser) classes: lifecycle hooks, one `ctx`
with the whole room, events between them. `games/counter` is the smallest example; this one
adds room options, a computer player and a settings screen.

## Start here

```
src/
  index.ts          server entry: meta, gameRules(new CaroGame()), room options
  client.ts         browser entry: the settings screen and the game's screen
  game/             the logic: no Phaser (runs on the server)
    model.ts          ★ read first: State and Options
    CaroGame.ts       events and hooks: onStart, onPlace, bot
    board.ts          grid helpers (winning line, runs, free cells)
    bot.ts            the computer's brain: which cell to mark
    *.test.ts         tests, written with testGame (npm run check)
  scenes/           what players see (browser only)
    CaroView.ts       the game's screen: onCreate, onLayout, onPlace, onState, onEnd
    Setup.ts          settings screen: "Tạo phòng", and "Tuỳ chỉnh" inside the room
    theme.ts          pieces, colors and tints the scenes share
assets/             images and sounds, used by file name (this.sprite('tile'), this.sfx('mark-drop'))
sources/            originals of the art (Git LFS) and prompts.json
```

## What happens

The server has no game loop: it waits for events, and each one runs a hook that returns the
next state. (The browser runs a frame loop, only to animate.)

| When | Server (`CaroGame`) | Every screen (`CaroView`) |
| --- | --- | --- |
| "Tạo phòng" / "Tuỳ chỉnh" | options checked by `optionsSchema`, kept by the room | `Setup.ts` calls `submit(options)` |
| "Bắt đầu", "Chơi ván mới" | `onStart(ctx)` → first state | `onStart` (start sound), `onState` |
| A tap on a free cell | `send('place', { cell })` → `onPlace(ctx)`: checks, then the new state (or `reject`) | `onPlace` (piece pops in), `onState` |
| The computer's turn | `bot(ctx)` → `place` event, after a short pause | same as a tap |
| Three (four, five) in a row / full board | `ctx.finish(winners)` in `onPlace` | `onEnd` (line glows, sound), result panel |
| Host taps a size or ⇄ after a game | next `onStart` uses the new options | `changeOptions(...)` |

Try it alone: http://localhost:5033/?play=tic-tac-toe (with `npm run dev`). "Tuỳ chỉnh" in the
sandbox opens the setup screen; the seat buttons switch whose eyes you see the board with.

## Credits

Art generated with Codex (`sources/prompts.json`). Sounds: see `assets/audio.json` in the repo
root.
