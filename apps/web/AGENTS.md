# Web app (@psc/web)

Folder guide and "where do I change…" table (Vietnamese): `apps/web/README.md`.

- **React** owns app state and all plain UI: panels, forms and buttons.
- **Phaser** draws the world: the sky, the island strip and the boards.
  - React passes a `Stage` to `PhaserStage`.
  - Phaser emits events on `bridge`.
  - Anything game-like (pieces, cards, animation, drag and drop) is Phaser.
- **File placement**:
  - A component's CSS sits next to it.
  - A new screen goes in `pages/<Name>/`.
  - UI shown on every screen goes in `components/hud/`, exported from its `index.ts`.
  - React state logic goes in `hooks/`; plain helpers go in `lib/`.
- **Floating React panels** get the `hud` class.
- **Layout**: a landscape frame 720 units tall in five aspect ratios, HUD corners, board sizes and
  minimum tap/text sizes: `docs/ui-guide.md` (Vietnamese). Follow it for any screen.
- **Look**: floating sky islands, in a polished 3D-cartoon mobile-game style (2015 Vietnamese
  mobile games).
  - Panels are wood and paper, with yellow buttons (`src/styles/`).
  - The font is "Baloo 2" (`titleStyle` in Phaser).
- **Mobile first**:
  - Test a phone (390×844), and phones held sideways with `npm run shots`.
  - When the layout changes, also test a desktop size, ideally plus 360×640 and 844×390.
- **Games** are found by glob in `src/games/index.ts`: their assets, lazy clients, hub portals and
  the wip lock. `pages/Sandbox` is `/?play=<id>`.
- **Dev tools** (the DEV button, bottom-left; not in production):
  - Add a toggle or an input as one entry in `DEV_SETTINGS` (`src/lib/devTools.ts`).
  - Read it with `devSetting(key)`.
- **Assets**:
  - `imageUrl(name)` and `soundUrl(name)` give the URLs of `public/shared/` files.
  - Phaser images also go in `IMAGES` (`src/phaser/assets.ts`).
- **Sounds**:
  - Play an effect with `playSfx(name)` (`SFX` in `src/lib/sound.ts`); the app's music is
    `APP_MUSIC`.
  - Buttons click and hover by default.
  - Change or mute that per button (`<Button clickSound=… hoverSound=…>`), or per container
    (`{...buttonSounds({ click: 'none' })}`).
