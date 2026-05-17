(function () {
  const data = (window.TRIP && window.TRIP.entries) || [];

  // Cloudflare Worker URL — set this once you've deployed the votes Worker.
  // Leave empty until then; dashboard will render but voting is disabled.
  const PREDICT_WORKER_URL = "https://coveted-votes.case-945.workers.dev";

  // Real lat/lon for visited cities — used by Leaflet
  const CITY_LATLON = {
    sapporo:   [43.07, 141.35],
    hakodate:  [41.77, 140.73],
    aomori:    [40.82, 140.74],
    sendai:    [38.27, 140.87],
    nikko:     [36.72, 139.60],
    kanazawa:  [36.56, 136.66],
    tokyo:     [35.68, 139.69],
    kamakura:  [35.32, 139.55],
    hakone:    [35.23, 139.03],
    nagoya:    [35.18, 136.91],
    kyoto:     [35.01, 135.77],
    osaka:     [34.69, 135.50],
    nara:      [34.69, 135.83],
    hiroshima: [34.39, 132.46],
    matsuyama: [33.84, 132.77],
    fukuoka:   [33.59, 130.40]
  };

  /* ── Coveted ─────────────────────────────────────────── */
  const coveted = (window.TRIP && window.TRIP.coveted) || [];
  const covGrid = document.getElementById("coveted-grid");
  if (covGrid) {
    if (coveted.length) {
      coveted.forEach(c => {
        const card = document.createElement("article");
        card.className = "cov-card";
        const srcs = [c.img, ...(c.gallery || [])].filter(Boolean);
        const imgBlock = srcs.length
          ? `<div class="cov-img-wrap">${srcs.map((s, i) =>
              `<img loading="lazy" src="${escapeAttr(s)}" class="cov-img${i === 0 ? " is-on" : ""}" alt="${escapeAttr(c.name)}" onerror="this.style.visibility='hidden'">`
            ).join("")}</div>`
          : `<div class="cov-placeholder"></div>`;
        const statusCls = c.status ? ` ${c.status.toLowerCase()}` : "";
        card.dataset.count = String(Math.max(1, srcs.length));
        card.dataset.index = "0";
        card.innerHTML = `
          ${imgBlock}
          <div class="cov-meta">
            <div class="cov-brand">${escapeHtml(c.brand || "—")}</div>
            <div class="cov-name">${escapeHtml(c.name || "")}</div>
            ${c.status ? `<div class="cov-status${statusCls}">${escapeHtml(c.status)}</div>` : ""}
          </div>
        `;
        covGrid.appendChild(card);
        if (srcs.length > 1) {
          const wrap = card.querySelector(".cov-img-wrap");
          wrap.style.cursor = "pointer";
          wrap.addEventListener("click", () => {
            const imgs = card.querySelectorAll(".cov-img");
            let idx = parseInt(card.dataset.index, 10);
            const next = (idx + 1) % srcs.length;
            card.dataset.index = next;
            imgs.forEach((img, i) => img.classList.toggle("is-on", i === next));
          });
        }
      });
    } else {
      covGrid.parentElement.style.display = "none";
    }
  }

  /* ── Ledger totals ───────────────────────────────────── */
  const totalMin = data.reduce((s, e) => s + ((e.shop && e.shop.minutes) || 0), 0);
  const totalEyed = data.reduce((s, e) => s + ((e.shop && e.shop.eyed) || 0), 0);
  const totalBought = data.reduce((s, e) => s + ((e.shop && e.shop.bought) || 0), 0);
  document.getElementById("stat-min").textContent = totalMin;
  document.getElementById("stat-eyed").textContent = totalEyed;
  document.getElementById("stat-bought").textContent = totalBought;

  /* ── Visited cities (in date order) ──────────────────── */
  const visitedCities = [];
  const seen = new Set();
  [...data].sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .forEach(e => { if (e.city && !seen.has(e.city)) { seen.add(e.city); visitedCities.push(e.city); } });

  /* ── Filter bar + vertical feed ──────────────────────── */
  const fmtCity = c => c.charAt(0).toUpperCase() + c.slice(1);
  const feedEl = document.getElementById("feed");
  const filterBarEl = document.getElementById("filter-bar");

  const sortedEntries = [...data].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const seenCities = new Set();
  const cityOrder = [];
  sortedEntries.forEach(e => {
    if (e.city && !seenCities.has(e.city)) { seenCities.add(e.city); cityOrder.push(e.city); }
  });

  function buildEntryHTML(entry) {
    const srcs = [entry.src, ...(entry.gallery || [])].filter(Boolean);
    const imgs = srcs.length
      ? srcs.map((s, i) => `<img loading="lazy" src="${escapeAttr(s)}" class="entry-img${i === 0 ? " is-on" : ""}" alt="" onerror="this.style.visibility='hidden'">`).join("")
      : "";
    const primary = entry.shop ? entry.shop.name : entry.location;
    const placeText = entry.shop ? entry.location : "";
    const timeText = entry.shop && entry.shop.minutes != null ? `${entry.shop.minutes} min` : "";
    let statsText = "";
    if (entry.shop) {
      const p = [];
      if (entry.shop.eyed != null) p.push(`${entry.shop.eyed} eyed`);
      if (entry.shop.bought != null) p.push(`${entry.shop.bought} bought`);
      statsText = p.join(" · ");
    }
    const bodyText = entry.body || "";
    return `
      <article class="entry" data-id="${escapeAttr(entry.id)}" data-city="${escapeAttr(entry.city || "")}" data-count="${Math.max(1, srcs.length)}" data-index="0">
        ${imgs ? `<div class="entry-img-stack">${imgs}</div>` : ""}
        <div class="entry-meta">
          <div class="entry-row-title">
            <span class="entry-shop">${escapeHtml(primary || "")}</span>
            ${timeText ? `<span class="entry-time">${escapeHtml(timeText)}</span>` : ""}
          </div>
          ${bodyText ? `<p class="entry-body">${escapeHtml(bodyText)}</p>` : ""}
          ${placeText ? `<div class="entry-place">${escapeHtml(placeText)}</div>` : ""}
          ${statsText ? `<div class="entry-stats">${escapeHtml(statsText)}</div>` : ""}
        </div>
      </article>
    `;
  }

  function renderFilterBar() {
    const items = [{ key: "all", label: "All" }, ...cityOrder.map(c => ({ key: c, label: fmtCity(c) }))];
    filterBarEl.innerHTML = items.map(it => `
      <button class="filter-seg${it.key === "all" ? " is-on" : ""}" data-filter="${escapeAttr(it.key)}" role="tab" aria-selected="${it.key === "all"}">
        <span class="filter-line" aria-hidden="true"></span>
        <span class="filter-label">${escapeHtml(it.label)}</span>
      </button>
    `).join("");
    filterBarEl.querySelectorAll(".filter-seg").forEach(btn => {
      btn.addEventListener("click", () => applyFilter(btn.dataset.filter));
    });
  }

  function applyFilter(filter) {
    filterBarEl.querySelectorAll(".filter-seg").forEach(b => {
      const on = b.dataset.filter === filter;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    feedEl.querySelectorAll(".entry").forEach(el => {
      if (filter === "all") el.classList.remove("hidden");
      else el.classList.toggle("hidden", el.dataset.city !== filter);
    });
  }

  function renderFeed() {
    feedEl.innerHTML = sortedEntries.map(buildEntryHTML).join("");
    feedEl.querySelectorAll(".entry").forEach(entry => {
      const count = parseInt(entry.dataset.count, 10);
      if (count <= 1) return;
      const stack = entry.querySelector(".entry-img-stack");
      if (!stack) return;
      stack.addEventListener("click", () => {
        const imgs = entry.querySelectorAll(".entry-img");
        let idx = parseInt(entry.dataset.index, 10);
        const next = (idx + 1) % count;
        entry.dataset.index = next;
        imgs.forEach((img, i) => img.classList.toggle("is-on", i === next));
      });
    });
  }

  renderFilterBar();
  renderFeed();

  /* ── Map sheet (Leaflet, lazy) ───────────────────────── */
  const mapTrigger = document.getElementById("map-trigger");
  const mapSheet = document.getElementById("map-sheet");
  const mapBackdrop = document.getElementById("map-backdrop");
  const mapClose = document.getElementById("map-close");
  let leafletMap = null;
  let cityMarkers = {};

  function initLeafletMap() {
    if (leafletMap || typeof L === "undefined") return;
    leafletMap = L.map("leaflet-map", {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: true
    });
    L.control.zoom({ position: "bottomright" }).addTo(leafletMap);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19
    }).addTo(leafletMap);

    const visitedCoords = visitedCities.map(c => CITY_LATLON[c]).filter(Boolean);
    if (visitedCoords.length > 1) {
      L.polyline(visitedCoords, {
        color: "#2a2a2a",
        weight: 1.4,
        opacity: 0.55,
        dashArray: "3 5"
      }).addTo(leafletMap);
    }

    visitedCities.forEach(city => {
      const xy = CITY_LATLON[city];
      if (!xy) return;
      const marker = L.circleMarker(xy, {
        radius: 5,
        color: "#2a2a2a",
        weight: 1,
        fillColor: "#2a2a2a",
        fillOpacity: 1
      }).addTo(leafletMap);
      marker.bindTooltip(city.charAt(0).toUpperCase() + city.slice(1), {
        permanent: true,
        direction: "right",
        offset: [8, 0],
        className: "city-label"
      });
      marker.on("click", () => {
        applyFilter(city);
        closeMapSheet();
      });
      cityMarkers[city] = marker;
    });

    if (visitedCoords.length) {
      leafletMap.fitBounds(L.latLngBounds(visitedCoords), { padding: [40, 40] });
    } else {
      leafletMap.setView([36.5, 138], 5);
    }
  }

  function updateMapHighlight(filter) {
    Object.keys(cityMarkers).forEach(city => {
      const m = cityMarkers[city];
      if (filter === city) {
        m.setStyle({ radius: 7, fillColor: "#2a2a2a" });
      } else {
        m.setStyle({ radius: 5, fillColor: "#2a2a2a" });
      }
    });
  }

  function openMapSheet() {
    initLeafletMap();
    mapBackdrop.hidden = false;
    requestAnimationFrame(() => {
      mapBackdrop.classList.add("is-open");
      mapSheet.classList.add("is-open");
    });
    mapSheet.setAttribute("aria-hidden", "false");
    mapTrigger.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    setTimeout(() => { if (leafletMap) leafletMap.invalidateSize(); }, 320);
  }

  function closeMapSheet() {
    mapBackdrop.classList.remove("is-open");
    mapSheet.classList.remove("is-open");
    mapSheet.setAttribute("aria-hidden", "true");
    mapTrigger.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    setTimeout(() => { mapBackdrop.hidden = true; }, 320);
  }

  mapTrigger.addEventListener("click", () => {
    if (mapSheet.classList.contains("is-open")) closeMapSheet();
    else openMapSheet();
  });
  mapClose.addEventListener("click", closeMapSheet);
  mapBackdrop.addEventListener("click", closeMapSheet);

  // Drag-down-to-close: only from the header area
  let dragStartY = null;
  let draggingHeader = false;
  mapSheet.addEventListener("touchstart", (ev) => {
    const head = mapSheet.querySelector(".map-sheet-head");
    if (head && head.contains(ev.target)) {
      draggingHeader = true;
      dragStartY = ev.touches[0].clientY;
    }
  }, { passive: true });
  mapSheet.addEventListener("touchmove", (ev) => {
    if (!draggingHeader || dragStartY == null) return;
    const dy = ev.touches[0].clientY - dragStartY;
    if (dy > 0) mapSheet.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  mapSheet.addEventListener("touchend", (ev) => {
    if (!draggingHeader || dragStartY == null) return;
    const dy = ev.changedTouches[0].clientY - dragStartY;
    mapSheet.style.transform = "";
    draggingHeader = false;
    dragStartY = null;
    if (dy > 80) closeMapSheet();
  }, { passive: true });

  /* ── Predict sheet (Polymarket-style) ────────────────── */
  const predictTrigger = document.getElementById("predict-trigger");
  const predictSheet = document.getElementById("predict-sheet");
  const predictBackdrop = document.getElementById("predict-backdrop");
  const predictClose = document.getElementById("predict-close");
  const predictContent = document.getElementById("predict-content");
  let predictRendered = false;

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function itemSlug(c) {
    return ((c.brand || "x") + "-" + c.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  function predictId(slug, question) {
    return question === "today" ? `${slug}:today:${todayKey()}` : `${slug}:all`;
  }
  function pct(yes, no) {
    const t = (yes || 0) + (no || 0);
    return t === 0 ? null : Math.round((yes / t) * 100);
  }
  async function fetchTally(id) {
    if (!PREDICT_WORKER_URL) return null;
    try {
      const r = await fetch(`${PREDICT_WORKER_URL}?id=${encodeURIComponent(id)}`);
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { return null; }
  }
  async function castVote(id, vote) {
    if (!PREDICT_WORKER_URL) return null;
    try {
      const r = await fetch(`${PREDICT_WORKER_URL}?id=${encodeURIComponent(id)}&vote=${vote}`, { method: "POST" });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { return null; }
  }

  function renderQuestionBlock(slug, question, label) {
    return `
      <div class="predict-q" data-q="${question}">
        <div class="predict-q-label">${escapeHtml(label)}</div>
        <div class="predict-q-bar"><div class="predict-q-fill" style="width:0%"></div></div>
        <div class="predict-q-row">
          <span class="predict-q-pct">—</span>
          <span class="predict-q-counts">0 yes · 0 no</span>
          <div class="predict-q-btns">
            <button class="predict-vote" data-slug="${escapeAttr(slug)}" data-q="${question}" data-vote="yes"${PREDICT_WORKER_URL ? "" : " disabled"}>Yes</button>
            <button class="predict-vote" data-slug="${escapeAttr(slug)}" data-q="${question}" data-vote="no"${PREDICT_WORKER_URL ? "" : " disabled"}>No</button>
          </div>
        </div>
      </div>
    `;
  }

  function updateQuestionRow(slug, question, tally) {
    const row = predictContent.querySelector(`.predict-row[data-slug="${slug}"] .predict-q[data-q="${question}"]`);
    if (!row) return;
    const yes = (tally && tally.yes) || 0;
    const no = (tally && tally.no) || 0;
    const p = pct(yes, no);
    row.querySelector(".predict-q-fill").style.width = (p == null ? 0 : p) + "%";
    row.querySelector(".predict-q-pct").textContent = (p == null ? "—" : p + "%");
    row.querySelector(".predict-q-counts").textContent = `${yes} yes · ${no} no`;
    const id = predictId(slug, question);
    const voted = localStorage.getItem(`vote-${id}`);
    if (voted) markVoted(slug, question, voted);
  }

  function markVoted(slug, question, vote) {
    const row = predictContent.querySelector(`.predict-row[data-slug="${slug}"] .predict-q[data-q="${question}"]`);
    if (!row) return;
    row.querySelectorAll(".predict-vote").forEach(b => {
      b.classList.toggle("voted", b.dataset.vote === vote);
      b.disabled = true;
    });
  }

  function renderPredictDashboard() {
    if (predictRendered) return;
    predictRendered = true;
    const items = coveted.filter(c => c.status !== "bought");
    const notice = PREDICT_WORKER_URL ? "" : `<div class="predict-notice">Voting is offline — set <code>PREDICT_WORKER_URL</code> in <code>app.js</code> to enable.</div>`;
    const rows = items.map(c => {
      const slug = itemSlug(c);
      const imgTag = c.img
        ? `<img class="predict-thumb" loading="lazy" src="${escapeAttr(c.img)}" alt="" onerror="this.style.visibility='hidden'">`
        : `<div class="predict-thumb"></div>`;
      return `
        <div class="predict-row" data-slug="${escapeAttr(slug)}">
          <div class="predict-row-head">
            ${imgTag}
            <div>
              <div class="predict-name">${escapeHtml(c.name)}</div>
              <div class="predict-brand">${escapeHtml(c.brand || "—")}</div>
            </div>
          </div>
          ${renderQuestionBlock(slug, "all", "Will she find it at all?")}
          ${renderQuestionBlock(slug, "today", "Will she find it today?")}
        </div>
      `;
    }).join("");
    predictContent.innerHTML = notice + rows;

    items.forEach(c => {
      const slug = itemSlug(c);
      ["all", "today"].forEach(async q => {
        const tally = await fetchTally(predictId(slug, q));
        updateQuestionRow(slug, q, tally);
      });
    });

    predictContent.querySelectorAll(".predict-vote").forEach(btn => {
      btn.addEventListener("click", async () => {
        const slug = btn.dataset.slug;
        const q = btn.dataset.q;
        const vote = btn.dataset.vote;
        const id = predictId(slug, q);
        const lsKey = `vote-${id}`;
        if (localStorage.getItem(lsKey)) return;
        markVoted(slug, q, vote);
        localStorage.setItem(lsKey, vote);
        const tally = await castVote(id, vote);
        if (tally) updateQuestionRow(slug, q, tally);
      });
    });
  }

  function openPredictSheet() {
    renderPredictDashboard();
    predictBackdrop.hidden = false;
    requestAnimationFrame(() => {
      predictBackdrop.classList.add("is-open");
      predictSheet.classList.add("is-open");
    });
    predictSheet.setAttribute("aria-hidden", "false");
    predictTrigger.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }
  function closePredictSheet() {
    predictBackdrop.classList.remove("is-open");
    predictSheet.classList.remove("is-open");
    predictSheet.setAttribute("aria-hidden", "true");
    predictTrigger.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    setTimeout(() => { predictBackdrop.hidden = true; }, 320);
  }

  predictTrigger.addEventListener("click", () => {
    if (predictSheet.classList.contains("is-open")) closePredictSheet();
    else openPredictSheet();
  });
  predictClose.addEventListener("click", closePredictSheet);
  predictBackdrop.addEventListener("click", closePredictSheet);

  let pDragStartY = null;
  let pDraggingHeader = false;
  predictSheet.addEventListener("touchstart", (ev) => {
    const head = predictSheet.querySelector(".map-sheet-head");
    if (head && head.contains(ev.target)) {
      pDraggingHeader = true;
      pDragStartY = ev.touches[0].clientY;
    }
  }, { passive: true });
  predictSheet.addEventListener("touchmove", (ev) => {
    if (!pDraggingHeader || pDragStartY == null) return;
    const dy = ev.touches[0].clientY - pDragStartY;
    if (dy > 0) predictSheet.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  predictSheet.addEventListener("touchend", (ev) => {
    if (!pDraggingHeader || pDragStartY == null) return;
    const dy = ev.changedTouches[0].clientY - pDragStartY;
    predictSheet.style.transform = "";
    pDraggingHeader = false;
    pDragStartY = null;
    if (dy > 80) closePredictSheet();
  }, { passive: true });

  /* ── Global keys ─────────────────────────────────────── */
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      if (mapSheet.classList.contains("is-open")) closeMapSheet();
      else if (predictSheet.classList.contains("is-open")) closePredictSheet();
    }
  });

  /* ── Utils ───────────────────────────────────────────── */
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function escapeAttr(s) { return escapeHtml(s); }
})();
