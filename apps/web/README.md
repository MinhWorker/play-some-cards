# @psc/web

The game's web app: React for the UI, Phaser 4 for the game world, Vite to build it.
Run it from the repo root with `npm run dev` (web on http://localhost:5033).

The screen has two layers. Phaser draws the world on a full-screen canvas: the sky, the island
map and the game boards. React draws the UI on top of it: panels, buttons and forms.
`src/phaser/bridge.ts` is the only link between the two.

## Folders

```
src/
  main.tsx            Entry point: global styles, then <App />
  App.tsx             Picks the page and tells Phaser what to draw
  pages/              One folder per screen (component + its CSS + its sub-components)
    Home/             Island map (the islands themselves are drawn by Phaser)
    GameRooms/        One game's live room list
    Room/             Inside a room: room bar, "waiting" panel, result panel
  components/
    hud/              UI shown on every screen: profile badge, sound button,
                      cloud transition, toasts. Import from '@/components/hud'
    ui/               Small building blocks (Button)
  hooks/              React hooks: login, room connection, sounds, URL state
  lib/                Plain TypeScript (no React): socket, login, sound, asset URLs
  styles/             theme.css (colors, font) and base.css (panels, buttons, modals)
  phaser/             The Phaser side: stage, bridge, scenes/ (boot, sky, hub), objects/
  games/index.ts      Finds every game in the repo's games/ folder (assets, board code)
public/
  shared/             Images and sounds used across the app
  audio/              Sounds not sorted yet (experiments)
```

Imports that leave the current folder use `@/`, which means `src/`: `import { request } from '@/lib/socket'`.

## Where do I find…

| I want to change… | Look in |
| --- | --- |
| A screen's layout or text | `src/pages/<Page>/` |
| The profile badge, speaker button, cloud transition, toasts | `src/components/hud/` |
| Colors, font, button and panel styles | `src/styles/` |
| How a board looks or reacts to taps | `games/<id>/src/<Name>Scene.ts` (repo root) |
| The island map or the sky | `src/phaser/scenes/HubScene.ts`, `SkyScene.ts` |
| Talking to the server | `src/lib/socket.ts`, `src/hooks/useRoom.ts` |
| Login and accounts | `src/pages/Login/`, `src/lib/auth.ts`, `src/hooks/useAccount.ts` |
| Music and sound effects | `src/lib/sound.ts` + `assets/audio.json` |
| The app's images | `assets/prompts.json` (generated) + `src/phaser/assets.ts` |
| Game rules | `games/<id>/src/rules.ts` (repo root) |

See `AGENTS.md` at the repo root for conventions and `docs/making-a-game.md` to make a game.
