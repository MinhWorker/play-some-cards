# Caro audio plan

The current 3×3 Caro scene uses a distinct wood-and-glass cue for each interaction. The sounds live in `games/tic-tac-toe/assets/` and the board plays them with `this.sfx(name)`; build them from the selected Google Cloud sources with the workflow in [generating-sfx.md](generating-sfx.md).

| Moment | Sound | Trigger |
| --- | --- | --- |
| Empty board appears for a new round | `caro-start` | Once on the first empty-board draw. |
| Player selects a cell | `caro-select` | On a selection change, if the scene adds selection before sending a move. |
| X is accepted | `mark-drop` | When the authoritative board gains an X. |
| O is accepted | `caro-o-place` | When the authoritative board gains an O. |
| A winning line appears | `caro-line-complete` | Once on the transition from no line to a line. |
| Round ends in a win | shared `game-win` / `game-lose` | Use the existing result hook; avoid overlapping it with `caro-win`. |
| Round ends in a draw | `caro-draw` | Once when a full board has no winning line. |
| A move is rejected | `caro-invalid` | Once if the scene exposes rejected-move feedback. |

The scene currently uses `caro-start`, `mark-drop`, `caro-o-place`, `caro-line-complete`, and `caro-draw`. `caro-select` and `caro-invalid` are ready if the interaction flow needs them later.
