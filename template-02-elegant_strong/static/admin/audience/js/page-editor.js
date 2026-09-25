"use strict";

const config = window.AUDIENCE_EDITOR;
const form = document.querySelector("#audience-page-form");
const workspace = document.querySelector("#page-editor-workspace");
const loadingStatus = document.querySelector("#page-editor-status");
const savebar = document.querySelector("#page-editor-savebar");
const saveButton = document.querySelector("#save-page");
const discardButton = document.querySelector("#discard-page");
const saveState = document.querySelector("#save-state");
const saveMessage = document.querySelector("#save-message");
const previewFrame = document.querySelector("#audience-page-preview");
const emptyPanel = document.querySelector("#edit-panel-empty");
const panelTitle = document.querySelector("#edit-panel-title");
const closePanel = document.querySelector("#close-edit-panel");
const sections = [...document.querySelectorAll("[data-editor-section]")];
const mediaControls = [...document.querySelectorAll("[data-media-control]")];
const documentControl = document.querySelector("[data-document-control]");
const uploadedThisSession = new Set();
const positionControls = new Map();
let draft = null;
let savedBaseline = null;
let availableTags = [];
let availableCategories = [];
let availableArticles = [];
let isDirty = false;
let isSaving = false;
let previewAnimationFrame = null;

async function requestJson(url, options = {}) {
    const headers = { Accept: "application/json", ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...options.headers };
    const response = await fetch(url, { ...options, headers, cache: "no-store" });
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || "Something went wrong. Please try again.");
    return data;
}

function cleanImage(image) {
    if (!image) return null;
    return { storagePath: image.storagePath, mediaType: "image", mimeType: "image/webp", focalX: Number(image.focalX ?? 50), focalY: Number(image.focalY ?? 50), fit: image.fit === "contain" ? "contain" : "cover", zoom: Number(image.zoom ?? 100) };
}
function cleanPdf(pdf) { return pdf ? { storagePath: pdf.storagePath, mimeType: "application/pdf" } : null; }
function contentFromResponse(data) {
    return {
        hero: { ...structuredClone(data.hero), image: data.hero.image ? { ...cleanImage(data.hero.image), publicUrl: data.hero.image.publicUrl } : null },
        guide: { ...structuredClone(data.guide), image: data.guide.image ? { ...cleanImage(data.guide.image), publicUrl: data.guide.image.publicUrl } : null, pdf: data.guide.pdf ? { ...cleanPdf(data.guide.pdf), publicUrl: data.guide.pdf.publicUrl } : null },
        formIntro: structuredClone(data.formIntro), resources: structuredClone(data.resources)
    };
}
function field(name) { return form.elements.namedItem(name); }
function setField(name, value) { if (field(name)) field(name).value = value ?? ""; }
function getField(name) { return field(name)?.value.trim() || ""; }
function renderBenefits(values) {
    const container = document.querySelector('[data-benefits="hero"]');
    container.replaceChildren(...values.map((value, index) => {
        const label = document.createElement("label"); const span = document.createElement("span"); span.textContent = `Benefit ${index + 1}`;
        const input = document.createElement("input"); input.required = true; input.maxLength = 80; input.value = value; input.dataset.benefitIndex = index;
        label.append(span, input); return label;
    }));
}
function benefits() { return [...document.querySelectorAll("[data-benefit-index]")].map((input) => input.value.trim()); }
function renderOptions(select, values, selected) {
    select.replaceChildren(...values.map((value) => { const option = document.createElement("option"); option.value = value; option.textContent = value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); return option; }));
    if (selected && !values.some((value) => value.toLowerCase() === selected.toLowerCase())) { const option = document.createElement("option"); option.value = selected; option.textContent = selected; select.append(option); }
    select.value = selected || values[0] || "";
}
function renderFilterFields() {
    const tag = getField("resources.filterType") === "tag";
    document.querySelector("[data-tag-field]").hidden = !tag;
    document.querySelector("[data-category-field]").hidden = tag;
    field("resources.tag").required = tag; field("resources.category").required = !tag;
}
function currentImage(key) { return key === "hero" ? draft.hero.image : draft.guide.image; }
function assignImage(key, image) { if (key === "hero") draft.hero.image = image; else draft.guide.image = image; }
function renderMedia(control) {
    const key = control.dataset.mediaControl; const imageData = currentImage(key); const image = control.querySelector("img"); const preview = control.querySelector(".image-control__preview");
    preview.classList.toggle("has-image", Boolean(imageData?.publicUrl));
    if (imageData?.publicUrl) { image.src = imageData.publicUrl; image.style.objectPosition = `${imageData.focalX}% ${imageData.focalY}%`; image.style.objectFit = imageData.fit; image.style.transform = `scale(${imageData.zoom / 100})`; image.style.transformOrigin = `${imageData.focalX}% ${imageData.focalY}%`; } else { image.removeAttribute("src"); }
    const focal = control.querySelector(".focal-control"); focal.hidden = !imageData;
    const adjustments = control.querySelector("[data-image-adjustments]"); adjustments.hidden = !imageData;
    if (imageData) { control.querySelector("[data-focal-x]").value = imageData.focalX; control.querySelector("[data-focal-y]").value = imageData.focalY; control.querySelectorAll("[data-image-fit]").forEach((button) => button.classList.toggle("is-active", button.dataset.imageFit === imageData.fit)); control.querySelector("[data-image-zoom-value]").textContent = `${imageData.zoom}%`; }
    positionControls.get(key)?.setEnabled(Boolean(imageData?.publicUrl)); control.querySelector("[data-remove-media]").disabled = !imageData;
}
function documentName(pdf) { return pdf ? (pdf.displayName || "Current guide PDF") : "No PDF selected"; }
function renderDocument() {
    const pdf = draft.guide.pdf; documentControl.querySelector("[data-document-name]").textContent = documentName(pdf);
    const link = documentControl.querySelector("[data-document-preview]"); link.hidden = !pdf?.publicUrl; if (pdf?.publicUrl) link.href = pdf.publicUrl; else link.removeAttribute("href");
    documentControl.querySelector("[data-remove-document]").disabled = !pdf;
}
function fillForm() {
    const values = { "hero.eyebrow": draft.hero.eyebrow, "hero.heading": draft.hero.heading, "hero.description": draft.hero.description, "guide.eyebrow": draft.guide.eyebrow, "guide.heading": draft.guide.heading, "guide.description": draft.guide.description, "guide.cardTitle": draft.guide.cardTitle, "guide.cardSummary": draft.guide.cardSummary, "formIntro.eyebrow": draft.formIntro.eyebrow, "formIntro.heading": draft.formIntro.heading, "formIntro.description": draft.formIntro.description, "resources.heading": draft.resources.heading, "resources.filterType": draft.resources.filterType, "resources.articleCount": draft.resources.articleCount };
    Object.entries(values).forEach(([name, value]) => setField(name, value)); renderBenefits(draft.hero.benefits);
    renderOptions(field("resources.category"), availableCategories, draft.resources.filterType === "category" ? draft.resources.filterValue : ""); renderOptions(field("resources.tag"), availableTags, draft.resources.filterType === "tag" ? draft.resources.filterValue : "");
    renderFilterFields(); mediaControls.forEach(renderMedia); renderDocument(); updatePreview();
}
function buildPayload(includeUrls = false) {
    const filterType = getField("resources.filterType"); const payload = {
        hero: { eyebrow: getField("hero.eyebrow"), heading: getField("hero.heading"), description: getField("hero.description"), benefits: benefits(), image: cleanImage(draft.hero.image) },
        guide: { eyebrow: getField("guide.eyebrow"), heading: getField("guide.heading"), description: getField("guide.description"), image: cleanImage(draft.guide.image), cardTitle: getField("guide.cardTitle"), cardSummary: getField("guide.cardSummary"), pdf: cleanPdf(draft.guide.pdf) },
        formIntro: { eyebrow: getField("formIntro.eyebrow"), heading: getField("formIntro.heading"), description: getField("formIntro.description") },
        resources: { heading: getField("resources.heading"), filterType, filterValue: getField(filterType === "tag" ? "resources.tag" : "resources.category"), articleCount: Number(getField("resources.articleCount")) }
    };
    if (includeUrls) { if (payload.hero.image) payload.hero.image.publicUrl = draft.hero.image.publicUrl; if (payload.guide.image) payload.guide.image.publicUrl = draft.guide.image.publicUrl; if (payload.guide.pdf) payload.guide.pdf.publicUrl = draft.guide.pdf.publicUrl; }
    return payload;
}
function setDirty(value = true) { isDirty = value; saveButton.disabled = !value || isSaving; discardButton.disabled = !value || isSaving; saveState.textContent = value ? "Unsaved changes" : "Everything is saved"; if (value) saveMessage.textContent = ""; }
function filteredArticles(content) { const value = content.resources.filterValue.toLowerCase(); return availableArticles.filter((article) => content.resources.filterType === "category" ? article.category === content.resources.filterValue : (article.tags || []).some((tag) => tag.toLowerCase() === value)).slice(0, content.resources.articleCount); }
function updatePreview() { if (previewAnimationFrame !== null) return; previewAnimationFrame = requestAnimationFrame(() => { previewAnimationFrame = null; const content = buildPayload(true); previewFrame.contentWindow?.postMessage({ type: "audience-editor:preview", pageType: config.pageType, content, resourceArticles: filteredArticles(content) }, window.location.origin); }); }
function activateSection(name) { const titles = { hero: "Edit Hero", guide: "Edit Guide", formIntro: "Edit inquiry introduction", resources: "Edit Helpful Resources" }; form.hidden = false; emptyPanel.hidden = true; closePanel.hidden = false; panelTitle.textContent = titles[name]; sections.forEach((section) => section.classList.toggle("is-active", section.dataset.editorSection === name)); }
function closeEditorPanel() { form.hidden = true; emptyPanel.hidden = false; closePanel.hidden = true; panelTitle.textContent = "Choose something to edit"; sections.forEach((section) => section.classList.remove("is-active")); previewFrame.contentWindow?.postMessage({ type: "audience-editor:clear" }, window.location.origin); }
async function deleteManaged(path, document = false, keepalive = false) { if (!path) return; await requestJson(document ? "/api/admin/media/documents" : "/api/admin/media/images", { method: "DELETE", body: JSON.stringify({ storagePath: path }), keepalive }); }
function uploadRequest(url, control, file) { return new Promise((resolve, reject) => { const body = new FormData(); body.append("scope", control.dataset.uploadScope); body.append("file", file); const xhr = new XMLHttpRequest(); xhr.open("POST", url); xhr.responseType = "json"; xhr.setRequestHeader("Accept", "application/json"); const progress = control.querySelector("progress"); xhr.upload.addEventListener("progress", (event) => { if (event.lengthComputable) { progress.hidden = false; progress.value = Math.round(event.loaded / event.total * 100); } }); xhr.addEventListener("load", () => xhr.status >= 200 && xhr.status < 300 ? resolve(xhr.response) : reject(new Error(xhr.response?.message || "Upload failed."))); xhr.addEventListener("error", () => reject(new Error("The upload was interrupted."))); xhr.send(body); }); }
async function uploadImage(control, file) {
    const status = control.querySelector(".image-control__status"); if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { status.textContent = "Choose a JPEG, PNG, or WebP image."; return; } if (file.size > 8 * 1024 * 1024) { status.textContent = "Images must be 8 MB or smaller."; return; }
    const key = control.dataset.mediaControl; const current = currentImage(key); status.textContent = "Uploading…";
    try { const uploaded = await uploadRequest("/api/admin/media/images", control, file); if (current && uploadedThisSession.has(current.storagePath)) { await deleteManaged(current.storagePath).catch(() => {}); uploadedThisSession.delete(current.storagePath); } uploadedThisSession.add(uploaded.storagePath); assignImage(key, { storagePath: uploaded.storagePath, publicUrl: uploaded.publicUrl, mediaType: "image", mimeType: "image/webp", focalX: 50, focalY: 50, fit: "cover", zoom: 100 }); renderMedia(control); status.textContent = "Image ready. Save Changes to publish it."; setDirty(); updatePreview(); } catch (error) { status.textContent = error.message; } finally { const progress = control.querySelector("progress"); progress.hidden = true; progress.value = 0; control.querySelector('input[type="file"]').value = ""; }
}
async function uploadPdf(file) {
    const status = documentControl.querySelector(".image-control__status"); if (file.type !== "application/pdf") { status.textContent = "Choose a PDF guide."; return; } if (file.size > 15 * 1024 * 1024) { status.textContent = "PDF guides must be 15 MB or smaller."; return; }
    const current = draft.guide.pdf; status.textContent = "Uploading…";
    try { const uploaded = await uploadRequest("/api/admin/media/documents", documentControl, file); if (current && uploadedThisSession.has(current.storagePath)) { await deleteManaged(current.storagePath, true).catch(() => {}); uploadedThisSession.delete(current.storagePath); } uploadedThisSession.add(uploaded.storagePath); draft.guide.pdf = { storagePath: uploaded.storagePath, publicUrl: uploaded.publicUrl, mimeType: "application/pdf", displayName: file.name }; renderDocument(); status.textContent = "PDF ready. Save Changes to publish it."; setDirty(); updatePreview(); } catch (error) { status.textContent = error.message; } finally { const progress = documentControl.querySelector("progress"); progress.hidden = true; progress.value = 0; documentControl.querySelector('input[type="file"]').value = ""; }
}
async function removeAsset(kind) { const asset = kind === "pdf" ? draft.guide.pdf : currentImage(kind); if (!asset) return; if (uploadedThisSession.has(asset.storagePath)) { await deleteManaged(asset.storagePath, kind === "pdf").catch(() => {}); uploadedThisSession.delete(asset.storagePath); } if (kind === "pdf") { draft.guide.pdf = null; renderDocument(); } else { assignImage(kind, null); renderMedia(document.querySelector(`[data-media-control="${kind}"]`)); } setDirty(); updatePreview(); }
function activeAssets(content) { return [{ path: content.hero.image?.storagePath, document: false }, { path: content.guide.image?.storagePath, document: false }, { path: content.guide.pdf?.storagePath, document: true }].filter((asset) => asset.path); }
async function savePage(event) {
    event.preventDefault(); if (!form.reportValidity() || !isDirty || isSaving) return; isSaving = true; saveButton.disabled = true; discardButton.disabled = true; saveButton.textContent = "Saving…"; saveMessage.textContent = `Saving your ${config.pageLabel} Page…`; const previous = activeAssets(savedBaseline);
    try { const saved = await requestJson(config.apiUrl, { method: "PUT", body: JSON.stringify(buildPayload()) }); const current = activeAssets(contentFromResponse(saved)); const superseded = previous.filter((old) => !current.some((asset) => asset.path === old.path)); availableTags = saved.availableTags || availableTags; availableCategories = saved.availableCategories || availableCategories; availableArticles = saved.availableArticles || availableArticles; draft = contentFromResponse(saved); savedBaseline = structuredClone(draft); uploadedThisSession.clear(); fillForm(); setDirty(false); saveMessage.textContent = "Changes saved successfully."; const cleanup = await Promise.allSettled(superseded.map((asset) => deleteManaged(asset.path, asset.document))); if (cleanup.some((result) => result.status === "rejected")) saveMessage.textContent = "Changes saved. An older file could not be cleaned up automatically."; } catch (error) { saveMessage.textContent = error.message; } finally { isSaving = false; saveButton.textContent = "Save Changes"; saveButton.disabled = !isDirty; discardButton.disabled = !isDirty; }
}
async function discardChanges() { if (!isDirty || isSaving) return; const baselinePaths = activeAssets(savedBaseline).map((asset) => asset.path); await Promise.allSettled([...uploadedThisSession].filter((path) => !baselinePaths.includes(path)).map((path) => deleteManaged(path, path.endsWith(".pdf")))); uploadedThisSession.clear(); draft = structuredClone(savedBaseline); fillForm(); setDirty(false); saveMessage.textContent = "Unsaved changes discarded."; }
async function loadPage() { try { const data = await requestJson(config.apiUrl); availableTags = data.availableTags || []; availableCategories = data.availableCategories || []; availableArticles = data.availableArticles || []; draft = contentFromResponse(data); savedBaseline = structuredClone(draft); fillForm(); loadingStatus.hidden = true; workspace.hidden = false; savebar.hidden = false; setDirty(false); } catch (error) { loadingStatus.textContent = error.message; } }

form.addEventListener("input", (event) => { if (event.target.name === "resources.filterType") renderFilterFields(); if (event.target.matches("[data-focal-x], [data-focal-y]")) { const control = event.target.closest("[data-media-control]"); const image = currentImage(control.dataset.mediaControl); if (image) { image.focalX = Number(control.querySelector("[data-focal-x]").value); image.focalY = Number(control.querySelector("[data-focal-y]").value); renderMedia(control); } } setDirty(); updatePreview(); });
form.addEventListener("change", (event) => { if (event.target.type !== "file") { setDirty(); updatePreview(); } }); form.addEventListener("submit", savePage); discardButton.addEventListener("click", discardChanges); closePanel.addEventListener("click", closeEditorPanel);
mediaControls.forEach((control) => { const input = control.querySelector('input[type="file"]'); const key = control.dataset.mediaControl; input.addEventListener("change", () => input.files[0] && uploadImage(control, input.files[0])); control.querySelector("[data-remove-media]").addEventListener("click", () => removeAsset(key)); control.querySelectorAll("[data-image-fit]").forEach((button) => button.addEventListener("click", () => { const image = currentImage(key); if (!image) return; image.fit = button.dataset.imageFit; renderMedia(control); setDirty(); updatePreview(); })); control.querySelectorAll("[data-image-zoom]").forEach((button) => button.addEventListener("click", () => { const image = currentImage(key); if (!image) return; image.zoom = Math.min(150, Math.max(100, image.zoom + Number(button.dataset.imageZoom))); renderMedia(control); setDirty(); updatePreview(); })); control.querySelector("[data-image-zoom-reset]").addEventListener("click", () => { const image = currentImage(key); if (!image) return; image.zoom = 100; renderMedia(control); setDirty(); updatePreview(); }); const previewImage = control.querySelector("img"); positionControls.set(key, new window.ManagedImagePositionControl({ frame: control.querySelector(".image-control__preview"), image: previewImage, getPosition: () => currentImage(key), onChange: ({ focalX, focalY }) => { const image = currentImage(key); if (!image) return; image.focalX = focalX; image.focalY = focalY; control.querySelector("[data-focal-x]").value = focalX; control.querySelector("[data-focal-y]").value = focalY; setDirty(); updatePreview(); } })); });
const pdfInput = documentControl.querySelector('input[type="file"]'); pdfInput.addEventListener("change", () => pdfInput.files[0] && uploadPdf(pdfInput.files[0])); documentControl.querySelector("[data-remove-document]").addEventListener("click", () => removeAsset("pdf"));
window.addEventListener("message", (event) => { if (event.origin !== window.location.origin || event.source !== previewFrame.contentWindow) return; if (event.data?.type === "audience-editor:select" && ["hero", "guide", "formIntro", "resources"].includes(event.data.target)) activateSection(event.data.target); if (event.data?.type === "audience-editor:ready") updatePreview(); });
window.addEventListener("beforeunload", (event) => { if (isDirty) event.preventDefault(); }); window.addEventListener("pagehide", () => { const baselinePaths = activeAssets(savedBaseline || { hero: {}, guide: {} }).map((asset) => asset.path); uploadedThisSession.forEach((path) => { if (!baselinePaths.includes(path)) deleteManaged(path, path.endsWith(".pdf"), true).catch(() => {}); }); });
loadPage();
