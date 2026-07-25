(function () {
  // Site base path ("/" locally, "/<repo>/" on GitHub Pages project sites) —
  // injected by the template so hardcoded asset paths keep working under a subpath.
  const SITE_BASE = (window.SITE_BASE || "/").replace(/\/$/, "");
  const asset = (path) => SITE_BASE + (path.startsWith("/") ? path : "/" + path);

  const todayIso = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const talks = JSON.parse(document.getElementById("talks-data").textContent)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  // The yaml "status" field is frozen at extraction time and goes stale between
  // pipeline runs — derive it from the date at page load instead.
  for (const t of talks) t.status = t.date <= todayIso ? "past" : "upcoming";

  const grid = document.getElementById("talks-grid");
  const emptyState = document.getElementById("empty-state");
  const searchInput = document.getElementById("search");
  const modeFilter = document.getElementById("filter-mode");
  const statusFilter = document.getElementById("filter-status");
  const tagFilter = document.getElementById("filter-tag");
  const overlay = document.getElementById("modal-overlay");
  const modalBody = document.getElementById("modal-body");
  const modalClose = document.getElementById("modal-close");

  const allTags = Array.from(new Set(talks.flatMap((t) => t.tags || []))).sort();
  for (const tag of allTags) {
    const opt = document.createElement("option");
    opt.value = tag;
    opt.textContent = tag;
    tagFilter.appendChild(opt);
  }

  // Canonical cluster name -> display label + icon, per the Figma "Topics" component.
  const TOPIC_META = {
    "Control and Learning": { label: "Control & Learning", icon: "control-and-learning" },
    "Modeling and System Identification": { label: "Modeling & Sys. Id.", icon: "modeling-and-sysid" },
    "Optimization": { label: "Optimization", icon: "optimization" },
    "Systems and Signal Analysis": { label: "Systems & Signals", icon: "systems-and-signals" },
  };

  // Watermarked stock placeholders (temporary, per Carlo — swap for licensed art later).
  const GENERIC_AVATAR_COUNT = 5;

  // Multiple clusters can be active at once. The <select> stays as a
  // secondary single-pick control synced to this set (see syncTagSelect).
  const selectedTags = new Set();
  const MULTI_OPTION_VALUE = "__multi__";
  let lastFocusedTrigger = null;

  const CARD_LIMIT = 20;
  let expanded = false;
  const showMoreBtn = document.getElementById("show-more-btn");

  function syncTagSelect() {
    let multiOpt = tagFilter.querySelector(`option[value="${MULTI_OPTION_VALUE}"]`);
    if (selectedTags.size > 1) {
      if (!multiOpt) {
        multiOpt = document.createElement("option");
        multiOpt.value = MULTI_OPTION_VALUE;
        multiOpt.hidden = true;
        tagFilter.appendChild(multiOpt);
      }
      multiOpt.textContent = `${selectedTags.size} clusters selected`;
      tagFilter.value = MULTI_OPTION_VALUE;
    } else {
      if (multiOpt) multiOpt.remove();
      tagFilter.value = selectedTags.size === 1 ? [...selectedTags][0] : "all";
    }
  }

  function topicChipHtml(canonical, variant) {
    const meta = TOPIC_META[canonical];
    if (!meta) return "";
    const iconSrc = asset(`/images/topics/${meta.icon}.png`);
    const pressed = selectedTags.has(canonical);
    if (variant === "compact") {
      return `<button type="button" class="topic-chip topic-chip-compact" data-topic="${escapeHtml(canonical)}"
                aria-pressed="${pressed}" title="${escapeHtml(canonical)}" aria-label="${escapeHtml(canonical)}">
                <img class="topic-chip-icon" src="${iconSrc}" alt="">
              </button>`;
    }
    const sizeClass = variant === "small" ? "topic-chip-small" : "topic-chip-default";
    return `<button type="button" class="topic-chip ${sizeClass}" data-topic="${escapeHtml(canonical)}" aria-pressed="${pressed}">
              <img class="topic-chip-icon" src="${iconSrc}" alt="">
              <span class="topic-chip-label">${escapeHtml(meta.label)}</span>
            </button>`;
  }

  function onTopicChipClick(e) {
    const btn = e.target.closest(".topic-chip");
    if (!btn) return;
    const topic = btn.dataset.topic;
    if (btn.closest(".modal-tags") || btn.closest(".sidebar-chips")) closeModal();
    if (selectedTags.has(topic)) selectedTags.delete(topic);
    else selectedTags.add(topic);
    syncTagSelect();
    expanded = false;
    render();
    renderTopicsLegend();
  }

  function renderTopicsLegend() {
    const legend = document.getElementById("topics-legend");
    if (!legend) return;
    legend.innerHTML = Object.keys(TOPIC_META).map((c) => topicChipHtml(c, "default")).join("");
  }
  document.addEventListener("click", onTopicChipClick);

  tagFilter.addEventListener("input", () => {
    if (tagFilter.value === "all") selectedTags.clear();
    else if (tagFilter.value !== MULTI_OPTION_VALUE) {
      selectedTags.clear();
      selectedTags.add(tagFilter.value);
    }
    renderTopicsLegend();
  });

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  const NEW_WINDOW_DAYS = 30;
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  function isNew(talk) {
    if (talk.status !== "past") return false;
    const talkDate = new Date(talk.date + "T00:00:00");
    const ageDays = (todayMidnight - talkDate) / 86400000;
    return ageDays >= 0 && ageDays <= NEW_WINDOW_DAYS;
  }

  function matchesFilters(talk) {
    const q = searchInput.value.trim().toLowerCase();
    if (q && !`${talk.speaker} ${talk.title}`.toLowerCase().includes(q)) return false;
    if (modeFilter.value !== "all" && talk.mode !== modeFilter.value) return false;
    if (statusFilter.value !== "all" && talk.status !== statusFilter.value) return false;
    if (selectedTags.size && !(talk.tags || []).some((t) => selectedTags.has(t))) return false;
    return true;
  }

  // --- Avatar ---
  function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function avatarSrc(talk) {
    if (talk.avatar_url) return asset(talk.avatar_url);
    const idx = (hashString(talk.speaker || "") % GENERIC_AVATAR_COUNT) + 1;
    return asset(`/images/avatars-generic/${idx}.png`);
  }

  function avatarHtml(talk, size) {
    return `<img class="avatar avatar-${size}" src="${avatarSrc(talk)}" alt="">`;
  }

  // --- Date chip ---
  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  function dateParts(iso) {
    const d = new Date(iso + "T00:00:00");
    return { day: d.getDate(), month: MONTHS[d.getMonth()], year: d.getFullYear() };
  }

  // Red alarm-clock overlay for recently-published talks — sits on top of the
  // date chip without resizing it, rings on hover. Hand-built SVG (no React/
  // shadcn runtime in this vanilla-JS site, so the animate-ui component isn't
  // usable as-is; this reproduces the same icon/motion in plain CSS/SVG).
  const NEW_BELL_SVG = `
    <svg class="new-bell-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="12" cy="13" r="8" stroke="currentColor" stroke-width="2"/>
      <path d="M7 8 4 5M17 8l3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M12 13V9M12 13l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  function dateChipHtml(talk, variant) {
    const { day, month, year } = dateParts(talk.date);
    const bellHtml = isNew(talk)
      ? `<span class="new-bell" title="Recently published">${NEW_BELL_SVG}</span>`
      : "";
    if (variant === "long") {
      return `<div class="date-chip-wrap">
                <div class="date-chip date-chip-long">
                  <span class="date-day">${day}</span>
                  <span class="date-my"><span class="date-month">${month}</span><span class="date-year">${year}</span></span>
                </div>
                ${bellHtml}
              </div>`;
    }
    return `<div class="date-chip-wrap">
              <div class="date-chip date-chip-default">
                <span class="date-day">${day}</span>
                <span class="date-month">${month}</span>
              </div>
              ${bellHtml}
            </div>`;
  }

  // --- Name and Role ---
  function splitName(speaker) {
    const trimmed = (speaker || "").trim();
    const idx = trimmed.indexOf(" ");
    if (idx === -1) return [trimmed, ""];
    return [trimmed.slice(0, idx), trimmed.slice(idx + 1)];
  }

  function nameRoleHtml(talk, variant) {
    if (variant === "long") {
      return `<div class="name-role name-role-long">
                <span class="name-line">${escapeHtml(talk.speaker)}</span>
                <div class="info-col">
                  <span>${escapeHtml(talk.affiliation_full)}</span>
                  <span>${escapeHtml(talk.role)}</span>
                </div>
              </div>`;
    }
    const [first, last] = splitName(talk.speaker);
    return `<div class="name-role name-role-default">
              <span class="name-line">${escapeHtml(first)}</span>
              ${last ? `<span class="name-line">${escapeHtml(last)}</span>` : ""}
              <div class="info-row"><span>${escapeHtml(talk.role)}</span><span>${escapeHtml(talk.affiliation_short)}</span></div>
            </div>`;
  }

  function displayTitle(talk) {
    return talk.title === "TBD" ? "Details coming soon" : talk.title;
  }

  function render() {
    const visible = talks.filter(matchesFilters);
    const cardsToShow = expanded ? visible : visible.slice(0, CARD_LIMIT);
    grid.innerHTML = "";
    cardsToShow.forEach((talk, i) => {
      const card = document.createElement("div");
      card.className = "talk-card" + (talk.status === "upcoming" ? " card-upcoming" : "");
      // Cards revealed by "Show more" fade/slide in; the first CARD_LIMIT
      // (already visible before the click) render as usual, no animation.
      if (expanded && i >= CARD_LIMIT) card.classList.add("card-enter");
      card.dataset.id = talk.id;
      const footerIcons = (talk.tags || []).map((t) => topicChipHtml(t, "compact")).join("");
      const statusHint = talk.status === "upcoming" ? " (upcoming)" : "";
      // The clickable "open" trigger is a real <button> wrapping only header+title —
      // footer topic-chip buttons stay as a sibling, never nested inside another
      // interactive control (WCAG 4.1.2: no focusable descendants of role=button).
      card.innerHTML = `
        <button type="button" class="talk-card-open" aria-label="${escapeHtml(displayTitle(talk))} — ${escapeHtml(talk.speaker)}${statusHint}">
          <div class="talk-card-header">
            ${avatarHtml(talk, "default")}
            ${nameRoleHtml(talk, "default")}
            ${dateChipHtml(talk, "default")}
          </div>
          <div class="talk-card-title">${escapeHtml(displayTitle(talk))}</div>
        </button>
        <div class="talk-card-footer">${footerIcons}</div>
      `;
      card.querySelector(".talk-card-open").addEventListener("click", () => openModal(talk));
      grid.appendChild(card);
    });
    emptyState.hidden = visible.length !== 0;
    showMoreBtn.hidden = expanded || visible.length <= CARD_LIMIT;
  }

  function openModal(talk) {
    const topicsHtml = (talk.tags || []).map((t) => topicChipHtml(t, "small")).join("");

    const videoHtml = talk.youtube_id
      ? `<div class="expanded-video"><iframe src="https://www.youtube-nocookie.com/embed/${talk.youtube_id}" title="Talk recording" allowfullscreen loading="lazy"></iframe></div>`
      : "";

    const links = [];
    if (talk.links && talk.links.scholar && talk.links.scholar !== "TBD") {
      links.push(`<a class="link-pill" href="${talk.links.scholar}" target="_blank" rel="noopener">&gt;scholar</a>`);
    }
    if (talk.links && talk.links.homepage) {
      links.push(`<a class="link-pill" href="${talk.links.homepage}" target="_blank" rel="noopener">&gt;website</a>`);
    }

    const downloadHtml = talk.slides_url
      ? `<div class="sidebar-label">Download</div>
         <div class="sidebar-chips">
           <a class="link-chip" href="${asset(talk.slides_url)}" download>
             <img src="${asset("/images/topics/slides.png")}" alt="">
             <span>Slides</span>
           </a>
         </div>`
      : "";

    modalBody.innerHTML = `
      <div class="expanded">
        <div class="expanded-main">
          <div class="expanded-header">
            ${avatarHtml(talk, "big")}
            ${nameRoleHtml(talk, "long")}
          </div>
          <div>
            <h2 id="modal-title" class="expanded-title">${escapeHtml(displayTitle(talk))}</h2>
            ${videoHtml}
            <div class="expanded-section">
              <h3>Abstract</h3>
              <p>${talk.abstract === "TBD" ? "Abstract will be posted closer to the talk." : escapeHtml(talk.abstract)}</p>
            </div>
            <div class="expanded-section">
              <h3>Bio</h3>
              <p>${talk.bio === "TBD" ? "Speaker bio will be added soon." : escapeHtml(talk.bio)}</p>
            </div>
            ${links.length ? `<div class="expanded-links">${links.join("")}</div>` : ""}
          </div>
        </div>
        <div class="expanded-sidebar">
          ${dateChipHtml(talk, "long")}
          ${topicsHtml ? `<div class="sidebar-group"><div class="sidebar-label">Topics</div><div class="sidebar-chips">${topicsHtml}</div></div>` : ""}
          ${downloadHtml ? `<div class="sidebar-group">${downloadHtml}</div>` : ""}
        </div>
      </div>
    `;
    lastFocusedTrigger = document.activeElement;
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    modalClose.focus();
  }

  function closeModal() {
    overlay.hidden = true;
    document.body.style.overflow = "";
    modalBody.innerHTML = "";
    if (lastFocusedTrigger && document.contains(lastFocusedTrigger)) lastFocusedTrigger.focus();
    lastFocusedTrigger = null;
  }

  modalClose.addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.hidden) closeModal();
  });

  [searchInput, modeFilter, statusFilter, tagFilter].forEach((el) =>
    el.addEventListener("input", () => {
      expanded = false;
      render();
    })
  );

  showMoreBtn.addEventListener("click", () => {
    expanded = true;
    render();
    showMoreBtn.blur();
  });

  render();
  renderTopicsLegend();
})();
