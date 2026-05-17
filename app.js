(function () {
  const data = (window.TRIP && window.TRIP.entries) || [];
  const feed = document.getElementById("feed");
  const datesEl = document.getElementById("trip-dates");
  if (window.TRIP && window.TRIP.dates) datesEl.textContent = window.TRIP.dates;

  const CITY_COORDS = {
    sapporo:   { x: 142, y: 52,  lx: 152, ly: 56,  anchor: "start" },
    hakodate:  { x: 128, y: 76,  lx: 138, ly: 80,  anchor: "start" },
    sendai:    { x: 178, y: 142, lx: 188, ly: 145, anchor: "end" },
    tokyo:     { x: 176, y: 196, lx: 188, ly: 199, anchor: "end" },
    kanazawa:  { x: 118, y: 168, lx: 108, ly: 165, anchor: "end" },
    nagoya:    { x: 152, y: 195, lx: 158, ly: 207, anchor: "start" },
    kyoto:     { x: 135, y: 184, lx: 122, ly: 180, anchor: "end" },
    osaka:     { x: 128, y: 197, lx: 118, ly: 202, anchor: "end" },
    nara:      { x: 138, y: 202, lx: 148, ly: 213, anchor: "start" },
    hiroshima: { x: 105, y: 212, lx: 95,  ly: 215, anchor: "end" },
    fukuoka:   { x: 78,  y: 272, lx: 68,  ly: 275, anchor: "end" }
  };

  const coveted = (window.TRIP && window.TRIP.coveted) || [];
  const covGrid = document.getElementById("coveted-grid");
  if (covGrid) {
    if (coveted.length) {
      coveted.forEach(c => {
        const card = document.createElement("article");
        card.className = "cov-card";
        const imgBlock = c.img
          ? `<div class="cov-img"><img loading="lazy" src="${escapeAttr(c.img)}" alt="${escapeAttr(c.name)}"></div>`
          : `<div class="cov-img"><div class="cov-placeholder">${escapeHtml(c.name)}</div></div>`;
        const statusCls = c.status ? ` ${c.status.toLowerCase()}` : "";
        card.innerHTML = `
          ${imgBlock}
          <div class="cov-brand">${escapeHtml(c.brand || "")}</div>
          <div class="cov-name">${escapeHtml(c.name || "")}</div>
          ${c.status ? `<span class="cov-status${statusCls}">${escapeHtml(c.status)}</span>` : ""}
        `;
        covGrid.appendChild(card);
      });
    } else {
      covGrid.parentElement.style.display = "none";
    }
  }

  const totalMin = data.reduce((s, e) => s + ((e.shop && e.shop.minutes) || 0), 0);
  const totalEyed = data.reduce((s, e) => s + ((e.shop && e.shop.eyed) || 0), 0);
  const totalBought = data.reduce((s, e) => s + ((e.shop && e.shop.bought) || 0), 0);
  document.getElementById("stat-min").textContent = totalMin;
  document.getElementById("stat-eyed").textContent = totalEyed;
  document.getElementById("stat-bought").textContent = totalBought;

  const citiesG = document.getElementById("map-cities");
  const routeG = document.getElementById("map-route");
  const NS = "http://www.w3.org/2000/svg";
  const visitedCities = [];
  const seen = new Set();
  [...data].sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .forEach(e => { if (e.city && !seen.has(e.city)) { seen.add(e.city); visitedCities.push(e.city); } });

  const routePts = visitedCities.map(c => CITY_COORDS[c]).filter(Boolean)
    .map(c => `${c.x},${c.y}`).join(" ");
  if (routePts) {
    const line = document.createElementNS(NS, "polyline");
    line.setAttribute("points", routePts);
    routeG.appendChild(line);
  }

  visitedCities.forEach(city => {
    const c = CITY_COORDS[city];
    if (!c) return;
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "city");
    g.setAttribute("data-city", city);
    g.setAttribute("tabindex", "0");
    g.setAttribute("role", "button");
    g.setAttribute("aria-label", "Filter to " + city);
    const dot = document.createElementNS(NS, "circle");
    dot.setAttribute("cx", c.x); dot.setAttribute("cy", c.y); dot.setAttribute("r", 2.6);
    const ring = document.createElementNS(NS, "circle");
    ring.setAttribute("class", "ring");
    ring.setAttribute("cx", c.x); ring.setAttribute("cy", c.y); ring.setAttribute("r", 5.5);
    const t = document.createElementNS(NS, "text");
    t.setAttribute("x", c.lx); t.setAttribute("y", c.ly);
    t.setAttribute("text-anchor", c.anchor);
    t.textContent = city.charAt(0).toUpperCase() + city.slice(1);
    g.appendChild(ring); g.appendChild(dot); g.appendChild(t);
    g.addEventListener("click", () => applyFilter(city));
    g.addEventListener("keypress", ev => { if (ev.key === "Enter") applyFilter(city); });
    citiesG.appendChild(g);
  });

  const fmtDate = iso => {
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  data.forEach((e, i) => {
    const entry = document.createElement("article");
    entry.className = "entry";
    entry.dataset.city = e.city || "";
    entry.dataset.shop = e.shop ? "1" : "0";
    entry.dataset.index = String(i);
    const ratio = e.ratio ? ` ${e.ratio}` : "";
    const num = String(i + 1).padStart(2, "0");
    const photoHtml = e.src
      ? `<div class="photo${ratio}" data-index="${i}"><img loading="lazy" src="${e.src}" alt="${escapeAttr(e.caption || e.location)}"></div>`
      : `<div class="photo${ratio}"><div class="placeholder">${escapeHtml(e.location || "Add photo")}</div></div>`;
    let ledger = "";
    if (e.shop) {
      const bits = [];
      if (e.shop.minutes != null) bits.push(`<strong>${e.shop.minutes} min</strong>`);
      if (e.shop.eyed != null) bits.push(`${e.shop.eyed} eyed`);
      if (e.shop.bought != null) bits.push(`${e.shop.bought} bought`);
      ledger = `<p class="wait">${escapeHtml(e.shop.name || "Shop")} &mdash; ${bits.join(" &middot; ")}</p>`;
    }
    entry.innerHTML = `
      <div class="entry-head">
        <span class="entry-num">${num}</span>
        <span class="entry-loc">${escapeHtml(e.location || "")}</span>
      </div>
      ${photoHtml}
      ${e.caption ? `<p class="entry-cap">${escapeHtml(e.caption)}</p>` : ""}
      <div class="entry-meta">
        <span class="date">${fmtDate(e.date)}</span>
        ${e.shop ? `<span>Wife&rsquo;s shop</span>` : ""}
      </div>
      ${ledger}
    `;
    feed.appendChild(entry);
  });

  const chips = document.querySelectorAll(".chip");
  function applyFilter(f) {
    chips.forEach(c => c.classList.toggle("is-on", c.dataset.filter === f));
    document.querySelectorAll(".entry").forEach(el => {
      if (f === "all") el.classList.remove("hidden");
      else if (f === "shop") el.classList.toggle("hidden", el.dataset.shop !== "1");
      else el.classList.toggle("hidden", el.dataset.city !== f);
    });
    document.querySelectorAll("#map-cities .city").forEach(g => {
      g.classList.toggle("is-on", g.dataset.city === f);
    });
    window.scrollTo({ top: document.querySelector(".feed").offsetTop - 8, behavior: "smooth" });
  }
  chips.forEach(c => c.addEventListener("click", () => applyFilter(c.dataset.filter)));

  const lb = document.getElementById("lightbox");
  const lbImg = document.getElementById("lb-img");
  const lbCap = document.getElementById("lb-cap");
  let visible = [];
  let cur = 0;

  function openLb(index) {
    visible = Array.from(document.querySelectorAll(".entry:not(.hidden)"))
      .map(el => data[Number(el.dataset.index)])
      .filter(e => e && e.src);
    if (!visible.length) return;
    const startEntry = data[index];
    cur = Math.max(0, visible.indexOf(startEntry));
    showCur();
    lb.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function showCur() {
    const e = visible[cur];
    if (!e) return;
    lbImg.src = e.src;
    lbImg.alt = e.caption || e.location || "";
    lbCap.textContent = e.caption ? `${e.caption} — ${e.location}` : (e.location || "");
  }
  function closeLb() { lb.hidden = true; document.body.style.overflow = ""; }
  function next() { if (!visible.length) return; cur = (cur + 1) % visible.length; showCur(); }
  function prev() { if (!visible.length) return; cur = (cur - 1 + visible.length) % visible.length; showCur(); }

  feed.addEventListener("click", ev => {
    const ph = ev.target.closest(".photo");
    if (!ph || !ph.dataset.index) return;
    openLb(Number(ph.dataset.index));
  });
  lb.querySelector(".lb-close").addEventListener("click", closeLb);
  lb.querySelector(".lb-prev").addEventListener("click", prev);
  lb.querySelector(".lb-next").addEventListener("click", next);
  document.addEventListener("keydown", ev => {
    if (lb.hidden) return;
    if (ev.key === "Escape") closeLb();
    if (ev.key === "ArrowRight") next();
    if (ev.key === "ArrowLeft") prev();
  });

  let tx = 0, ty = 0, tt = 0;
  lb.addEventListener("touchstart", ev => {
    const t = ev.changedTouches[0];
    tx = t.clientX; ty = t.clientY; tt = Date.now();
  }, { passive: true });
  lb.addEventListener("touchend", ev => {
    const t = ev.changedTouches[0];
    const dx = t.clientX - tx, dy = t.clientY - ty, dt = Date.now() - tt;
    if (dt > 600) return;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      dx < 0 ? next() : prev();
    } else if (dy > 80 && Math.abs(dy) > Math.abs(dx)) {
      closeLb();
    }
  }, { passive: true });

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function escapeAttr(s) { return escapeHtml(s); }
})();
