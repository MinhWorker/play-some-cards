# Xiangqi sound plan

The Cờ Tướng pack uses dry wooden piece sounds with restrained bell accents. It has no voice lines or board ambience.

| Moment | Sound | Trigger |
| --- | --- | --- |
| Board and players are ready | `xiangqi-start` | Once when a new game first appears; skip on reconnect. |
| Select a piece | `xiangqi-piece-select` | On a local selection change. |
| Make a regular move | `xiangqi-move` | Once after the server accepts a non-capturing move. |
| Capture a piece | `xiangqi-capture` | Instead of `xiangqi-move` after the server accepts a capture. |
| Consequential capture | `xiangqi-capture-heavy` | Instead of `xiangqi-capture` for an especially important capture. |
| Put the opposing general in check | `xiangqi-check` | Once when the game state transitions into check. |
| Turn reaches the local player | `xiangqi-turn` | On a transition into the local player's turn, not on room load or reconnect. |
| Server rejects a move | `xiangqi-illegal` | Once when a move is rejected, if the UI exposes that feedback. |
| A decisive winning move | `xiangqi-decisive-move` | Once after the final move is accepted. |
| Checkmate | `xiangqi-checkmate` | Once when the match transitions to a checkmate result. |
| Draw | `xiangqi-draw` | Once when the authoritative result is a draw. |
| Local player wins | `xiangqi-game-win` or shared `game-win` | Choose one result cue so victory sounds do not overlap. |

The current pack has 12 cloud-generated SFX IDs built into `games/xiangqi/assets/`. Use the shared video generation, trim, and WAV workflow in [generating-sfx.md](generating-sfx.md). The Xiangqi board can call `this.sfx(name)` after accepted moves or authoritative check, turn, and result transitions.
