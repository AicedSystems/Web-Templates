const archivedCount = document.querySelector("#archived-count");
const archivedStatus = document.querySelector("#archived-status");
const archivedTable = document.querySelector("#archived-table");
const archivedList = document.querySelector("#archived-list");
const archivedRowTemplate = document.querySelector("#archived-row-template");
const selectAllCheckbox = document.querySelector("#archived-select-all");
const selectedCount = document.querySelector("#archived-selected-count");
const bulkRestoreButton = document.querySelector("#bulk-restore");
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

async function restorePost(post) {
    if (!window.confirm(`Restore “${post.title}” to the public blog?`)) return;

    archivedStatus.hidden = false;
    archivedStatus.textContent = "Restoring article…";

    try {
        await sendPostAction(`/api/posts/${post.id}/restore`, "PATCH");
        await loadArchivedPosts();
    } catch (error) {
        console.error("Unable to restore post:", error);
        archivedStatus.textContent = error.message || "The article could not be restored.";
    }
}

async function permanentlyDeletePost(post) {
    if (!window.confirm(`Permanently delete “${post.title}”? This cannot be undone.`)) return;

    archivedStatus.hidden = false;
    archivedStatus.textContent = "Permanently deleting article…";

    try {
        await sendPostAction(`/api/posts/${post.id}`, "DELETE");
        await loadArchivedPosts();
    } catch (error) {
        console.error("Unable to permanently delete post:", error);
        archivedStatus.textContent = error.message || "The article could not be deleted.";
    }
}

function createArchivedRow(post) {
    const row = archivedRowTemplate.content.cloneNode(true);
    const rowElement = row.querySelector(".post-row");
    const date = row.querySelector(".post-row__date");
    const checkbox = row.querySelector(".post-row__checkbox");

    rowElement.dataset.postId = post.id;
    checkbox.value = post.id;
    checkbox.setAttribute("aria-label", `Select ${post.title || "article"}`);
    checkbox.addEventListener("change", updateBulkSelection);
    row.querySelector(".post-row__title").textContent = post.title || "Untitled article";
    row.querySelector(".post-row__category").textContent =
        categoryLabels[post.category] || post.category || "Uncategorized";
    date.dateTime = post.publishedDate || "";
    date.textContent = formatPublishedDate(post.publishedDate);
    row.querySelector('[data-post-action="restore"]').addEventListener("click", () => restorePost(post));
    row.querySelector('[data-post-action="delete"]').addEventListener("click", () => permanentlyDeletePost(post));

    return row;
}

function getSelectedPosts() {
    const selectedIds = new Set(
        [...archivedList.querySelectorAll(".post-row__checkbox:checked")].map((checkbox) => checkbox.value)
    );
    return visiblePosts.filter((post) => selectedIds.has(String(post.id)));
}

function updateBulkSelection() {
    const checkboxes = [...archivedList.querySelectorAll(".post-row__checkbox")];
    const checkedCount = checkboxes.filter((checkbox) => checkbox.checked).length;

    selectedCount.textContent = `${checkedCount} selected`;
    bulkRestoreButton.disabled = checkedCount === 0;
    bulkDeleteButton.disabled = checkedCount === 0;
    selectAllCheckbox.checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
    selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
}

selectAllCheckbox.addEventListener("change", () => {
    archivedList.querySelectorAll(".post-row__checkbox").forEach((checkbox) => {
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
        : `Restore ${label} to the public blog?`;
    if (!window.confirm(prompt)) return;

    bulkRestoreButton.disabled = true;
    bulkDeleteButton.disabled = true;
    archivedStatus.hidden = false;
    archivedStatus.textContent = `${isDelete ? "Deleting" : "Restoring"} ${label}…`;

    const results = await Promise.allSettled(selectedPosts.map((post) => (
        sendPostAction(
            isDelete ? `/api/posts/${post.id}` : `/api/posts/${post.id}/restore`,
            isDelete ? "DELETE" : "PATCH"
        )
    )));
    const failedCount = results.filter((result) => result.status === "rejected").length;

    await loadArchivedPosts();
    if (failedCount > 0) {
        archivedStatus.hidden = false;
        archivedStatus.textContent = `${failedCount} article${failedCount === 1 ? "" : "s"} could not be updated.`;
    }
}

bulkRestoreButton.addEventListener("click", () => runBulkAction("restore"));
bulkDeleteButton.addEventListener("click", () => runBulkAction("delete"));

async function loadArchivedPosts() {
    archivedTable.hidden = true;
    archivedStatus.hidden = false;
    archivedStatus.textContent = "Loading archived articles…";
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

        const archivedPosts = posts.filter((post) => post.status === "archived");
        visiblePosts = archivedPosts;
        archivedCount.textContent = archivedPosts.length.toLocaleString();

        if (archivedPosts.length === 0) {
            archivedList.replaceChildren();
            archivedStatus.textContent = "There are no archived articles.";
            return;
        }

        archivedList.replaceChildren(...archivedPosts.map(createArchivedRow));
        archivedTable.hidden = false;
        archivedStatus.hidden = true;
    } catch (error) {
        console.error("Unable to load archived posts:", error);
        archivedCount.textContent = "—";
        archivedStatus.textContent = "Archived articles could not be loaded. Please try again.";
    }
}

loadArchivedPosts();
