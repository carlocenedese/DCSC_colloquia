(function () {
  const talks = JSON.parse(document.getElementById("talks-data").textContent)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

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
    const iconSrc = `/images/topics/${meta.icon}.png`;
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

  function formatDate(iso) {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
      year: "numeric", month: "short", day: "numeric",
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  const NEW_WINDOW_DAYS = 21;
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
    if (talk.avatar_url) return talk.avatar_url;
    const idx = (hashString(talk.speaker || "") % GENERIC_AVATAR_COUNT) + 1;
    return `/images/avatars-generic/${idx}.png`;
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

  function dateChipHtml(talk, variant) {
    const { day, month, year } = dateParts(talk.date);
    if (variant === "long") {
      return `<div class="date-chip date-chip-long">
                <span class="date-day">${day}</span>
                <span class="date-my"><span class="date-month">${month}</span><span class="date-year">${year}</span></span>
              </div>`;
    }
    return `<div class="date-chip date-chip-default">
              <span class="date-day">${day}</span>
              <span class="date-month">${month}</span>
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

  function render() {
    const visible = talks.filter(matchesFilters);
    grid.innerHTML = "";
    for (const talk of visible) {
      const card = document.createElement("div");
      card.className = "talk-card" + (talk.status === "upcoming" ? " card-upcoming" : "");
      card.dataset.id = talk.id;
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `${talk.title} — ${talk.speaker}`);
      const newBadge = isNew(talk) ? `<span class="badge badge-new">New</span>` : "";
      const footerIcons = (talk.tags || []).map((t) => topicChipHtml(t, "compact")).join("");
      card.innerHTML = `
        <div class="talk-card-header">
          ${avatarHtml(talk, "default")}
          ${nameRoleHtml(talk, "default")}
          ${dateChipHtml(talk, "default")}
        </div>
        <div class="talk-card-title">${escapeHtml(talk.title)}${newBadge}</div>
        <div class="talk-card-footer">${footerIcons}</div>
      `;
      card.addEventListener("click", (e) => {
        if (e.target.closest(".topic-chip")) return;
        openModal(talk);
      });
      card.addEventListener("keydown", (e) => {
        if ((e.key === "Enter" || e.key === " ") && !e.target.closest(".topic-chip")) {
          e.preventDefault();
          openModal(talk);
        }
      });
      grid.appendChild(card);
    }
    emptyState.hidden = visible.length !== 0;
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
           <a class="link-chip" href="${talk.slides_url}" download>
             <img src="/images/topics/slides.png" alt="">
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
            <h2 id="modal-title" class="expanded-title">${escapeHtml(talk.title)}</h2>
            ${videoHtml}
            <div class="expanded-section">
              <h3>Abstract</h3>
              <p>${escapeHtml(talk.abstract)}</p>
            </div>
            <div class="expanded-section">
              <h3>Bio</h3>
              <p>${escapeHtml(talk.bio)}</p>
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
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    overlay.hidden = true;
    document.body.style.overflow = "";
    modalBody.innerHTML = "";
  }

  modalClose.addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.hidden) closeModal();
  });

  [searchInput, modeFilter, statusFilter, tagFilter].forEach((el) =>
    el.addEventListener("input", render)
  );

  render();
  renderTopicsLegend();
})();
