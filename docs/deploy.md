# Deploy and CI

## CI (GitHub Actions)

`.github/workflows/ci.yml` runs `npm run check` and `npm run build` on every push to `main`
and on every pull request.

## Web app → Vercel

The GitHub repo is connected to a Vercel project. Every push to `main` deploys production;
every PR gets a preview URL. Build settings live in `vercel.json` (repo root).

Vercel env var: `VITE_SERVER_URL` = public URL of the game server (see below). It is baked in at
build time, so redeploy after changing it.

## Game server

Vercel cannot run the server: it needs a long-running process with WebSockets, and Vercel
functions are short-lived. Host `apps/server` on something that runs Node processes
(Render, Railway, Fly.io, a VPS). Settings for any of them:

- Install: `npm ci`
- Build: `npm run build -w @psc/shared && npm run build -w @psc/server`
- Start: `npm start -w @psc/server`
- Env: `PORT` is read automatically. Health check: `GET /api/health`.

Keep exactly one server instance: rooms live in its memory.

## Simplest option: one process, no Vercel

`npm run build && npm start -w @psc/server` serves the web app and the game on port 3000.
Friends on the same Wi-Fi can open `http://<your-LAN-IP>:3000`.
