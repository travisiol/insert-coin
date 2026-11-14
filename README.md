# Insert Coin

Drop a post or an idea. Get a pixel fighter, a Solana coin, and an agent that works with its creator fees.

Next.js 14 web app (Vercel) + a long-running agent worker (Railway / Fly.io / any VPS) + Postgres.

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000, uses an embedded Postgres in .data/ when DATABASE_URL is unset
```

Launching stays disabled locally until the secrets below are set.

## The 3 server secrets

| Name | What | How to get it |
| --- | --- | --- |
| `DATABASE_URL` | Postgres connection string | Neon or Railway Postgres |
| `WALLET_ENCRYPTION_KEY` | 32 random bytes, base64 (encrypts every agent wallet) | `npm run keys` |
| `FUNDER_WALLET_SECRET` | dedicated wallet that pays ~0.03 SOL per launch | `npm run keys`, then send it a small SOL balance |

Losing `WALLET_ENCRYPTION_KEY` makes every agent wallet unrecoverable. Never commit these values.

## Deploy

1. Create the database, then `DATABASE_URL=... npm run db:setup` (idempotent).
2. Vercel: import the repo, add the 3 secrets, deploy (zero config).
3. Worker: same repo on Railway/Fly, same 3 secrets, start command `npm run worker`.
4. Send SOL to the funder address. Daily budget cap: 1 SOL (`lib/server/launch.ts`).

Global emergency stop: `update settings set value = 'true' where key = 'emergency_stop';`

## Useful scripts

- `npm run signals` — read-only check of the 6 strategies on live market data (no DB, no transactions).
- `npm run typecheck`, `npm run build`.

## Layout

- `app/` pages and API routes (`/api/launch`, `/api/meta/[mint]`, `/api/img/[mint]`, `/api/world`, `/api/stream`, `/api/owner`, `/api/og`, ...)
- `components/` UI (cabinet, sprites, arcade canvas, studio, terminal, mini-game)
- `lib/engine/` Fighter Engine: seed, keywords, names, stories, personality, 32x32 sprites, 9 animation states
- `lib/agent/` worker logic: fees, allocation, buyback & burn, strategies, risk, levels
- `lib/chain/` Solana RPC queue, PumpPortal, Jupiter, burn
- `lib/db/` schema (`schema.sql`) and client
- `worker/` the agent loop
