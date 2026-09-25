# Cờ Cá Ngựa audio plan

The 16 SFX cues are mapped with `"game": "co-ca-ngua"` in `assets/audio.json` and built into `games/co-ca-ngua/assets/`; the board plays them with `this.sfx(name)`. Generate/select sources and build the WAV files with [generating-sfx.md](generating-sfx.md). Trigger sounds from accepted state changes so rejected or replayed moves do not produce duplicate effects.

| Moment | Sound | Trigger |
| --- | --- | --- |
| A race starts | `ludo-game-start` | Once when the first race state appears; skip on reconnect. |
| Roll the die | `ludo-dice-roll` | Once for the current player's accepted roll, ending when the result appears. |
| The die shows six | `ludo-dice-six` | After the result is known, layered lightly at the end of the roll. |
| A horse leaves its stable | `ludo-token-leave` | Once when it enters the track. |
| Select a horse | `ludo-token-select` | On local selection change. |
| Move one space | `ludo-token-step` | For each confirmed animated step; lower volume for long moves. |
| Land on a safe tile | `ludo-token-safe` | Once when the token finishes its move on a protected tile. |
| Bump an opponent | `ludo-token-bump` | Once when the move captures an opponent token. |
| Return to stable | `ludo-token-return` | When the bumped token animation returns to its stable. |
| Reach home | `ludo-token-finish` | Once when a token enters its home slot. |
| Jump animation | `ludo-pawn-jump` | Use instead of `ludo-token-step` for a special jump move. |
| Enter the final lap | `ludo-final-lap` | Once on the first transition to a player's final path. |
| Turn changes | `ludo-turn` | On a transition into the local player's turn, not on room load. |
| No legal move | `ludo-no-move` | Once when the resolved die result leaves every token unable to move. |
| Race ends in a tie | `ludo-tie` | Once for an authoritative tied result. |
| Local player wins | `ludo-win` or shared `game-win` | Choose one result cue so victory sounds do not overlap. |
