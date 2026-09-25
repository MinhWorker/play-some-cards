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
| A rare strongest hand | `tien-len-special-hand` | Instead of the single-card cue for a top-tier hand supported by the selected rule variant. |
| All other players pass and a new trick starts | `tien-len-trick-clear` | Once when control returns to the trick leader. |
| Game ends | shared `game-win` / `game-lose` | Reuse the app result cues. |

The eight original pitched/card-rush cues can be regenerated with `python3 scripts/generate-tien-len-sfx.py`. That script uses the local playing-card recording plus Python's standard library and ffmpeg. Build or rebuild the committed browser assets with:

```bash
python3 scripts/generate-tien-len-sfx.py
npm run audio -- tien-len-deal tien-len-pass tien-len-turn tien-len-last-card tien-len-combo tien-len-special-cut tien-len-special-hand tien-len-trick-clear tien-len-card-select tien-len-card-play
```

Every effect is a mono WAV so it starts without MP3 encoder padding. Originals live in `assets/games/tien-len/audio/`; the built files in `games/tien-len/assets/`. The Tiến lên board plays them with `this.sfx(name)` when its authoritative view changes.
