# Art and audio (the app's and the games')

- Any way of making art or sound is fine: Codex, drawn by people, rendered in Blender, drawn or
  synthesized in code, or free resources from the web.
- Pick what looks and sounds best for a card/board game in the app's style.
- Credit a source when it's easy, in the game's README or in LICENSE-ASSETS.md.
- Use only free, clearly allowed assets, and never sell anything.

## Where files live

- **A game**:
  - `games/<id>/assets/` holds the app-ready files (full size, plus atlases and normals).
  - The optional `games/<id>/sources/` holds originals; `npm run assets -- <id>` makes
    `assets/<name>.webp` from them.
  - `games/<id>/godot/` holds the copies the Godot table uses (`art/`, `sounds/`, `music/`): the
    folder is the game's pack, so copy only what it draws or plays.
  - The game's picture on its hub card is `island`.
- **The app**:
  - Originals are in `assets/` (`shared/`, older game audio in `games/<id>/audio/`, and unsorted
    experiments in `audio/`).
  - App-ready files are in `assets/app/` (`images/`, `audio/`, unsorted sounds in
    `audio/unsorted/`). The Godot client copies what it uses into its own folders
    (`apps/client/addons/xomdao_sdk/ui/`, `apps/client/hub/`).
- **Storage**: originals are Git LFS, and a new binary type needs a pattern in `.gitattributes`.
  App-ready files (`assets/app/`, `games/<id>/assets/`, `godot/`) are plain git.
- **Avatars and frames are separate images** of the same 256×256 canvas: `avatar-<id>.webp` is a
  round, frameless picture (a disc of radius 100), `frame-<id>.webp` the ring drawn over it. The ids
  are `AVATARS` and `FRAMES` in `packages/shared/src/account.ts`; `avatar-bot` keeps its own frame.
  - `avatar-boy`, `avatar-girl` and `avatar-long` had the gold frame cut off (`frame-gold` is the
    generated ring). `avatar-long` is a real photo (`assets/shared/images/Long-look-at-u.jpg`), not
    generated art.
  - `node scripts/avatars.mjs frames` recolors `frame-gold` into the other frames;
    `node scripts/avatars.mjs emoji <dir>` makes the animal avatars from Microsoft's Fluent Emoji 3D
    (MIT, credited in LICENSE-ASSETS.md). Add a new id to both the script and `account.ts`.

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

## Blender sprites and normals

- Shared materials, geometry, camera setup and upper-left light rig live in `tools/blender/xomdao_bake/`.
  Chess, checkers and go use them; Cờ tỷ phú keeps its existing scripts.
- `npm run blender -- <id> [names…]` runs every `games/<id>/sources/render*.py` in name order;
  each script bakes only its own names from the list (all when empty). `npm run setup:blender`
  installs bpy + Pillow (`tools/blender/requirements.txt`) into a Python 3.13 venv in `.tools/blender`,
  which `npm run blender` then uses. Without it, it runs `blender` (with Pillow).
  `XOMDAO_BLENDER_PYTHON` selects another Python with bpy, `XOMDAO_BLENDER_BIN` another Blender. Direct `python x.py -- <names>` and
  `blender -b --python x.py -- <names>` work too. PNG intermediates stay in ignored `.blender/`;
  commit Python sources and app-ready files, without adding LFS originals or `.blend` files.
- `assets/<name>.normal.webp` pairs with image/atlas `<name>`. Same dimensions, frame placement
  and unrotated/untrimmed canvases, and **opaque** (RGB, no alpha): a premultiplied upload would
  shrink the vectors where alpha is below 255 and mis-shade edges. Empty canvas is
  the flat normal; edges blend toward it (`opaque_normals` in xomdao_bake). Camera-space +X right, +Y up, +Z toward the viewer;
  flat normals are (128,128,255). Bake with Raw (Standard applies sRGB), disable dithering and
  save normals losslessly. Never run them through image cropping, grading or lossy compression.
- Pack many pieces into one aligned atlas pair (chess's `pieces`) rather than one file each.
- Cloth is a seamless 256×256 POT tile; the table tiles it (`TextureRect.STRETCH_TILE`) to cover
  the whole screen.
- Art baked before the shared rig keeps its own settings so a re-bake matches what is committed:
  `setup(…, lights=LEGACY_RIG)` (chess board/buttons, checkers at 96 samples) and go's disk rig.
  Only change a game's rig when you re-bake all of its art.
- Verify the bake with `python tools/blender/test_bake.py` or
  `blender -b --python tools/blender/test_bake.py`.

## Sounds

- **The app-ready files are the real ones**, with no build step:
  - `assets/app/audio/`;
  - `games/<id>/assets/`;
  - unsorted ones in `assets/app/audio/unsorted/`.
  A Godot table plays its copies in `godot/sounds/`; copy again after changing one.
- Originals (Veo clips in `assets/**/sfx-selected/`, `xomdao-*` files, downloads in
  `assets/**/sfx/`) are kept as an archive.
- **To change a sound**, edit the app-ready file in place with ffmpeg, then measure it with
  ffprobe. A sound may also be made once from an original.
  - Cut: `-ss`/`-t` plus a short `afade`.
  - Faster at the same pitch: `atempo`.
  - Louder: `volume`.
- **Formats**:
  - Short effects are mono 16-bit WAV, because MP3 starts with about 25 ms of padding.
  - Music is 128 kbps MP3.
- **Music**: a game's music is every track in its `godot/music/`; the hub's `HubMusic` plays a
  random one while its table shows. The app's own tracks (`music-hub-*`, `music-sky-*`) are in
  `assets/app/audio/`.
- Asset provenance and license exceptions live in `LICENSE-ASSETS.md` and the game README.
  Find playback triggers in the game's `godot/` scripts; avoid duplicating them in audio planning
  documents.
