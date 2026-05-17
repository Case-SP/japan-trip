(function () {
  const entries = window.ENTRIES || [];
  const coords = window.CITY_COORDS || {};
  const SVG_NS = "http://www.w3.org/2000/svg";

  let currentFilter = "all"; // "all" | "wife" | <cityName>
  let lightboxList = [];
  let lightboxIndex = 0;
  let touchStartX = null;
  let touchStartY = null;

  const $ = (s) => document.querySelector(s);

  const escapeHTML = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  function fmtDate(s) {
    const d = new Date(s + "T00:00:00");
    return d
      .toLocaleDateString("en-US", { month: "short", day: "numeric" })
      .toLowerCase();
  }

  function uniqueCitiesByVisit() {
    const seen = new Set();
    const out = [];
    [...entries]
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((e) => {
        if (!seen.has(e.city)) {
          seen.add(e.city);
          out.push(e.city);
        }
      });
    return out;
  }

  function filteredEntries() {
    const list = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    if (currentFilter === "all") return list;
    if (currentFilter === "wife") return list.filter((e) => e.shop);
    return list.filter((e) => e.city === currentFilter);
  }

  function renderMetrics() {
    let mins = 0, eyed = 0, bought = 0;
    entries.forEach((e) => {
      if (e.shop) {
        mins += e.shop.minutes || 0;
        eyed += e.shop.eyed || 0;
        bought += e.shop.bought || 0;
      }
    });
    $("#metric-mins").textContent = mins;
    $("#metric-eyed").textContent = eyed;
    $("#metric-bought").textContent = bought;
  }

  function renderChips() {
    const cities = uniqueCitiesByVisit();
    const wrap = $("#chips");
    wrap.innerHTML = "";
    const make = (key, label, cls = "") => {
      const b = document.createElement("button");
      b.className =
        "chip " + cls + (currentFilter === key ? " is-active" : "");
      b.textContent = label;
      b.addEventListener("click", () => {
        currentFilter = key;
        renderAll();
      });
      return b;
    };
    wrap.appendChild(make("all", "all"));
    cities.forEach((c) => wrap.appendChild(make(c, c)));
    wrap.appendChild(make("wife", "wife's shops", "wife"));
  }

  function renderMap() {
    const svg = $("#map-svg");
    svg.querySelectorAll(".dyn").forEach((n) => n.remove());

    const cities = uniqueCitiesByVisit().filter((c) => coords[c]);

    if (cities.length > 1) {
      const pts = cities.map((c) => `${coords[c].x},${coords[c].y}`).join(" ");
      const route = document.createElementNS(SVG_NS, "polyline");
      route.setAttribute("points", pts);
      route.setAttribute("class", "map-route dyn");
      svg.appendChild(route);
    }

    cities.forEach((c) => {
      const { x, y } = coords[c];
      const isActive = currentFilter === c;

      const dot = document.createElementNS(SVG_NS, "circle");
      dot.setAttribute("cx", x);
      dot.setAttribute("cy", y);
      dot.setAttribute("r", isActive ? 4.8 : 4);
      dot.setAttribute("class", "map-dot dyn" + (isActive ? " is-active" : ""));
      svg.appendChild(dot);

      const lbl = document.createElementNS(SVG_NS, "text");
      lbl.setAttribute("x", x + 6);
      lbl.setAttribute("y", y + 2.5);
      lbl.setAttribute("class", "map-label dyn");
      lbl.textContent = c;
      svg.appendChild(lbl);

      const hit = document.createElementNS(SVG_NS, "circle");
      hit.setAttribute("cx", x);
      hit.setAttribute("cy", y);
      hit.setAttribute("r", 12);
      hit.setAttribute("class", "map-dot-hit dyn");
      hit.addEventListener("click", () => {
        currentFilter = currentFilter === c ? "all" : c;
        renderAll();
      });
      svg.appendChild(hit);
    });
  }

  function renderFeed() {
    const feed = $("#feed");
    feed.innerHTML = "";
    const list = filteredEntries();

    if (list.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "no entries";
      feed.appendChild(empty);
      return;
    }

    const photoList = list.filter((e) => e.src);
    const photoIndex = new Map();
    photoList.forEach((e, i) => photoIndex.set(e.id, i));

    list.forEach((e, i) => {
      const article = document.createElement("article");
      article.className = "entry";

      const head = document.createElement("div");
      head.className = "entry-head";

      const no = document.createElement("span");
      no.className = "entry-no";
      no.textContent = "no. " + String(i + 1).padStart(2, "0");

      const meta = document.createElement("span");
      meta.className = "entry-meta";
      meta.textContent = `${fmtDate(e.date)} · ${e.city}`;

      head.appendChild(no);
      head.appendChild(meta);
      article.appendChild(head);

      const loc = document.createElement("p");
      loc.className = "entry-loc";
      loc.textContent = e.location;
      article.appendChild(loc);

      if (e.src) {
        const btn = document.createElement("button");
        btn.className = "entry-photo";
        btn.type = "button";
        const img = document.createElement("img");
        img.src = e.src;
        img.alt = e.caption || e.location;
        img.loading = "lazy";
        if (e.ratio) img.style.aspectRatio = String(e.ratio);
        btn.appendChild(img);
        btn.addEventListener("click", () =>
          openLightbox(photoList, photoIndex.get(e.id))
        );
        article.appendChild(btn);
      } else {
        const ph = document.createElement("div");
        ph.className = "entry-placeholder";
        ph.style.aspectRatio = String(e.ratio || 4 / 5);
        ph.textContent = "photo to come";
        article.appendChild(ph);
      }

      if (e.caption) {
        const cap = document.createElement("p");
        cap.className = "entry-caption";
        cap.textContent = e.caption;
        article.appendChild(cap);
      }

      if (e.shop) {
        const shop = document.createElement("div");
        shop.className = "entry-shop";
        shop.innerHTML =
          `<span class="shop-name">${escapeHTML(e.shop.name)}</span>` +
          `<span><em>${e.shop.minutes}</em> min waiting</span>` +
          `<span><em>${e.shop.eyed}</em> eyed</span>` +
          `<span><em>${e.shop.bought}</em> bought</span>`;
        article.appendChild(shop);
      }

      feed.appendChild(article);
    });
  }

  function openLightbox(list, index) {
    if (!list.length) return;
    lightboxList = list;
    lightboxIndex = index;
    renderLightbox();
    const lb = $("#lightbox");
    lb.classList.add("is-open");
    lb.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    const lb = $("#lightbox");
    lb.classList.remove("is-open");
    lb.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function stepLightbox(dir) {
    if (!lightboxList.length) return;
    const n = lightboxList.length;
    lightboxIndex = (lightboxIndex + dir + n) % n;
    renderLightbox();
  }

  function renderLightbox() {
    const e = lightboxList[lightboxIndex];
    if (!e) return;
    $("#lb-img").src = e.src;
    $("#lb-img").alt = e.caption || "";
    $("#lb-caption").textContent = e.caption || "";
    $("#lb-count").textContent = `${lightboxIndex + 1} / ${lightboxList.length}`;
  }

  function wireLightbox() {
    const lb = $("#lightbox");
    lb.addEventListener("click", () => closeLightbox());
    $("#lb-img").addEventListener("click", (ev) => {
      ev.stopPropagation();
      closeLightbox();
    });

    document.addEventListener("keydown", (ev) => {
      if (!lb.classList.contains("is-open")) return;
      if (ev.key === "Escape") closeLightbox();
      else if (ev.key === "ArrowRight") stepLightbox(1);
      else if (ev.key === "ArrowLeft") stepLightbox(-1);
    });

    lb.addEventListener("touchstart", (ev) => {
      touchStartX = ev.touches[0].clientX;
      touchStartY = ev.touches[0].clientY;
    }, { passive: true });
    lb.addEventListener("touchend", (ev) => {
      if (touchStartX == null) return;
      const dx = ev.changedTouches[0].clientX - touchStartX;
      const dy = ev.changedTouches[0].clientY - touchStartY;
      touchStartX = null;
      touchStartY = null;
      // Treat as a swipe only when horizontal motion clearly dominates.
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        stepLightbox(dx < 0 ? 1 : -1);
      }
    });
  }

  function renderAll() {
    renderChips();
    renderMap();
    renderFeed();
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderMetrics();
    renderAll();
    wireLightbox();
  });
})();
