# japan-trip

Mobile-first photo journal of a trip through Japan, with a running ledger of shopping-wait stats. Pure HTML/CSS/JS — no build step, no external fonts. One runtime dependency (Leaflet) for the map sheet.

## View

<https://case-sp.github.io/japan-trip/>

Auto-deploys on every push to `main` (~30s).

## Adding entries

Edit `data.js`. Each entry follows:

```js
{
  id: "beams",                  // unique short slug
  date: "2026-05-17",           // ISO date — drives feed order
  city: "osaka",                // lowercase slug — used by the city filter
  location: "Osaka",            // small muted line under the title
  src: "photos/beams-osaka.jpg",
  gallery: ["photos/extra.jpg"],// optional additional images; tap card to crossfade
  body: "1/4 Beams visited.",   // optional body copy; max-width 50% so it never crosses the image midline
  shop: {                       // optional — minutes feed the headline ledger
    name: "BEAMS",
    minutes: 12,                // shown inline-right on the title row, in full ink
    eyed: 0,                    // optional, falls into the small stats line
    bought: 1                   // optional
  }
}
```

Drop photos into `photos/` and reference them via `src` (relative path only).

## Adding coveted items

Edit `data.js` `coveted: [...]`. Each card follows:

```js
{ brand: "BEAMS", name: "Cotton beanie", img: "photos/beams-beanie.jpg", status: "bought" }
```

`status` is freeform — current convention: `watching` / `hunting` / `bought`. Missing `brand` renders as `—` to keep cards uniform.
