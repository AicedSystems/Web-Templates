const postForm = document.querySelector("#post-form");
const titleInput = document.querySelector("#post-title");
const excerptInput = document.querySelector("#post-excerpt");
const categoryInput = document.querySelector("#post-category");
const tagsInput = document.querySelector("#post-tags");
const titleCount = document.querySelector("#title-character-count");
const excerptCount = document.querySelector("#excerpt-character-count");
const blockList = document.querySelector("#content-block-list");
const addBlockButtons = document.querySelectorAll("[data-add-block]");
const featuredImageInput = document.querySelector("#post-featured-image");
const previewImage = document.querySelector("#preview-image");
const previewNoImage = document.querySelector("#preview-no-image");
const removeImageButton = document.querySelector("#remove-thumbnail-button");
const previewCategory = document.querySelector("#preview-category");
const previewTitle = document.querySelector("#preview-title");
const previewExcerpt = document.querySelector("#preview-excerpt");
const saveDraftButton = document.querySelector("#save-draft-button");
const publishButton = document.querySelector("#publish-post-button");
const publishingStatus = document.querySelector("#publishing-status");
const aicedLauncher = document.querySelector("#aiced-launcher");
const aicedBackdrop = document.querySelector("#aiced-backdrop");
const aicedPanel = document.querySelector("#aiced-panel");
const aicedCloseButton = document.querySelector("#aiced-close");
const aicedIdle = document.querySelector("#aiced-idle");
const aicedWorkflow = document.querySelector("#aiced-workflow");
const improveSeoButton = document.querySelector("#aiced-improve-seo");

const supportedBlockTypes = new Set(["heading", "paragraph", "quote", "image", "youtube", "cta"]);
const supportedCategories = new Set(["market-updates", "recruiting", "success-stories", "training"]);
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maximumImageSize = 5 * 1024 * 1024;
const pastedPostImportStorageKey = "cmsPastedPostImport";
const blockLabels = { heading: "Heading", paragraph: "Paragraph", quote: "Quote", image: "Image", youtube: "YouTube", cta: "Call to action" };
const blockDefaults = {
    heading: { type: "heading", text: "" },
    paragraph: { type: "paragraph", text: "" },
    quote: { type: "quote", text: "" },
    image: { type: "image", url: "" },
    youtube: { type: "youtube", url: "" },
    cta: { type: "cta", text: "", url: "" }
};

let contentBlocks = [];
let featuredImageDataUrl = null;
let isPublishing = false;
let isAiProcessing = false;
let aiUndoState = null;
let aiWorkflowState = { mode: "idle", before: null, after: null, summary: null };

function showStatus(message, type = "") {
    publishingStatus.textContent = message;
    publishingStatus.classList.toggle("is-error", type === "error");
    publishingStatus.classList.toggle("is-success", type === "success");
}

function parseTags() {
    return tagsInput.value.split(",").map((tag) => tag.trim()).filter(Boolean);
}

function getPostData(status = "draft") {
    return {
        title: titleInput.value.trim(),
        content: contentBlocks.filter((block) => typeof block.text === "string").map((block) => block.text.trim()).filter(Boolean).join("\n\n"),
        category: categoryInput.value,
        tags: parseTags(),
        excerpt: excerptInput.value.trim(),
        featuredImage: featuredImageDataUrl,
        status,
        contentBlocks: contentBlocks.map((block) => ({ ...block }))
    };
}

function renderMetadata() {
    titleCount.textContent = `${titleInput.value.length}/100`;
    excerptCount.textContent = `${excerptInput.value.length}/160`;
    previewTitle.textContent = titleInput.value.trim() || "Your article title";
    previewExcerpt.textContent = excerptInput.value.trim() || "Your article summary will appear here.";
    previewCategory.textContent = categoryInput.selectedOptions[0]?.text || "Select a category";
}

function makeField(labelText, value, onInput, options = {}) {
    const label = document.createElement("label");
    label.className = "block-field";
    const labelName = document.createElement("span");
    labelName.textContent = labelText;
    const control = document.createElement(options.multiline ? "textarea" : "input");
    if (options.multiline) control.rows = 4;
    else control.type = options.type || "text";
    control.value = value || "";
    control.placeholder = options.placeholder || "";
    control.addEventListener("input", (event) => onInput(event.target.value));
    label.append(labelName, control);
    return label;
}

function validateImageFile(file) {
    if (!file || !allowedImageTypes.has(file.type)) throw new Error("Choose a JPEG, PNG, or WebP image.");
    if (file.size > maximumImageSize) throw new Error("Images must be 5 MB or smaller.");
}

function readImageFile(file) {
    validateImageFile(file);
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => resolve(reader.result));
        reader.addEventListener("error", () => reject(new Error("The image could not be read.")));
        reader.readAsDataURL(file);
    });
}

function renderBlocks() {
    if (contentBlocks.length === 0) {
        const empty = document.createElement("p");
        empty.className = "block-builder__empty";
        empty.textContent = "Add a heading, paragraph, image, video, quote, or call to action.";
        blockList.replaceChildren(empty);
        return;
    }

    blockList.replaceChildren(...contentBlocks.map((block, index) => {
        const element = document.createElement("article");
        element.className = "content-block";
        element.dataset.blockIndex = index;
        const header = document.createElement("header");
        header.className = "content-block__header";
        const type = document.createElement("strong");
        type.className = "content-block__type";
        type.textContent = blockLabels[block.type];

        const up = document.createElement("button");
        up.className = "content-block__control";
        up.type = "button";
        up.textContent = "↑";
        up.title = "Move block up";
        up.disabled = index === 0;
        up.addEventListener("click", () => moveBlock(index, index - 1));
        const down = document.createElement("button");
        down.className = "content-block__control";
        down.type = "button";
        down.textContent = "↓";
        down.title = "Move block down";
        down.disabled = index === contentBlocks.length - 1;
        down.addEventListener("click", () => moveBlock(index, index + 1));
        const remove = document.createElement("button");
        remove.className = "content-block__control content-block__control--danger";
        remove.type = "button";
        remove.textContent = "⌫";
        remove.title = "Delete block";
        remove.addEventListener("click", () => {
            if (window.confirm(`Delete this ${blockLabels[block.type].toLowerCase()} block?`)) {
                contentBlocks.splice(index, 1);
                renderBlocks();
            }
        });
        header.append(type, up, down, remove);
        element.append(header);

        if (["heading", "paragraph", "quote"].includes(block.type)) {
            element.append(makeField(blockLabels[block.type], block.text, (value) => { block.text = value; }, { multiline: block.type !== "heading" }));
        } else if (block.type === "image") {
            element.append(makeField("Image URL", block.url, (value) => { block.url = value; }, { type: "url", placeholder: "https://…" }));
            const picker = document.createElement("label");
            picker.className = "block-image-picker";
            picker.textContent = "Or choose an image file: ";
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/jpeg,image/png,image/webp";
            input.addEventListener("change", async () => {
                try {
                    if (input.files[0]) block.url = await readImageFile(input.files[0]);
                    renderBlocks();
                    showStatus("Image block is ready.", "success");
                } catch (error) { showStatus(error.message, "error"); }
            });
            picker.append(input);
            element.append(picker);
        } else if (block.type === "youtube") {
            element.append(makeField("YouTube URL", block.url, (value) => { block.url = value; }, { type: "url", placeholder: "https://youtube.com/…" }));
        } else {
            element.append(
                makeField("Button text", block.text, (value) => { block.text = value; }),
                makeField("Destination URL", block.url, (value) => { block.url = value; }, { type: "url", placeholder: "https://…" })
            );
        }
        return element;
    }));
}

function moveBlock(fromIndex, toIndex) {
    if (toIndex < 0 || toIndex >= contentBlocks.length) return;
    const [block] = contentBlocks.splice(fromIndex, 1);
    contentBlocks.splice(toIndex, 0, block);
    renderBlocks();
}

function populateEditor(post) {
    titleInput.value = typeof post.title === "string" ? post.title.slice(0, 100) : "";
    excerptInput.value = typeof post.excerpt === "string" ? post.excerpt.slice(0, 160) : "";
    categoryInput.value = supportedCategories.has(post.category) ? post.category : "";
    tagsInput.value = Array.isArray(post.tags) ? post.tags.filter((tag) => typeof tag === "string").join(", ") : "";
    featuredImageDataUrl = typeof post.featuredImage === "string" ? post.featuredImage : null;
    contentBlocks = Array.isArray(post.contentBlocks)
        ? post.contentBlocks.filter((block) => block && supportedBlockTypes.has(block.type)).map((block) => ({ ...block }))
        : [];
    renderFeaturedImage();
    renderMetadata();
    renderBlocks();
}

function renderFeaturedImage() {
    const hasImage = Boolean(featuredImageDataUrl);
    previewImage.hidden = !hasImage;
    previewNoImage.hidden = hasImage;
    removeImageButton.hidden = !hasImage;
    if (hasImage) previewImage.src = featuredImageDataUrl;
    else previewImage.removeAttribute("src");
}

function isHttpUrl(value) {
    try { return ["http:", "https:"].includes(new URL(value).protocol); }
    catch { return false; }
}

function validatePost(post) {
    if (!post.title) return "Add an article title.";
    if (!supportedCategories.has(post.category)) return "Choose a valid category.";
    if (!post.excerpt) return "Add an SEO summary.";
    if (post.contentBlocks.length === 0) return "Add at least one content block.";

    for (const block of post.contentBlocks) {
        if (["heading", "paragraph", "quote"].includes(block.type) && !block.text?.trim()) return `${blockLabels[block.type]} blocks require text.`;
        if (block.type === "image" && !(isHttpUrl(block.url) || /^data:image\/(jpeg|png|webp);base64,/i.test(block.url || ""))) return "Image blocks require an image URL or selected image file.";
        if (block.type === "youtube") {
            if (!isHttpUrl(block.url)) return "YouTube blocks require a valid URL.";
            const host = new URL(block.url).hostname.replace(/^www\./, "");
            if (!["youtube.com", "m.youtube.com", "youtu.be"].includes(host)) return "Use a standard YouTube URL.";
        }
        if (block.type === "cta" && (!block.text?.trim() || !isHttpUrl(block.url))) return "CTA blocks require button text and a valid URL.";
    }
    return null;
}

function saveDraft() {
    postStorage.saveDraft(getPostData("draft"));
    showStatus("Draft saved in this browser.", "success");
}

async function publishPost() {
    if (isPublishing) return;
    const post = getPostData("published");
    const validationError = validatePost(post);
    if (validationError) { showStatus(validationError, "error"); return; }

    isPublishing = true;
    publishButton.disabled = true;
    saveDraftButton.disabled = true;
    showStatus("Publishing article…");

    try {
        const response = await fetch("/api/posts", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(post)
        });
        const createdPost = await response.json().catch(() => null);
        if (!response.ok) throw new Error(createdPost?.message || "The article could not be published.");
        if (!createdPost?.id) throw new Error("The published article did not return an ID.");
        showStatus("Article published. Opening it now…", "success");
        window.location.assign(`/blog/${createdPost.id}`);
    } catch (error) {
        showStatus(error instanceof TypeError ? "Unable to reach the publishing service. Please try again." : error.message, "error");
        isPublishing = false;
        publishButton.disabled = false;
        saveDraftButton.disabled = false;
    }
}

[titleInput, excerptInput, tagsInput].forEach((input) => input.addEventListener("input", renderMetadata));
categoryInput.addEventListener("change", renderMetadata);
addBlockButtons.forEach((button) => button.addEventListener("click", () => {
    contentBlocks.push({ ...blockDefaults[button.dataset.addBlock] });
    renderBlocks();
    blockList.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}));
featuredImageInput.addEventListener("change", async () => {
    try {
        if (!featuredImageInput.files[0]) return;
        featuredImageDataUrl = await readImageFile(featuredImageInput.files[0]);
        renderFeaturedImage();
        showStatus("Featured image is ready.", "success");
    } catch (error) {
        featuredImageInput.value = "";
        showStatus(error.message, "error");
    }
});
removeImageButton.addEventListener("click", () => {
    featuredImageDataUrl = null;
    featuredImageInput.value = "";
    renderFeaturedImage();
    showStatus("Featured image removed.");
});
saveDraftButton.addEventListener("click", saveDraft);
publishButton.addEventListener("click", publishPost);

renderMetadata();
renderFeaturedImage();
renderBlocks();

const editorQuery = new URLSearchParams(window.location.search);
if (["pasted", "enhanced"].includes(editorQuery.get("import"))) {
    const storedImport = sessionStorage.getItem(pastedPostImportStorageKey);
    if (!storedImport) {
        showStatus("The imported article is no longer available. Paste it again to continue.", "error");
    } else {
        try {
            populateEditor(JSON.parse(storedImport));
            sessionStorage.removeItem(pastedPostImportStorageKey);
            showStatus("Imported article loaded and ready to edit.", "success");
        } catch (error) {
            sessionStorage.removeItem(pastedPostImportStorageKey);
            showStatus("The imported article could not be loaded. Paste it again to continue.", "error");
        }
    }
} else if (editorQuery.get("draft") === "continue") {
    const savedDraft = postStorage.getDraft();
    if (savedDraft) {
        populateEditor(savedDraft);
        showStatus("Continued your saved browser draft.", "success");
    } else {
        showStatus("No browser draft was found. You can start a new article here.");
    }
}

function setAicedOpen(isOpen) {
    aicedLauncher.setAttribute("aria-expanded", String(isOpen));
    if (isOpen) {
        aicedBackdrop.hidden = false;
        window.requestAnimationFrame(() => {
            aicedBackdrop.classList.add("is-open");
            aicedPanel.focus();
        });
        return;
    }
    aicedBackdrop.classList.remove("is-open");
    window.setTimeout(() => {
        if (!aicedBackdrop.classList.contains("is-open")) aicedBackdrop.hidden = true;
    }, 180);
    aicedLauncher.focus();
}

function captureAiState() {
    return {
        post: JSON.parse(JSON.stringify(getPostData("draft")))
    };
}

function restoreAiState(state) {
    if (!state?.post) return;
    populateEditor(state.post);
}

function createWorkflowElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function createWorkflowButton(label, action, accent = false) {
    const button = createWorkflowElement("button", "aiced-workflow__button", label);
    button.type = "button";
    button.dataset.aicedAction = action;
    if (accent) button.classList.add("aiced-workflow__button--accent");
    return button;
}

function setWorkflowScreen(mode, elements = []) {
    aiWorkflowState.mode = mode;
    const isIdle = mode === "idle";
    aicedIdle.hidden = !isIdle;
    aicedWorkflow.hidden = isIdle;
    aicedWorkflow.replaceChildren(...elements);
}

function getBlockValue(block) {
    if (!block) return "";
    if (block.type === "cta") return `${block.text || ""}\n${block.url || ""}`.trim();
    return block.text || block.url || "";
}

function getAiChanges(beforeState, afterState) {
    const before = beforeState.post;
    const after = afterState.post;
    const fields = [];
    [["Title", "title"], ["SEO summary", "excerpt"], ["Category", "category"]].forEach(([label, key]) => {
        if (before[key] !== after[key]) fields.push({ label, before: before[key], after: after[key] });
    });
    if (JSON.stringify(before.tags) !== JSON.stringify(after.tags)) {
        fields.push({ label: "Tags", before: before.tags.join(", "), after: after.tags.join(", ") });
    }

    const blocks = [];
    const counts = { heading: 0, paragraph: 0, quote: 0 };
    const length = Math.max(before.contentBlocks.length, after.contentBlocks.length);
    for (let index = 0; index < length; index += 1) {
        const beforeBlock = before.contentBlocks[index];
        const afterBlock = after.contentBlocks[index];
        if (beforeBlock?.type === afterBlock?.type && getBlockValue(beforeBlock) === getBlockValue(afterBlock)) continue;
        const type = afterBlock?.type || beforeBlock?.type || "content";
        if (Object.prototype.hasOwnProperty.call(counts, type)) counts[type] += 1;
        blocks.push({
            label: `${blockLabels[type] || "Content"} ${index + 1}`,
            before: getBlockValue(beforeBlock),
            after: getBlockValue(afterBlock)
        });
    }
    return { fields, blocks, counts };
}

function showAiProcessing(beforeState) {
    const image = createWorkflowElement("img", "aiced-workflow__bot");
    image.src = "/static/admin/blog/images/aiced-bot/aicedbotrunning.png";
    image.alt = "Aiced Bot is working";
    const title = createWorkflowElement("h2", "aiced-workflow__title", "Improving SEO…");
    const description = createWorkflowElement("p", "aiced-workflow__description", "Aiced Bot is reviewing your article for search clarity.");
    const label = createWorkflowElement("p", "aiced-workflow__label", "Analyzing:");
    const list = createWorkflowElement("ul", "aiced-workflow__list");
    ["Title", "SEO summary", "Headings", "Keyword clarity"].forEach((item) => list.append(createWorkflowElement("li", "", item)));
    aiWorkflowState = { mode: "processing", before: beforeState, after: null, summary: null };
    setWorkflowScreen("processing", [image, title, description, label, list]);
}

function showAiSuccess(beforeState, afterState) {
    const summary = getAiChanges(beforeState, afterState);
    const title = createWorkflowElement("h2", "aiced-workflow__title", "SEO improved");
    const description = createWorkflowElement("p", "aiced-workflow__description", "Your editor has been updated. Review the changes before publishing.");
    const label = createWorkflowElement("p", "aiced-workflow__label", "I updated:");
    const list = createWorkflowElement("ul", "aiced-workflow__list");
    const items = [
        ...summary.fields.map((change) => change.label),
        ...Object.entries(summary.counts).filter(([, count]) => count).map(([type, count]) => `${count} ${type} block${count === 1 ? "" : "s"}`)
    ];
    (items.length ? items : ["Search clarity refinements"]).forEach((item) => list.append(createWorkflowElement("li", "", item)));
    const actions = createWorkflowElement("div", "aiced-workflow__actions");
    actions.append(createWorkflowButton("Review Changes", "review", true), createWorkflowButton("Keep Changes", "keep"), createWorkflowButton("Undo", "undo"));
    aiWorkflowState = { mode: "success", before: beforeState, after: afterState, summary };
    setWorkflowScreen("success", [title, description, label, list, actions]);
}

function createReviewItem(change) {
    const item = createWorkflowElement("section", "aiced-review__item");
    item.append(createWorkflowElement("h3", "", change.label));
    [["Before", change.before], ["After", change.after]].forEach(([label, value]) => {
        const wrapper = createWorkflowElement("div", "aiced-review__value");
        wrapper.append(createWorkflowElement("strong", "", label), createWorkflowElement("p", "", value || "—"));
        item.append(wrapper);
    });
    return item;
}

function showAiReview() {
    const { before, after, summary } = aiWorkflowState;
    if (!before || !after || !summary) return;
    const title = createWorkflowElement("h2", "aiced-workflow__title", "Review SEO changes");
    const description = createWorkflowElement("p", "aiced-workflow__description", "Only fields and content blocks that changed are shown.");
    const review = createWorkflowElement("div", "aiced-review");
    [...summary.fields, ...summary.blocks].forEach((change) => review.append(createReviewItem(change)));
    if (!review.childElementCount) review.append(createWorkflowElement("p", "aiced-workflow__description", "No visible changes were returned."));
    const actions = createWorkflowElement("div", "aiced-workflow__actions");
    actions.append(createWorkflowButton("Back", "success"), createWorkflowButton("Keep Changes", "keep", true), createWorkflowButton("Undo", "undo"));
    setWorkflowScreen("review", [title, description, review, actions]);
}

function showAiError(message) {
    const title = createWorkflowElement("h2", "aiced-workflow__title", "Couldn’t improve SEO");
    const description = createWorkflowElement("p", "aiced-workflow__description", message || "Your original article has not been changed.");
    const reassurance = createWorkflowElement("p", "aiced-workflow__description", "Your article remains available in the editor.");
    const actions = createWorkflowElement("div", "aiced-workflow__actions");
    actions.append(createWorkflowButton("Try Again", "retry", true), createWorkflowButton("Back", "idle"));
    setWorkflowScreen("error", [title, description, reassurance, actions]);
}

function undoAiChanges() {
    if (!aiUndoState) return;
    restoreAiState(aiUndoState);
    aiUndoState = null;
    const title = createWorkflowElement("h2", "aiced-workflow__title", "Changes undone");
    const description = createWorkflowElement("p", "aiced-workflow__description", "Your exact pre-AI article has been restored.");
    const actions = createWorkflowElement("div", "aiced-workflow__actions");
    actions.append(createWorkflowButton("Back to Actions", "idle", true));
    setWorkflowScreen("undone", [title, description, actions]);
    showStatus("SEO changes undone. Your original article was restored.", "success");
}

function isUsableAiResult(result) {
    return result
        && typeof result.title === "string"
        && typeof result.excerpt === "string"
        && supportedCategories.has(result.category)
        && Array.isArray(result.tags)
        && Array.isArray(result.contentBlocks)
        && result.contentBlocks.every((block) => block && supportedBlockTypes.has(block.type));
}

async function improveSeo() {
    if (isAiProcessing) return;
    const beforeState = captureAiState();
    const validationError = validatePost(beforeState.post);
    if (validationError) {
        setAicedOpen(true);
        showAiError(`Complete the article first: ${validationError}`);
        return;
    }

    const { title, excerpt, category, tags, contentBlocks: blocks } = beforeState.post;
    isAiProcessing = true;
    improveSeoButton.disabled = true;
    setAicedOpen(true);
    showAiProcessing(beforeState);

    try {
        const response = await fetch("/api/posts/ai-edit", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ action: "seo", title, excerpt, category, tags, contentBlocks: blocks })
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) throw new Error(result?.message || "Aiced Bot could not improve SEO right now.");
        if (!isUsableAiResult(result)) throw new Error("Aiced Bot returned an unusable result. Your article was not changed.");

        aiUndoState = beforeState;
        populateEditor({ ...result, featuredImage: beforeState.post.featuredImage });
        const afterState = captureAiState();
        showAiSuccess(beforeState, afterState);
        showStatus("SEO improved. Review the changes before publishing.", "success");
    } catch (error) {
        const message = error instanceof TypeError ? "Unable to reach Aiced Bot. Check your connection and try again." : error.message;
        showAiError(message);
        showStatus(message, "error");
    } finally {
        isAiProcessing = false;
        improveSeoButton.disabled = false;
    }
}

aicedLauncher.addEventListener("click", () => setAicedOpen(aicedBackdrop.hidden));
aicedCloseButton.addEventListener("click", () => setAicedOpen(false));
aicedBackdrop.addEventListener("click", (event) => { if (event.target === aicedBackdrop) setAicedOpen(false); });
improveSeoButton.addEventListener("click", improveSeo);
aicedWorkflow.addEventListener("click", (event) => {
    const button = event.target.closest("[data-aiced-action]");
    if (!button) return;
    if (button.dataset.aicedAction === "review") showAiReview();
    if (button.dataset.aicedAction === "success") showAiSuccess(aiWorkflowState.before, aiWorkflowState.after);
    if (button.dataset.aicedAction === "undo") undoAiChanges();
    if (button.dataset.aicedAction === "retry") improveSeo();
    if (button.dataset.aicedAction === "idle") setWorkflowScreen("idle");
    if (button.dataset.aicedAction === "keep") { aiUndoState = null; setWorkflowScreen("idle"); setAicedOpen(false); showStatus("SEO changes kept. Review once more, then publish when ready.", "success"); }
});
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !aicedBackdrop.hidden) setAicedOpen(false); });
