const reviewsStatus = document.querySelector("#reviews-status");
const reviewsList = document.querySelector("#reviews-list");
const filterButtons = document.querySelectorAll("[data-review-filter]");
const selectReviewsButton = document.querySelector("#select-reviews");
const deleteSelectedReviewsButton = document.querySelector("#delete-selected-reviews");
const selectedReviewsCount = document.querySelector("#selected-reviews-count");
const addReviewButton = document.querySelector("#add-review-button");
const reviewDialog = document.querySelector("#review-dialog");
const reviewForm = document.querySelector("#review-form");
const reviewDialogTitle = document.querySelector("#review-dialog-title");
const closeReviewDialogButton = document.querySelector("#close-review-dialog");
const cancelReviewButton = document.querySelector("#cancel-review");
const saveReviewButton = document.querySelector("#save-review");
const reviewFormStatus = document.querySelector("#review-form-status");
const reviewIdInput = document.querySelector("#review-id");
const clientNameInput = document.querySelector("#review-client-name");
const quoteInput = document.querySelector("#review-quote");
const clientTypeInput = document.querySelector("#review-client-type");
const ratingInput = document.querySelector("#review-rating");
const displayOrderInput = document.querySelector("#review-display-order");
const publishedInput = document.querySelector("#review-is-published");
const ratingButtons = [...document.querySelectorAll("[data-review-rating]")];
const reviewImageDropzone = document.querySelector("#review-image-dropzone");
const reviewImageFile = document.querySelector("#review-image-file");
const reviewImageAction = document.querySelector("#review-image-action");
const replaceReviewImageButton = document.querySelector("#replace-review-image");
const removeReviewImageButton = document.querySelector("#remove-review-image");
const reviewImageFocal = document.querySelector("#review-image-focal");
const reviewImageFit = document.querySelector("#review-image-fit");
const reviewImageFocalX = document.querySelector("#review-image-focal-x");
const reviewImageFocalY = document.querySelector("#review-image-focal-y");
const reviewImageStatus = document.querySelector("#review-image-status");
const previewMedia = document.querySelector("#review-preview-media");
const previewImage = document.querySelector("#review-preview-image");
const previewQuote = document.querySelector("#review-preview-quote");
const previewName = document.querySelector("#review-preview-name");
const previewType = document.querySelector("#review-preview-type");
const previewStars = document.querySelector("#review-preview-stars");
const agentReviewMode = document.body.dataset.reviewAudience === "agents";

let reviews = [];
let activeFilter = "all";
let reviewImage = null;
let originalReviewImagePath = null;
let pendingReviewImagePath = null;
let selectionMode = false;
const selectedReviewIds = new Set();

function initials(name) {
    return (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function setRating(value) {
    ratingInput.value = value ? String(value) : "";
    ratingButtons.forEach((button) => {
        const active = Number(button.dataset.reviewRating) <= Number(value || 0);
        button.classList.toggle("is-active", active);
        button.textContent = active ? "★" : "☆";
        button.setAttribute("aria-pressed", String(Number(button.dataset.reviewRating) === Number(value || 0)));
    });
    renderReviewPreview();
}

function renderReviewPreview() {
    const name = clientNameInput.value.trim() || "Client Name";
    const quote = quoteInput.value.trim() || "Your client's testimonial will appear here.";
    const type = clientTypeInput.value.trim() || "Client Story";
    const rating = Number(ratingInput.value || 0);
    const imageUrl = reviewImage?.publicUrl || reviewImage?.legacyUrl || null;

    previewName.textContent = name;
    previewQuote.textContent = `“${quote}”`;
    previewType.textContent = type;
    previewStars.textContent = rating ? `${"★".repeat(rating)}${"☆".repeat(5 - rating)}` : "☆☆☆☆☆";
    previewStars.setAttribute("aria-label", rating ? `${rating} out of 5 stars` : "No rating");

    if (imageUrl) {
        previewImage.src = imageUrl;
        previewImage.style.objectPosition = `${reviewImage.focalX}% ${reviewImage.focalY}%`;
        previewImage.style.objectFit = reviewImage.fit === "contain" ? "contain" : "cover";
        previewMedia.classList.add("has-image");
        previewMedia.closest(".review-card-preview").classList.remove("review-card-preview--text-only");
        reviewImageFocal.hidden = false;
        reviewImageFit.hidden = false;
        const fitInput = reviewImageFit.querySelector(`[value="${reviewImage.fit === "contain" ? "contain" : "cover"}"]`);
        if (fitInput) fitInput.checked = true;
        reviewImageFocalX.value = reviewImage.focalX;
        reviewImageFocalY.value = reviewImage.focalY;
        replaceReviewImageButton.hidden = false;
        removeReviewImageButton.disabled = false;
        reviewImageAction.textContent = "Replace client photo";
    } else {
        previewImage.removeAttribute("src");
        previewMedia.classList.remove("has-image");
        previewMedia.closest(".review-card-preview").classList.add("review-card-preview--text-only");
        reviewImageFocal.hidden = true;
        reviewImageFit.hidden = true;
        replaceReviewImageButton.hidden = true;
        removeReviewImageButton.disabled = true;
        reviewImageAction.textContent = "Upload client photo";
    }
    reviewImagePositionControl?.setEnabled(Boolean(imageUrl));
}

const reviewImagePositionControl = new window.ManagedImagePositionControl({
    frame: previewMedia,
    image: previewImage,
    getPosition: () => reviewImage,
    onChange: ({ focalX, focalY }) => {
        if (!reviewImage) return;
        reviewImage.focalX = focalX;
        reviewImage.focalY = focalY;
        reviewImageFocalX.value = focalX;
        reviewImageFocalY.value = focalY;
        renderReviewPreview();
    }
});

function reviewMatchesFilter(review) {
    const isAgentReview = (review.clientType || "").trim().toLowerCase() === "agent";
    if (agentReviewMode !== isAgentReview) return false;
    if (activeFilter === "archived") return Boolean(review.archivedAt);
    if (activeFilter === "published") return review.isPublished && !review.archivedAt;
    if (activeFilter === "hidden") return !review.isPublished && !review.archivedAt;
    return true;
}

function createBadge(label, modifier = "") {
    const badge = document.createElement("span");
    badge.className = `review-row__badge${modifier ? ` review-row__badge--${modifier}` : ""}`;
    badge.textContent = label;
    return badge;
}

function createAction(label, handler, className = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    if (className) button.className = className;
    button.addEventListener("click", handler);
    return button;
}

function createReviewRow(review) {
    const row = document.createElement("article");
    row.className = `review-row${review.archivedAt ? " is-archived" : ""}`;

    const selector = document.createElement("label");
    selector.className = "review-row__selector";
    selector.hidden = !selectionMode;
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedReviewIds.has(review.id);
    checkbox.setAttribute("aria-label", `Select review from ${review.clientName}`);
    checkbox.addEventListener("change", () => {
        if (checkbox.checked) selectedReviewIds.add(review.id);
        else selectedReviewIds.delete(review.id);
        updateSelectionControls();
    });
    selector.append(checkbox);

    const image = document.createElement("div");
    image.className = "review-row__image";
    if (review.clientImageUrl) {
        const img = document.createElement("img");
        img.src = review.clientImageUrl;
        img.alt = "";
        img.style.objectPosition = `${review.clientImageFocalX ?? 50}% ${review.clientImageFocalY ?? 50}%`;
        img.addEventListener("error", () => image.replaceChildren(document.createTextNode(initials(review.clientName))));
        image.append(img);
    } else image.textContent = initials(review.clientName);

    const identity = document.createElement("div");
    identity.className = "review-row__identity";
    const name = document.createElement("h3");
    name.textContent = review.clientName;
    const type = document.createElement("p");
    type.textContent = review.clientType || "Client type not set";
    identity.append(name, type);

    const quote = document.createElement("p");
    quote.className = "review-row__quote";
    quote.textContent = `“${review.quote}”`;

    const meta = document.createElement("div");
    meta.className = "review-row__meta";
    meta.append(document.createTextNode(review.rating ? `${"★".repeat(review.rating)} ${review.rating}/5` : "No rating"));
    const badges = document.createElement("div");
    badges.className = "review-row__badges";
    badges.append(createBadge(review.isPublished ? "Published" : "Hidden", review.isPublished ? "published" : ""));
    if (review.archivedAt) badges.append(createBadge("Archived", "archived"));
    meta.append(badges);

    const order = document.createElement("span");
    order.className = "review-row__order";
    order.textContent = `Order ${review.displayOrder}`;

    const actions = document.createElement("div");
    actions.className = "review-row__actions";
    actions.append(
        createAction("Edit", () => openReviewDialog(review)),
        createAction(review.isPublished ? "Hide" : "Publish", () => updateReview(review.id, { isPublished: !review.isPublished }, review.isPublished ? "Hiding review…" : "Publishing review…")),
        createAction(review.archivedAt ? "Restore" : "Archive", () => changeArchiveState(review), "review-row__archive")
    );

    row.append(selector, image, identity, quote, meta, order, actions);
    return row;
}

function updateSelectionControls() {
    const count = selectedReviewIds.size;
    reviewsList.classList.toggle("is-selecting", selectionMode);
    selectReviewsButton.textContent = selectionMode ? "Cancel selection" : "Select reviews";
    selectReviewsButton.setAttribute("aria-pressed", String(selectionMode));
    selectedReviewsCount.hidden = !selectionMode;
    deleteSelectedReviewsButton.hidden = !selectionMode;
    selectedReviewsCount.textContent = `${count} selected`;
    deleteSelectedReviewsButton.disabled = count === 0;
}

function renderReviews() {
    const visibleReviews = reviews.filter(reviewMatchesFilter);
    reviewsList.replaceChildren(...visibleReviews.map(createReviewRow));
    reviewsList.hidden = visibleReviews.length === 0;
    reviewsStatus.hidden = visibleReviews.length > 0;
    if (!visibleReviews.length) reviewsStatus.textContent = reviews.length ? "No reviews match this filter." : "No reviews have been added yet.";
    updateSelectionControls();
}

function toggleReviewSelection() {
    selectionMode = !selectionMode;
    if (!selectionMode) selectedReviewIds.clear();
    renderReviews();
}

async function deleteSelectedReviews() {
    const selectedReviews = reviews.filter((review) => selectedReviewIds.has(review.id));
    if (!selectedReviews.length) return;
    const label = `${selectedReviews.length} review${selectedReviews.length === 1 ? "" : "s"}`;
    if (!window.confirm(`Permanently delete ${label}? This cannot be undone.`)) return;

    selectReviewsButton.disabled = true;
    deleteSelectedReviewsButton.disabled = true;
    reviewsStatus.hidden = false;
    reviewsStatus.textContent = `Deleting ${label}…`;
    let deletedCount = 0;
    const failures = [];
    for (const review of selectedReviews) {
        try {
            await requestJson(`/api/reviews/${review.id}`, { method: "DELETE" });
            deletedCount += 1;
            selectedReviewIds.delete(review.id);
            if (review.clientImagePath) await deleteManagedImage(review.clientImagePath).catch(() => {});
        } catch (error) {
            failures.push(review.clientName);
        }
    }

    selectionMode = failures.length > 0;
    selectReviewsButton.disabled = false;
    await loadReviews("Refreshing reviews…");
    if (failures.length) {
        reviewsStatus.hidden = false;
        reviewsStatus.textContent = `${deletedCount} deleted. ${failures.length} could not be deleted; please try again.`;
    }
}

async function requestJson(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        cache: "no-store",
        headers: { Accept: "application/json", ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...options.headers }
    });
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || `Request failed with status ${response.status}.`);
    return data;
}

async function loadReviews(message = "Loading reviews…") {
    reviewsStatus.hidden = false;
    reviewsStatus.textContent = message;
    try {
        const audience = agentReviewMode ? "agents" : "clients";
        const data = await requestJson(`/api/admin/reviews?audience=${audience}`);
        if (!Array.isArray(data)) throw new Error("Reviews response was not an array.");
        reviews = data;
        renderReviews();
    } catch (error) {
        console.error("Unable to load reviews:", error);
        reviewsList.hidden = true;
        reviewsStatus.hidden = false;
        reviewsStatus.textContent = error.message || "Reviews could not be loaded.";
    }
}

function openReviewDialog(review = null) {
    reviewForm.reset();
    reviewFormStatus.textContent = "";
    reviewIdInput.value = review?.id || "";
    clientNameInput.value = review?.clientName || "";
    quoteInput.value = review?.quote || "";
    clientTypeInput.value = review?.clientType || (agentReviewMode ? "Agent" : "");
    setRating(review?.rating || null);
    reviewImage = review?.clientImageUrl ? {
        storagePath: review.clientImagePath || null,
        publicUrl: review.clientImageUrl,
        legacyUrl: review.clientImagePath ? null : review.clientImageUrl,
        focalX: Number(review.clientImageFocalX ?? 50),
        focalY: Number(review.clientImageFocalY ?? 50),
        fit: review.clientImageFit === "contain" ? "contain" : "cover"
    } : null;
    originalReviewImagePath = review?.clientImagePath || null;
    pendingReviewImagePath = null;
    displayOrderInput.value = review?.displayOrder ?? 0;
    publishedInput.checked = Boolean(review?.isPublished);
    reviewDialogTitle.textContent = review ? "Edit Review" : "Add Review";
    saveReviewButton.textContent = review ? "Save Changes" : "Add Review";
    reviewImageStatus.textContent = "";
    renderReviewPreview();
    reviewDialog.showModal();
    clientNameInput.focus();
}

async function closeReviewDialog() {
    if (pendingReviewImagePath) {
        const abandonedPath = pendingReviewImagePath;
        pendingReviewImagePath = null;
        await deleteManagedImage(abandonedPath).catch(() => {});
    }
    reviewDialog.close();
}

async function deleteManagedImage(storagePath) {
    if (!storagePath) return;
    await requestJson("/api/admin/media/images", { method: "DELETE", body: JSON.stringify({ storagePath }) });
}

async function uploadReviewImage(file) {
    const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!supportedTypes.has(file.type)) {
        reviewImageStatus.textContent = "Choose a JPEG, PNG, or WebP image.";
        return;
    }
    if (file.size > 8 * 1024 * 1024) {
        reviewImageStatus.textContent = "Images must be 8 MB or smaller.";
        return;
    }
    const body = new FormData();
    body.append("scope", "review-card");
    body.append("file", file);
    reviewImageStatus.textContent = "Uploading and preparing photo…";
    reviewImageDropzone.classList.add("is-uploading");
    try {
        const uploaded = await requestJson("/api/admin/media/images", { method: "POST", body });
        if (pendingReviewImagePath) await deleteManagedImage(pendingReviewImagePath).catch(() => {});
        pendingReviewImagePath = uploaded.storagePath;
        reviewImage = { storagePath: uploaded.storagePath, publicUrl: uploaded.publicUrl, legacyUrl: null, focalX: 50, focalY: 50, fit: "cover" };
        reviewImageStatus.textContent = "Photo ready. Save the review to publish it.";
        renderReviewPreview();
    } catch (error) {
        reviewImageStatus.textContent = error.message;
    } finally {
        reviewImageDropzone.classList.remove("is-uploading");
        reviewImageFile.value = "";
    }
}

async function removeReviewImage() {
    if (pendingReviewImagePath) {
        await deleteManagedImage(pendingReviewImagePath).catch(() => {});
        pendingReviewImagePath = null;
    }
    reviewImage = null;
    reviewImageStatus.textContent = "The client photo will be removed when you save.";
    renderReviewPreview();
}

async function updateReview(reviewId, payload, progressMessage) {
    reviewsStatus.hidden = false;
    reviewsStatus.textContent = progressMessage;
    try {
        await requestJson(`/api/reviews/${reviewId}`, { method: "PATCH", body: JSON.stringify(payload) });
        await loadReviews("Refreshing reviews…");
    } catch (error) {
        reviewsStatus.hidden = false;
        reviewsStatus.textContent = error.message;
    }
}

async function changeArchiveState(review) {
    const action = review.archivedAt ? "restore" : "archive";
    if (!review.archivedAt && !window.confirm(`Archive the review from ${review.clientName}?`)) return;
    reviewsStatus.hidden = false;
    reviewsStatus.textContent = `${action === "archive" ? "Archiving" : "Restoring"} review…`;
    try {
        await requestJson(`/api/reviews/${review.id}/${action}`, { method: "PATCH" });
        await loadReviews("Refreshing reviews…");
    } catch (error) {
        reviewsStatus.hidden = false;
        reviewsStatus.textContent = error.message;
    }
}

reviewForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!reviewForm.reportValidity()) return;
    const reviewId = reviewIdInput.value;
    const payload = {
        clientName: clientNameInput.value,
        quote: quoteInput.value,
        clientType: clientTypeInput.value || null,
        rating: ratingInput.value ? Number(ratingInput.value) : null,
        clientImageUrl: reviewImage?.storagePath ? null : reviewImage?.legacyUrl || null,
        clientImagePath: reviewImage?.storagePath || null,
        clientImageFocalX: Number(reviewImage?.focalX ?? 50),
        clientImageFocalY: Number(reviewImage?.focalY ?? 50),
        clientImageFit: reviewImage?.fit === "contain" ? "contain" : "cover",
        displayOrder: Number(displayOrderInput.value),
        isPublished: publishedInput.checked
    };
    saveReviewButton.disabled = true;
    reviewFormStatus.textContent = reviewId ? "Saving changes…" : "Adding review…";
    try {
        await requestJson(reviewId ? `/api/reviews/${reviewId}` : "/api/reviews", { method: reviewId ? "PATCH" : "POST", body: JSON.stringify(payload) });
        const supersededImagePath = originalReviewImagePath && originalReviewImagePath !== reviewImage?.storagePath ? originalReviewImagePath : null;
        pendingReviewImagePath = null;
        reviewDialog.close();
        if (supersededImagePath) await deleteManagedImage(supersededImagePath).catch(() => {});
        await loadReviews("Refreshing reviews…");
    } catch (error) {
        reviewFormStatus.textContent = error.message;
    } finally {
        saveReviewButton.disabled = false;
    }
});

filterButtons.forEach((button) => button.addEventListener("click", () => {
    activeFilter = button.dataset.reviewFilter;
    filterButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    renderReviews();
}));
selectReviewsButton.addEventListener("click", toggleReviewSelection);
deleteSelectedReviewsButton.addEventListener("click", deleteSelectedReviews);
addReviewButton.addEventListener("click", () => openReviewDialog());
closeReviewDialogButton.addEventListener("click", closeReviewDialog);
cancelReviewButton.addEventListener("click", closeReviewDialog);
reviewDialog.addEventListener("click", (event) => { if (event.target === reviewDialog) closeReviewDialog(); });
reviewDialog.addEventListener("cancel", (event) => { event.preventDefault(); closeReviewDialog(); });
[clientNameInput, quoteInput, clientTypeInput].forEach((input) => input.addEventListener("input", renderReviewPreview));
ratingButtons.forEach((button) => button.addEventListener("click", () => {
    const value = Number(button.dataset.reviewRating);
    setRating(Number(ratingInput.value) === value ? null : value);
}));
reviewImageFile.addEventListener("change", (event) => { if (event.target.files[0]) uploadReviewImage(event.target.files[0]); });
reviewImageDropzone.addEventListener("click", () => reviewImageFile.click());
replaceReviewImageButton.addEventListener("click", () => reviewImageFile.click());
removeReviewImageButton.addEventListener("click", removeReviewImage);
reviewImageDropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        reviewImageFile.click();
    }
});
["dragenter", "dragover"].forEach((name) => reviewImageDropzone.addEventListener(name, (event) => {
    event.preventDefault();
    reviewImageDropzone.classList.add("is-dragging");
}));
["dragleave", "drop"].forEach((name) => reviewImageDropzone.addEventListener(name, (event) => {
    event.preventDefault();
    reviewImageDropzone.classList.remove("is-dragging");
}));
reviewImageDropzone.addEventListener("drop", (event) => { if (event.dataTransfer.files[0]) uploadReviewImage(event.dataTransfer.files[0]); });
[reviewImageFocalX, reviewImageFocalY].forEach((input) => input.addEventListener("input", () => {
    if (!reviewImage) return;
    reviewImage.focalX = Number(reviewImageFocalX.value);
    reviewImage.focalY = Number(reviewImageFocalY.value);
    renderReviewPreview();
}));
reviewImageFit.addEventListener("input", (event) => {
    if (!reviewImage || event.target.name !== "review-image-fit") return;
    reviewImage.fit = event.target.value === "contain" ? "contain" : "cover";
    renderReviewPreview();
});

loadReviews();
