---
name: make-asset
description: Make an image or sound for a Xóm Đảo game or the hub (Codex prompt, Blender bake or code), then bring it into the Godot client. Use when a game needs card art, sprites, a board texture or a sound.
---

# Make an asset and bring it into Godot

Read first: `assets/AGENTS.md` (how and where), `docs/art-direction.md` (the look: Vietnamese
village by the sea, warm paper and lacquer, thick outlines).

## Pick the way

| Need | Way |
| --- | --- |
| Painted picture: card art, board, background, avatar | Codex prompt → `npm run gen:asset` |
| Pieces that need a consistent 3D look or normal maps | Blender script → `npm run blender` |
| Simple shapes, rings, placeholder | Draw in GDScript (`_draw`) or a script in `scripts/` |
| Sound effect | Free source or synthesized; mono 16-bit WAV; trim with ffmpeg |
| Music | 128 kbps MP3, named `music*` |

## Codex image

1. Add a prompt to `games/<id>/sources/prompts.json` (or `assets/prompts.json` for the hub):
   subject, style from art-direction.md, size, `transparent: true` for objects.
2. `npm run gen:asset -- <id>/<name>`; small fixes with `--edit <name> "<change>"`.
3. Look at the file (Read the image). Check the alpha is real, not a painted checkerboard.
4. `npm run assets -- <id>` makes `games/<id>/assets/<name>.webp`.

## Blender bake

1. Write `games/<id>/sources/render_<thing>.py` with `tools/blender/xomdao_bake` (shared camera,
   materials, upper-left light rig).
2. `npm run setup:blender` once, then `npm run blender -- <id> [names…]`.
3. Commit the Python and the app-ready files, not `.blend` files or PNG intermediates.

## Into the Godot client

1. Copy the app-ready file into the game's Godot folder: `games/<id>/godot/art/<name>.webp`
   (sounds: `godot/sounds/<name>.wav`). Keep names short; the folder is the game's pack.
2. `npm run godot -- --headless --import` (or `npm run godot:check`) so Godot writes
   `<name>.webp.import`; commit it next to the file.
3. Use it with `preload("res://content/<id>/art/<name>.webp")`; a hub asset goes in
   `apps/client/` and is used by the hub only.
4. Card art for the hub's game card is a 2:3 picture; until a game ships one, the hub draws a
   stand-in (`apps/client/hub/card_art.gd`).
5. Check it in place: a headless screenshot (`phone-check` skill), and judge sharpness on the
   `-crop.png` files.

Credit sources in the game README or `LICENSE-ASSETS.md`. Only free, clearly allowed assets.
