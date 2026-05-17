# japan-trip

Mobile-first photo journal of a trip through Japan, with a running ledger of shopping-wait stats. Pure HTML/CSS/JS — no build step, no dependencies, no external fonts.

## View

After pushing to `main`:
<https://cdn.jsdelivr.net/gh/Case-SP/japan-trip@main/index.html>

jsDelivr caches branch-pinned URLs for ~12 hours. To force-refresh after a push, open this once (returns JSON, you'll see "success"):
<https://purge.jsdelivr.net/gh/Case-SP/japan-trip@main/index.html>

## Adding entries

Edit `data.js`. Each entry follows:

```js
{
  id: "001",                    // unique short string
  date: "2026-05-12",           // ISO date — drives feed order and map route
  city: "tokyo",                // lowercase slug — must match a key in CITY_COORDS (app.js)
  location: "Shibuya, Tokyo",   // human-readable
  src: "photos/001.jpg",        // optional — placeholder shown if absent
  ratio: "tall",                // optional — "wide" | "tall" | "square" (default 4:5)
  caption: "Neon doing the talking.",
  shop: {                       // optional — presence flags entry for the "Wife's shops" filter
    name: "Okura",
    minutes: 47,                // auto-summed into the headline ledger
    eyed: 14,
    bought: 1
  }
}
```

Drop photos into `photos/` and reference them via `src` (relative path only).
