# __NAME__

Rules of the game, and credits for art and sounds.

## Where things are

```
src/
  index.ts          server entry: meta (name, players, island) and rules
  client.ts         browser entry: which scenes to show
  game/             the game itself: pure TypeScript, no Phaser (runs on the server)
    model.ts          read first: State and Move
    rules.ts          setup, validateMove, applyMove, getView, getResult
    rules.test.ts     tests (npm run check)
  scenes/           what players see: Phaser, browser only
    Board.ts          the board, while a game runs
assets/             images (.webp/.png) and sounds (.wav/.mp3), used by file name
sources/            optional originals; `npm run assets -- __ID__` turns them into assets/
```

A game runs like this: `setup` makes the state, then on every move the board calls
`sendMove`, the server runs `validateMove` and `applyMove`, each player gets `getView`, and the
board redraws; `getResult` ends it. Room options, a "Tạo phòng" screen and a computer player:
see games/tic-tac-toe (the example game).

Try it alone: http://localhost:5033/?play=__ID__&players=2 (with `npm run dev` running).
