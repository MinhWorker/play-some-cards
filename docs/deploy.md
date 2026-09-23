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

## Game server → Render

Render service `play-some-cards-server` (free plan, Singapore), config mirrored in `render.yaml`:
- URL: https://play-some-cards-server.onrender.com (health: `/api/health`)
- Dashboard: https://dashboard.render.com/web/srv-daq1sc0473hc73e7bsl0
- Auto-deploys on push to `main` when `apps/server/**`, `packages/shared/**` or
  `package-lock.json` change.
- Free plan sleeps after ~15 min idle; the first visit takes ~30-60s to wake it
  (the web app shows a "Connecting…" banner meanwhile). Sleeping or redeploying wipes all rooms.
- CLI: `render services`, `render logs -r srv-daq1sc0473hc73e7bsl0`,
  `render deploys create srv-daq1sc0473hc73e7bsl0`.

Vercel's `VITE_SERVER_URL` (production + preview) points at this URL.

Do not move the server to Vercel. Vercel Functions do support WebSockets, but connections are
closed at the function's max duration and each connection may land on a different instance.
Rooms live in one process's memory, so two friends in the same room could end up on different
instances. Keep exactly one server instance for the same reason.

## Simplest option: one process, no Vercel

`npm run build && npm start -w @psc/server` serves the web app and the game on port 8033.
Friends on the same Wi-Fi can open `http://<your-LAN-IP>:8033`.
