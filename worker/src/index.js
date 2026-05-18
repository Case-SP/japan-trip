const STARTING_BALANCE = 1000;
const SEED = 10;
const cors = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type"
};

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/$/, "");
    const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: cors });
    const getMarket = async (id) => JSON.parse((await env.VOTES.get("market:" + id)) || '{"yes":0,"no":0,"status":"open","outcome":null}');
    const putMarket = (id, m) => env.VOTES.put("market:" + id, JSON.stringify(m));
    const getUser = async (n) => { const r = await env.VOTES.get("user:" + n); return r ? JSON.parse(r) : null; };
    const putUser = (u) => env.VOTES.put("user:" + u.name, JSON.stringify(u));
    const normName = (s) => (s || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 20);
    const adminOk = () => env.ADMIN_SECRET && url.searchParams.get("secret") === env.ADMIN_SECRET;
    const priceOf = (m, side) => {
      const yE = (m.yes || 0) + SEED, nE = (m.no || 0) + SEED;
      return side === "yes" ? yE / (yE + nE) : nE / (yE + nE);
    };

    if (req.method === "GET" && (path === "" || path === "/")) {
      const ids = (url.searchParams.get("ids") || "").split(",").map(s => s.trim()).filter(Boolean);
      const out = {};
      for (const id of ids) out[id] = await getMarket(id);
      return json(out);
    }

    if (req.method === "POST" && path === "/signup") {
      const name = normName(url.searchParams.get("name"));
      if (!name || name.length < 2) return json({ error: "name 2-20 chars, a-z 0-9 _-" }, 400);
      if (await getUser(name)) return json({ error: "taken" }, 409);
      const u = { name, balance: STARTING_BALANCE, positions: {}, created: Date.now() };
      await putUser(u);
      return json(u);
    }

    if (req.method === "GET" && path === "/user") {
      const name = normName(url.searchParams.get("name"));
      if (!name) return json({ error: "name required" }, 400);
      const u = await getUser(name);
      if (!u) return json({ error: "not found" }, 404);
      return json(u);
    }

    if (req.method === "POST" && path === "/buy") {
      const name = normName(url.searchParams.get("user"));
      const mid = url.searchParams.get("market");
      const side = url.searchParams.get("side");
      const amount = parseFloat(url.searchParams.get("amount") || "0");
      if (!name || !mid || (side !== "yes" && side !== "no") || !(amount > 0)) return json({ error: "bad params" }, 400);
      const u = await getUser(name);
      if (!u) return json({ error: "user not found" }, 404);
      if (u.balance < amount) return json({ error: "insufficient funds", user: u }, 400);
      const m = await getMarket(mid);
      if (m.status !== "open") return json({ error: "market closed", market: m }, 400);
      const price = priceOf(m, side);
      const shares = amount / price;
      m[side] = (m[side] || 0) + shares;
      u.balance -= amount;
      if (!u.positions[mid]) u.positions[mid] = { yes: 0, no: 0 };
      u.positions[mid][side] = (u.positions[mid][side] || 0) + shares;
      await Promise.all([putMarket(mid, m), putUser(u)]);
      return json({ market: m, user: u, shares, price });
    }

    if (req.method === "POST" && path === "/resolve") {
      if (!adminOk()) return json({ error: "unauthorized" }, 401);
      const mid = url.searchParams.get("market");
      const outcome = url.searchParams.get("outcome");
      if (!mid || (outcome !== "yes" && outcome !== "no")) return json({ error: "bad params" }, 400);
      const m = await getMarket(mid);
      m.status = "resolved";
      m.outcome = outcome;
      m.resolved_at = Date.now();
      const listing = await env.VOTES.list({ prefix: "user:" });
      let settled = 0;
      for (const key of listing.keys) {
        const raw = await env.VOTES.get(key.name);
        if (!raw) continue;
        const u = JSON.parse(raw);
        const pos = u.positions && u.positions[mid];
        if (!pos) continue;
        u.balance += outcome === "yes" ? (pos.yes || 0) : (pos.no || 0);
        delete u.positions[mid];
        await putUser(u);
        settled++;
      }
      await putMarket(mid, m);
      return json({ market: m, settled });
    }

    if (req.method === "GET" && path === "/leaderboard") {
      const listing = await env.VOTES.list({ prefix: "user:" });
      const mCache = {};
      const out = [];
      for (const key of listing.keys) {
        const raw = await env.VOTES.get(key.name);
        if (!raw) continue;
        const u = JSON.parse(raw);
        let posVal = 0;
        for (const mid of Object.keys(u.positions || {})) {
          if (!mCache[mid]) mCache[mid] = await getMarket(mid);
          const m = mCache[mid];
          const p = u.positions[mid];
          if (m.status === "resolved") posVal += m.outcome === "yes" ? (p.yes || 0) : (p.no || 0);
          else {
            const pY = priceOf(m, "yes");
            posVal += (p.yes || 0) * pY + (p.no || 0) * (1 - pY);
          }
        }
        out.push({ name: u.name, total: u.balance + posVal });
      }
      out.sort((a, b) => b.total - a.total);
      return json({ users: out.slice(0, 20) });
    }

    // POST /seed?secret=…&count=50 — admin: spin up fake users + random bets
    if (req.method === "POST" && path === "/seed") {
      if (!adminOk()) return json({ error: "unauthorized" }, 401);
      const count = Math.min(200, parseInt(url.searchParams.get("count") || "50"));
      const today = url.searchParams.get("date") || (() => {
        const d = new Date();
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      })();
      const NAMES = [
        "anna","jules","max","sara","ben","lily","noah","ivy","leo","zoe",
        "kim","ari","ravi","mae","ezra","luna","milo","ada","rex","june",
        "theo","iris","kai","wren","felix","nora","owen","ruth","elsa","joel",
        "harper","soren","vera","neil","tara","jude","sky","rio","indy","cass",
        "ezra","mila","dax","odin","reese","sage","tess","wilder","yuki","zane"
      ];
      const ITEMS = [
        "cartier-panthere-watch",
        "dior-saddle-bag",
        "uniqlo-assorted-shirts",
        "comme-des-garcons-halter-top",
        "issey-miyake-fiber-mini",
        "x-sailor-moon-shirt"
      ];
      const MARKETS = [];
      ITEMS.forEach(s => { MARKETS.push(s + ":all"); MARKETS.push(s + ":today:" + today); });
      const STAKES = [10, 10, 25, 25, 50, 50, 100];
      const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

      const mState = {};
      for (const mid of MARKETS) mState[mid] = await getMarket(mid);

      let created = 0, trades = 0;
      const userPuts = [];
      for (let i = 0; i < count; i++) {
        const base = NAMES[i % NAMES.length];
        const handle = `${base}${10 + i}`.toLowerCase();
        if (await getUser(handle)) continue;
        const u = { name: handle, balance: STARTING_BALANCE, positions: {}, created: Date.now() };
        const bias = Math.random(); // 0=NO-leaning, 1=YES-leaning
        const numBets = 2 + Math.floor(Math.random() * 5);
        for (let j = 0; j < numBets; j++) {
          const mid = pick(MARKETS);
          const m = mState[mid];
          if (!m || m.status !== "open") continue;
          const side = Math.random() < bias ? "yes" : "no";
          const amount = pick(STAKES);
          if (u.balance < amount) continue;
          const yE = (m.yes || 0) + SEED, nE = (m.no || 0) + SEED;
          const price = side === "yes" ? yE / (yE + nE) : nE / (yE + nE);
          const shares = amount / price;
          m[side] = (m[side] || 0) + shares;
          u.balance -= amount;
          if (!u.positions[mid]) u.positions[mid] = { yes: 0, no: 0 };
          u.positions[mid][side] += shares;
          trades++;
        }
        userPuts.push(putUser(u));
        created++;
      }
      await Promise.all(userPuts);
      await Promise.all(Object.keys(mState).map(mid => putMarket(mid, mState[mid])));
      return json({ created, trades });
    }

    return json({ error: "not found" }, 404);
  }
};
