# Deploy and CI

## CI (GitHub Actions)

`.github/workflows/ci.yml` runs `npm run check` and `npm run build` on every push to `main`
and on every pull request.

## Web app → Vercel

GitHub repo `MinhWorker/play-some-cards` is connected to Vercel project
`minhnks-projects/play-some-cards` (production: https://play-some-cards.vercel.app).
Every push to `main` deploys production; every PR gets a preview URL. Build settings live in `vercel.json` (repo root).

Vercel env var: `VITE_SERVER_URL` = public URL of the game server (see below). It is baked in at
build time, so redeploy after changing it.

## Game server

**Status: not deployed yet.** Until it is, the Vercel site loads but cannot create rooms.

Do not host the server on Vercel. Vercel Functions do support WebSockets, but connections are
closed at the function's max duration and each connection may land on a different instance.
Rooms live in one process's memory, so two friends in the same room could end up on different
instances. Moving to Vercel would require storing rooms in Redis plus a Socket.IO Redis adapter. Host `apps/server` on something that runs Node processes
(Render, Railway, Fly.io, a VPS). Settings for any of them:

- Install: `npm ci`
- Build: `npm run build -w @psc/shared && npm run build -w @psc/server`
- Start: `npm start -w @psc/server`
- Env: `PORT` is read automatically. Health check: `GET /api/health`.

Keep exactly one server instance: rooms live in its memory.

## Simplest option: one process, no Vercel

`npm run build && npm start -w @psc/server` serves the web app and the game on port 3000.
Friends on the same Wi-Fi can open `http://<your-LAN-IP>:3000`.
