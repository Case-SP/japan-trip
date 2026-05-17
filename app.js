(function () {
  const data = (window.TRIP && window.TRIP.entries) || [];
  const feed = document.getElementById("feed");
  const datesEl = document.getElementById("trip-dates");
  if (window.TRIP && window.TRIP.dates && datesEl) datesEl.textContent = window.TRIP.dates;

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

  /* ── Feed entries ────────────────────────────────────── */
  const fmtDate = iso => {
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  };

  data.forEach((e, i) => {
    const entry = document.createElement("article");
    entry.className = "entry";
    entry.dataset.city = e.city || "";
    entry.dataset.shop = e.shop ? "1" : "0";
    entry.dataset.index = String(i);
    const ratio = e.ratio ? ` ${e.ratio}` : "";
    const photoHtml = e.src
      ? `<div class="photo${ratio}" data-index="${i}"><img loading="lazy" src="${escapeAttr(e.src)}" alt="${escapeAttr(e.caption || e.location)}"></div>`
      : `<div class="photo${ratio}"><div class="placeholder">${escapeHtml(e.location || "Photo to come")}</div></div>`;

    const metaBits = [];
    if (e.location) metaBits.push(escapeHtml(e.location));
    if (e.date) metaBits.push(escapeHtml(fmtDate(e.date)));
    const metaLine = metaBits.length
      ? `<p class="entry-cap">${metaBits.join(" &middot; ")}</p>`
      : "";

    const noteLine = e.caption
      ? `<p class="entry-note"><em>${escapeHtml(e.caption)}</em></p>`
      : "";

    let ledger = "";
    if (e.shop) {
      const bits = [];
      if (e.shop.minutes != null) bits.push(`<strong>${e.shop.minutes} min</strong>`);
      if (e.shop.eyed != null) bits.push(`${e.shop.eyed} eyed`);
      if (e.shop.bought != null) bits.push(`${e.shop.bought} bought`);
      ledger = `<p class="wait">${escapeHtml(e.shop.name || "Shop")} &mdash; ${bits.join(" &middot; ")}</p>`;
    }

    entry.innerHTML = `${photoHtml}${metaLine}${noteLine}${ledger}`;
    feed.appendChild(entry);
  });

  /* ── Filter chips ────────────────────────────────────── */
  const chips = document.querySelectorAll(".chip");
  function applyFilter(f) {
    chips.forEach(c => c.classList.toggle("is-on", c.dataset.filter === f));
    document.querySelectorAll(".entry").forEach(el => {
      if (f === "all") el.classList.remove("hidden");
      else if (f === "shop") el.classList.toggle("hidden", el.dataset.shop !== "1");
      else el.classList.toggle("hidden", el.dataset.city !== f);
    });
    if (leafletMap) updateMapHighlight(f);
    const feedTop = document.querySelector(".field-notes");
    if (feedTop) window.scrollTo({ top: feedTop.offsetTop - 8, behavior: "smooth" });
  }
  chips.forEach(c => c.addEventListener("click", () => applyFilter(c.dataset.filter)));

  /* ── Lightbox ────────────────────────────────────────── */
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
    const bits = [];
    if (e.caption) bits.push(e.caption);
    if (e.location) bits.push(e.location);
    lbCap.textContent = bits.join(" — ");
  }
  function closeLb() { lb.hidden = true; document.body.style.overflow = ""; }
  function nextLb() { if (!visible.length) return; cur = (cur + 1) % visible.length; showCur(); }
  function prevLb() { if (!visible.length) return; cur = (cur - 1 + visible.length) % visible.length; showCur(); }

  feed.addEventListener("click", ev => {
    const ph = ev.target.closest(".photo");
    if (!ph || !ph.dataset.index) return;
    openLb(Number(ph.dataset.index));
  });
  lb.querySelector(".lb-close").addEventListener("click", closeLb);
  lb.querySelector(".lb-prev").addEventListener("click", prevLb);
  lb.querySelector(".lb-next").addEventListener("click", nextLb);

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

  /* ── Global keys ─────────────────────────────────────── */
  document.addEventListener("keydown", (ev) => {
    if (!lb.hidden) {
      if (ev.key === "Escape") closeLb();
      else if (ev.key === "ArrowRight") nextLb();
      else if (ev.key === "ArrowLeft") prevLb();
      return;
    }
    if (ev.key === "Escape" && mapSheet.classList.contains("is-open")) closeMapSheet();
  });

  /* ── Lightbox swipe ──────────────────────────────────── */
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
      dx < 0 ? nextLb() : prevLb();
    } else if (dy > 80 && Math.abs(dy) > Math.abs(dx)) {
      closeLb();
    }
  }, { passive: true });

  /* ── Utils ───────────────────────────────────────────── */
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function escapeAttr(s) { return escapeHtml(s); }
})();
