const workspace = document.querySelector("#page-editor-workspace");
const loadingStatus = document.querySelector("#page-editor-status");
const form = document.querySelector("#reviews-page-form");
const savebar = document.querySelector("#page-editor-savebar");
const saveButton = document.querySelector("#save-page");
const saveState = document.querySelector("#save-state");
const saveMessage = document.querySelector("#save-message");
const reviewOptions = document.querySelector("#featured-review-options");
const editorSections = [...document.querySelectorAll("[data-editor-section]")];
const previewSections = [...document.querySelectorAll("[data-preview-section]")];
const imageControls = [...document.querySelectorAll("[data-image-control]")];
const previewFrame = document.querySelector("#reviews-page-preview");
const editPanelEmpty = document.querySelector("#edit-panel-empty");
const editPanelTitle = document.querySelector("#edit-panel-title");
const closeEditPanelButton = document.querySelector("#close-edit-panel");

let pageContent = null;
let eligibleReviews = [];
let isDirty = false;
let isSaving = false;
const uploadedThisSession = new Set();

function requestJson(url, options = {}) {
    return fetch(url, {
        ...options,
        cache: "no-store",
        headers: {
            Accept: "application/json",
            ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
            ...options.headers
        }
    }).then(async (response) => {
        const data = response.status === 204 ? null : await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.message || "Something went wrong. Please try again.");
        return data;
    });
}

function cleanImage(image) {
    return image ? { storagePath: image.storagePath, focalX: Number(image.focalX), focalY: Number(image.focalY) } : null;
}

function contentFromResponse(data) {
    return {
        hero: structuredClone(data.hero),
        about: { ...structuredClone(data.about), image: cleanImage(data.about.image) },
        featuredStory: { ...structuredClone(data.featuredStory), image: cleanImage(data.featuredStory.image) },
        featuredReviewId: data.featuredReviewId,
        finalCta: { ...structuredClone(data.finalCta), image: cleanImage(data.finalCta.image) }
    };
}

function setField(name, value) {
    const field = form.elements.namedItem(name);
    if (field) field.value = value ?? "";
}

function getField(name) {
    return form.elements.namedItem(name)?.value.trim() || "";
}

function renderValueInputs(section, values) {
    const container = document.querySelector(`[data-values="${section}"]`);
    container.replaceChildren();
    values.forEach((value, index) => {
        const row = document.createElement("div");
        row.className = "value-item";
        const title = document.createElement("label");
        title.innerHTML = `<span>Title ${index + 1}</span>`;
        const titleInput = document.createElement("input");
        titleInput.maxLength = 40;
        titleInput.required = true;
        titleInput.dataset.valueSection = section;
        titleInput.dataset.valueIndex = index;
        titleInput.dataset.valueKey = "title";
        titleInput.value = value.title;
        title.append(titleInput);
        const subtitle = document.createElement("label");
        subtitle.innerHTML = `<span>Subtitle ${index + 1}</span>`;
        const subtitleInput = document.createElement("input");
        subtitleInput.maxLength = 40;
        subtitleInput.required = true;
        subtitleInput.dataset.valueSection = section;
        subtitleInput.dataset.valueIndex = index;
        subtitleInput.dataset.valueKey = "subtitle";
        subtitleInput.value = value.subtitle;
        subtitle.append(subtitleInput);
        row.append(title, subtitle);
        container.append(row);
    });
}

function initials(name) {
    return (name || "Client").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function renderReviewOptions() {
    reviewOptions.replaceChildren();
    const none = document.createElement("label");
    none.className = "review-choice review-choice--empty";
    const noneInput = document.createElement("input");
    noneInput.type = "radio";
    noneInput.name = "featured-review";
    noneInput.value = "";
    noneInput.checked = pageContent.featuredReviewId == null;
    const noneText = document.createElement("span");
    noneText.innerHTML = "<strong>No featured review</strong><small>Keep the section's current fallback story.</small>";
    none.append(noneInput, noneText);
    reviewOptions.append(none);

    eligibleReviews.forEach((review) => {
        const choice = document.createElement("label");
        choice.className = "review-choice";
        const input = document.createElement("input");
        input.type = "radio";
        input.name = "featured-review";
        input.value = String(review.id);
        input.checked = review.id === pageContent.featuredReviewId;
        let portrait;
        if (review.clientImageUrl) {
            portrait = document.createElement("img");
            portrait.src = review.clientImageUrl;
            portrait.alt = "";
            portrait.style.objectPosition = `${review.clientImageFocalX ?? 50}% ${review.clientImageFocalY ?? 50}%`;
        } else {
            portrait = document.createElement("span");
            portrait.className = "review-choice__initials";
            portrait.textContent = initials(review.clientName);
        }
        const details = document.createElement("span");
        const excerpt = review.quote.length > 90 ? `${review.quote.slice(0, 87)}…` : review.quote;
        details.innerHTML = `<strong></strong><small></small>`;
        details.querySelector("strong").textContent = review.clientName;
        details.querySelector("small").textContent = `${review.clientType || "Client"} · “${excerpt}”`;
        choice.append(input, portrait, details);
        reviewOptions.append(choice);
    });
}

function renderImageControl(control) {
    const key = control.dataset.imageControl;
    const image = pageContent[key].image;
    const preview = control.querySelector(".image-control__preview");
    const previewImage = preview.querySelector("img");
    const focal = control.querySelector(".focal-control");
    const removeButton = control.querySelector("[data-remove-image]");
    if (image) {
        const responseImage = key === "about" ? window.pageResponse?.about.image : key === "featuredStory" ? window.pageResponse?.featuredStory.image : window.pageResponse?.finalCta.image;
        const matchingResponse = responseImage?.storagePath === image.storagePath ? responseImage.publicUrl : null;
        previewImage.src = matchingResponse || image.publicUrl || "";
        previewImage.style.objectPosition = `${image.focalX}% ${image.focalY}%`;
        preview.classList.toggle("has-image", Boolean(previewImage.src));
        focal.hidden = false;
        control.querySelector("[data-focal-x]").value = image.focalX;
        control.querySelector("[data-focal-y]").value = image.focalY;
        removeButton.disabled = false;
        control.querySelector(".image-upload-button span").textContent = "Replace image";
    } else {
        previewImage.removeAttribute("src");
        preview.classList.remove("has-image");
        focal.hidden = true;
        removeButton.disabled = true;
        control.querySelector(".image-upload-button span").textContent = "Upload image";
    }
}

function fillForm(data) {
    setField("hero.eyebrow", data.hero.eyebrow);
    setField("hero.titleLine1", data.hero.titleLine1);
    setField("hero.titleEmphasis", data.hero.titleEmphasis);
    setField("hero.description", data.hero.description);
    setField("hero.cta.label", data.hero.cta.label);
    setField("hero.cta.href", data.hero.cta.href);
    setField("hero.reelUrl", data.hero.reelUrl);
    setField("about.eyebrow", data.about.eyebrow);
    setField("about.titleLine1", data.about.titleLine1);
    setField("about.titleLine2", data.about.titleLine2);
    setField("about.body", data.about.body);
    setField("about.cta.label", data.about.cta.label);
    setField("about.cta.href", data.about.cta.href);
    setField("featuredStory.eyebrow", data.featuredStory.eyebrow);
    setField("featuredStory.titleLine1", data.featuredStory.titleLine1);
    setField("featuredStory.titleLine2", data.featuredStory.titleLine2);
    setField("finalCta.eyebrow", data.finalCta.eyebrow);
    setField("finalCta.title", data.finalCta.title);
    setField("finalCta.cta.label", data.finalCta.cta.label);
    setField("finalCta.cta.href", data.finalCta.cta.href);
    renderValueInputs("hero", data.hero.values);
    renderValueInputs("about", data.about.values);
    renderReviewOptions();
    imageControls.forEach(renderImageControl);
    updatePreview();
}

function valuesFromForm(section) {
    return [...document.querySelectorAll(`[data-value-section="${section}"][data-value-key="title"]`)].map((titleInput) => {
        const index = titleInput.dataset.valueIndex;
        const subtitle = document.querySelector(`[data-value-section="${section}"][data-value-index="${index}"][data-value-key="subtitle"]`);
        return { title: titleInput.value.trim(), subtitle: subtitle.value.trim() };
    });
}

function buildPayload() {
    const selectedReview = form.querySelector('input[name="featured-review"]:checked');
    return {
        hero: { eyebrow: getField("hero.eyebrow"), titleLine1: getField("hero.titleLine1"), titleEmphasis: getField("hero.titleEmphasis"), description: getField("hero.description"), cta: { label: getField("hero.cta.label"), href: getField("hero.cta.href") }, values: valuesFromForm("hero"), reelUrl: getField("hero.reelUrl") },
        about: { eyebrow: getField("about.eyebrow"), titleLine1: getField("about.titleLine1"), titleLine2: getField("about.titleLine2"), body: getField("about.body"), cta: { label: getField("about.cta.label"), href: getField("about.cta.href") }, values: valuesFromForm("about"), image: cleanImage(pageContent.about.image) },
        featuredStory: { eyebrow: getField("featuredStory.eyebrow"), titleLine1: getField("featuredStory.titleLine1"), titleLine2: getField("featuredStory.titleLine2"), image: cleanImage(pageContent.featuredStory.image) },
        featuredReviewId: selectedReview?.value ? Number(selectedReview.value) : null,
        finalCta: { eyebrow: getField("finalCta.eyebrow"), title: getField("finalCta.title"), cta: { label: getField("finalCta.cta.label"), href: getField("finalCta.cta.href") }, image: cleanImage(pageContent.finalCta.image) }
    };
}

function setDirty(dirty = true) {
    isDirty = dirty;
    saveButton.disabled = !dirty || isSaving;
    saveState.textContent = dirty ? "Unsaved changes" : "Everything is saved";
    if (dirty) saveMessage.textContent = "";
}

function updatePreview() {
    if (!pageContent || !previewFrame?.contentWindow) return;
    const content = buildPayload();
    for (const key of ["about", "featuredStory", "finalCta"]) {
        const currentImage = pageContent[key].image;
        if (!currentImage) continue;
        const responseImage = key === "about" ? window.pageResponse?.about.image : key === "featuredStory" ? window.pageResponse?.featuredStory.image : window.pageResponse?.finalCta.image;
        content[key].image = {
            ...content[key].image,
            publicUrl: currentImage.publicUrl || (responseImage?.storagePath === currentImage.storagePath ? responseImage.publicUrl : null)
        };
    }
    const selectedReview = eligibleReviews.find((review) => review.id === content.featuredReviewId);
    content.featuredReview = selectedReview || null;
    previewFrame.contentWindow.postMessage({ type: "reviews-editor:preview", content }, window.location.origin);
}

function activateSection(name) {
    const titles = { hero: "Edit Hero", carousel: "Client Stories", about: "Edit About Stephanie", featuredStory: "Edit Featured Story", finalCta: "Edit Final CTA" };
    form.hidden = false;
    editPanelEmpty.hidden = true;
    closeEditPanelButton.hidden = false;
    editPanelTitle.textContent = titles[name] || "Edit page content";
    editorSections.forEach((section) => {
        const active = section.dataset.editorSection === name;
        section.classList.toggle("is-active", active);
        section.querySelector(".editor-section__toggle").setAttribute("aria-expanded", "true");
        section.querySelector(".editor-section__body").hidden = false;
    });
}

function closeEditPanel() {
    form.hidden = true;
    editPanelEmpty.hidden = false;
    closeEditPanelButton.hidden = true;
    editPanelTitle.textContent = "Choose something to edit";
    editorSections.forEach((section) => section.classList.remove("is-active"));
    previewFrame?.contentWindow?.postMessage({ type: "reviews-editor:clear" }, window.location.origin);
}

async function deleteManagedImage(storagePath) {
    if (!storagePath) return;
    await requestJson("/api/admin/media/images", { method: "DELETE", body: JSON.stringify({ storagePath }) });
}

async function uploadImage(control, file) {
    const key = control.dataset.imageControl;
    const status = control.querySelector(".image-control__status");
    const uploadLabel = control.querySelector(".image-upload-button");
    const oldImage = pageContent[key].image;
    const formData = new FormData();
    formData.append("scope", control.dataset.uploadScope);
    formData.append("file", file);
    status.textContent = "Uploading and preparing image…";
    uploadLabel.classList.add("is-busy");
    try {
        const uploaded = await requestJson("/api/admin/media/images", { method: "POST", body: formData });
        if (oldImage && uploadedThisSession.has(oldImage.storagePath)) {
            await deleteManagedImage(oldImage.storagePath).catch(() => {});
            uploadedThisSession.delete(oldImage.storagePath);
        }
        uploadedThisSession.add(uploaded.storagePath);
        pageContent[key].image = { storagePath: uploaded.storagePath, publicUrl: uploaded.publicUrl, focalX: 50, focalY: 50 };
        renderImageControl(control);
        status.textContent = "Image ready. Save Changes to publish it.";
        setDirty();
        updatePreview();
    } catch (error) {
        status.textContent = error.message;
    } finally {
        uploadLabel.classList.remove("is-busy");
        control.querySelector('input[type="file"]').value = "";
    }
}

async function removeImage(control) {
    const key = control.dataset.imageControl;
    const image = pageContent[key].image;
    if (!image) return;
    if (uploadedThisSession.has(image.storagePath)) {
        await deleteManagedImage(image.storagePath).catch(() => {});
        uploadedThisSession.delete(image.storagePath);
    }
    pageContent[key].image = null;
    renderImageControl(control);
    control.querySelector(".image-control__status").textContent = "The website default will be used after saving.";
    setDirty();
    updatePreview();
}

async function savePage(event) {
    event.preventDefault();
    if (!form.reportValidity() || !isDirty || isSaving) return;
    const previousPaths = [pageContent.originalAboutPath, pageContent.originalFeaturedPath, pageContent.originalFinalPath].filter(Boolean);
    isSaving = true;
    saveButton.disabled = true;
    saveButton.textContent = "Saving…";
    saveMessage.textContent = "Saving your Reviews Page…";
    try {
        const saved = await requestJson("/api/admin/reviews-page", { method: "PUT", body: JSON.stringify(buildPayload()) });
        const activePaths = [saved.about.image?.storagePath, saved.featuredStory.image?.storagePath, saved.finalCta.image?.storagePath].filter(Boolean);
        const supersededPaths = previousPaths.filter((path) => !activePaths.includes(path));
        window.pageResponse = saved;
        pageContent = contentFromResponse(saved);
        pageContent.originalAboutPath = saved.about.image?.storagePath || null;
        pageContent.originalFeaturedPath = saved.featuredStory.image?.storagePath || null;
        pageContent.originalFinalPath = saved.finalCta.image?.storagePath || null;
        eligibleReviews = saved.eligibleReviews || eligibleReviews;
        uploadedThisSession.clear();
        fillForm(pageContent);
        setDirty(false);
        saveMessage.textContent = "Changes saved successfully.";
        const cleanupResults = await Promise.allSettled(supersededPaths.map(deleteManagedImage));
        if (cleanupResults.some((result) => result.status === "rejected")) {
            saveMessage.textContent = "Changes saved. An older image could not be cleaned up automatically.";
        }
    } catch (error) {
        saveMessage.textContent = error.message;
    } finally {
        isSaving = false;
        saveButton.textContent = "Save Changes";
        saveButton.disabled = !isDirty;
    }
}

async function loadPage() {
    try {
        const data = await requestJson("/api/admin/reviews-page");
        window.pageResponse = data;
        eligibleReviews = data.eligibleReviews || [];
        pageContent = contentFromResponse(data);
        pageContent.originalAboutPath = data.about.image?.storagePath || null;
        pageContent.originalFeaturedPath = data.featuredStory.image?.storagePath || null;
        pageContent.originalFinalPath = data.finalCta.image?.storagePath || null;
        fillForm(pageContent);
        loadingStatus.hidden = true;
        workspace.hidden = false;
        savebar.hidden = false;
        setDirty(false);
    } catch (error) {
        loadingStatus.textContent = error.message;
    }
}

editorSections.forEach((section) => section.querySelector(".editor-section__toggle").addEventListener("click", () => activateSection(section.dataset.editorSection)));
previewSections.forEach((section) => section.addEventListener("click", () => {
    activateSection(section.dataset.previewSection);
    document.querySelector(`[data-editor-section="${section.dataset.previewSection}"]`).scrollIntoView({ behavior: "smooth", block: "center" });
}));
closeEditPanelButton.addEventListener("click", closeEditPanel);
window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type === "reviews-editor:select") activateSection(event.data.target);
    if (event.data?.type === "reviews-editor:ready") updatePreview();
});
form.addEventListener("input", (event) => {
    if (event.target.matches("[data-focal-x], [data-focal-y]")) {
        const control = event.target.closest("[data-image-control]");
        const image = pageContent[control.dataset.imageControl].image;
        image.focalX = Number(control.querySelector("[data-focal-x]").value);
        image.focalY = Number(control.querySelector("[data-focal-y]").value);
        control.querySelector("img").style.objectPosition = `${image.focalX}% ${image.focalY}%`;
    }
    setDirty();
    updatePreview();
});
form.addEventListener("submit", savePage);
imageControls.forEach((control) => {
    control.querySelector('input[type="file"]').addEventListener("change", (event) => { if (event.target.files[0]) uploadImage(control, event.target.files[0]); });
    control.querySelector("[data-remove-image]").addEventListener("click", () => removeImage(control));
});
window.addEventListener("beforeunload", (event) => { if (isDirty) event.preventDefault(); });

loadPage();
