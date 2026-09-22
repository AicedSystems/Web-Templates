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
const heroMediaControl = document.querySelector("#hero-media-control");
const heroMediaDropzone = document.querySelector("#hero-media-dropzone");
const heroMediaFile = document.querySelector("#hero-media-file");
const heroMediaPreview = document.querySelector("#hero-media-preview");
const heroMediaStatus = document.querySelector("#hero-media-status");
const heroMediaProgress = document.querySelector("#hero-media-progress");
const heroMediaFocal = document.querySelector("#hero-media-focal");
const heroMediaFocalX = document.querySelector("#hero-media-focal-x");
const heroMediaFocalY = document.querySelector("#hero-media-focal-y");
const heroMediaActive = document.querySelector("#hero-media-active");
const replaceHeroMediaButton = document.querySelector("#replace-hero-media");
const removeHeroMediaButton = document.querySelector("#remove-hero-media");
const heroFitControl = document.querySelector("#hero-fit-control");
const heroFitButtons = [...document.querySelectorAll("[data-hero-fit]")];
const heroZoomControl = document.querySelector("#hero-zoom-control");
const heroZoomOutButton = document.querySelector("#hero-zoom-out");
const heroZoomInButton = document.querySelector("#hero-zoom-in");
const heroZoomResetButton = document.querySelector("#hero-zoom-reset");
const heroZoomValue = document.querySelector("#hero-zoom-value");
const heroPositionHelp = document.querySelector("#hero-position-help");

let pageContent = null;
let eligibleReviews = [];
let isDirty = false;
let isSaving = false;
const uploadedThisSession = new Set();
const imagePositionControls = new Map();

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

function cleanImage(image, defaultFit = "cover") {
    return image ? { storagePath: image.storagePath, focalX: Number(image.focalX), focalY: Number(image.focalY), fit: image.fit === "contain" ? "contain" : image.fit === "cover" ? "cover" : defaultFit, zoom: Number(image.zoom ?? 100) } : null;
}

function cleanHeroMedia(media) {
    if (!media) return null;
    const cleaned = {
        storagePath: media.storagePath,
        mediaType: media.mediaType,
        mimeType: media.mimeType
    };
    if (media.mediaType === "image") {
        cleaned.focalX = Number(media.focalX ?? 50);
        cleaned.focalY = Number(media.focalY ?? 50);
        cleaned.desktopZoom = Number(media.desktopZoom ?? 100);
        cleaned.desktopFit = media.desktopFit === "contain" ? "contain" : "cover";
    }
    return cleaned;
}

function contentFromResponse(data) {
    return {
        hero: { ...structuredClone(data.hero), media: cleanHeroMedia(data.hero.media) },
        about: { ...structuredClone(data.about), image: cleanImage(data.about.image, "contain") },
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
        previewImage.style.objectFit = image.fit;
        previewImage.style.transform = `scale(${image.zoom / 100})`;
        previewImage.style.transformOrigin = `${image.focalX}% ${image.focalY}%`;
        preview.classList.toggle("has-image", Boolean(previewImage.src));
        focal.hidden = false;
        control.querySelector("[data-focal-x]").value = image.focalX;
        control.querySelector("[data-focal-y]").value = image.focalY;
        removeButton.disabled = false;
        control.querySelector(".image-upload-button span").textContent = "Replace image";
        imagePositionControls.get(key)?.setEnabled(Boolean(previewImage.src));
        control.querySelector("[data-image-adjustments]").hidden = false;
        control.querySelectorAll("[data-image-fit]").forEach((button) => button.classList.toggle("is-active", button.dataset.imageFit === image.fit));
        control.querySelector("[data-image-zoom-value]").textContent = `${image.zoom}%`;
    } else {
        previewImage.removeAttribute("src");
        preview.classList.remove("has-image");
        focal.hidden = true;
        removeButton.disabled = true;
        control.querySelector(".image-upload-button span").textContent = "Upload image";
        imagePositionControls.get(key)?.setEnabled(false);
        control.querySelector("[data-image-adjustments]").hidden = true;
    }
}

function heroMediaPublicUrl(media) {
    if (!media) return null;
    if (media.publicUrl) return media.publicUrl;
    const responseMedia = window.pageResponse?.hero?.media;
    return responseMedia?.storagePath === media.storagePath ? responseMedia.publicUrl : null;
}

function renderHeroMediaControl() {
    const media = pageContent.hero.media;
    const image = heroMediaPreview.querySelector("img");
    const video = heroMediaPreview.querySelector("video");
    const publicUrl = heroMediaPublicUrl(media);
    image.removeAttribute("src");
    video.pause();
    video.removeAttribute("src");
    video.load();
    heroMediaPreview.classList.remove("has-image", "has-video");

    if (media?.mediaType === "image" && publicUrl) {
        image.src = publicUrl;
        image.style.objectPosition = `${media.focalX}% ${media.focalY}%`;
        image.style.objectFit = media.desktopFit === "contain" ? "contain" : "cover";
        image.style.transform = `scale(${(media.desktopZoom ?? 100) / 100})`;
        image.style.transformOrigin = `${media.focalX}% ${media.focalY}%`;
        heroMediaPreview.classList.add("has-image");
        heroMediaFocal.hidden = false;
        heroMediaFocalX.value = media.focalX;
        heroMediaFocalY.value = media.focalY;
        heroZoomControl.hidden = false;
        heroFitControl.hidden = false;
        heroFitButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.heroFit === media.desktopFit));
        heroZoomValue.value = `${media.desktopZoom ?? 100}%`;
        heroZoomValue.textContent = `${media.desktopZoom ?? 100}%`;
        heroZoomOutButton.disabled = (media.desktopZoom ?? 100) <= 100;
        heroZoomInButton.disabled = (media.desktopZoom ?? 100) >= 130;
        heroPositionHelp.hidden = false;
        imagePositionControls.get("hero")?.setEnabled(true);
    } else if (media?.mediaType === "video" && publicUrl) {
        image.style.removeProperty("transform");
        image.style.removeProperty("transform-origin");
        video.src = publicUrl;
        video.load();
        video.play().catch(() => {});
        heroMediaPreview.classList.add("has-video");
        heroMediaFocal.hidden = true;
        heroZoomControl.hidden = true;
        heroFitControl.hidden = true;
        heroPositionHelp.hidden = true;
        imagePositionControls.get("hero")?.setEnabled(false);
    } else {
        image.style.removeProperty("transform");
        image.style.removeProperty("transform-origin");
        heroMediaFocal.hidden = true;
        heroZoomControl.hidden = true;
        heroFitControl.hidden = true;
        heroPositionHelp.hidden = true;
        imagePositionControls.get("hero")?.setEnabled(false);
    }

    replaceHeroMediaButton.hidden = !media;
    removeHeroMediaButton.disabled = !media;
    if (media) heroMediaActive.textContent = `Active after saving: uploaded ${media.mediaType}.`;
    else if (getField("hero.reelUrl")) heroMediaActive.textContent = "Active media: Instagram Reel fallback.";
    else heroMediaActive.textContent = "Active media: bundled website fallback image.";
}

function setHeroDesktopZoom(nextZoom) {
    const media = pageContent.hero.media;
    if (media?.mediaType !== "image") return;
    media.desktopZoom = Math.min(130, Math.max(100, nextZoom));
    renderHeroMediaControl();
    setDirty();
    updatePreview();
}

function initializeImagePositionControls() {
    imagePositionControls.set("hero", new window.ManagedImagePositionControl({
        frame: heroMediaPreview,
        image: heroMediaPreview.querySelector("img"),
        getPosition: () => pageContent?.hero.media?.mediaType === "image" ? pageContent.hero.media : null,
        onChange: ({ focalX, focalY }) => {
            const media = pageContent.hero.media;
            media.focalX = focalX;
            media.focalY = focalY;
            heroMediaFocalX.value = focalX;
            heroMediaFocalY.value = focalY;
            setDirty();
            updatePreview();
        }
    }));

    imageControls.forEach((control) => {
        const key = control.dataset.imageControl;
        const frame = control.querySelector(".image-control__preview");
        imagePositionControls.set(key, new window.ManagedImagePositionControl({
            frame,
            image: frame.querySelector("img"),
            getPosition: () => pageContent?.[key]?.image || null,
            onChange: ({ focalX, focalY }) => {
                const image = pageContent[key].image;
                image.focalX = focalX;
                image.focalY = focalY;
                control.querySelector("[data-focal-x]").value = focalX;
                control.querySelector("[data-focal-y]").value = focalY;
                setDirty();
                updatePreview();
            }
        }));
    });
}

function fillForm(data) {
    setField("hero.eyebrow", data.hero.eyebrow);
    setField("hero.titleLine1", data.hero.titleLine1);
    setField("hero.titleEmphasis", data.hero.titleEmphasis);
    setField("hero.description", data.hero.description);
    setField("hero.reelUrl", data.hero.reelUrl);
    setField("about.eyebrow", data.about.eyebrow);
    setField("about.titleLine1", data.about.titleLine1);
    setField("about.titleLine2", data.about.titleLine2);
    setField("about.body", data.about.body);
    setField("featuredStory.eyebrow", data.featuredStory.eyebrow);
    setField("featuredStory.titleLine1", data.featuredStory.titleLine1);
    setField("featuredStory.titleLine2", data.featuredStory.titleLine2);
    setField("finalCta.eyebrow", data.finalCta.eyebrow);
    setField("finalCta.title", data.finalCta.title);
    renderValueInputs("hero", data.hero.values);
    renderValueInputs("about", data.about.values);
    renderReviewOptions();
    renderHeroMediaControl();
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
        hero: { eyebrow: getField("hero.eyebrow"), titleLine1: getField("hero.titleLine1"), titleEmphasis: getField("hero.titleEmphasis"), description: getField("hero.description"), cta: structuredClone(pageContent.hero.cta), values: valuesFromForm("hero"), reelUrl: getField("hero.reelUrl") || null, media: cleanHeroMedia(pageContent.hero.media) },
        about: { eyebrow: getField("about.eyebrow"), titleLine1: getField("about.titleLine1"), titleLine2: getField("about.titleLine2"), body: getField("about.body"), cta: structuredClone(pageContent.about.cta), values: valuesFromForm("about"), image: cleanImage(pageContent.about.image) },
        featuredStory: { eyebrow: getField("featuredStory.eyebrow"), titleLine1: getField("featuredStory.titleLine1"), titleLine2: getField("featuredStory.titleLine2"), image: cleanImage(pageContent.featuredStory.image) },
        featuredReviewId: selectedReview?.value ? Number(selectedReview.value) : null,
        finalCta: { eyebrow: getField("finalCta.eyebrow"), title: getField("finalCta.title"), cta: structuredClone(pageContent.finalCta.cta), image: cleanImage(pageContent.finalCta.image) }
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
    if (content.hero.media) {
        content.hero.media.publicUrl = heroMediaPublicUrl(pageContent.hero.media);
    }
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

function uploadHeroMediaRequest(file) {
    return new Promise((resolve, reject) => {
        const body = new FormData();
        body.append("scope", "reviews-page/hero");
        body.append("file", file);
        const request = new XMLHttpRequest();
        request.open("POST", "/api/admin/media/images");
        request.responseType = "json";
        request.setRequestHeader("Accept", "application/json");
        request.upload.addEventListener("progress", (event) => {
            if (!event.lengthComputable) return;
            heroMediaProgress.hidden = false;
            heroMediaProgress.value = Math.round((event.loaded / event.total) * 100);
            heroMediaStatus.textContent = `Uploading… ${heroMediaProgress.value}%`;
        });
        request.addEventListener("load", () => {
            if (request.status >= 200 && request.status < 300) resolve(request.response);
            else reject(new Error(request.response?.message || "The Hero media could not be uploaded."));
        });
        request.addEventListener("error", () => reject(new Error("The Hero media upload was interrupted.")));
        request.send(body);
    });
}

async function uploadHeroMedia(file) {
    const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"]);
    const isVideo = file.type === "video/mp4" || file.type === "video/webm";
    const limit = isVideo ? 50 * 1024 * 1024 : 8 * 1024 * 1024;
    if (!supportedTypes.has(file.type)) {
        heroMediaStatus.textContent = "Choose a JPEG, PNG, WebP, MP4, or WebM file.";
        return;
    }
    if (file.size > limit) {
        heroMediaStatus.textContent = isVideo ? "Videos must be 50 MB or smaller." : "Images must be 8 MB or smaller.";
        return;
    }

    const oldMedia = pageContent.hero.media;
    heroMediaControl.classList.add("is-uploading");
    heroMediaProgress.hidden = false;
    heroMediaProgress.value = 0;
    heroMediaStatus.textContent = "Preparing upload…";
    try {
        const uploaded = await uploadHeroMediaRequest(file);
        if (oldMedia && uploadedThisSession.has(oldMedia.storagePath)) {
            await deleteManagedImage(oldMedia.storagePath).catch(() => {});
            uploadedThisSession.delete(oldMedia.storagePath);
        }
        uploadedThisSession.add(uploaded.storagePath);
        pageContent.hero.media = {
            storagePath: uploaded.storagePath,
            publicUrl: uploaded.publicUrl,
            mediaType: uploaded.mediaType,
            mimeType: uploaded.mimeType,
            ...(uploaded.mediaType === "image" ? { focalX: 50, focalY: 50, desktopZoom: 100, desktopFit: "cover" } : {})
        };
        renderHeroMediaControl();
        heroMediaStatus.textContent = `${uploaded.mediaType === "video" ? "Video" : "Image"} ready. Save Changes to publish it.`;
        setDirty();
        updatePreview();
    } catch (error) {
        heroMediaStatus.textContent = error.message;
    } finally {
        heroMediaControl.classList.remove("is-uploading");
        heroMediaProgress.hidden = true;
        heroMediaProgress.value = 0;
        heroMediaFile.value = "";
    }
}

async function removeHeroMedia() {
    const media = pageContent.hero.media;
    if (!media) return;
    if (uploadedThisSession.has(media.storagePath)) {
        await deleteManagedImage(media.storagePath).catch(() => {});
        uploadedThisSession.delete(media.storagePath);
    }
    pageContent.hero.media = null;
    renderHeroMediaControl();
    heroMediaStatus.textContent = getField("hero.reelUrl") ? "The Instagram Reel will be used after saving." : "The website fallback image will be used after saving.";
    setDirty();
    updatePreview();
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
        pageContent[key].image = { storagePath: uploaded.storagePath, publicUrl: uploaded.publicUrl, focalX: 50, focalY: 50, fit: key === "about" ? "contain" : "cover", zoom: 100 };
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
    const previousPaths = [pageContent.originalHeroPath, pageContent.originalAboutPath, pageContent.originalFeaturedPath, pageContent.originalFinalPath].filter(Boolean);
    isSaving = true;
    saveButton.disabled = true;
    saveButton.textContent = "Saving…";
    saveMessage.textContent = "Saving your Reviews Page…";
    try {
        const saved = await requestJson("/api/admin/reviews-page", { method: "PUT", body: JSON.stringify(buildPayload()) });
        const activePaths = [saved.hero.media?.storagePath, saved.about.image?.storagePath, saved.featuredStory.image?.storagePath, saved.finalCta.image?.storagePath].filter(Boolean);
        const supersededPaths = previousPaths.filter((path) => !activePaths.includes(path));
        window.pageResponse = saved;
        pageContent = contentFromResponse(saved);
        pageContent.originalHeroPath = saved.hero.media?.storagePath || null;
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
        pageContent.originalHeroPath = data.hero.media?.storagePath || null;
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
    if (event.target === heroMediaFocalX || event.target === heroMediaFocalY) {
        const media = pageContent.hero.media;
        if (media?.mediaType === "image") {
            media.focalX = Number(heroMediaFocalX.value);
            media.focalY = Number(heroMediaFocalY.value);
            heroMediaPreview.querySelector("img").style.objectPosition = `${media.focalX}% ${media.focalY}%`;
        }
    }
    if (event.target.name === "hero.reelUrl") renderHeroMediaControl();
    setDirty();
    updatePreview();
});
form.addEventListener("submit", savePage);
imageControls.forEach((control) => {
    control.querySelector('input[type="file"]').addEventListener("change", (event) => { if (event.target.files[0]) uploadImage(control, event.target.files[0]); });
    control.querySelector("[data-remove-image]").addEventListener("click", () => removeImage(control));
    control.querySelectorAll("[data-image-fit]").forEach((button) => button.addEventListener("click", () => {
        const image = pageContent[control.dataset.imageControl].image;
        if (!image) return;
        image.fit = button.dataset.imageFit;
        renderImageControl(control);
        setDirty();
        updatePreview();
    }));
    control.querySelectorAll("[data-image-zoom]").forEach((button) => button.addEventListener("click", () => {
        const image = pageContent[control.dataset.imageControl].image;
        if (!image) return;
        image.zoom = Math.min(150, Math.max(100, image.zoom + Number(button.dataset.imageZoom)));
        renderImageControl(control);
        setDirty();
        updatePreview();
    }));
    control.querySelector("[data-image-zoom-reset]").addEventListener("click", () => {
        const image = pageContent[control.dataset.imageControl].image;
        if (!image) return;
        image.zoom = 100;
        renderImageControl(control);
        setDirty();
        updatePreview();
    });
});
heroMediaFile.addEventListener("change", (event) => { if (event.target.files[0]) uploadHeroMedia(event.target.files[0]); });
heroMediaDropzone.addEventListener("click", () => heroMediaFile.click());
heroMediaDropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        heroMediaFile.click();
    }
});
["dragenter", "dragover"].forEach((eventName) => heroMediaDropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    heroMediaDropzone.classList.add("is-dragging");
}));
["dragleave", "drop"].forEach((eventName) => heroMediaDropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    heroMediaDropzone.classList.remove("is-dragging");
}));
heroMediaDropzone.addEventListener("drop", (event) => { if (event.dataTransfer.files[0]) uploadHeroMedia(event.dataTransfer.files[0]); });
replaceHeroMediaButton.addEventListener("click", () => heroMediaFile.click());
removeHeroMediaButton.addEventListener("click", removeHeroMedia);
heroZoomOutButton.addEventListener("click", () => setHeroDesktopZoom((pageContent.hero.media?.desktopZoom ?? 100) - 5));
heroZoomInButton.addEventListener("click", () => setHeroDesktopZoom((pageContent.hero.media?.desktopZoom ?? 100) + 5));
heroZoomResetButton.addEventListener("click", () => setHeroDesktopZoom(100));
heroFitButtons.forEach((button) => button.addEventListener("click", () => {
    const media = pageContent.hero.media;
    if (media?.mediaType !== "image") return;
    media.desktopFit = button.dataset.heroFit;
    renderHeroMediaControl();
    setDirty();
    updatePreview();
}));
window.addEventListener("beforeunload", (event) => { if (isDirty) event.preventDefault(); });

initializeImagePositionControls();
loadPage();
