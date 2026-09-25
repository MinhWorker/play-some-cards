# Chơi Chút Bài (Play Some Cards)

Board and card games to play with friends in the browser, on floating sky islands. Pick a game,
open a room, and your friends join from the room list, as players or to watch.

**Play:** https://play-some-cards.vercel.app

![Caro on the sky islands](docs/images/screenshot.webp)

## Run it locally (5 minutes)

You need Node 22 and [Git LFS](https://git-lfs.com) (for the source art in `assets/`).

```
git lfs install
git clone https://github.com/MinhWorker/play-some-cards.git
cd play-some-cards
npm install
npm run dev        # open http://localhost:5033
```

No accounts or secrets needed: without a database the server keeps accounts in memory. Open a
second browser window (or a private one) to play against yourself.

## What's inside

- `apps/web`: React + Vite for the UI, Phaser 4 for the world and the game boards
- `apps/server`: NestJS + Socket.IO; the server owns the rooms and checks every move
- `packages/shared`: game rules and the socket protocol, used by both

`npm run check` runs lint, type checks and tests. More commands and the full map: `AGENTS.md`.

## Contributing

Anyone is welcome, with whatever tools you like. See [CONTRIBUTING.md](CONTRIBUTING.md).
Deploying: [docs/deploy.md](docs/deploy.md).
