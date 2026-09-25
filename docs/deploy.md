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
  (the web app shows a "Connecting…" banner meanwhile). Sleeping or redeploying wipes all rooms
  (accounts stay: they are in Neon).
- CLI: `render services`, `render logs -r srv-daq1sc0473hc73e7bsl0`,
  `render deploys create srv-daq1sc0473hc73e7bsl0`.

Vercel's `VITE_SERVER_URL` (production + preview) points at this URL.

Do not move the server to Vercel. Vercel Functions do support WebSockets, but connections are
closed at the function's max duration and each connection may land on a different instance.
Rooms live in one process's memory, so two friends in the same room could end up on different
instances. Keep exactly one server instance for the same reason.

## Database → Neon Postgres

Stores accounts (`users`) and login tokens (`sessions`); rooms stay in memory.
Neon project `play-some-cards` (id `royal-block-89471600`, free plan, `aws-ap-southeast-1`
= Singapore, next to the Render server). Database `psc`, role `psc_owner`.
- Branch `main` = production. Render's `DATABASE_URL` holds its **pooled** URL.
- Branch `dev` = local development. Its pooled URL is in `apps/server/.env` (gitignored;
  the server loads it with `process.loadEnvFile()`).
- Get a URL again: `neonctl connection-string <main|dev> --project-id royal-block-89471600
  --database-name psc --pooled`, then change `sslmode=require` to `sslmode=verify-full`
  (node-postgres warns otherwise).
- The server works without `DATABASE_URL` (tests, LAN play); `/api/health` then reports `db: "off"`
  and accounts are kept in memory (gone after a restart).
- Free plan: 0.5 GB storage per branch, compute sleeps after 5 min idle (first query wakes it in
  ~1 s).
- CLI: `neonctl` (installed globally with npm; `neonctl auth` to log in).

Schema and migrations use Drizzle ORM: edit `apps/server/src/db/schema.ts`, run
`npm run db:generate -w @psc/server` (writes SQL into `apps/server/drizzle/`, commit it). The server
applies pending migrations when it starts. `npm run db:studio -w @psc/server` opens a table browser.

## Simplest option: one process, no Vercel

`npm run build && npm start -w @psc/server` serves the web app and the game on port 8033.
Friends on the same Wi-Fi can open `http://<your-LAN-IP>:8033`.
