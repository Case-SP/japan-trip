# Worker

Source of the `coveted-votes` Cloudflare Worker that powers the prediction-market dashboard. Edit `src/index.js`; Cloudflare auto-deploys on push to `main`.

## One-time setup (Cloudflare → GitHub)

1. Cloudflare dashboard → **Workers & Pages → `coveted-votes` → Settings → Builds**.
2. **Connect to Git → Authorize Cloudflare** to access GitHub.
3. Pick repo `Case-SP/japan-trip`, branch `main`, **Root directory** `worker`.
4. Build command: leave blank. Deploy command: `npx wrangler deploy`.
5. Save. Cloudflare runs an initial build and now redeploys on every push.

KV binding (`VOTES`) and the `ADMIN_SECRET` env variable stay configured in the Cloudflare dashboard — they don't live in this repo.

## Endpoints

- `GET /?ids=a,b,c` — bulk market states
- `POST /signup?name=X` — new user with $1,000
- `GET /user?name=X` — user state
- `POST /buy?user=X&market=Y&side=yes|no&amount=$N` — buy shares at current price
- `POST /resolve?market=Y&outcome=yes|no&secret=…` — admin, settles all holders
- `GET /leaderboard` — top 20 by net worth

## Pricing

Each market has a virtual liquidity seed of 10 shares per side, so the price formula is `(yes + 10) / (yes + no + 20)`. Prices asymptote toward 0/1 but never reach them — markets stay tradable.
