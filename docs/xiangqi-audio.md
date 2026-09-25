# Xiangqi sound plan

The Xiangqi pack uses dry wooden piece sounds with restrained bell accents. It has no voice lines or board music. The app's shared `game-win` and `game-lose` cues cover the result screen.

| Moment | Sound | Trigger |
| --- | --- | --- |
| Board and players are ready | `xiangqi-start` | Once when a new game first appears; skip on reconnect. |
| Select a piece | `xiangqi-piece-select` | On a local selection change. |
| Make a regular move | `xiangqi-move` | Once after the server accepts a non-capturing move. |
| Capture a piece | `xiangqi-capture` | Instead of `xiangqi-move` after the server accepts a capture. |
| Put the opposing general in check | `xiangqi-check` | Once when the game state transitions into check. |
| Turn reaches the local player | `xiangqi-turn` | On a transition into the local player's turn, not on room load or reconnect. |
| Server rejects a move | `xiangqi-illegal` | Once when a move is rejected, if the UI exposes that feedback. |
| Game ends | shared `game-win` / `game-lose` | Reuse the app result cues, including checkmate. |

Regenerate the seven source cues with `python3 scripts/generate-xiangqi-sfx.py`, then build their app-ready files with:

```bash
python3 scripts/generate-xiangqi-sfx.py
npm run audio -- xiangqi-start xiangqi-piece-select xiangqi-move xiangqi-capture xiangqi-check xiangqi-turn xiangqi-illegal
```

Generated source WAVs are written under `assets/games/xiangqi/audio/` (gitignored). The committed mono WAVs go under `apps/web/public/games/xiangqi/audio/`; the sounds are registered in `apps/web/src/lib/sound.ts` for a future Xiangqi scene to use with `playSfx(name)`.
