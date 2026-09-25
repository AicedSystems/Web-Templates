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
const featuredImageControls = document.querySelector("#featured-image-controls");
const featuredImageFitButtons = document.querySelectorAll("[data-featured-fit]");
const featuredImageZoomOut = document.querySelector("#featured-image-zoom-out");
const featuredImageZoomIn = document.querySelector("#featured-image-zoom-in");
const featuredImageZoomValue = document.querySelector("#featured-image-zoom-value");
const featuredImageReset = document.querySelector("#featured-image-reset");
const featuredImageFocalX = document.querySelector("#featured-image-focal-x");
const featuredImageFocalY = document.querySelector("#featured-image-focal-y");
const postCardPreviewImage = document.querySelector("#post-card-preview-image");
const postCardPreviewPlaceholder = document.querySelector("#post-card-preview-placeholder");
const previewCategory = document.querySelector("#preview-category");
const previewTitle = document.querySelector("#preview-title");
const previewExcerpt = document.querySelector("#preview-excerpt");
const saveDraftButton = document.querySelector("#save-draft-button");
const publishButton = document.querySelector("#publish-post-button");
const publishingStatus = document.querySelector("#publishing-status");
const viewFullArticleButton = document.querySelector("#view-full-article-button");
const fullPreviewDialog = document.querySelector("#full-preview-dialog");
const closeFullPreviewButton = document.querySelector("#close-full-preview-button");
const fullPreviewCategory = document.querySelector("#full-preview-category");
const fullPreviewTitle = document.querySelector("#full-preview-title");
const fullPreviewExcerpt = document.querySelector("#full-preview-excerpt");
const fullPreviewFeaturedImage = document.querySelector("#full-preview-featured-image");
const fullPreviewContent = document.querySelector("#full-preview-content");
const aicedLauncher = document.querySelector("#aiced-launcher");
const aicedBackdrop = document.querySelector("#aiced-backdrop");
const aicedPanel = document.querySelector("#aiced-panel");
const aicedCloseButton = document.querySelector("#aiced-close");
const aicedIdle = document.querySelector("#aiced-idle");
const aicedWorkflow = document.querySelector("#aiced-workflow");
const improveSeoButton = document.querySelector("#aiced-improve-seo");
const aiAssistantCardToggle = document.querySelector("#ai-assistant-card-toggle");
const aiAssistantCardContent = document.querySelector("#ai-assistant-card-content");
const aiAssistantTips = document.querySelector("#ai-assistant-tips");
const aiAssistantCardStatus = document.querySelector("#ai-assistant-card-status");
const aiAssistantRequest = document.querySelector("#ai-assistant-request");
const aiAssistantSend = document.querySelector("#ai-assistant-send");
const aiAssistantCardActions = document.querySelectorAll("[data-aiced-card-action]");

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
let featuredImageSettings = { focalX: 50, focalY: 50, fit: "cover", zoom: 100 };
let isPublishing = false;
let isAiProcessing = false;
let aiUndoState = null;
let aiWorkflowState = { mode: "idle", before: null, after: null, summary: null };
let draggedBlockIndex = null;
let draggedSectionIndexes = null;
let editingBlocks = new WeakSet();
let sectionStartHeadings = new WeakSet();
let standaloneBetweenSectionBlocks = new WeakSet();

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
        featuredImageSettings: { ...featuredImageSettings },
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

function getBlockSummary(block) {
    if (block.type === "cta") return block.text || "Add call-to-action text";
    if (block.type === "image") return block.url ? "Image ready" : "Add an image URL or file";
    if (block.type === "youtube") return block.url || "Add a YouTube URL";
    return block.text || `Add ${blockLabels[block.type].toLowerCase()} content`;
}

function setBlockEditing(element, block, editButton, isEditing, shouldFocus = false) {
    element.classList.toggle("is-editing", isEditing);
    editButton.textContent = isEditing ? "Done editing" : "Edit";
    editButton.setAttribute("aria-expanded", String(isEditing));

    if (isEditing) editingBlocks.add(block);
    else editingBlocks.delete(block);

    if (shouldFocus && isEditing) {
        element.querySelector("input, textarea")?.focus({ preventScroll: true });
    }
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

function insertBlock(type, index, options = {}) {
    const block = { ...blockDefaults[type] };
    contentBlocks.splice(index, 0, block);
    if (options.sectionStart) sectionStartHeadings.add(block);
    if (options.standalone) standaloneBetweenSectionBlocks.add(block);
    editingBlocks.add(block);
    renderBlocks();
}

function createInsertionMenu(index, betweenSections = false) {
    const menu = document.createElement("details");
    menu.className = betweenSections ? "section-insert" : "block-insert";
    const summary = document.createElement("summary");
    summary.textContent = betweenSections ? "+ Add between sections" : "+";
    if (betweenSections) summary.title = "Add a new section or standalone content";
    else {
        summary.dataset.tooltip = "Add content after this block";
        summary.setAttribute("aria-label", "Add content after this block");
    }
    menu.append(summary);
    const actions = document.createElement("div");
    actions.className = "insert-actions";

    if (betweenSections) {
        const actionLabel = document.createElement("span");
        actionLabel.className = "section-insert__label";
        actionLabel.textContent = "Add between sections:";
        const newSection = document.createElement("button");
        newSection.type = "button";
        newSection.textContent = "Heading";
        newSection.addEventListener("click", () => {
            const heading = { ...blockDefaults.heading };
            contentBlocks.splice(index, 0, heading);
            sectionStartHeadings.add(heading);
            editingBlocks.add(heading);
            renderBlocks();
        });
        actions.append(actionLabel, newSection);
        ["paragraph", "quote", "image", "youtube", "cta"].forEach((type) => {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = blockLabels[type];
            button.addEventListener("click", () => insertBlock(type, index, { standalone: true }));
            actions.append(button);
        });
    } else {
        Object.keys(blockDefaults).forEach((type) => {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = blockLabels[type];
            button.addEventListener("click", () => insertBlock(type, index));
            actions.append(button);
        });
    }
    menu.append(actions);
    return menu;
}

function closeOpenSectionMenus(target = null) {
    blockList.querySelectorAll(".section-insert[open]").forEach((menu) => {
        if (!target || !menu.contains(target)) menu.open = false;
    });
}

function closeEditingSections(target = null) {
    blockList.querySelectorAll(".article-section.is-editing").forEach((section) => {
        if (target && section.contains(target)) return;
        section.classList.remove("is-editing");
        const sectionEditButton = section.querySelector(".article-section__group-header .article-section__edit-button");
        if (sectionEditButton) sectionEditButton.textContent = "Edit section";
        section.querySelectorAll(".content-block").forEach((item) => {
            setBlockEditing(item, item.blockReference, item.editButton, false);
        });
    });
}

function moveSection(blockIndexes, rawDestinationIndex) {
    const indexes = [...blockIndexes].sort((a, b) => a - b);
    const blocks = indexes.map((index) => contentBlocks[index]);
    const moving = new Set(blocks);
    const destination = rawDestinationIndex - indexes.filter((index) => index < rawDestinationIndex).length;
    contentBlocks = contentBlocks.filter((block) => !moving.has(block));
    contentBlocks.splice(destination, 0, ...blocks);
    renderBlocks();
}

function groupHeadingSections() {
    let activeSection = null;
    const originalBlocks = [...blockList.children];

    originalBlocks.forEach((element) => {
        if (!element.classList.contains("content-block")) return;
        const block = contentBlocks[Number(element.dataset.blockIndex)];
        const startsSection = block.type === "heading" && sectionStartHeadings.has(block);

        if (startsSection || (!activeSection && !standaloneBetweenSectionBlocks.has(block))) {
            const section = document.createElement("section");
            section.className = "article-section";
            const header = document.createElement("header");
            header.className = "article-section__header article-section__group-header";
            const label = document.createElement("p");
            label.className = "article-section__label";
            label.textContent = "Article section";
            const actions = document.createElement("div");
            actions.className = "article-section__header-actions";
            const drag = document.createElement("button");
            drag.className = "article-section__drag-handle";
            drag.type = "button";
            drag.draggable = true;
            drag.textContent = "⠿";
            drag.dataset.tooltip = "Drag to move";
            drag.setAttribute("aria-label", "Drag entire article section");
            drag.addEventListener("dragstart", (event) => {
                draggedSectionIndexes = [...section.querySelectorAll(".content-block")].map((item) => Number(item.dataset.blockIndex));
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", "article-section");
                section.classList.add("is-dragging");
            });
            drag.addEventListener("dragend", () => {
                draggedSectionIndexes = null;
                section.classList.remove("is-dragging");
                blockList.querySelectorAll(".is-section-drop").forEach((item) => item.classList.remove("is-section-drop", "is-section-drop--above", "is-section-drop--below"));
            });
            const edit = document.createElement("button");
            edit.className = "article-section__edit-button";
            edit.type = "button";
            edit.textContent = "Edit section";
            edit.addEventListener("click", () => {
                const editing = !section.classList.contains("is-editing");
                section.classList.toggle("is-editing", editing);
                edit.textContent = editing ? "Done editing" : "Edit section";
                section.querySelectorAll(".content-block").forEach((item) => setBlockEditing(item, item.blockReference, item.editButton, editing));
            });
            const removeSection = document.createElement("button");
            removeSection.className = "article-section__delete-button";
            removeSection.type = "button";
            removeSection.setAttribute("aria-label", "Delete article section");
            removeSection.title = "Delete section";
            removeSection.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg>';
            removeSection.addEventListener("click", () => {
                if (!window.confirm("Delete this entire article section and all of its content?")) return;
                const sectionIndexes = new Set(
                    [...section.querySelectorAll(".content-block")].map((item) => Number(item.dataset.blockIndex))
                );
                contentBlocks = contentBlocks.filter((_, blockIndex) => !sectionIndexes.has(blockIndex));
                renderBlocks();
            });
            actions.append(drag, edit, removeSection);
            header.append(label, actions);
            blockList.insertBefore(section, element);
            section.append(header, element);
            activeSection = section;

            section.addEventListener("dragover", (event) => {
                if (!draggedSectionIndexes) return;
                event.preventDefault();
                const bounds = section.getBoundingClientRect();
                const above = event.clientY < bounds.top + bounds.height / 2;
                section.classList.toggle("is-section-drop--above", above);
                section.classList.toggle("is-section-drop--below", !above);
                section.classList.add("is-section-drop");
            });
            section.addEventListener("drop", (event) => {
                if (!draggedSectionIndexes) return;
                event.preventDefault();
                const indexes = [...section.querySelectorAll(".content-block")].map((item) => Number(item.dataset.blockIndex));
                const bounds = section.getBoundingClientRect();
                const destination = event.clientY < bounds.top + bounds.height / 2 ? Math.min(...indexes) : Math.max(...indexes) + 1;
                moveSection(draggedSectionIndexes, destination);
                draggedSectionIndexes = null;
            });
            return;
        }

        if (standaloneBetweenSectionBlocks.has(block)) {
            activeSection = null;
            return;
        }
        if (activeSection) activeSection.append(element);
    });

    [...blockList.querySelectorAll(".article-section")].forEach((section) => {
        const indexes = [...section.querySelectorAll(".content-block")].map((item) => Number(item.dataset.blockIndex));
        section.after(createInsertionMenu(Math.max(...indexes) + 1, true));
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
        element.className = `content-block content-block--${block.type}`;
        element.dataset.blockIndex = index;
        const header = document.createElement("header");
        header.className = "article-section__header content-block__header";

        const headerActions = document.createElement("div");
        headerActions.className = "article-section__header-actions";
        const dragHandle = document.createElement("button");
        dragHandle.className = "article-section__drag-handle";
        dragHandle.type = "button";
        dragHandle.draggable = true;
        dragHandle.textContent = "⠿";
        dragHandle.dataset.tooltip = "Drag to move";
        dragHandle.setAttribute("aria-label", `Drag ${blockLabels[block.type]} block to reorder`);
        dragHandle.addEventListener("dragstart", (event) => {
            draggedBlockIndex = index;
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", String(index));
            element.classList.add("is-dragging");
        });
        dragHandle.addEventListener("dragend", () => {
            draggedBlockIndex = null;
            element.classList.remove("is-dragging");
            blockList.querySelectorAll(".is-dragging-over").forEach((item) => item.classList.remove("is-dragging-over"));
        });

        const editButton = document.createElement("button");
        editButton.className = "content-block__menu-action";
        editButton.type = "button";
        editButton.addEventListener("click", () => {
            setBlockEditing(element, block, editButton, !element.classList.contains("is-editing"), true);
            actionMenu.open = false;
        });

        const changeButton = document.createElement("button");
        changeButton.className = "content-block__menu-action";
        changeButton.type = "button";
        changeButton.textContent = "Change element";
        changeButton.setAttribute("aria-expanded", "false");

        const typeOptions = document.createElement("div");
        typeOptions.className = "content-block__type-options";
        typeOptions.hidden = true;
        Object.keys(blockDefaults).forEach((typeName) => {
            const option = document.createElement("button");
            option.type = "button";
            option.textContent = blockLabels[typeName];
            option.disabled = typeName === block.type;
            option.addEventListener("click", () => {
                const previousText = block.text || "";
                const previousUrl = block.url || "";
                const wasSectionStart = sectionStartHeadings.has(block);
                Object.keys(block).forEach((key) => delete block[key]);
                Object.assign(block, blockDefaults[typeName]);
                if (["heading", "paragraph", "quote", "cta"].includes(typeName)) block.text = previousText;
                if (["image", "youtube", "cta"].includes(typeName)) block.url = previousUrl;
                if (wasSectionStart && typeName !== "heading") sectionStartHeadings.delete(block);
                editingBlocks.add(block);
                renderBlocks();
            });
            typeOptions.append(option);
        });
        changeButton.addEventListener("click", () => {
            typeOptions.hidden = !typeOptions.hidden;
            changeButton.setAttribute("aria-expanded", String(!typeOptions.hidden));
        });

        const remove = document.createElement("button");
        remove.className = "content-block__menu-action content-block__menu-action--danger";
        remove.type = "button";
        remove.textContent = "Remove";
        remove.addEventListener("click", () => {
            if (window.confirm(`Delete this ${blockLabels[block.type].toLowerCase()} block?`)) {
                contentBlocks.splice(index, 1);
                renderBlocks();
            }
        });

        const actionMenu = document.createElement("details");
        actionMenu.className = "content-block__menu";
        const actionMenuTrigger = document.createElement("summary");
        actionMenuTrigger.textContent = "⋮";
        actionMenuTrigger.setAttribute("aria-label", `Open actions for ${blockLabels[block.type]} block`);
        actionMenuTrigger.title = "Element actions";
        const actionMenuPanel = document.createElement("div");
        actionMenuPanel.className = "content-block__menu-panel";
        actionMenuPanel.append(editButton, changeButton, typeOptions, remove);
        actionMenu.append(actionMenuTrigger, actionMenuPanel);

        headerActions.append(createInsertionMenu(index + 1), dragHandle, actionMenu);
        header.append(headerActions);
        element.append(header);

        const summary = document.createElement("p");
        summary.className = "content-block__summary";
        summary.textContent = getBlockSummary(block);
        element.append(summary);

        const editor = document.createElement("div");
        editor.className = "content-block__editor";
        editor.id = `content-block-editor-${index}`;
        editButton.setAttribute("aria-controls", editor.id);

        if (["heading", "paragraph", "quote"].includes(block.type)) {
            editor.append(makeField(blockLabels[block.type], block.text, (value) => { block.text = value; summary.textContent = getBlockSummary(block); }, { multiline: block.type !== "heading" }));
        } else if (block.type === "image") {
            editor.append(makeField("Image URL", block.url, (value) => { block.url = value; summary.textContent = getBlockSummary(block); }, { type: "url", placeholder: "https://…" }));
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
            editor.append(picker);
        } else if (block.type === "youtube") {
            editor.append(makeField("YouTube URL", block.url, (value) => { block.url = value; summary.textContent = getBlockSummary(block); }, { type: "url", placeholder: "https://youtube.com/…" }));
        } else {
            editor.append(
                makeField("Button text", block.text, (value) => { block.text = value; summary.textContent = getBlockSummary(block); }),
                makeField("Destination URL", block.url, (value) => { block.url = value; }, { type: "url", placeholder: "https://…" })
            );
        }
        element.append(editor);
        element.blockReference = block;
        element.editButton = editButton;
        setBlockEditing(element, block, editButton, editingBlocks.has(block) || getBlockSummary(block).startsWith("Add "));

        element.addEventListener("dragover", (event) => {
            if (draggedBlockIndex === null || draggedBlockIndex === index) return;
            event.preventDefault();
            element.classList.add("is-dragging-over");
        });
        element.addEventListener("dragleave", () => element.classList.remove("is-dragging-over"));
        element.addEventListener("drop", (event) => {
            event.preventDefault();
            element.classList.remove("is-dragging-over");
            if (draggedBlockIndex === null || draggedBlockIndex === index) return;
            const destinationIndex = index;
            moveBlock(draggedBlockIndex, destinationIndex);
            draggedBlockIndex = null;
        });
        return element;
    }));
    groupHeadingSections();
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
    const savedImageSettings = post.featuredImageSettings || {};
    featuredImageSettings = {
        focalX: Number.isInteger(savedImageSettings.focalX) ? savedImageSettings.focalX : 50,
        focalY: Number.isInteger(savedImageSettings.focalY) ? savedImageSettings.focalY : 50,
        fit: ["cover", "contain"].includes(savedImageSettings.fit) ? savedImageSettings.fit : "cover",
        zoom: Number.isInteger(savedImageSettings.zoom) ? savedImageSettings.zoom : 100
    };
    contentBlocks = Array.isArray(post.contentBlocks)
        ? post.contentBlocks.filter((block) => block && supportedBlockTypes.has(block.type)).map((block) => ({ ...block }))
        : [];
    editingBlocks = new WeakSet();
    sectionStartHeadings = new WeakSet();
    standaloneBetweenSectionBlocks = new WeakSet();
    contentBlocks.forEach((block) => {
        if (block.type === "heading") sectionStartHeadings.add(block);
    });
    renderFeaturedImage();
    renderMetadata();
    renderBlocks();
}

function renderFeaturedImage() {
    const hasImage = Boolean(featuredImageDataUrl);
    previewImage.hidden = !hasImage;
    previewNoImage.hidden = hasImage;
    removeImageButton.hidden = !hasImage;
    featuredImageControls.hidden = !hasImage;
    postCardPreviewImage.hidden = !hasImage;
    postCardPreviewPlaceholder.hidden = hasImage;
    if (hasImage) {
        previewImage.src = featuredImageDataUrl;
        postCardPreviewImage.src = featuredImageDataUrl;
        applyFeaturedImagePresentation(previewImage);
        applyFeaturedImagePresentation(postCardPreviewImage);
    } else {
        previewImage.removeAttribute("src");
        postCardPreviewImage.removeAttribute("src");
    }
    featuredImageFocalX.value = String(featuredImageSettings.focalX);
    featuredImageFocalY.value = String(featuredImageSettings.focalY);
    featuredImageZoomValue.value = `${featuredImageSettings.zoom}%`;
    featuredImageFitButtons.forEach((button) => {
        const active = button.dataset.featuredFit === featuredImageSettings.fit;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
    });
}

function applyFeaturedImagePresentation(image) {
    image.style.objectFit = featuredImageSettings.fit;
    image.style.objectPosition = `${featuredImageSettings.focalX}% ${featuredImageSettings.focalY}%`;
    image.style.transform = `scale(${featuredImageSettings.zoom / 100})`;
}

function updateFeaturedImageSettings() {
    renderFeaturedImage();
    if (!fullPreviewFeaturedImage.hidden) applyFeaturedImagePresentation(fullPreviewFeaturedImage);
}

function isHttpUrl(value) {
    try { return ["http:", "https:"].includes(new URL(value).protocol); }
    catch { return false; }
}

function getYouTubeEmbedUrl(value) {
    try {
        const url = new URL(value);
        const host = url.hostname.replace(/^www\./, "");
        let videoId = "";
        if (host === "youtu.be") videoId = url.pathname.slice(1).split("/")[0];
        if (["youtube.com", "m.youtube.com"].includes(host)) {
            if (url.pathname === "/watch") videoId = url.searchParams.get("v") || "";
            else {
                const [prefix, id] = url.pathname.split("/").filter(Boolean);
                if (["embed", "shorts", "live"].includes(prefix)) videoId = id || "";
            }
        }
        return /^[A-Za-z0-9_-]{11}$/.test(videoId) ? `https://www.youtube-nocookie.com/embed/${videoId}` : null;
    } catch { return null; }
}

function createFullPreviewBlock(block) {
    if (["heading", "paragraph", "quote"].includes(block.type) && typeof block.text === "string") {
        const tag = block.type === "heading" ? "h2" : block.type === "quote" ? "blockquote" : "p";
        const element = document.createElement(tag);
        element.className = `full-preview-block full-preview-block--${block.type}`;
        element.textContent = block.text;
        return element;
    }
    if (block.type === "image" && (isHttpUrl(block.url) || /^data:image\/(jpeg|png|webp);base64,/i.test(block.url || ""))) {
        const image = document.createElement("img");
        image.className = "full-preview-block full-preview-block--image";
        image.src = block.url;
        image.alt = "Article image";
        return image;
    }
    if (block.type === "youtube") {
        const embedUrl = getYouTubeEmbedUrl(block.url);
        if (!embedUrl) return null;
        const video = document.createElement("figure");
        video.className = "full-preview-block full-preview-block--youtube-wrap";
        const frame = document.createElement("iframe");
        frame.className = "full-preview-block--youtube";
        frame.src = embedUrl;
        frame.title = "YouTube video";
        frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
        frame.allowFullscreen = true;
        const fallback = document.createElement("a");
        fallback.className = "full-preview-block--youtube-fallback";
        fallback.href = embedUrl.replace("youtube-nocookie.com/embed/", "youtube.com/watch?v=");
        fallback.target = "_blank";
        fallback.rel = "noopener noreferrer";
        fallback.textContent = "Video not playing? Watch on YouTube →";
        video.append(frame, fallback);
        return video;
    }
    if (block.type === "cta" && typeof block.text === "string" && isHttpUrl(block.url)) {
        const link = document.createElement("a");
        link.className = "full-preview-block full-preview-block--cta";
        link.href = block.url;
        link.textContent = block.text;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        return link;
    }
    return null;
}

function renderFullArticlePreview() {
    const post = getPostData("draft");
    fullPreviewCategory.textContent = categoryInput.selectedOptions[0]?.text || "Insights";
    fullPreviewTitle.textContent = post.title || "Your article title";
    fullPreviewExcerpt.textContent = post.excerpt || "Your article summary will appear here.";
    fullPreviewFeaturedImage.hidden = !post.featuredImage;
    if (post.featuredImage) fullPreviewFeaturedImage.src = post.featuredImage;
    else fullPreviewFeaturedImage.removeAttribute("src");
    if (post.featuredImage) applyFeaturedImagePresentation(fullPreviewFeaturedImage);
    const blocks = post.contentBlocks.map(createFullPreviewBlock).filter(Boolean);
    if (!blocks.length) {
        const empty = document.createElement("p");
        empty.className = "full-preview-article__empty";
        empty.textContent = "Add content blocks to preview the full article.";
        blocks.push(empty);
    }
    fullPreviewContent.replaceChildren(...blocks);
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
    const newBlock = { ...blockDefaults[button.dataset.addBlock] };
    contentBlocks.push(newBlock);
    if (newBlock.type === "heading") sectionStartHeadings.add(newBlock);
    editingBlocks.add(newBlock);
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
featuredImageFitButtons.forEach((button) => button.addEventListener("click", () => {
    featuredImageSettings.fit = button.dataset.featuredFit;
    if (featuredImageSettings.fit === "contain") featuredImageSettings.zoom = 100;
    updateFeaturedImageSettings();
}));
featuredImageZoomOut.addEventListener("click", () => {
    featuredImageSettings.zoom = Math.max(100, featuredImageSettings.zoom - 5);
    updateFeaturedImageSettings();
});
featuredImageZoomIn.addEventListener("click", () => {
    featuredImageSettings.zoom = Math.min(150, featuredImageSettings.zoom + 5);
    updateFeaturedImageSettings();
});
featuredImageReset.addEventListener("click", () => {
    featuredImageSettings = { focalX: 50, focalY: 50, fit: "cover", zoom: 100 };
    updateFeaturedImageSettings();
});
[featuredImageFocalX, featuredImageFocalY].forEach((input) => input.addEventListener("input", () => {
    featuredImageSettings.focalX = Number(featuredImageFocalX.value);
    featuredImageSettings.focalY = Number(featuredImageFocalY.value);
    updateFeaturedImageSettings();
}));
saveDraftButton.addEventListener("click", saveDraft);
publishButton.addEventListener("click", publishPost);
viewFullArticleButton.addEventListener("click", () => {
    renderFullArticlePreview();
    fullPreviewDialog.showModal();
});
closeFullPreviewButton.addEventListener("click", () => fullPreviewDialog.close());
fullPreviewDialog.addEventListener("click", (event) => {
    if (event.target === fullPreviewDialog) fullPreviewDialog.close();
});

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
        post: JSON.parse(JSON.stringify(getPostData("draft"))),
        sectionStartIndexes: contentBlocks.reduce((indexes, block, index) => sectionStartHeadings.has(block) ? [...indexes, index] : indexes, []),
        standaloneIndexes: contentBlocks.reduce((indexes, block, index) => standaloneBetweenSectionBlocks.has(block) ? [...indexes, index] : indexes, [])
    };
}

function restoreAiState(state) {
    if (!state?.post) return;
    populateEditor(state.post);
    sectionStartHeadings = new WeakSet();
    standaloneBetweenSectionBlocks = new WeakSet();
    (state.sectionStartIndexes || []).forEach((index) => contentBlocks[index] && sectionStartHeadings.add(contentBlocks[index]));
    (state.standaloneIndexes || []).forEach((index) => contentBlocks[index] && standaloneBetweenSectionBlocks.add(contentBlocks[index]));
    renderBlocks();
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
    aiAssistantCardActions.forEach((button) => { button.disabled = true; });
    aiAssistantCardStatus.hidden = false;
    aiAssistantCardStatus.textContent = "Aiced Bot is improving your article…";
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
        aiAssistantCardStatus.textContent = "SEO improved. Review the changes before publishing.";
    } catch (error) {
        const message = error instanceof TypeError ? "Unable to reach Aiced Bot. Check your connection and try again." : error.message;
        showAiError(message);
        showStatus(message, "error");
        aiAssistantCardStatus.textContent = message;
    } finally {
        isAiProcessing = false;
        improveSeoButton.disabled = false;
        aiAssistantCardActions.forEach((button) => { button.disabled = false; });
    }
}

function showUnavailableAicedAction() {
    aiAssistantCardStatus.hidden = false;
    aiAssistantCardStatus.textContent = "This action will be connected in the next Aiced Bot phase. Improve SEO is ready now.";
    setAicedOpen(true);
}

aiAssistantCardToggle.addEventListener("click", () => {
    const expanded = aiAssistantCardToggle.getAttribute("aria-expanded") === "true";
    aiAssistantCardToggle.setAttribute("aria-expanded", String(!expanded));
    aiAssistantCardToggle.setAttribute("aria-label", expanded ? "Expand Aiced Bot card" : "Collapse Aiced Bot card");
    aiAssistantCardContent.hidden = expanded;
});
aiAssistantTips.addEventListener("click", () => setAicedOpen(true));
aiAssistantCardActions.forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.aicedCardAction === "seo") improveSeo();
    else showUnavailableAicedAction();
}));
document.querySelectorAll("[data-aiced-example]").forEach((button) => button.addEventListener("click", () => {
    aiAssistantRequest.value = button.dataset.aicedExample;
    aiAssistantRequest.focus();
}));
aiAssistantSend.addEventListener("click", () => {
    if (!aiAssistantRequest.value.trim()) return aiAssistantRequest.focus();
    showUnavailableAicedAction();
});

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
document.addEventListener("click", (event) => {
    closeOpenSectionMenus(event.target);
    if (!event.target.closest(".section-insert, .block-insert")) closeEditingSections(event.target);
});
document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!aicedBackdrop.hidden) setAicedOpen(false);
    closeOpenSectionMenus();
    closeEditingSections();
});
