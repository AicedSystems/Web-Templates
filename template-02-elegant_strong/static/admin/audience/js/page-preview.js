"use strict";

const pageType = document.body.dataset.audiencePreview;
const journeyName = pageType === "sellers" ? "Seller" : "Buyer";
const fallbacks = {
    hero: "/static/site/images/buyers-hero.jpg",
    guide: pageType === "sellers" ? "/static/site/images/sellersecondimg.webp" : "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=85"
};
const regions = [
    { selector: ".buyers-hero", target: "hero", label: "Edit Hero" },
    { selector: ".buyers-guide__resource", target: "guide", label: "Edit Guide" },
    { selector: ".buyer-inquiry", target: "formIntro", label: "Edit inquiry introduction" },
    { selector: ".buyer-resources", target: "resources", label: "Edit Helpful Resources" }
];

function selectRegion(region, element) {
    document.querySelectorAll("[data-editor-region].is-selected").forEach((item) => item.classList.remove("is-selected"));
    element.classList.add("is-selected");
    window.parent.postMessage({ type: "audience-editor:select", target: region.target }, window.location.origin);
}
regions.forEach((region) => {
    const element = document.querySelector(region.selector); if (!element) return;
    element.dataset.editorRegion = region.target; element.dataset.editorLabel = region.label; element.tabIndex = 0; element.setAttribute("role", "button"); element.setAttribute("aria-label", region.label);
    element.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); selectRegion(region, element); });
    element.addEventListener("keydown", (event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); selectRegion(region, element); } });
});
document.querySelectorAll("a, button, input, select, textarea").forEach((element) => element.addEventListener("click", (event) => event.preventDefault()));
document.querySelectorAll("form").forEach((form) => form.addEventListener("submit", (event) => event.preventDefault()));

function updateImage(element, image, fallback) {
    element.src = image?.publicUrl || fallback;
    element.style.setProperty("--buyers-hero-position", `${image?.focalX ?? 50}% ${image?.focalY ?? 50}%`);
    element.style.setProperty("--buyers-hero-fit", image?.fit || "cover");
    element.style.setProperty("--buyers-hero-zoom", String((image?.zoom ?? 100) / 100));
    element.style.setProperty("--guide-image-position", `${image?.focalX ?? 50}% ${image?.focalY ?? 50}%`);
    element.style.setProperty("--guide-image-fit", image?.fit || "cover");
    element.style.setProperty("--guide-image-zoom", String((image?.zoom ?? 100) / 100));
}
function resourceCard(article) {
    const card = document.createElement("article"); card.className = "buyer-resource-card";
    const link = document.createElement("a"); link.href = `/blog/${article.id}`;
    const media = document.createElement("div"); media.className = "buyer-resource-card__media"; const image = document.createElement("img"); image.src = article.imageUrl; image.alt = ""; const badge = document.createElement("span"); badge.textContent = `${journeyName}s`; media.append(image, badge);
    const body = document.createElement("div"); body.className = "buyer-resource-card__body"; const category = document.createElement("p"); category.textContent = article.categoryLabel; const title = document.createElement("h3"); title.textContent = article.title; const time = document.createElement("time"); time.dateTime = article.publishedDateTime; time.textContent = article.publishedDate; const action = document.createElement("span"); action.className = "buyer-resource-card__link"; action.textContent = "Read Article →"; body.append(category, title, time, action); link.append(media, body); card.append(link); return card;
}
function updatePreview(content, articles) {
    if (!content) return;
    document.querySelector(".buyers-hero__copy .eyebrow").lastChild.textContent = ` ${content.hero.eyebrow}`;
    document.querySelector(".buyers-hero__copy h1").textContent = content.hero.heading;
    document.querySelector(".buyers-hero__copy > p:last-of-type").textContent = content.hero.description;
    document.querySelectorAll(".buyers-hero__values strong").forEach((element, index) => { element.textContent = content.hero.benefits[index] || ""; });
    updateImage(document.querySelector(".buyers-hero__media img"), content.hero.image, fallbacks.hero);

    const guide = document.querySelector(".buyers-guide__resource"); guide.querySelector(".buyers-guide__heading .eyebrow").lastChild.textContent = ` ${content.guide.eyebrow}`; guide.querySelector(".buyers-guide__heading h1").textContent = content.guide.heading; guide.querySelector(".buyers-guide__heading > p:last-child").textContent = content.guide.description; guide.querySelector(".guide-card h2").textContent = content.guide.cardTitle; guide.querySelector(".guide-card__body > p").textContent = content.guide.cardSummary; updateImage(guide.querySelector(".guide-card__media img"), content.guide.image, fallbacks.guide);
    const guideActions = guide.querySelector(".guide-card__actions"); const pdf = content.guide.pdf?.publicUrl;
    const view = pdf ? document.createElement("a") : document.createElement("span"); view.className = `button${pdf ? "" : " button--disabled"}`; view.textContent = pdf ? "View the Guide →" : "View the Guide →"; if (pdf) { view.href = pdf; view.target = "_blank"; view.rel = "noopener"; } else view.setAttribute("aria-disabled", "true");
    const download = pdf ? document.createElement("a") : document.createElement("span"); download.className = `guide-card__download${pdf ? "" : " guide-card__download--disabled"}`; download.textContent = pdf ? "⇩ PDF Guide Download" : "⇩ PDF Guide Coming Soon"; if (pdf) { download.href = pdf; download.download = ""; } else download.setAttribute("aria-disabled", "true");
    guideActions.toggleAttribute("data-guide-unavailable", !pdf); guideActions.replaceChildren(view, download);

    const inquiry = document.querySelector(".buyer-inquiry"); inquiry.querySelector(".eyebrow").lastChild.textContent = ` ${content.formIntro.eyebrow}`; inquiry.querySelector("h2").textContent = content.formIntro.heading; inquiry.querySelector(":scope > p:not(.eyebrow):not(.buyer-inquiry__privacy)").textContent = content.formIntro.description;
    document.querySelector(".buyer-resources__heading h2").textContent = content.resources.heading;
    const existing = document.querySelector(".buyer-resource-grid, .buyer-resources__empty");
    if (articles.length) { const grid = document.createElement("div"); grid.className = "buyer-resource-grid"; grid.append(...articles.map(resourceCard)); existing.replaceWith(grid); } else { const empty = document.createElement("div"); empty.className = "buyer-resources__empty"; const message = document.createElement("p"); message.textContent = "No published articles match this filter yet."; empty.append(message); existing.replaceWith(empty); }
}
window.addEventListener("message", (event) => { if (event.origin !== window.location.origin || event.source !== window.parent) return; if (event.data?.type === "audience-editor:preview" && event.data.pageType === pageType) updatePreview(event.data.content, event.data.resourceArticles || []); if (event.data?.type === "audience-editor:clear") document.querySelectorAll("[data-editor-region].is-selected").forEach((item) => item.classList.remove("is-selected")); });
window.parent.postMessage({ type: "audience-editor:ready", pageType }, window.location.origin);
