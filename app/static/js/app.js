const grid = document.getElementById("games-grid");
const filterButtons = document.querySelectorAll(".filter-btn");
const modal = document.getElementById("game-modal");
const modalTitle = document.getElementById("modal-title");
const gameForm = document.getElementById("game-form");
const gameIdInput = document.getElementById("game-id");
const titleInput = document.getElementById("game-title");
const statusInput = document.getElementById("game-status");
const ratingInput = document.getElementById("game-rating");
const yearInput = document.getElementById("game-year");
const platformInput = document.getElementById("game-platform");
const hoursInput = document.getElementById("game-hours");
const favoriteInput = document.getElementById("game-favorite");
const notesInput = document.getElementById("game-notes");
const fileInput = document.getElementById("game-files");
const folderInput = document.getElementById("game-folder");
const uploadDropzone = document.getElementById("upload-dropzone");
const uploadInfo = document.getElementById("upload-info");
const thumbStrip = document.getElementById("thumb-strip");
const categoryCheckboxesEl = document.getElementById("category-checkboxes");
const categoryFiltersEl = document.getElementById("category-filters");
const openCreateModalBtn = document.getElementById("open-create-modal");
const closeModalBtn = document.getElementById("close-modal-btn");
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const exportPdfBtn = document.getElementById("export-pdf-btn");
const searchInput = document.getElementById("search-input");
const favoriteOnlyInput = document.getElementById("favorite-only");

const CATEGORY_OPTIONS = [
    "RPG",
    "Action",
    "Adventure",
    "Strategy",
    "Simulation",
    "Sports",
    "Racing",
    "Puzzle",
    "Horror",
    "FPS",
    "PVE",
    "PVP",
    "Romantic",
    "Indie",
    "Sandbox",
    "Other",
];

const MAX_IMAGES = 20;

let allGames = [];
let activeFilter = "All";
let activeCategoryFilter = null;
let searchQuery = "";
let favoriteOnly = false;
let lastVisibleGameIds = [];

let pendingFiles = [];
let selectedExistingShots = [];
const slideshowTimers = new Map();
const allowedExts = [".png", ".jpg", ".jpeg", ".bmp", ".avif", ".webp"];

function escapeHtml(value) {
    return (value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getStatusClass(status) {
    const normalized = (status || "").toLowerCase();
    if (normalized === "played") return "status-played";
    if (normalized === "playing") return "status-playing";
    if (normalized === "wishlist") return "status-wishlist";
    return "";
}

function getImageUrl(image) {
    if (!image) return "";
    if (image.startsWith("/uploads/")) return image;
    if (image.startsWith("/static/images/")) return image;
    if (image.startsWith("http://") || image.startsWith("https://")) return image;
    return `/uploads/${image}`;
}

function clearSlideshows() {
    slideshowTimers.forEach((timer) => clearInterval(timer));
    slideshowTimers.clear();
}

function buildCategoryFilters() {
    if (!categoryFiltersEl) return;
    const chips = [
        `<button type="button" class="cat-chip ${activeCategoryFilter === null ? "active" : ""}" data-category="">All categories</button>`,
        ...CATEGORY_OPTIONS.map(
            (c) =>
                `<button type="button" class="cat-chip ${activeCategoryFilter === c ? "active" : ""}" data-category="${escapeHtml(c)}">${escapeHtml(c)}</button>`
        ),
    ];
    categoryFiltersEl.innerHTML = chips.join("");
    categoryFiltersEl.querySelectorAll(".cat-chip").forEach((btn) => {
        btn.addEventListener("click", () => {
            activeCategoryFilter = btn.dataset.category || null;
            categoryFiltersEl.querySelectorAll(".cat-chip").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            renderGames();
        });
    });
}

function buildCategoryCheckboxes() {
    if (!categoryCheckboxesEl) return;
    categoryCheckboxesEl.innerHTML = CATEGORY_OPTIONS.map(
        (c, i) =>
            `<div class="cat-check"><input type="checkbox" id="cat-opt-${i}" value="${escapeHtml(c)}" /><label for="cat-opt-${i}" class="cat-check-label">${escapeHtml(c)}</label></div>`
    ).join("");
}

function getSelectedCategories() {
    const boxes = categoryCheckboxesEl?.querySelectorAll('input[type="checkbox"]') || [];
    return Array.from(boxes)
        .filter((b) => b.checked)
        .map((b) => b.value);
}

function setSelectedCategories(values) {
    const set = new Set(values || []);
    categoryCheckboxesEl?.querySelectorAll('input[type="checkbox"]').forEach((b) => {
        b.checked = set.has(b.value);
    });
}

function totalImageCount() {
    return selectedExistingShots.length + pendingFiles.length;
}

function revokePendingUrls() {
    pendingFiles.forEach((p) => URL.revokeObjectURL(p.url));
}

function renderThumbStrip() {
    if (!thumbStrip) return;
    const parts = [];
    selectedExistingShots.forEach((fn, idx) => {
        const src = getImageUrl(fn);
        parts.push(`
            <div class="thumb-item" data-existing="${escapeHtml(fn)}">
                <img src="${src}" alt="" />
                <button type="button" class="thumb-remove" data-remove-existing="${escapeHtml(fn)}" aria-label="Remove">×</button>
            </div>
        `);
    });
    pendingFiles.forEach((p, idx) => {
        parts.push(`
            <div class="thumb-item" data-pending="${idx}">
                <img src="${p.url}" alt="" />
                <button type="button" class="thumb-remove" data-remove-pending="${idx}" aria-label="Remove">×</button>
            </div>
        `);
    });
    thumbStrip.innerHTML = parts.join("");
    const count = totalImageCount();
    uploadInfo.textContent = count ? `${count} / ${MAX_IMAGES} images` : `0 / ${MAX_IMAGES} images`;
}

function addPendingFiles(fileList) {
    const files = filterUploadFiles(fileList);
    for (const file of files) {
        if (totalImageCount() >= MAX_IMAGES) break;
        pendingFiles.push({ file, url: URL.createObjectURL(file) });
    }
    renderThumbStrip();
}

const ICON_EDIT =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
const ICON_DELETE =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';

function createCoverElement(game) {
    const images = [game.cover, ...(game.screenshots || [])].filter(Boolean);
    const uniqueImages = [...new Set(images)];
    if (!uniqueImages.length) {
        return `<div class="cover-fallback">${escapeHtml(game.title)}</div>`;
    }
    return uniqueImages
        .map(
            (img, idx) =>
                `<img class="slide-img ${idx === 0 ? "active" : ""}" src="${getImageUrl(img)}" alt="${escapeHtml(game.title)}" />`
        )
        .join("");
}

function createGameCard(game) {
    const ratingText =
        game.rating !== null && game.rating !== undefined && game.rating !== ""
            ? `<div class="rating">Rating: <strong>${game.rating}/10</strong></div>`
            : `<div class="rating">Rating: <strong>—</strong></div>`;
    const notesText = game.notes && game.notes.trim() !== "" ? escapeHtml(game.notes) : "No notes added yet.";
    const cats = Array.isArray(game.categories) ? game.categories : [];
    const catLine = cats.length ? cats.map(escapeHtml).join(", ") : "";
    const meta = [
        catLine ? `Categories: ${catLine}` : "",
        game.release_year ? `Year: ${escapeHtml(String(game.release_year))}` : "",
        game.platform ? `Platform: ${escapeHtml(game.platform)}` : "",
        game.completion_hours !== null && game.completion_hours !== undefined
            ? `Hours: ${escapeHtml(String(game.completion_hours))}`
            : "",
    ]
        .filter(Boolean)
        .join(" • ");

    const images = [game.cover, ...(game.screenshots || [])].filter(Boolean);
    const uniqueCount = [...new Set(images)].length;
    const slideshowClass = uniqueCount >= 2 ? "slideshow" : "";
    const coverInner = createCoverElement(game);
    const star = `<button type="button" class="card-star js-favorite-toggle" data-game-id="${game.id}" aria-label="Toggle favorite" aria-pressed="${Boolean(game.favorite)}">${game.favorite ? "★" : "☆"}</button>`;
    const mediaActions = `<div class="card-media-actions">
        <button type="button" class="card-icon-btn js-edit-btn" data-game-id="${game.id}" title="Edit" aria-label="Edit">${ICON_EDIT}</button>
        <button type="button" class="card-icon-btn card-icon-danger js-delete-btn" data-game-id="${game.id}" title="Delete" aria-label="Delete">${ICON_DELETE}</button>
    </div>`;

    return `
        <article class="game-card" data-game-id="${game.id}">
            <div class="card-media">
                <div class="cover-wrap ${slideshowClass}" data-game-id="${game.id}" data-count="${uniqueCount}">
                    ${coverInner}
                </div>
                ${mediaActions}
                ${star}
            </div>
            <div class="card-content">
                <div class="card-top">
                    <h3 class="game-title">${escapeHtml(game.title) || "Untitled Game"}</h3>
                    <span class="status-badge ${getStatusClass(game.status)}">${escapeHtml(game.status) || "Unknown"}</span>
                </div>
                ${meta ? `<p class="meta-text">${meta}</p>` : ""}
                ${ratingText}
                <p class="notes">${notesText}</p>
            </div>
        </article>
    `;
}

function initSlideshows() {
    document.querySelectorAll(".slideshow").forEach((el) => {
        const count = Number(el.dataset.count || 0);
        if (count < 2) return;
        const gameId = Number(el.dataset.gameId);
        const imgs = el.querySelectorAll(".slide-img");
        let index = 0;
        const timer = setInterval(() => {
            imgs[index].classList.remove("active");
            index = (index + 1) % count;
            imgs[index].classList.add("active");
        }, 5000);
        slideshowTimers.set(gameId, timer);
    });
}

function renderGames() {
    clearSlideshows();
    let filteredGames = [...allGames];
    if (activeFilter !== "All") {
        filteredGames = filteredGames.filter((game) => (game.status || "").toLowerCase() === activeFilter.toLowerCase());
    }
    if (favoriteOnly) {
        filteredGames = filteredGames.filter((game) => Boolean(game.favorite));
    }
    if (activeCategoryFilter) {
        filteredGames = filteredGames.filter((game) => (game.categories || []).includes(activeCategoryFilter));
    }
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredGames = filteredGames.filter((game) => {
            const cats = (game.categories || []).join(" ");
            const haystack = `${game.title || ""} ${cats} ${game.platform || ""}`.toLowerCase();
            return haystack.includes(query);
        });
    }
    filteredGames.sort((a, b) => {
        if (Boolean(b.favorite) !== Boolean(a.favorite)) return Number(Boolean(b.favorite)) - Number(Boolean(a.favorite));
        return (b.id || 0) - (a.id || 0);
    });
    lastVisibleGameIds = filteredGames.map((g) => g.id);
    if (!filteredGames.length) {
        grid.innerHTML = `<div class="empty-state glass-panel"><h3>No games found</h3><p>There are no games in this section yet.</p></div>`;
        return;
    }
    grid.innerHTML = filteredGames.map(createGameCard).join("");
    initSlideshows();
}

async function loadGames() {
    try {
        const response = await fetch("/api/games");
        if (response.status === 401) {
            window.location.href = "/login";
            return;
        }
        const data = await response.json();
        allGames = data.games || [];
        renderGames();
    } catch (error) {
        console.error("Failed to load games:", error);
        grid.innerHTML = `<div class="empty-state glass-panel"><h3>Failed to load library</h3><p>Please check your API route.</p></div>`;
    }
}

async function createGame(payload) {
    const response = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (response.status === 401) {
        window.location.href = "/login";
        return null;
    }
    return response.ok ? response.json() : null;
}

async function updateGame(id, payload) {
    const response = await fetch(`/api/games/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (response.status === 401) {
        window.location.href = "/login";
        return null;
    }
    return response.ok ? response.json() : null;
}

async function deleteGame(id) {
    const response = await fetch(`/api/games/${id}`, { method: "DELETE" });
    if (response.status === 401) {
        window.location.href = "/login";
        return false;
    }
    return response.ok;
}

function filterUploadFiles(files) {
    return Array.from(files).filter((file) => {
        const lower = file.name.toLowerCase();
        return allowedExts.some((ext) => lower.endsWith(ext));
    });
}

async function uploadFilesForGame(gameId, setCover = false) {
    if (!pendingFiles.length) return [];
    const formData = new FormData();
    pendingFiles.forEach((p) => formData.append("files", p.file));
    formData.append("game_id", String(gameId));
    formData.append("set_cover", String(setCover));
    const response = await fetch("/api/uploads", { method: "POST", body: formData });
    if (!response.ok) return [];
    const data = await response.json();
    return data.files || [];
}

function openModal(game = null) {
    revokePendingUrls();
    pendingFiles = [];
    selectedExistingShots = [];
    buildCategoryCheckboxes();
    renderThumbStrip();
    if (game) {
        modalTitle.textContent = "Edit Game";
        gameIdInput.value = game.id;
        titleInput.value = game.title || "";
        statusInput.value = game.status || "Wishlist";
        ratingInput.value = game.rating ?? "";
        yearInput.value = game.release_year ?? "";
        platformInput.value = game.platform || "";
        hoursInput.value = game.completion_hours ?? "";
        favoriteInput.checked = Boolean(game.favorite);
        notesInput.value = game.notes || "";
        setSelectedCategories(game.categories || []);
        const rest = (game.screenshots || []).filter((x) => x !== game.cover);
        selectedExistingShots = game.cover ? [game.cover, ...rest] : [...rest];
    } else {
        modalTitle.textContent = "Add Game";
        gameForm.reset();
        gameIdInput.value = "";
        statusInput.value = "Wishlist";
        favoriteInput.checked = false;
        setSelectedCategories([]);
    }
    if (fileInput) fileInput.value = "";
    if (folderInput) folderInput.value = "";
    modal.classList.remove("hidden");
    renderThumbStrip();
}

function closeModal() {
    modal.classList.add("hidden");
    revokePendingUrls();
    pendingFiles = [];
    renderThumbStrip();
}

async function handleGameSubmit(event) {
    event.preventDefault();
    const categories = getSelectedCategories();
    const payload = {
        title: titleInput.value.trim(),
        status: statusInput.value,
        rating: ratingInput.value === "" ? null : Number(ratingInput.value),
        categories,
        release_year: yearInput.value === "" ? null : Number(yearInput.value),
        platform: platformInput.value.trim() || null,
        completion_hours: hoursInput.value === "" ? null : Number(hoursInput.value),
        favorite: favoriteInput.checked,
        notes: notesInput.value.trim() || null,
        cover_filename: null,
        screenshots: [],
    };
    if (!payload.title) {
        alert("Title is required.");
        return;
    }
    if (totalImageCount() > MAX_IMAGES) {
        alert(`Maximum ${MAX_IMAGES} images.`);
        return;
    }

    const gameId = gameIdInput.value;
    if (gameId) {
        const uploaded = await uploadFilesForGame(gameId, false);
        const shots = [...new Set([...selectedExistingShots, ...uploaded])];
        payload.cover_filename = shots[0] || null;
        payload.screenshots = shots.slice(1);
        const result = await updateGame(gameId, payload);
        if (!result) return alert("Unable to update game.");
    } else {
        const result = await createGame({ ...payload, screenshots: [] });
        if (!result || !result.game) return alert("Unable to create game.");
        const newId = result.game.id;
        const uploaded = await uploadFilesForGame(newId, true);
        const shots = [...new Set(uploaded)];
        if (shots.length) {
            await updateGame(newId, {
                cover_filename: shots[0],
                screenshots: shots.slice(1),
            });
        }
    }
    closeModal();
    await loadGames();
}

async function handleGridClick(event) {
    const fav = event.target.closest(".js-favorite-toggle");
    if (fav) {
        event.preventDefault();
        event.stopPropagation();
        const id = Number(fav.dataset.gameId);
        const game = allGames.find((item) => item.id === id);
        if (!game) return;
        await updateGame(id, { favorite: !game.favorite });
        await loadGames();
        return;
    }
    const editBtn = event.target.closest(".js-edit-btn");
    if (editBtn) {
        const id = Number(editBtn.dataset.gameId);
        const game = allGames.find((item) => item.id === id);
        if (game) openModal(game);
        return;
    }
    const deleteBtn = event.target.closest(".js-delete-btn");
    if (!deleteBtn) return;
    const id = Number(deleteBtn.dataset.gameId);
    const game = allGames.find((item) => item.id === id);
    if (!window.confirm(`Delete "${game?.title || "this game"}"?`)) return;
    const ok = await deleteGame(id);
    if (!ok) return alert("Unable to delete game.");
    await loadGames();
}

function handleThumbStripClick(event) {
    const rmEx = event.target.closest("[data-remove-existing]");
    if (rmEx) {
        const fn = rmEx.getAttribute("data-remove-existing");
        selectedExistingShots = selectedExistingShots.filter((f) => f !== fn);
        renderThumbStrip();
        return;
    }
    const rmP = event.target.closest("[data-remove-pending]");
    if (rmP) {
        const idx = Number(rmP.getAttribute("data-remove-pending"));
        const [removed] = pendingFiles.splice(idx, 1);
        if (removed) URL.revokeObjectURL(removed.url);
        renderThumbStrip();
    }
}

function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
    const darkIcon = document.querySelector(".theme-icon-dark");
    const lightIcon = document.querySelector(".theme-icon-light");
    if (darkIcon && lightIcon) {
        darkIcon.style.display = theme === "dark" ? "inline" : "none";
        lightIcon.style.display = theme === "light" ? "inline" : "none";
    }
}

function initTheme() {
    const stored = localStorage.getItem("theme");
    setTheme(stored || "dark");
}

async function exportPdf() {
    if (!lastVisibleGameIds.length) {
        alert("No games to export.");
        return;
    }
    const response = await fetch("/api/games/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: lastVisibleGameIds }),
    });
    if (response.status === 401) {
        window.location.href = "/login";
        return;
    }
    if (!response.ok) {
        alert("Export failed.");
        return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "games-showcase-export.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
        filterButtons.forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");
        activeFilter = button.dataset.filter;
        renderGames();
    });
});

searchInput?.addEventListener("input", () => {
    searchQuery = searchInput.value.trim();
    renderGames();
});

favoriteOnlyInput?.addEventListener("change", () => {
    favoriteOnly = favoriteOnlyInput.checked;
    renderGames();
});

fileInput?.addEventListener("change", (event) => {
    addPendingFiles(event.target.files || []);
    fileInput.value = "";
});

folderInput?.addEventListener("change", (event) => {
    addPendingFiles(event.target.files || []);
    folderInput.value = "";
});

uploadDropzone?.addEventListener("dragover", (event) => {
    event.preventDefault();
    uploadDropzone.classList.add("dragover");
});

uploadDropzone?.addEventListener("dragleave", () => uploadDropzone.classList.remove("dragover"));
uploadDropzone?.addEventListener("drop", (event) => {
    event.preventDefault();
    uploadDropzone.classList.remove("dragover");
    addPendingFiles(event.dataTransfer?.files || []);
});

openCreateModalBtn?.addEventListener("click", () => openModal());
closeModalBtn?.addEventListener("click", closeModal);
themeToggleBtn?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(next);
});
exportPdfBtn?.addEventListener("click", exportPdf);
modal?.addEventListener("click", (event) => {
    if (event.target.dataset.closeModal === "true") closeModal();
});
gameForm?.addEventListener("submit", handleGameSubmit);
grid?.addEventListener("click", handleGridClick);
thumbStrip?.addEventListener("click", handleThumbStripClick);

buildCategoryCheckboxes();
buildCategoryFilters();
initTheme();
loadGames();
