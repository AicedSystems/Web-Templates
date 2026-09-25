"use strict";

const form = document.querySelector("#agents-page-form");
const workspace = document.querySelector("#page-editor-workspace");
const loadingStatus = document.querySelector("#page-editor-status");
const savebar = document.querySelector("#page-editor-savebar");
const saveButton = document.querySelector("#save-page");
const saveState = document.querySelector("#save-state");
const saveMessage = document.querySelector("#save-message");
const previewFrame = document.querySelector("#agents-page-preview");
const emptyPanel = document.querySelector("#edit-panel-empty");
const panelTitle = document.querySelector("#edit-panel-title");
const closePanel = document.querySelector("#close-edit-panel");
const sections = [...document.querySelectorAll("[data-editor-section]")];
const mediaControls = [...document.querySelectorAll("[data-media-control]")];
let draft = null;
let savedBaseline = null;
let availableTags = [];
let availableArticles = [];
let isDirty = false;
let isSaving = false;
let previewAnimationFrame = null;
const uploadedThisSession = new Set();
const positionControls = new Map();

async function requestJson(url, options = {}) {
    const response = await fetch(url, { ...options, cache: "no-store", headers: { Accept: "application/json", ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...options.headers } });
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || "Something went wrong. Please try again.");
    return data;
}

function cleanMedia(media, placement) {
    if (!media) return null;
    const clean = { storagePath: media.storagePath, mediaType: media.mediaType, mimeType: media.mimeType };
    if (media.mediaType === "image") {
        Object.assign(clean, { focalX: Number(media.focalX ?? 50), focalY: Number(media.focalY ?? 50) });
        if (placement === "hero") Object.assign(clean, { desktopFit: media.desktopFit === "contain" ? "contain" : "cover", desktopZoom: Number(media.desktopZoom ?? 100) });
        else Object.assign(clean, { fit: media.fit === "contain" ? "contain" : "cover", zoom: Number(media.zoom ?? 100) });
    }
    return clean;
}

function contentFromResponse(data) {
    return {
        hero: { ...structuredClone(data.hero), media: data.hero.media ? { ...cleanMedia(data.hero.media, "hero"), publicUrl: data.hero.media.publicUrl } : null },
        spotlight: { ...structuredClone(data.spotlight), image: data.spotlight.image ? { ...cleanMedia(data.spotlight.image, "spotlight"), publicUrl: data.spotlight.image.publicUrl } : null },
        application: structuredClone(data.application), resources: structuredClone(data.resources),
        finalCta: { ...structuredClone(data.finalCta), image: data.finalCta.image ? { ...cleanMedia(data.finalCta.image, "finalCta"), publicUrl: data.finalCta.image.publicUrl } : null }
    };
}

function field(name) { return form.elements.namedItem(name); }
function setField(name, value) { if (field(name)) field(name).value = value ?? ""; }
function getField(name) { return field(name)?.value.trim() || ""; }

function renderBenefits(section, values) {
    const container = document.querySelector(`[data-benefits="${section}"]`);
    container.replaceChildren(...values.map((value, index) => {
        const label = document.createElement("label");
        const span = document.createElement("span"); span.textContent = `Benefit ${index + 1}`;
        const input = document.createElement("input"); input.required = true; input.maxLength = 80; input.value = value; input.dataset.benefitSection = section; input.dataset.benefitIndex = index;
        label.append(span, input); return label;
    }));
}
function benefits(section) { return [...document.querySelectorAll(`[data-benefit-section="${section}"]`)].map((input) => input.value.trim()); }

function renderTagOptions(selected) {
    const select = field("resources.tag");
    select.replaceChildren(...availableTags.map((tag) => { const option = document.createElement("option"); option.value = tag; option.textContent = tag; return option; }));
    if (selected && !availableTags.some((tag) => tag.toLowerCase() === selected.toLowerCase())) { const option = document.createElement("option"); option.value = selected; option.textContent = selected; select.append(option); }
    select.value = selected || availableTags[0] || "";
}

function renderFilterFields() {
    const isTag = getField("resources.filterType") === "tag";
    document.querySelector("[data-tag-field]").hidden = !isTag;
    field("resources.category").closest("label").hidden = isTag;
    field("resources.tag").required = isTag;
    field("resources.category").required = !isTag;
}

function renderMedia(control) {
    const key = control.dataset.mediaControl;
    const media = key === "hero" ? draft.hero.media : draft[key].image;
    const preview = control.querySelector(".image-control__preview");
    const image = preview.querySelector("img"); const video = preview.querySelector("video");
    preview.classList.remove("has-image", "has-video");
    if (media?.publicUrl && media.mediaType === "video" && video) { video.src = media.publicUrl; preview.classList.add("has-video"); video.play().catch(() => {}); }
    else if (media?.publicUrl) { const fit = key === "hero" ? media.desktopFit : media.fit; const zoom = key === "hero" ? media.desktopZoom : media.zoom; image.src = media.publicUrl; image.style.objectPosition = `${media.focalX}% ${media.focalY}%`; image.style.objectFit = fit; image.style.transform = `scale(${zoom / 100})`; image.style.transformOrigin = `${media.focalX}% ${media.focalY}%`; preview.classList.add("has-image"); }
    else { image.removeAttribute("src"); if (video) video.removeAttribute("src"); }
    const focal = control.querySelector(".focal-control");
    if (focal) { focal.hidden = media?.mediaType !== "image"; if (media?.mediaType === "image") { control.querySelector("[data-focal-x]").value = media.focalX; control.querySelector("[data-focal-y]").value = media.focalY; } }
    const adjustments = control.querySelector("[data-image-adjustments]");
    if (adjustments) { adjustments.hidden = media?.mediaType !== "image"; if (media?.mediaType === "image") { const fit = key === "hero" ? media.desktopFit : media.fit; const zoom = key === "hero" ? media.desktopZoom : media.zoom; control.querySelectorAll("[data-image-fit]").forEach((button) => button.classList.toggle("is-active", button.dataset.imageFit === fit)); control.querySelector("[data-image-zoom-value]").textContent = `${zoom}%`; } }
    positionControls.get(key)?.setEnabled(Boolean(media?.publicUrl && media.mediaType === "image"));
    control.querySelector("[data-remove-media]").disabled = !media;
}

function fillForm() {
    for (const [name, value] of Object.entries({ "hero.eyebrow": draft.hero.eyebrow, "hero.heading": draft.hero.heading, "hero.description": draft.hero.description, "spotlight.heading": draft.spotlight.heading, "spotlight.quote": draft.spotlight.quote, "spotlight.agentName": draft.spotlight.agentName, "spotlight.attribution": draft.spotlight.attribution, "spotlight.rating": draft.spotlight.rating, "application.heading": draft.application.heading, "application.description": draft.application.description, "resources.heading": draft.resources.heading, "resources.filterType": draft.resources.filterType, "resources.category": draft.resources.filterType === "category" ? draft.resources.filterValue : "recruiting", "resources.articleCount": draft.resources.articleCount, "finalCta.heading": draft.finalCta.heading, "finalCta.button.label": draft.finalCta.button.label, "finalCta.button.href": draft.finalCta.button.href })) setField(name, value);
    renderTagOptions(draft.resources.filterType === "tag" ? draft.resources.filterValue : "");
    renderFilterFields(); renderBenefits("hero", draft.hero.benefits); renderBenefits("application", draft.application.benefits); mediaControls.forEach(renderMedia); updatePreview();
}

function buildPayload(includeUrls = false) {
    const filterType = getField("resources.filterType");
    const payload = {
        hero: { eyebrow: getField("hero.eyebrow"), heading: getField("hero.heading"), description: getField("hero.description"), benefits: benefits("hero"), media: cleanMedia(draft.hero.media, "hero") },
        spotlight: { heading: getField("spotlight.heading"), quote: getField("spotlight.quote"), agentName: getField("spotlight.agentName"), attribution: getField("spotlight.attribution"), rating: getField("spotlight.rating") ? Number(getField("spotlight.rating")) : null, image: cleanMedia(draft.spotlight.image, "spotlight") },
        application: { heading: getField("application.heading"), description: getField("application.description"), benefits: benefits("application") },
        resources: { heading: getField("resources.heading"), filterType, filterValue: getField(filterType === "tag" ? "resources.tag" : "resources.category"), articleCount: Number(getField("resources.articleCount")) },
        finalCta: { heading: getField("finalCta.heading"), button: { label: getField("finalCta.button.label"), href: getField("finalCta.button.href") }, image: cleanMedia(draft.finalCta.image, "finalCta") }
    };
    if (includeUrls) { if (payload.hero.media) payload.hero.media.publicUrl = draft.hero.media.publicUrl; if (payload.spotlight.image) payload.spotlight.image.publicUrl = draft.spotlight.image.publicUrl; if (payload.finalCta.image) payload.finalCta.image.publicUrl = draft.finalCta.image.publicUrl; }
    return payload;
}

function setDirty(value = true) { isDirty = value; saveButton.disabled = !value || isSaving; saveState.textContent = value ? "Unsaved changes" : "Everything is saved"; if (value) saveMessage.textContent = ""; }
function filteredResourceArticles(content) {
    const resources = content.resources;
    return availableArticles.filter((article) => resources.filterType === "category" ? article.category === resources.filterValue : article.tags.some((tag) => tag.toLowerCase() === resources.filterValue.toLowerCase())).slice(0, resources.articleCount);
}
function updatePreview() {
    if (previewAnimationFrame !== null) return;
    previewAnimationFrame = window.requestAnimationFrame(() => {
        previewAnimationFrame = null;
        const content = buildPayload(true);
        previewFrame?.contentWindow?.postMessage({ type: "agents-editor:preview", content, resourceArticles: filteredResourceArticles(content) }, window.location.origin);
    });
}

function updateEditorMediaPosition(control, media) {
    const image = control.querySelector(".image-control__preview img");
    image.style.objectPosition = `${media.focalX}% ${media.focalY}%`;
    image.style.transformOrigin = `${media.focalX}% ${media.focalY}%`;
}
function activateSection(name) { const titles = { hero: "Edit Hero", spotlight: "Edit Agent Spotlight", application: "Edit Application intro", resources: "Edit Agent Resources", finalCta: "Edit Final CTA" }; form.hidden = false; emptyPanel.hidden = true; closePanel.hidden = false; panelTitle.textContent = titles[name]; sections.forEach((section) => section.classList.toggle("is-active", section.dataset.editorSection === name)); }
function closeEditorPanel() { form.hidden = true; emptyPanel.hidden = false; closePanel.hidden = true; panelTitle.textContent = "Choose something to edit"; sections.forEach((section) => section.classList.remove("is-active")); previewFrame.contentWindow.postMessage({ type: "agents-editor:clear" }, window.location.origin); }

async function deleteMedia(path, keepalive = false) { if (!path) return; await requestJson("/api/admin/media/images", { method: "DELETE", body: JSON.stringify({ storagePath: path }), keepalive }); }

function uploadRequest(control, file) {
    return new Promise((resolve, reject) => { const body = new FormData(); body.append("scope", control.dataset.uploadScope); body.append("file", file); const request = new XMLHttpRequest(); request.open("POST", "/api/admin/media/images"); request.responseType = "json"; request.setRequestHeader("Accept", "application/json"); const progress = control.querySelector("progress"); request.upload.addEventListener("progress", (event) => { if (progress && event.lengthComputable) { progress.hidden = false; progress.value = Math.round(event.loaded / event.total * 100); } }); request.addEventListener("load", () => request.status >= 200 && request.status < 300 ? resolve(request.response) : reject(new Error(request.response?.message || "Media upload failed."))); request.addEventListener("error", () => reject(new Error("The upload was interrupted."))); request.send(body); });
}

async function uploadMedia(control, file) {
    const key = control.dataset.mediaControl; const status = control.querySelector(".image-control__status");
    const video = ["video/mp4", "video/webm"].includes(file.type); const allowed = video || ["image/jpeg", "image/png", "image/webp"].includes(file.type); const limit = video ? 50 * 1024 * 1024 : 8 * 1024 * 1024;
    if (!allowed || (video && key !== "hero")) { status.textContent = key === "hero" ? "Choose a JPEG, PNG, WebP, MP4, or WebM file." : "Choose a JPEG, PNG, or WebP image."; return; }
    if (file.size > limit) { status.textContent = video ? "Videos must be 50 MB or smaller." : "Images must be 8 MB or smaller."; return; }
    const current = key === "hero" ? draft.hero.media : draft[key].image; status.textContent = "Uploading…";
    try { const uploaded = await uploadRequest(control, file); if (current && uploadedThisSession.has(current.storagePath)) { await deleteMedia(current.storagePath).catch(() => {}); uploadedThisSession.delete(current.storagePath); } uploadedThisSession.add(uploaded.storagePath); const media = { storagePath: uploaded.storagePath, publicUrl: uploaded.publicUrl, mediaType: uploaded.mediaType || "image", mimeType: uploaded.mimeType || "image/webp", ...(uploaded.mediaType === "video" ? {} : key === "hero" ? { focalX: 50, focalY: 50, desktopFit: "cover", desktopZoom: 100 } : { focalX: 50, focalY: 50, fit: "cover", zoom: 100 }) }; if (key === "hero") draft.hero.media = media; else draft[key].image = media; renderMedia(control); status.textContent = "Media ready. Save Changes to publish it."; setDirty(); updatePreview(); } catch (error) { status.textContent = error.message; } finally { const progress = control.querySelector("progress"); if (progress) { progress.hidden = true; progress.value = 0; } control.querySelector('input[type="file"]').value = ""; }
}

async function removeMedia(control) { const key = control.dataset.mediaControl; const media = key === "hero" ? draft.hero.media : draft[key].image; if (!media) return; if (uploadedThisSession.has(media.storagePath)) { await deleteMedia(media.storagePath).catch(() => {}); uploadedThisSession.delete(media.storagePath); } if (key === "hero") draft.hero.media = null; else draft[key].image = null; renderMedia(control); control.querySelector(".image-control__status").textContent = "The website fallback will be used after saving."; setDirty(); updatePreview(); }

function activePaths(content) { return [content.hero.media?.storagePath, content.spotlight.image?.storagePath, content.finalCta.image?.storagePath].filter(Boolean); }
async function savePage(event) { event.preventDefault(); if (!form.reportValidity() || !isDirty || isSaving) return; isSaving = true; saveButton.disabled = true; saveButton.textContent = "Saving…"; saveMessage.textContent = "Saving your Agents Page…"; const previous = activePaths(savedBaseline); try { const saved = await requestJson("/api/admin/agents-page", { method: "PUT", body: JSON.stringify(buildPayload()) }); const current = activePaths(saved); const superseded = previous.filter((path) => !current.includes(path)); availableTags = saved.availableTags || availableTags; availableArticles = saved.availableArticles || availableArticles; draft = contentFromResponse(saved); savedBaseline = structuredClone(draft); uploadedThisSession.clear(); fillForm(); setDirty(false); saveMessage.textContent = "Changes saved successfully."; const cleanup = await Promise.allSettled(superseded.map((path) => deleteMedia(path))); if (cleanup.some((item) => item.status === "rejected")) saveMessage.textContent = "Changes saved. An older media file could not be cleaned up automatically."; } catch (error) { saveMessage.textContent = error.message; } finally { isSaving = false; saveButton.textContent = "Save Changes"; saveButton.disabled = !isDirty; } }

async function loadPage() { try { const data = await requestJson("/api/admin/agents-page"); availableTags = data.availableTags || []; availableArticles = data.availableArticles || []; draft = contentFromResponse(data); savedBaseline = structuredClone(draft); fillForm(); loadingStatus.hidden = true; workspace.hidden = false; savebar.hidden = false; setDirty(false); } catch (error) { loadingStatus.textContent = error.message; } }

form.addEventListener("input", (event) => { if (event.target.name === "resources.filterType") renderFilterFields(); if (event.target.matches("[data-focal-x], [data-focal-y]")) { const control = event.target.closest("[data-media-control]"); const key = control.dataset.mediaControl; const media = key === "hero" ? draft.hero.media : draft[key].image; if (media) { media.focalX = Number(control.querySelector("[data-focal-x]").value); media.focalY = Number(control.querySelector("[data-focal-y]").value); updateEditorMediaPosition(control, media); } } setDirty(); updatePreview(); });
form.addEventListener("change", (event) => { if (event.target.type !== "file") { setDirty(); updatePreview(); } }); form.addEventListener("submit", savePage);
mediaControls.forEach((control) => { const input = control.querySelector('input[type="file"]'); const key = control.dataset.mediaControl; const currentMedia = () => key === "hero" ? draft.hero.media : draft[key].image; input.addEventListener("change", () => { if (input.files[0]) uploadMedia(control, input.files[0]); }); control.querySelector("[data-remove-media]").addEventListener("click", () => removeMedia(control)); control.querySelector("[data-browse]")?.addEventListener("click", () => input.click()); control.querySelectorAll("[data-image-fit]").forEach((button) => button.addEventListener("click", () => { const media = currentMedia(); if (!media || media.mediaType !== "image") return; if (key === "hero") media.desktopFit = button.dataset.imageFit; else media.fit = button.dataset.imageFit; renderMedia(control); setDirty(); updatePreview(); })); control.querySelectorAll("[data-image-zoom]").forEach((button) => button.addEventListener("click", () => { const media = currentMedia(); if (!media || media.mediaType !== "image") return; const property = key === "hero" ? "desktopZoom" : "zoom"; const maximum = key === "hero" ? 130 : 150; media[property] = Math.min(maximum, Math.max(100, media[property] + Number(button.dataset.imageZoom))); renderMedia(control); setDirty(); updatePreview(); })); control.querySelector("[data-image-zoom-reset]")?.addEventListener("click", () => { const media = currentMedia(); if (!media || media.mediaType !== "image") return; media[key === "hero" ? "desktopZoom" : "zoom"] = 100; renderMedia(control); setDirty(); updatePreview(); }); const dropzone = control.querySelector(".hero-media-dropzone"); if (dropzone) { dropzone.addEventListener("click", () => input.click()); dropzone.addEventListener("keydown", (event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); input.click(); } }); ["dragover", "drop"].forEach((name) => dropzone.addEventListener(name, (event) => event.preventDefault())); dropzone.addEventListener("drop", (event) => { if (event.dataTransfer.files[0]) uploadMedia(control, event.dataTransfer.files[0]); }); } });
closePanel.addEventListener("click", closeEditorPanel);
window.addEventListener("message", (event) => { if (event.origin !== window.location.origin || event.source !== previewFrame.contentWindow) return; if (event.data?.type === "agents-editor:select" && ["hero", "spotlight", "application", "resources", "finalCta"].includes(event.data.target)) activateSection(event.data.target); if (event.data?.type === "agents-editor:ready") updatePreview(); });
window.addEventListener("beforeunload", (event) => { if (isDirty) event.preventDefault(); });
window.addEventListener("pagehide", () => { uploadedThisSession.forEach((path) => { if (!activePaths(savedBaseline).includes(path)) deleteMedia(path, true).catch(() => {}); }); });
mediaControls.forEach((control) => {
    const key = control.dataset.mediaControl;
    const previewImage = control.querySelector(".image-control__preview img");
    positionControls.set(key, new window.ManagedImagePositionControl({
        frame: control.querySelector(".image-control__preview"),
        image: previewImage,
        getPosition: () => key === "hero" ? draft?.hero?.media : draft?.[key]?.image,
        onChange: ({ focalX, focalY }) => {
            const media = key === "hero" ? draft.hero.media : draft[key].image;
            if (!media || media.mediaType !== "image") return;
            media.focalX = focalX; media.focalY = focalY;
            control.querySelector("[data-focal-x]").value = focalX; control.querySelector("[data-focal-y]").value = focalY;
            setDirty(); updatePreview();
        }
    }));
});
loadPage();
