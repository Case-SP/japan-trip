# japan-trip

Mobile-first photo gallery for a trip through Japan. Pure HTML/CSS/JS — no build step.

## View
After pushing to `main`:
<https://cdn.jsdelivr.net/gh/Case-SP/japan-trip@main/index.html>

## Adding entries
Edit `data.js`. Each entry follows:

```js
{
  id: 12,
  date: "2026-03-28",     // YYYY-MM-DD, drives feed order & map route
  city: "Osaka",          // must match a key in CITY_COORDS to plot on map
  location: "Dotonbori",
  src: "photos/0012.jpg", // optional; omit for a placeholder tile
  ratio: 4/5,             // optional; width/height, helps reserve layout space
  caption: "neon spilled across the canal like a held breath.",
  shop: {                 // optional; presence flags entry for the "wife's shops" filter
    name: "Komehyo Gion",
    minutes: 58,          // auto-summed into headline metrics
    eyed: 14,
    bought: 2,
  },
}
```

Drop image files into `photos/` and reference them via `src`.
