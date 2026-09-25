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
  hooks/              React hooks: room connection, profile, sounds, URL state
  lib/                Plain TypeScript (no React): socket, sound, storage, asset URLs
  styles/             theme.css (colors, font) and base.css (panels, buttons, modals)
  phaser/             The Phaser side: stage, bridge, base board scene, scenes/, objects/
  games/<id>/         One board scene per game (e.g. tic-tac-toe/TicTacToeScene.ts)
public/
  shared/             Images and sounds used across the app
  games/<id>/         Images and sounds used by one game only
  audio/              Sounds not sorted yet (experiments)
```

Imports that leave the current folder use `@/`, which means `src/`: `import { request } from '@/lib/socket'`.

## Where do I find…

| I want to change… | Look in |
| --- | --- |
| A screen's layout or text | `src/pages/<Page>/` |
| The profile badge, speaker button, cloud transition, toasts | `src/components/hud/` |
| Colors, font, button and panel styles | `src/styles/` |
| How a board looks or reacts to taps | `src/games/<id>/<Name>Scene.ts` |
| The island map or the sky | `src/phaser/scenes/HubScene.ts`, `SkyScene.ts` |
| Talking to the server | `src/lib/socket.ts`, `src/hooks/useRoom.ts` |
| Music and sound effects | `src/lib/sound.ts` + `assets/audio.json` |
| Images | `assets/prompts.json` (generated) + `src/phaser/assets.ts` |
| Game rules | `packages/shared/src/games/<id>/` (not in this app) |

See `AGENTS.md` at the repo root for conventions and `docs/adding-a-game.md` to add a game.
