const reviewsStatus = document.querySelector("#reviews-status");
const reviewsList = document.querySelector("#reviews-list");
const filterButtons = document.querySelectorAll("[data-review-filter]");
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
const imageUrlInput = document.querySelector("#review-image-url");
const displayOrderInput = document.querySelector("#review-display-order");
const publishedInput = document.querySelector("#review-is-published");

let reviews = [];
let activeFilter = "all";

function initials(name) {
    return (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function reviewMatchesFilter(review) {
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

    const image = document.createElement("div");
    image.className = "review-row__image";
    if (review.clientImageUrl) {
        const img = document.createElement("img");
        img.src = review.clientImageUrl;
        img.alt = "";
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

    row.append(image, identity, quote, meta, order, actions);
    return row;
}

function renderReviews() {
    const visibleReviews = reviews.filter(reviewMatchesFilter);
    reviewsList.replaceChildren(...visibleReviews.map(createReviewRow));
    reviewsList.hidden = visibleReviews.length === 0;
    reviewsStatus.hidden = visibleReviews.length > 0;
    if (!visibleReviews.length) reviewsStatus.textContent = reviews.length ? "No reviews match this filter." : "No reviews have been added yet.";
}

async function requestJson(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        cache: "no-store",
        headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers }
    });
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || `Request failed with status ${response.status}.`);
    return data;
}

async function loadReviews(message = "Loading reviews…") {
    reviewsStatus.hidden = false;
    reviewsStatus.textContent = message;
    try {
        const data = await requestJson("/api/admin/reviews");
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
    clientTypeInput.value = review?.clientType || "";
    ratingInput.value = review?.rating || "";
    imageUrlInput.value = review?.clientImageUrl || "";
    displayOrderInput.value = review?.displayOrder ?? 0;
    publishedInput.checked = Boolean(review?.isPublished);
    reviewDialogTitle.textContent = review ? "Edit Review" : "Add Review";
    saveReviewButton.textContent = review ? "Save Changes" : "Add Review";
    reviewDialog.showModal();
    clientNameInput.focus();
}

function closeReviewDialog() {
    reviewDialog.close();
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
        clientImageUrl: imageUrlInput.value || null,
        displayOrder: Number(displayOrderInput.value),
        isPublished: publishedInput.checked
    };
    saveReviewButton.disabled = true;
    reviewFormStatus.textContent = reviewId ? "Saving changes…" : "Adding review…";
    try {
        await requestJson(reviewId ? `/api/reviews/${reviewId}` : "/api/reviews", { method: reviewId ? "PATCH" : "POST", body: JSON.stringify(payload) });
        closeReviewDialog();
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
addReviewButton.addEventListener("click", () => openReviewDialog());
closeReviewDialogButton.addEventListener("click", closeReviewDialog);
cancelReviewButton.addEventListener("click", closeReviewDialog);
reviewDialog.addEventListener("click", (event) => { if (event.target === reviewDialog) closeReviewDialog(); });

loadReviews();
