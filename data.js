// Entry schema:
//   { id, date (YYYY-MM-DD), city, location, src?, ratio?, caption, shop?: {name, minutes, eyed, bought} }
// Drop photos into /photos/ and reference them as e.g. src: "photos/0002.jpg".
// `ratio` is width/height (e.g. 4/5 = 0.8); used so placeholders reserve space.

window.CITY_COORDS = {
  Sapporo:   { x: 197, y: 69 },
  Hakodate:  { x: 188, y: 95 },
  Aomori:    { x: 188, y: 115 },
  Sendai:    { x: 191, y: 164 },
  Nikko:     { x: 172, y: 195 },
  Kanazawa:  { x: 128, y: 197 },
  Tokyo:     { x: 173, y: 215 },
  Kamakura:  { x: 170, y: 223 },
  Hakone:    { x: 163, y: 225 },
  Nagoya:    { x: 131, y: 225 },
  Kyoto:     { x: 114, y: 229 },
  Nara:      { x: 116, y: 235 },
  Osaka:     { x: 110, y: 235 },
  Hiroshima: { x: 65,  y: 241 },
  Matsuyama: { x: 69,  y: 253 },
  Fukuoka:   { x: 33,  y: 257 },
};

window.ENTRIES = [
  {
    id: 1,
    date: "2026-03-21",
    city: "Tokyo",
    location: "Shibuya Scramble",
    caption: "first night — the city as a single moving signal.",
  },
  {
    id: 2,
    date: "2026-03-22",
    city: "Tokyo",
    location: "Daikanyama",
    caption: "three coats tried on; the shopkeeper bowed at each refusal.",
    shop: { name: "Okura", minutes: 35, eyed: 9, bought: 1 },
  },
  {
    id: 3,
    date: "2026-03-24",
    city: "Kanazawa",
    location: "Higashi Chaya",
    caption: "gold leaf in the window, dust on the sill.",
    shop: { name: "Hakuza", minutes: 22, eyed: 6, bought: 1 },
  },
  {
    id: 4,
    date: "2026-03-26",
    city: "Kyoto",
    location: "Arashiyama bamboo grove",
    caption: "morning rain, no other footsteps.",
  },
  {
    id: 5,
    date: "2026-03-27",
    city: "Kyoto",
    location: "Gion side street",
    caption: "vintage Issey behind a sliding door — she went quiet for an hour.",
    shop: { name: "Komehyo Gion", minutes: 58, eyed: 14, bought: 2 },
  },
  {
    id: 6,
    date: "2026-03-28",
    city: "Osaka",
    location: "Dotonbori",
    caption: "neon spilled across the canal like a held breath.",
  },
  {
    id: 7,
    date: "2026-03-30",
    city: "Hakone",
    location: "Tenzan Onsen",
    caption: "steam, cedar, the small clatter of buckets.",
  },
  {
    id: 8,
    date: "2026-04-01",
    city: "Sapporo",
    location: "Susukino at dusk",
    caption: "snow still tucked in shaded corners — april in name only.",
    shop: { name: "BEAMS Sapporo", minutes: 41, eyed: 11, bought: 2 },
  },
];
