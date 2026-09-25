# Tiến lên sound plan

The pack uses short, tactile card sounds and warm pitched cues suited to a casual table game. It has no voice lines or background music. Result screens reuse the app's shared `game-win` and `game-lose` cues.

| Moment | Sound | Trigger |
| --- | --- | --- |
| Initial hand arrives | `tien-len-deal` | Once when the dealt hand first appears; skip on reconnects. |
| Select or unselect a card | `tien-len-card-select` | On a local selection change. Keep the level quiet if selection can happen rapidly. |
| Play a single card | `tien-len-card-play` | Once after the server accepts a single-card play. Use the combination cues for grouped plays. |
| Pass | `tien-len-pass` | Once after the server accepts a pass. |
| Turn reaches the local player | `tien-len-turn` | Only on a transition into the local player's turn, not on room load. |
| Any player is down to one card | `tien-len-last-card` | Once per hand on the first one-card state. |
| Ordinary pair, triple, or straight | `tien-len-combo` | Instead of the single-card cue after an accepted combination. |
| A valid cut or bomb | `tien-len-special-cut` | Instead of the single-card cue for a special play that cuts the current trick, according to the selected rule variant. |
| Four-of-a-kind bomb | `tien-len-bomb` | Instead of `tien-len-special-cut` when a four-of-a-kind is played. |
| A rare strongest hand | `tien-len-special-hand` | Instead of the single-card cue for a top-tier hand supported by the selected rule variant. |
| All other players pass and a new trick starts | `tien-len-trick-clear` | Once when control returns to the trick leader. |
| Local player wins the hand | `tien-len-win` | Once when the authoritative result changes to a local win; other results can reuse shared `game-lose`. |

The current pack has 12 cloud-generated SFX IDs built into `games/tien-len/assets/`. Generate/select their synchronized-audio video sources and build the mono WAVs with the shared workflow in [generating-sfx.md](generating-sfx.md). The Tiến Lên board can call `this.sfx(name)` after accepted moves or authoritative state transitions.
