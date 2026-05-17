(function () {
  const data = (window.TRIP && window.TRIP.entries) || [];

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
          ? `<img loading="lazy" src="${escapeAttr(c.img)}" alt="${escapeAttr(c.name)}">`
          : `<div class="cov-placeholder"></div>`;
        const statusCls = c.status ? ` ${c.status.toLowerCase()}` : "";
        card.innerHTML = `
          ${imgBlock}
          <div class="cov-meta">
            <div class="cov-brand">${escapeHtml(c.brand || "")}</div>
            <div class="cov-name">${escapeHtml(c.name || "")}</div>
            ${c.status ? `<div class="cov-status${statusCls}">${escapeHtml(c.status)}</div>` : ""}
          </div>
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

  /* ── City carousels (Field Notes) ────────────────────── */
  const fmtCity = c => c.charAt(0).toUpperCase() + c.slice(1);
  const citySectionsEl = document.getElementById("city-sections");

  function buildCardHTML(entry) {
    const srcs = [entry.src, ...(entry.gallery || [])].filter(Boolean);
    const imgs = srcs.length
      ? srcs.map((s, i) => `<img loading="lazy" src="${escapeAttr(s)}" class="card-img${i === 0 ? " is-on" : ""}" alt="">`).join("")
      : `<div class="card-placeholder"></div>`;
    const primary = entry.shop ? entry.shop.name : entry.location;
    const placeText = entry.shop ? entry.location : "";
    let statsText = "";
    if (entry.shop) {
      const p = [];
      if (entry.shop.minutes != null) p.push(`${entry.shop.minutes} min`);
      if (entry.shop.eyed != null) p.push(`${entry.shop.eyed} eyed`);
      if (entry.shop.bought != null) p.push(`${entry.shop.bought} bought`);
      statsText = p.join(" · ");
    }
    return `
      <article class="card" data-id="${escapeAttr(entry.id)}" data-count="${Math.max(1, srcs.length)}" data-index="0">
        <div class="card-img-stack">${imgs}</div>
        <div class="card-meta">
          <div class="card-shop">${escapeHtml(primary || "")}</div>
          ${placeText ? `<div class="card-place">${escapeHtml(placeText)}</div>` : ""}
          ${statsText ? `<div class="card-stats">${escapeHtml(statsText)}</div>` : ""}
        </div>
      </article>
    `;
  }

  function wireSection(section) {
    const carousel = section.querySelector(".carousel");
    const cards = Array.from(section.querySelectorAll(".card"));
    const segs = Array.from(section.querySelectorAll(".indicator .seg"));

    const updateIndicator = () => {
      const cRect = carousel.getBoundingClientRect();
      const targetX = cRect.left + 24;  // matches scroll-padding-left
      let closest = 0;
      let minDist = Infinity;
      cards.forEach((card, i) => {
        const r = card.getBoundingClientRect();
        const d = Math.abs(r.left - targetX);
        if (d < minDist) { minDist = d; closest = i; }
      });
      segs.forEach((s, i) => s.classList.toggle("is-on", i === closest));
    };
    carousel.addEventListener("scroll", updateIndicator, { passive: true });
    requestAnimationFrame(updateIndicator);

    segs.forEach((seg, i) => {
      seg.addEventListener("click", () => {
        const target = cards[i];
        const left = target.offsetLeft - 24;  // align to scroll-padding
        carousel.scrollTo({ left, behavior: "smooth" });
      });
    });

    cards.forEach(card => {
      const count = parseInt(card.dataset.count, 10);
      if (count <= 1) return;
      card.addEventListener("click", () => {
        const imgs = card.querySelectorAll(".card-img");
        let idx = parseInt(card.dataset.index, 10);
        const next = (idx + 1) % count;
        card.dataset.index = next;
        imgs.forEach((img, i) => img.classList.toggle("is-on", i === next));
      });
    });
  }

  function renderCitySections() {
    const seen = new Set();
    const cityOrder = [];
    [...data].sort((a, b) => (a.date || "").localeCompare(b.date || ""))
      .forEach(e => { if (e.city && !seen.has(e.city)) { seen.add(e.city); cityOrder.push(e.city); } });

    citySectionsEl.innerHTML = "";

    cityOrder.forEach(city => {
      const cityEntries = data
        .filter(e => e.city === city)
        .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      if (!cityEntries.length) return;

      const section = document.createElement("section");
      section.className = "section city-section";
      section.dataset.city = city;
      const segs = cityEntries.map((_, i) => `<span class="seg${i === 0 ? " is-on" : ""}" data-i="${i}"></span>`).join("");
      section.innerHTML = `
        <h2 class="section-head">Japan / ${escapeHtml(fmtCity(city))}</h2>
        <div class="carousel-wrap">
          <div class="carousel">${cityEntries.map(buildCardHTML).join("")}</div>
        </div>
        <div class="indicator">${segs}</div>
      `;
      citySectionsEl.appendChild(section);
      wireSection(section);
    });
  }
  renderCitySections();

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
    if (ev.key === "Escape" && mapSheet.classList.contains("is-open")) closeMapSheet();
  });

  /* ── Utils ───────────────────────────────────────────── */
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function escapeAttr(s) { return escapeHtml(s); }
})();
