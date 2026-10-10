---
name: phone-check
description: Check a Godot screen or game table on real phone, tablet and desktop sizes held sideways, headless, and judge layout and sharpness. Use after changing a screen, a game's table or its art.
---

# Check a screen on phone sizes

Never open a visible browser; everything here is headless.

1. **Build and serve.** `npm run godot:export -- --debug`, then a dev server on free ports with
   no database (the environment may hold a real `DATABASE_URL`):
   `DATABASE_URL= PORT=8133 WEB_PORT=5133 BOT_DELAY_MS=200 npm run dev` in the background, and
   wait for `curl -sf localhost:8133/api/health` and `localhost:5133/godot/`.
2. **Shoot.** One page on every device profile, sideways, at its pixel density with notch
   insets:
   - a game's table: `npm run shots -- http://localhost:5133 --path '/godot/?play=<id>' --wait 15000`
   - a hub screen: `--path '/godot/'`, or a UI kit page: `--path '/godot/?gallery=2'`
   - `-- --audit` also lists images drawn bigger than their pixels.
   Files land in `.shots/<device>.png` (scaled) and `.shots/<device>-crop.png` (1:1).
3. **Look** at every device with the Read tool, the smallest first (`android-720p` 640×360,
   `iphone-se`, then `ipad` and `laptop`). Check:
   - nothing under the ☰ square (top left, 88 × 88 design units) or the notch;
   - nothing overlaps or runs off screen (buttons over the board, long names, counters);
   - text is readable at phone size; tap targets are at least the kit's button size;
   - the layout matches `docs/experience.md` (Bàn or Hành động);
   - sharpness on the `-crop.png` files, not the scaled ones.
4. **Fix** in `_layout()` (design units: 720 tall, 960–1600 wide), export again, shoot again.
5. **Stop the dev server** by its PID when done (never `pkill -f`).

For a whole flow (lobby → game → result) on a phone, run the e2e scenario instead:
`npm run e2e -- http://localhost:5133 --only godot-<id>`; screenshots in `.e2e/godot-<id>/`.
