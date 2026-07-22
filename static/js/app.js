(function () {
  const talks = JSON.parse(document.getElementById("talks-data").textContent)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  const tbody = document.getElementById("talks-tbody");
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

  function matchesFilters(talk) {
    const q = searchInput.value.trim().toLowerCase();
    if (q && !`${talk.speaker} ${talk.title}`.toLowerCase().includes(q)) return false;
    if (modeFilter.value !== "all" && talk.mode !== modeFilter.value) return false;
    if (statusFilter.value !== "all" && talk.status !== statusFilter.value) return false;
    if (tagFilter.value !== "all" && !(talk.tags || []).includes(tagFilter.value)) return false;
    return true;
  }

  function render() {
    const visible = talks.filter(matchesFilters);
    tbody.innerHTML = "";
    for (const talk of visible) {
      const tr = document.createElement("tr");
      tr.dataset.id = talk.id;
      tr.innerHTML = `
        <td>${formatDate(talk.date)}</td>
        <td>${escapeHtml(talk.speaker)}</td>
        <td>${escapeHtml(talk.affiliation)}</td>
        <td class="title-cell">${escapeHtml(talk.title)}</td>
      `;
      tr.addEventListener("click", () => openModal(talk));
      tbody.appendChild(tr);
    }
    emptyState.hidden = visible.length !== 0;
  }

  function openModal(talk) {
    const tagsHtml = (talk.tags || [])
      .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
      .join("");

    const videoHtml = talk.youtube_id
      ? `<div class="modal-video"><iframe src="https://www.youtube-nocookie.com/embed/${talk.youtube_id}" title="Talk recording" allowfullscreen loading="lazy"></iframe></div>`
      : "";

    const links = [];
    if (talk.links && talk.links.scholar && talk.links.scholar !== "TBD") {
      links.push(`<a class="btn btn-secondary-outline" href="${talk.links.scholar}" target="_blank" rel="noopener">Google Scholar</a>`);
    }
    if (talk.links && talk.links.homepage) {
      links.push(`<a class="btn btn-secondary-outline" href="${talk.links.homepage}" target="_blank" rel="noopener">Homepage</a>`);
    }
    if (talk.slides_url) {
      links.push(`<a class="btn btn-secondary-outline" href="${talk.slides_url}" target="_blank" rel="noopener">Slides</a>`);
    }

    modalBody.innerHTML = `
      <h2 id="modal-title">${escapeHtml(talk.title)}</h2>
      <p class="modal-meta">${escapeHtml(talk.speaker)} — ${escapeHtml(talk.role)}, ${escapeHtml(talk.affiliation)}<br>
        ${formatDate(talk.date)} · ${escapeHtml(talk.time)} · ${talk.mode === "online" ? "Online" : escapeHtml(talk.location)}</p>
      <div class="modal-tags">${tagsHtml}</div>
      ${videoHtml}
      <div class="modal-section">
        <h3>Abstract</h3>
        <p>${escapeHtml(talk.abstract)}</p>
      </div>
      <div class="modal-section">
        <h3>Bio</h3>
        <p>${escapeHtml(talk.bio)}</p>
      </div>
      ${links.length ? `<div class="modal-links">${links.join("")}</div>` : ""}
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
})();
