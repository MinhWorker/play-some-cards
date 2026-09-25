# Generate game sound effects with Google Cloud Veo

Use Veo to create short sound effects as synchronized audio in generated video, then extract the best take and cut its audio into WAVs. The catalog follows the floating-island art and games shown on the home screen: shared hub sounds, Caro, Tiến Lên, Cờ Cá Ngựa, and Cờ Tướng. Prompts request one dry effect per video, with silence around it, so each source can become an instant-playing app sound.

## Generate candidate videos

The scripts use the active `gcloud` account and bill project `rcloud-507417` by default. Verify that this is the intended billing project before changing `--project`; the user must have access to it and the Vertex AI API must be enabled.

```bash
gcloud auth list
gcloud services enable aiplatform.googleapis.com --project=rcloud-507417
python3 scripts/generate-game-sfx.py --jobs 4
```

By default, this requests four 8-second, 720p Veo 3.1 standard candidates for each of the 56 sound IDs in the catalog (the app's effects plus each game's). Choose a quicker or lighter model and fewer candidates when broad coverage matters more than alternates:

```bash
python3 scripts/generate-game-sfx.py --model fast --candidates 1 --jobs 2
```

Supported models are `standard`, `fast`, and `lite`; candidate count is 1–4. The script asks Veo for one video per API request and saves each successful result immediately, so a retry resumes from the missing candidates. Source videos are kept locally under `assets/shared/audio/sfx-candidates/` and `assets/games/<id>/audio/sfx-candidates/` (Git LFS). Rerunning reuses complete candidate sets; `--only button-click,ludo-dice-roll` limits a run to selected IDs, and `--force` regenerates that model's existing sets.

## Select, trim, and build the audio

Select one take for every cue, detect the quiet lead-in and tail from the audio envelope, and write the source and trim to `assets/audio.json`:

```bash
python3 scripts/prepare-game-sfx.py
npm run audio
```

The selected source videos are copied to `assets/{shared,games/<id>}/audio/sfx-selected/`. The build step extracts mono 16-bit WAVs into `apps/web/public/shared/audio/` or `games/<id>/assets/`. Commit the `assets/audio.json` mappings, the WAVs and the picked videos in `sfx-selected/` (Git LFS); the other takes in `sfx-candidates/` stay local (gitignored). The app plays its own effects with `playSfx(name)` (`SFX` in `apps/web/src/lib/sound.ts`); a game's board plays `this.sfx(name)` with no list to update.

Prepare or build only part of the catalog with comma-separated names:

```bash
python3 scripts/prepare-game-sfx.py --only island-click,caro-win
npm run audio -- island-click caro-win
```

## Catalog

| Owner | Sound IDs |
| --- | --- |
| Shared island hub | `button-click`, `button-hover`, `island-hover`, `island-click`, `island-locked`, `cloud-spread`, `game-win`, `game-lose` |
| [Caro](caro-audio.md) | `mark-drop`, `caro-select`, `caro-o-place`, `caro-line-complete`, `caro-start`, `caro-win`, `caro-draw`, `caro-invalid` |
| [Tiến Lên](tien-len-audio.md) | `tien-len-deal`, `tien-len-card-select`, `tien-len-card-play`, `tien-len-pass`, `tien-len-turn`, `tien-len-last-card`, `tien-len-combo`, `tien-len-special-cut`, `tien-len-special-hand`, `tien-len-trick-clear`, `tien-len-bomb`, `tien-len-win` |
| [Cờ Cá Ngựa](co-ca-ngua-audio.md) | `ludo-dice-roll`, `ludo-dice-six`, `ludo-token-leave`, `ludo-token-select`, `ludo-token-step`, `ludo-token-safe`, `ludo-token-bump`, `ludo-token-return`, `ludo-token-finish`, `ludo-turn`, `ludo-game-start`, `ludo-win`, `ludo-pawn-jump`, `ludo-final-lap`, `ludo-tie`, `ludo-no-move` |
| [Cờ Tướng](xiangqi-audio.md) | `xiangqi-start`, `xiangqi-piece-select`, `xiangqi-move`, `xiangqi-capture`, `xiangqi-check`, `xiangqi-turn`, `xiangqi-illegal`, `xiangqi-checkmate`, `xiangqi-capture-heavy`, `xiangqi-decisive-move`, `xiangqi-draw`, `xiangqi-game-win` |

At the Google Cloud list price checked on 2026-09-25, Veo 3.1 standard video plus audio at 720p is $0.40 per video; Fast is $0.10, and Lite is $0.05. Four standard takes for all 56 cues would be 224 videos (about $89.60 before applicable discounts or taxes). See [Veo 3.1](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/veo/3-1-generate) and [Agent Platform pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing) for current model behavior and rates.
