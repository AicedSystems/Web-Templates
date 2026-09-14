const draftsList = document.querySelector("#drafts-list");
const draftsEmptyState = document.querySelector("#drafts-empty-state");
const loadMoreDraftsButton = document.querySelector("#load-more-drafts");

const draftsPerPage = 3;
let visibleDraftCount = 0;
let drafts = [];

function getDraftTitle(draft) {
    return draft?.title?.trim() || "Untitled draft";
}

function createDraftCard(draft) {
    const link = document.createElement("a");
    link.className = "post-start-drafts__item";
    link.href = "/admin/blog/new/build?draft=continue";

    const thumbnail = document.createElement("div");
    thumbnail.className = "post-start-drafts__thumbnail";

    if (draft.featuredImage) {
        const image = document.createElement("img");
        image.src = draft.featuredImage;
        image.alt = "";
        thumbnail.append(image);
    } else {
        thumbnail.textContent = "No thumbnail";
    }

    const content = document.createElement("div");
    content.className = "post-start-drafts__item-content";
    const label = document.createElement("span");
    label.className = "post-start-drafts__item-label";
    label.textContent = "DRAFT";
    const title = document.createElement("span");
    title.className = "post-start-drafts__item-title";
    title.textContent = getDraftTitle(draft);
    const action = document.createElement("span");
    action.className = "post-start-drafts__item-meta";
    action.textContent = "Continue editing →";
    content.append(label, title, action);
    link.append(thumbnail, content);
    return link;
}

function loadMoreDrafts() {
    const nextDrafts = drafts.slice(visibleDraftCount, visibleDraftCount + draftsPerPage);
    nextDrafts.forEach((draft) => draftsList.append(createDraftCard(draft)));
    visibleDraftCount += nextDrafts.length;
    loadMoreDraftsButton.hidden = visibleDraftCount >= drafts.length;
}

function renderDrafts() {
    const savedDraft = postStorage.getDraft();
    drafts = savedDraft ? [savedDraft] : [];
    draftsList.replaceChildren();
    visibleDraftCount = 0;
    draftsEmptyState.hidden = drafts.length > 0;

    if (drafts.length) loadMoreDrafts();
    else loadMoreDraftsButton.hidden = true;
}

loadMoreDraftsButton.addEventListener("click", loadMoreDrafts);
renderDrafts();
