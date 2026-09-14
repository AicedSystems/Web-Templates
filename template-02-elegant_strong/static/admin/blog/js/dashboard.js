const publishedPostCount = document.querySelector("#published-post-count");
const draftCount = document.querySelector("#draft-count");
const draftSummary = document.querySelector("#draft-summary");
const postsStatus = document.querySelector("#posts-status");
const postsTable = document.querySelector("#posts-table");
const postsList = document.querySelector("#posts-list");
const postRowTemplate = document.querySelector("#post-row-template");
const selectAllCheckbox = document.querySelector("#posts-select-all");
const selectedCount = document.querySelector("#posts-selected-count");
const bulkArchiveButton = document.querySelector("#bulk-archive");
const bulkDeleteButton = document.querySelector("#bulk-delete");
let visiblePosts = [];

const categoryLabels = {
    "market-updates": "Market Updates",
    recruiting: "Recruiting",
    "success-stories": "Success Stories",
    training: "Training"
};

function formatPublishedDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Date unavailable";

    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    }).format(date);
}

function createPostRow(post) {
    const row = postRowTemplate.content.cloneNode(true);
    const rowElement = row.querySelector(".post-row");
    const title = row.querySelector(".post-row__title");
    const category = row.querySelector(".post-row__category");
    const date = row.querySelector(".post-row__date");
    const status = row.querySelector(".post-row__status");
    const link = row.querySelector(".post-row__link");
    const archiveButton = row.querySelector('[data-post-action="archive"]');
    const deleteButton = row.querySelector('[data-post-action="delete"]');
    const checkbox = row.querySelector(".post-row__checkbox");
    const isArchived = post.status === "archived";

    rowElement.dataset.postId = post.id;
    checkbox.value = post.id;
    checkbox.setAttribute("aria-label", `Select ${post.title || "article"}`);
    checkbox.addEventListener("change", updateBulkSelection);
    title.textContent = post.title || "Untitled article";
    category.textContent = categoryLabels[post.category] || post.category || "Uncategorized";
    date.dateTime = post.publishedDate || "";
    date.textContent = formatPublishedDate(post.publishedDate);
    status.textContent = isArchived ? "Archived" : "Published";
    status.classList.toggle("post-row__status--archived", isArchived);
    link.href = `/blog/${post.id}`;
    link.hidden = isArchived;
    archiveButton.textContent = isArchived ? "Restore" : "Archive";
    archiveButton.dataset.postAction = isArchived ? "restore" : "archive";
    archiveButton.addEventListener("click", () => updatePostStatus(post, archiveButton.dataset.postAction));
    deleteButton.setAttribute("aria-label", `Permanently delete ${post.title || "article"}`);
    deleteButton.addEventListener("click", () => permanentlyDeletePost(post));

    return row;
}

function getSelectedPosts() {
    const selectedIds = new Set(
        [...postsList.querySelectorAll(".post-row__checkbox:checked")].map((checkbox) => checkbox.value)
    );
    return visiblePosts.filter((post) => selectedIds.has(String(post.id)));
}

function updateBulkSelection() {
    const checkboxes = [...postsList.querySelectorAll(".post-row__checkbox")];
    const checkedCount = checkboxes.filter((checkbox) => checkbox.checked).length;

    selectedCount.textContent = `${checkedCount} selected`;
    bulkArchiveButton.disabled = checkedCount === 0;
    bulkDeleteButton.disabled = checkedCount === 0;
    selectAllCheckbox.checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
    selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
}

selectAllCheckbox.addEventListener("change", () => {
    postsList.querySelectorAll(".post-row__checkbox").forEach((checkbox) => {
        checkbox.checked = selectAllCheckbox.checked;
    });
    updateBulkSelection();
});

async function runBulkAction(action) {
    const selectedPosts = getSelectedPosts();
    if (selectedPosts.length === 0) return;

    const isDelete = action === "delete";
    const label = `${selectedPosts.length} selected article${selectedPosts.length === 1 ? "" : "s"}`;
    const prompt = isDelete
        ? `Permanently delete ${label}? This cannot be undone.`
        : `Archive ${label}? You can restore them later.`;
    if (!window.confirm(prompt)) return;

    bulkArchiveButton.disabled = true;
    bulkDeleteButton.disabled = true;
    postsStatus.hidden = false;
    postsStatus.textContent = `${isDelete ? "Deleting" : "Archiving"} ${label}…`;

    const results = await Promise.allSettled(selectedPosts.map((post) => (
        sendPostAction(
            isDelete ? `/api/posts/${post.id}` : `/api/posts/${post.id}/archive`,
            isDelete ? "DELETE" : "PATCH"
        )
    )));
    const failedCount = results.filter((result) => result.status === "rejected").length;

    await loadPublishedPosts();
    if (failedCount > 0) {
        postsStatus.hidden = false;
        postsStatus.textContent = `${failedCount} article${failedCount === 1 ? "" : "s"} could not be updated.`;
    }
}

bulkArchiveButton.addEventListener("click", () => runBulkAction("archive"));
bulkDeleteButton.addEventListener("click", () => runBulkAction("delete"));

async function sendPostAction(url, method) {
    const response = await fetch(url, {
        method,
        headers: { Accept: "application/json" }
    });
    const responseData = response.status === 204
        ? null
        : await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(responseData?.message || `Request failed with status ${response.status}`);
    }

    return responseData;
}

async function updatePostStatus(post, action) {
    const actionLabel = action === "archive" ? "archive" : "restore";
    if (!window.confirm(`Are you sure you want to ${actionLabel} “${post.title}”?`)) return;

    postsStatus.hidden = false;
    postsStatus.textContent = `${actionLabel === "archive" ? "Archiving" : "Restoring"} article…`;

    try {
        await sendPostAction(`/api/posts/${post.id}/${action}`, "PATCH");
        await loadPublishedPosts();
    } catch (error) {
        console.error(`Unable to ${actionLabel} post:`, error);
        postsStatus.textContent = error.message || `The article could not be ${actionLabel}d.`;
    }
}

async function permanentlyDeletePost(post) {
    const confirmed = window.confirm(
        `Permanently delete “${post.title}”? This cannot be undone.`
    );
    if (!confirmed) return;

    postsStatus.hidden = false;
    postsStatus.textContent = "Permanently deleting article…";

    try {
        await sendPostAction(`/api/posts/${post.id}`, "DELETE");
        await loadPublishedPosts();
    } catch (error) {
        console.error("Unable to permanently delete post:", error);
        postsStatus.textContent = error.message || "The article could not be deleted.";
    }
}

function loadBrowserDraftSummary() {
    try {
        const storedDraft = localStorage.getItem("cmsPostDraft");
        const draft = storedDraft ? JSON.parse(storedDraft) : null;
        const hasDraft = Boolean(draft && typeof draft === "object");

        draftCount.textContent = hasDraft ? "1" : "0";
        draftSummary.textContent = hasDraft
            ? draft.title?.trim() || "Untitled browser draft"
            : "No draft saved in this browser.";
    } catch (error) {
        console.error("Unable to read the browser draft:", error);
        draftCount.textContent = "—";
        draftSummary.textContent = "Draft information is unavailable.";
    }
}

async function loadPublishedPosts() {
    postsTable.hidden = true;
    postsList.replaceChildren();
    postsStatus.hidden = false;
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
    visiblePosts = [];
    updateBulkSelection();

    try {
        const response = await fetch("/api/admin/posts", {
            cache: "no-store",
            headers: { Accept: "application/json" }
        });

        if (!response.ok) {
            throw new Error(`Posts request failed with status ${response.status}`);
        }

        const posts = await response.json();
        if (!Array.isArray(posts)) throw new Error("Posts response was not an array.");

        const publishedPosts = posts.filter((post) => post.status === "published");
        visiblePosts = publishedPosts.slice(0, 12);
        publishedPostCount.textContent = publishedPosts.length.toLocaleString();

        if (publishedPosts.length === 0) {
            postsStatus.textContent = "No articles have been published yet.";
            return;
        }

        postsList.replaceChildren(...visiblePosts.map(createPostRow));
        postsTable.hidden = false;
        postsStatus.hidden = true;
    } catch (error) {
        console.error("Unable to load published posts:", error);
        publishedPostCount.textContent = "—";
        postsStatus.textContent = "Published posts could not be loaded. Please try again.";
    }
}

loadBrowserDraftSummary();
loadPublishedPosts();
