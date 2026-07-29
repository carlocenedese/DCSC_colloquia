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
  const formatButtons = document.getElementById("format-filter-buttons");
  const dateButtons = document.getElementById("date-filter-buttons");
  const filtersTopicRow = document.getElementById("filters-topic-row");
  const topicDropdownBtn = document.getElementById("filters-topic-dropdown-btn");
  const topicDropdownPanel = document.getElementById("filters-topic-dropdown-panel");

  const allTags = Array.from(new Set(talks.flatMap((t) => t.tags || []))).sort();
  for (const tag of allTags) {
    const opt = document.createElement("option");
    opt.value = tag;
    opt.textContent = tag;
    tagFilter.appendChild(opt);
  }

  // Canonical cluster name -> display label + icon, per the Figma "Topics" component.
  // `description` is the research-area summary shown in the Topics accordion.
  const TOPIC_META = {
    "Control and Learning": {
      label: "Control & Learning",
      icon: "control-and-learning",
      description: "It combines optimization, estimation, model-based control with ML and operations research, under uncertainty/disturbances/constraints. Covers discrete-event and hybrid systems control, predictive control/scheduling (model-based + data-driven), multi-agent/distributed control of large-scale systems, game-theoretic multi-agent control, RL/supervised learning for control, and optimization-learning hybrids.",
    },
    "Modeling and System Identification": {
      label: "Modeling & Sys. Id.",
      icon: "modeling-and-sysid",
      description: "Addresses what model complexity and actuator/sensor configuration each system component needs for reliable model-based diagnostics, parameter estimation, monitoring, and control, with uncertainty quantification and disturbance modeling as key aspects. Combines measurement data with multi-disciplinary models for robust decision-making. Covers efficient numerical methods, sensor fusion, finite-sample identification, kernel-based methods, Koopman operator theory, statistical learning theory, tensor-based nonlinear identification, event-based timing models, data-driven hybrid system modeling, and function space approaches.",
    },
    "Optimization": {
      label: "Optimization",
      icon: "optimization",
      description: "Develops efficient solution methods and algorithms for complex, large-scale optimization problems in systems and control, exploiting problem structure for better computational efficiency, numerical properties, and memory use. Covers parallel/asynchronous/event-triggered computation, data-driven signal-acquisition optimization, distributionally robust ambiguity sets, sampled-data sampling strategies, infinite-dimensional optimization, stochastic optimization, matrix/tensor factorization, convex optimization, and multi-objective control optimization.",
    },
    "Systems and Signal Analysis": {
      label: "Systems & Signals",
      icon: "systems-and-signals",
      description: "Focuses on analyzing systems and signals across linear, nonlinear, hybrid, and spatio-temporally-varying dynamics. Aims to extract information from signals to understand, diagnose, and interact with systems, model their dynamics, and improve performance. Emphasizes algorithms exploiting physical insight and structure, alongside integrated designs with embedded prognostics and diagnostics.",
    },
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
  let viewMode = "card"; // "card" | "list", toggled by #view-toggle below
  const showMoreBtn = document.getElementById("show-more-btn");

  const viewToggle = document.getElementById("view-toggle");
  if (viewToggle) {
    viewToggle.querySelectorAll(".view-toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        viewMode = btn.getAttribute("aria-label") === "List view" ? "list" : "card";
        expanded = false;
        render();
      });
    });
  }

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
    return `<button type="button" class="topic-chip topic-chip-default" data-topic="${escapeHtml(canonical)}" aria-pressed="${pressed}">
              <img class="topic-chip-icon" src="${iconSrc}" alt="">
              <span class="topic-chip-label">${escapeHtml(meta.label)}</span>
            </button>`;
  }

  function topicPillHtml(canonical) {
    const meta = TOPIC_META[canonical];
    if (!meta) return "";
    const iconSrc = asset(`/images/topics/${meta.icon}.png`);
    const pressed = selectedTags.has(canonical);
    return `<button type="button" class="topic-pill" data-topic="${escapeHtml(canonical)}" aria-pressed="${pressed}">
              <img class="topic-pill-icon" src="${iconSrc}" alt="">
              <span class="topic-pill-label">${escapeHtml(meta.label)}</span>
            </button>`;
  }

  function onTopicChipClick(e) {
    const btn = e.target.closest(".topic-chip, .topic-pill");
    if (!btn) return;
    const topic = btn.dataset.topic;
    if (btn.closest(".modal-tags")) closeModal();
    if (selectedTags.has(topic)) selectedTags.delete(topic);
    else selectedTags.add(topic);
    syncTagSelect();
    expanded = false;
    render();
    renderFiltersTopicRow();
    renderTopicDropdownPanel();
  }

  // Informational only — describes DCSC's research areas, isn't a talk filter.
  // Rendered once at init (see bottom); never re-rendered on filter changes,
  // since that would collapse whichever row the user has open.
  function accordionRowHtml(canonical, isOpen) {
    const meta = TOPIC_META[canonical];
    if (!meta) return "";
    const iconSrc = asset(`/images/topics/${meta.icon}.png`);
    return `<div class="accordion-row" data-open="${isOpen}">
              <button type="button" class="accordion-header" aria-expanded="${isOpen}">
                <span class="accordion-header-main">
                  <img class="accordion-icon" src="${iconSrc}" alt="">
                  <span class="accordion-label">${escapeHtml(canonical)}</span>
                </span>
                <span class="accordion-toggle" aria-hidden="true"></span>
              </button>
              <div class="accordion-content-wrap">
                <div class="accordion-content-inner">
                  <p class="accordion-content-text">${escapeHtml(meta.description)}</p>
                </div>
              </div>
            </div>`;
  }

  function renderTopicsAccordion() {
    const accordion = document.getElementById("topics-accordion");
    if (!accordion) return;
    accordion.innerHTML = Object.keys(TOPIC_META)
      .map((canonical, i) => accordionRowHtml(canonical, i === 0))
      .join("");
    accordion.querySelectorAll(".accordion-header").forEach((header) => {
      header.addEventListener("click", () => {
        const row = header.closest(".accordion-row");
        const isOpen = row.getAttribute("data-open") === "true";
        accordion.querySelectorAll(".accordion-row").forEach((r) => {
          r.setAttribute("data-open", "false");
          r.querySelector(".accordion-header").setAttribute("aria-expanded", "false");
        });
        if (!isOpen) {
          row.setAttribute("data-open", "true");
          header.setAttribute("aria-expanded", "true");
        }
      });
    });
  }

  function renderFiltersTopicRow() {
    if (!filtersTopicRow) return;
    filtersTopicRow.innerHTML = Object.keys(TOPIC_META).map(topicPillHtml).join("");
  }

  function renderTopicDropdownPanel() {
    if (!topicDropdownPanel) return;
    topicDropdownPanel.innerHTML = Object.keys(TOPIC_META)
      .map((canonical) => {
        const meta = TOPIC_META[canonical];
        const checked = selectedTags.has(canonical) ? "checked" : "";
        return `<label><input type="checkbox" data-topic="${escapeHtml(canonical)}" ${checked}> ${escapeHtml(meta.label)}</label>`;
      })
      .join("");
  }

  document.addEventListener("click", onTopicChipClick);

  if (topicDropdownPanel) {
    topicDropdownPanel.addEventListener("change", (e) => {
      const checkbox = e.target.closest('input[type="checkbox"]');
      if (!checkbox) return;
      const topic = checkbox.dataset.topic;
      if (checkbox.checked) selectedTags.add(topic);
      else selectedTags.delete(topic);
      syncTagSelect();
      expanded = false;
      render();
      renderFiltersTopicRow();
    });
  }

  if (topicDropdownBtn) {
    topicDropdownBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = topicDropdownPanel.classList.contains("open");
      topicDropdownPanel.classList.toggle("open", !isOpen);
      topicDropdownBtn.setAttribute("aria-expanded", String(!isOpen));
    });
    document.addEventListener("click", () => {
      topicDropdownPanel.classList.remove("open");
      topicDropdownBtn.setAttribute("aria-expanded", "false");
    });
  }

  function wireSegmentedButtons(container, hiddenSelect) {
    if (!container) return;
    container.querySelectorAll(".format-filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        hiddenSelect.value = btn.dataset.value;
        hiddenSelect.dispatchEvent(new Event("input"));
      });
    });
  }
  function syncSegmentedButtons(container, value) {
    if (!container) return;
    container.querySelectorAll(".format-filter-btn").forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.dataset.value === value ? "true" : "false");
    });
  }
  wireSegmentedButtons(formatButtons, modeFilter);
  wireSegmentedButtons(dateButtons, statusFilter);

  tagFilter.addEventListener("input", () => {
    if (tagFilter.value === "all") selectedTags.clear();
    else if (tagFilter.value !== MULTI_OPTION_VALUE) {
      selectedTags.clear();
      selectedTags.add(tagFilter.value);
    }
    renderFiltersTopicRow();
    renderTopicDropdownPanel();
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
    if (variant === "row") {
      return `<div class="name-role name-role-row">
                <span class="name-line">${escapeHtml(talk.speaker)}</span>
                <span class="info-line">${escapeHtml(talk.role)} · ${escapeHtml(talk.affiliation_short)}</span>
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

  function buildCardEl(talk, i) {
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
    return card;
  }

  function buildRowEl(talk, i) {
    const row = document.createElement("div");
    row.className = "talk-row" + (talk.status === "upcoming" ? " card-upcoming" : "");
    if (expanded && i >= CARD_LIMIT) row.classList.add("card-enter");
    row.dataset.id = talk.id;
    const footerIcons = (talk.tags || []).map((t) => topicChipHtml(t, "compact")).join("");
    const statusHint = talk.status === "upcoming" ? " (upcoming)" : "";
    row.innerHTML = `
      <button type="button" class="talk-row-open" aria-label="${escapeHtml(displayTitle(talk))} — ${escapeHtml(talk.speaker)}${statusHint}">
        ${avatarHtml(talk, "row")}
        ${nameRoleHtml(talk, "row")}
        ${dateChipHtml(talk, "default")}
        <div class="talk-row-title">${escapeHtml(displayTitle(talk))}</div>
      </button>
      <div class="talk-row-footer">${footerIcons}</div>
    `;
    row.querySelector(".talk-row-open").addEventListener("click", () => openModal(talk));
    return row;
  }

  function render() {
    const visible = talks.filter(matchesFilters);
    const cardsToShow = expanded ? visible : visible.slice(0, CARD_LIMIT);
    grid.innerHTML = "";
    grid.classList.toggle("view-list", viewMode === "list");
    cardsToShow.forEach((talk, i) => {
      grid.appendChild(viewMode === "list" ? buildRowEl(talk, i) : buildCardEl(talk, i));
    });
    emptyState.hidden = visible.length !== 0;
    showMoreBtn.hidden = expanded || visible.length <= CARD_LIMIT;
  }

  function modalSlidesPillHtml(talk) {
    if (!talk.slides_url) return "";
    return `<a class="slides-pill" href="${asset(talk.slides_url)}" download>
              <img class="slides-pill-icon" src="${asset("/images/topics/slides.png")}" alt="">
              <span class="slides-pill-frame">
                <span class="slides-pill-label">Slides</span>
                <svg class="slides-pill-download" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M6 1v7M6 8 3 5M6 8l3-3M1.5 10h9" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
            </a>`;
  }

  function openModal(talk) {
    const tags = talk.tags || [];
    const topicsHtml = tags.map((t) => topicPillHtml(t)).join("");
    const slidesHtml = modalSlidesPillHtml(talk);
    const tagsRowHtml = topicsHtml || slidesHtml
      ? `<div class="modal-tags">
           ${topicsHtml}
           ${topicsHtml && slidesHtml ? `<span class="modal-tags-divider">|</span>` : ""}
           ${slidesHtml}
         </div>`
      : "";

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

    modalBody.innerHTML = `
      <div class="expanded">
        <div class="expanded-header">
          <div class="expanded-header-speaker">
            ${avatarHtml(talk, "big")}
            ${nameRoleHtml(talk, "long")}
          </div>
          ${dateChipHtml(talk, "long")}
        </div>
        <h2 id="modal-title" class="expanded-title">${escapeHtml(displayTitle(talk))}</h2>
        ${videoHtml}
        ${tagsRowHtml}
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
      syncSegmentedButtons(formatButtons, modeFilter.value);
      syncSegmentedButtons(dateButtons, statusFilter.value);
      render();
    })
  );

  showMoreBtn.addEventListener("click", () => {
    expanded = true;
    render();
    showMoreBtn.blur();
  });

  render();
  renderTopicsAccordion();
  renderFiltersTopicRow();
  renderTopicDropdownPanel();
  syncSegmentedButtons(formatButtons, modeFilter.value);
  syncSegmentedButtons(dateButtons, statusFilter.value);
})();

// ---- View toggle (design-v2 variation): sliding indicator behind the active
// card/list button. Not wired into the page yet — no-op until .view-toggle
// markup exists, since list view itself isn't built.
function initViewToggle() {
  document.querySelectorAll(".view-toggle").forEach((toggle) => {
    const buttons = [...toggle.querySelectorAll(".view-toggle-btn")];
    if (!buttons.length) return;

    let indicator = toggle.querySelector(".view-toggle-indicator");
    if (!indicator) {
      indicator = document.createElement("span");
      indicator.className = "view-toggle-indicator";
      indicator.setAttribute("aria-hidden", "true");
      toggle.insertBefore(indicator, toggle.firstChild);
    }

    function moveIndicatorTo(btn) {
      const toggleRect = toggle.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      indicator.style.width = `${btnRect.width}px`;
      indicator.style.transform = `translateX(${btnRect.left - toggleRect.left}px)`;
    }

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.setAttribute("aria-pressed", b === btn ? "true" : "false"));
        moveIndicatorTo(btn);
      });
    });

    const active = buttons.find((b) => b.getAttribute("aria-pressed") === "true") || buttons[0];
    moveIndicatorTo(active);
  });
}
if (document.querySelector(".view-toggle")) initViewToggle();
