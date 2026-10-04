# Art and audio (the app's and the games')

- Any way of making art or sound is fine: Codex, drawn by people, rendered in Blender, drawn or
  synthesized in code, or free resources from the web.
- Pick what looks and sounds best for a card/board game in the app's style.
- Credit a source when it's easy, in the game's README or in LICENSE-ASSETS.md.
- Use only free, clearly allowed assets, and never sell anything.

## Where files live

- **A game**:
  - `games/<id>/assets/` holds files used as they are.
  - The optional `games/<id>/sources/` holds originals; `npm run assets -- <id>` makes
    `assets/<name>.webp` from them.
  - The game's image on the home map is `island`.
- **The app**:
  - Originals are in `assets/` (`shared/`, older game audio in `games/<id>/audio/`, and unsorted
    experiments in `audio/`).
  - App-ready files are in `apps/web/public/shared/`.
- **Storage**: originals are Git LFS, and a new binary type needs a pattern in `.gitattributes`.
  App-ready files are plain git.
- `avatar-long.webp` is a real photo (`assets/shared/images/Long-look-at-u.jpg`) inside the
  generated `avatar-frame`. It is not generated art.

## Codex images

1. Add a prompt:
   - for the app, to `assets/prompts.json`;
   - for a game, to `games/<id>/sources/prompts.json`.
2. Run `npm run gen:asset -- <name>` (or `<id>/<name>`). Useful options:
   - `--missing` generates only the images that don't exist yet.
   - `--edit <name> "<change>"` tweaks an image and keeps its style. Prefer it for small changes.
3. Look at the result.

Notes on the options and on Codex:
- Objects use `transparent: true`. Check the alpha: Codex sometimes paints a fake checkerboard.
- **Animation frames** use `preserveCanvas: true`, plus `"from": "<base>"` so each frame is drawn
  by editing the base image. The prompt then describes only what changes. Generate the base first.
- An image takes about 1.5 minutes, and the timeout is 10 minutes. A slow run is usually Codex
  keying its own background. Ask it for a flat magenta background, then key that yourself.

## Sounds

- **The app-ready files are the real ones**, with no build step:
  - `apps/web/public/shared/audio/`;
  - `games/<id>/assets/`;
  - unsorted ones in `apps/web/public/audio/`.
- Originals (Veo clips in `assets/**/sfx-selected/`, `psc-*` files, downloads in
  `assets/**/sfx/`) are kept as an archive.
- **To change a sound**, edit the app-ready file in place with ffmpeg, then measure it with
  ffprobe. A sound may also be made once from an original.
  - Cut: `-ss`/`-t` plus a short `afade`.
  - Faster at the same pitch: `atempo`.
  - Louder: `volume`.
- **Formats**:
  - Short effects are mono 16-bit WAV, because MP3 starts with about 25 ms of padding.
  - Music is 128 kbps MP3.
- **Music**: a game's music is every `music*` file in its `assets/`, and a random one plays on its
  board. The app's music is `APP_MUSIC` in `apps/web/src/lib/sound.ts`.
- Asset provenance and license exceptions live in `LICENSE-ASSETS.md` and the game README.
  Find playback triggers in the game scenes; avoid duplicating them in audio planning documents.
