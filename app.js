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

  /* ── Predict sheet (Polymarket-style paper market) ───── */
  const predictTrigger = document.getElementById("predict-trigger");
  const predictSheet = document.getElementById("predict-sheet");
  const predictBackdrop = document.getElementById("predict-backdrop");
  const predictClose = document.getElementById("predict-close");
  const predictContent = document.getElementById("predict-content");

  const STARTING_BALANCE = 1000;
  const STAKE_PRESETS = [10, 50, 100];

  // Admin token via ?admin=... URL param (stored in localStorage)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("admin")) {
    localStorage.setItem("admin-token", urlParams.get("admin"));
    history.replaceState(null, "", window.location.pathname);
  }
  const adminToken = localStorage.getItem("admin-token");

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
  function questionLabel(q) {
    return q === "today" ? "Will she find it today?" : "Will she find it at all?";
  }

  function getWallet() {
    try {
      const raw = localStorage.getItem("wallet");
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    const fresh = { balance: STARTING_BALANCE, positions: {} };
    localStorage.setItem("wallet", JSON.stringify(fresh));
    return fresh;
  }
  function saveWallet(w) { localStorage.setItem("wallet", JSON.stringify(w)); }

  function priceYes(market) {
    const t = (market.yes || 0) + (market.no || 0);
    return t === 0 ? 0.5 : market.yes / t;
  }
  function positionValue(pos, market) {
    if (!pos) return 0;
    if (market.status === "resolved") {
      return market.outcome === "yes" ? (pos.yes || 0) : (pos.no || 0);
    }
    const pY = priceYes(market);
    return (pos.yes || 0) * pY + (pos.no || 0) * (1 - pY);
  }
  function fmtMoney(v) {
    return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtShares(n) {
    return n < 10 ? n.toFixed(1) : n.toFixed(0);
  }

  const marketsCache = {};
  const stakeChoice = {};  // marketId → chosen stake
  let allMarketIds = [];

  async function fetchMarkets(ids) {
    if (!PREDICT_WORKER_URL || !ids.length) return {};
    try {
      const r = await fetch(`${PREDICT_WORKER_URL}/?ids=${encodeURIComponent(ids.join(","))}`);
      if (!r.ok) return {};
      return await r.json();
    } catch (e) { return {}; }
  }
  async function buyShares(marketId, side, shares) {
    const r = await fetch(`${PREDICT_WORKER_URL}/buy?market=${encodeURIComponent(marketId)}&side=${side}&shares=${shares}`, { method: "POST" });
    if (!r.ok) throw new Error((await r.json()).error || "buy failed");
    return await r.json();
  }
  async function resolveMarket(marketId, outcome) {
    if (!adminToken) throw new Error("no admin token");
    const r = await fetch(`${PREDICT_WORKER_URL}/resolve?market=${encodeURIComponent(marketId)}&outcome=${outcome}&secret=${encodeURIComponent(adminToken)}`, { method: "POST" });
    if (!r.ok) throw new Error((await r.json()).error || "resolve failed");
    return await r.json();
  }

  // Auto-settle: when a held position belongs to a resolved market, credit balance and clear
  function settleResolved(wallet) {
    let changed = false;
    Object.keys(wallet.positions).forEach(id => {
      const m = marketsCache[id];
      if (!m || m.status !== "resolved") return;
      const pos = wallet.positions[id];
      const payout = m.outcome === "yes" ? (pos.yes || 0) : (pos.no || 0);
      wallet.balance += payout;
      delete wallet.positions[id];
      changed = true;
    });
    if (changed) saveWallet(wallet);
  }

  let predictRendered = false;

  async function renderPredictDashboard() {
    const items = coveted.filter(c => c.status !== "bought");
    allMarketIds = [];
    items.forEach(c => {
      const slug = itemSlug(c);
      allMarketIds.push(predictId(slug, "all"));
      allMarketIds.push(predictId(slug, "today"));
    });

    Object.assign(marketsCache, await fetchMarkets(allMarketIds));
    settleResolved(getWallet());

    predictContent.innerHTML = `
      <div class="port" id="port"></div>
      ${PREDICT_WORKER_URL ? "" : `<div class="predict-notice">Backend offline — set <code>PREDICT_WORKER_URL</code> in app.js.</div>`}
      <div class="markets" id="markets">${items.map(renderItemBlock).join("")}</div>
    `;

    renderPortfolio();
    predictContent.addEventListener("click", onDashboardClick);
    predictRendered = true;
  }

  function renderItemBlock(c) {
    const slug = itemSlug(c);
    const imgTag = c.img
      ? `<img class="predict-thumb" loading="lazy" src="${escapeAttr(c.img)}" alt="" onerror="this.style.visibility='hidden'">`
      : `<div class="predict-thumb"></div>`;
    return `
      <article class="predict-row" data-slug="${escapeAttr(slug)}">
        <header class="predict-row-head">
          ${imgTag}
          <div>
            <div class="predict-brand">${escapeHtml(c.brand || "—")}</div>
            <div class="predict-name">${escapeHtml(c.name)}</div>
          </div>
        </header>
        ${renderMarket(slug, "all")}
        ${renderMarket(slug, "today")}
      </article>
    `;
  }

  function renderMarket(slug, q) {
    const id = predictId(slug, q);
    const m = marketsCache[id] || { yes: 0, no: 0, status: "open", outcome: null };
    const wallet = getWallet();
    const pos = wallet.positions[id] || { yes: 0, no: 0 };
    const pY = priceYes(m);
    const pYesPct = Math.round(pY * 100);
    const totalShares = (m.yes || 0) + (m.no || 0);
    const isResolved = m.status === "resolved";
    const stake = stakeChoice[id] || STAKE_PRESETS[0];

    const resolveCtrl = (!isResolved && adminToken && PREDICT_WORKER_URL)
      ? `<div class="market-admin"><button class="resolve-btn" data-side="yes" data-market="${escapeAttr(id)}">Resolve YES</button><button class="resolve-btn" data-side="no" data-market="${escapeAttr(id)}">Resolve NO</button></div>`
      : "";

    const statusBadge = isResolved
      ? `<span class="market-badge market-badge-${m.outcome}">Resolved ${m.outcome.toUpperCase()}</span>`
      : "";

    const posLine = (pos.yes > 0 || pos.no > 0)
      ? `You hold ${fmtShares(pos.yes || 0)} YES · ${fmtShares(pos.no || 0)} NO`
      : "";

    const betUI = isResolved || !PREDICT_WORKER_URL ? "" : `
      <div class="bet">
        <div class="bet-chips">
          ${STAKE_PRESETS.map(a => `<button class="bet-chip${a === stake ? " is-on" : ""}" data-stake="${a}" data-market="${escapeAttr(id)}">$${a}</button>`).join("")}
        </div>
        <div class="bet-btns">
          <button class="bet-yes" data-side="yes" data-market="${escapeAttr(id)}">Buy YES <span class="bet-price">${fmtMoney(pY)}</span></button>
          <button class="bet-no" data-side="no" data-market="${escapeAttr(id)}">Buy NO <span class="bet-price">${fmtMoney(1 - pY)}</span></button>
        </div>
      </div>
    `;

    return `
      <div class="market" data-market="${escapeAttr(id)}" data-slug="${escapeAttr(slug)}" data-q="${q}">
        <div class="market-head">
          <span class="market-label">${escapeHtml(questionLabel(q))}</span>
          ${statusBadge}
        </div>
        <div class="market-bar"><div class="market-fill" style="width:${pYesPct}%"></div></div>
        <div class="market-meta">
          <span class="market-pct">${pYesPct}%</span>
          <span class="market-vol">${fmtShares(totalShares)} shares traded</span>
        </div>
        ${posLine ? `<div class="market-pos">${posLine}</div>` : ""}
        ${betUI}
        ${resolveCtrl}
      </div>
    `;
  }

  function renderPortfolio() {
    const wallet = getWallet();
    let positionsValue = 0;
    Object.keys(wallet.positions).forEach(id => {
      const m = marketsCache[id];
      if (m) positionsValue += positionValue(wallet.positions[id], m);
    });
    const total = wallet.balance + positionsValue;
    const profit = total - STARTING_BALANCE;
    const profitSign = profit >= 0 ? "+" : "−";
    const profitPct = ((profit / STARTING_BALANCE) * 100);
    const profitColorClass = profit >= 0 ? "is-up" : "is-down";

    const el = document.getElementById("port");
    if (!el) return;
    el.innerHTML = `
      <div class="port-line">
        <div class="port-balance">${fmtMoney(total)}</div>
        <div class="port-net ${profitColorClass}">${profitSign}${fmtMoney(Math.abs(profit))} <span class="port-pct">${profitSign}${Math.abs(profitPct).toFixed(1)}%</span></div>
      </div>
      <div class="port-sub">Cash ${fmtMoney(wallet.balance)} · Positions ${fmtMoney(positionsValue)}</div>
    `;
  }

  function rerenderMarket(marketId) {
    const el = predictContent.querySelector(`.market[data-market="${marketId}"]`);
    if (!el) return;
    const slug = el.dataset.slug;
    const q = el.dataset.q;
    const tmp = document.createElement("div");
    tmp.innerHTML = renderMarket(slug, q).trim();
    el.replaceWith(tmp.firstChild);
  }

  async function onDashboardClick(ev) {
    const chip = ev.target.closest(".bet-chip");
    if (chip) {
      const id = chip.dataset.market;
      stakeChoice[id] = parseFloat(chip.dataset.stake);
      rerenderMarket(id);
      return;
    }
    const buy = ev.target.closest(".bet-yes, .bet-no");
    if (buy) {
      const id = buy.dataset.market;
      const side = buy.dataset.side;
      const stake = stakeChoice[id] || STAKE_PRESETS[0];
      await handleBuy(id, side, stake);
      return;
    }
    const resolve = ev.target.closest(".resolve-btn");
    if (resolve) {
      const id = resolve.dataset.market;
      const outcome = resolve.dataset.side;
      if (!confirm(`Resolve "${id}" as ${outcome.toUpperCase()}?`)) return;
      await handleResolve(id, outcome);
      return;
    }
  }

  async function handleBuy(marketId, side, dollars) {
    const wallet = getWallet();
    if (wallet.balance < dollars) { alert("Not enough balance"); return; }
    const m = marketsCache[marketId];
    if (!m) { alert("Market not loaded"); return; }
    const price = side === "yes" ? priceYes(m) : (1 - priceYes(m));
    if (price <= 0.01 || price >= 0.99) { alert("Price too extreme — try a smaller stake or the other side"); return; }
    const shares = dollars / price;

    let updated;
    try { updated = await buyShares(marketId, side, shares); }
    catch (e) { alert("Buy failed: " + e.message); return; }

    marketsCache[marketId] = updated;
    wallet.balance -= dollars;
    if (!wallet.positions[marketId]) wallet.positions[marketId] = { yes: 0, no: 0 };
    wallet.positions[marketId][side] = (wallet.positions[marketId][side] || 0) + shares;
    saveWallet(wallet);

    rerenderMarket(marketId);
    renderPortfolio();
  }

  async function handleResolve(marketId, outcome) {
    let updated;
    try { updated = await resolveMarket(marketId, outcome); }
    catch (e) { alert("Resolve failed: " + e.message); return; }
    marketsCache[marketId] = updated;
    settleResolved(getWallet());
    rerenderMarket(marketId);
    renderPortfolio();
  }

  function openPredictSheet() {
    if (!predictRendered) renderPredictDashboard();
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
