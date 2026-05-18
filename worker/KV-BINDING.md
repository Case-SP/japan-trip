# KV binding — what broke and how to fix it from CLI

## The problem

`coveted-votes` Worker requires a KV namespace binding named `VOTES` to read/write user accounts, market state, and votes. Every endpoint (`/signup`, `/user`, `/buy`, `/resolve`, `/leaderboard`, `/seed`) calls `env.VOTES.get/put/list` — without the binding, every call throws an unhandled error, Cloudflare returns 500 with no CORS headers, and the browser shows "Load failed."

When the Cloudflare → GitHub auto-deploy runs `npx wrangler deploy`, **Wrangler treats `wrangler.toml` as the source of truth.** Bindings configured only in the dashboard are wiped on each deploy. Our `wrangler.toml` doesn't list the KV binding, so any push silently kills the connection.

## Quick fix — restore the binding

You need three things from your Cloudflare account:

| Value | Where to find |
|---|---|
| Account ID | <https://dash.cloudflare.com> → right sidebar |
| KV namespace ID | `npx wrangler kv namespace list` (after auth) or dashboard → Workers & Pages → KV |
| API token (Workers edit scope) | <https://dash.cloudflare.com/profile/api-tokens> — create one with `Edit Cloudflare Workers` template |

### Option A — re-bind once via CLI, no code change (binding will get wiped on next push)

```bash
cd worker

# auth (browser opens, you approve)
npx wrangler login

# list KV namespaces — copy the id of the one named "votes" (or whatever you named it)
npx wrangler kv namespace list

# if no namespace exists, create one and copy the id from the output:
npx wrangler kv namespace create "votes"
```

Then add it as a dashboard-only binding (NOT recommended — gets wiped on next deploy):

```bash
# CLI doesn't have a "bind without redeploy" command — easier to use the dashboard
# (Workers & Pages → coveted-votes → Bindings → + Binding → KV namespace → VOTES → votes)
```

### Option B — bake the binding into `wrangler.toml` so it survives every deploy (recommended)

```bash
cd worker

# 1. Get the namespace id
npx wrangler kv namespace list
# → [{ "id": "abc123...", "title": "votes" }]

# 2. Append the binding to wrangler.toml
cat >> wrangler.toml <<'EOF'

[[kv_namespaces]]
binding = "VOTES"
id = "PASTE_NAMESPACE_ID_HERE"
EOF

# 3. Replace the placeholder with the real id
sed -i '' 's/PASTE_NAMESPACE_ID_HERE/abc123.../' wrangler.toml

# 4. Verify the file looks right
cat wrangler.toml

# 5. Deploy directly to test
npx wrangler deploy

# 6. Commit + push so the next git-triggered deploy keeps the binding
git add wrangler.toml
git commit -m "chore: bind KV namespace VOTES in wrangler.toml"
git push origin main
```

After this, every future `git push` → Cloudflare auto-deploy keeps the KV binding intact. No more "Load failed."

## Verify the binding is live

```bash
# the Worker URL should return JSON, not 500
curl -s "https://coveted-votes.case-945.workers.dev/?ids=test:all"
# → {"test:all":{"yes":0,"no":0,"status":"open","outcome":null}}

# signup a throwaway user
curl -s -X POST "https://coveted-votes.case-945.workers.dev/signup?name=cli-test-$(date +%s)"
# → {"name":"cli-test-...","balance":1000,"positions":{},"created":...}
```

If both return JSON, the binding is wired and the site's prediction dashboard works again.

## Restoring ADMIN_SECRET if it got wiped

`ADMIN_SECRET` is an *encrypted variable*, not a binding — `wrangler deploy` preserves dashboard-set encrypted variables by default. But if `npx wrangler deploy --keep-vars=false` ever ran or you redeployed with `wrangler.toml` overriding vars, set it again:

```bash
cd worker
npx wrangler secret put ADMIN_SECRET
# (paste the value at the prompt; not printed back)
```

## Future-proof — pin the namespace in CI

If someone else ever connects the repo to a different Cloudflare account or a fresh Worker, they'll need to repeat Option B with their own namespace ID. Keep this doc up to date as the source of truth.
