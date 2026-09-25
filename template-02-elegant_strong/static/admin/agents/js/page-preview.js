"use strict";

const regions = [
    { selector: ".agents-hero__intro", target: "hero", label: "Edit Hero text" },
    { selector: ".agents-mentor-card", target: "hero", label: "Edit Hero benefits" },
    { selector: ".agents-hero__visual", target: "hero", label: "Edit Hero media" },
    { selector: ".agent-testimonial", target: "spotlight", label: "Edit Agent Spotlight" },
    { selector: ".agent-application__intro", target: "application", label: "Edit Application intro" },
    { selector: ".agent-resources", target: "resources", label: "Edit Agent Resources" },
    { selector: ".agents-final-cta", target: "finalCta", label: "Edit Final CTA" }
];
let resourcePreviewSignature = "";

function selectRegion(region, element) {
    document.querySelectorAll("[data-editor-region].is-selected").forEach((item) => item.classList.remove("is-selected"));
    element.classList.add("is-selected");
    window.parent.postMessage({ type: "agents-editor:select", target: region.target }, window.location.origin);
}

regions.forEach((region) => {
    const element = document.querySelector(region.selector); if (!element) return;
    element.dataset.editorRegion = region.target; element.dataset.editorLabel = region.label; element.tabIndex = 0; element.setAttribute("role", "button"); element.setAttribute("aria-label", region.label);
    element.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); selectRegion(region, element); });
    element.addEventListener("keydown", (event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); selectRegion(region, element); } });
});

function updateHeading(element, heading) {
    const words = heading.split(/\s+/).filter(Boolean); if (words.length < 3) { element.textContent = heading; return; }
    const first = words.slice(0, -3).join(" "); const lead = words.at(-3); const emphasis = words.slice(-2).join(" "); const em = document.createElement("em"); em.textContent = emphasis;
    element.replaceChildren(document.createTextNode(first), document.createElement("br"), document.createTextNode(`${lead} `), em);
}

function updateHeroMedia(media) {
    const visual = document.querySelector(".agents-hero__visual");
    const desiredType = media?.publicUrl && media.mediaType === "video" ? "video" : "img";
    const desiredSource = media?.publicUrl || "/static/site/images/agents-feature.jpg";
    let element = visual.querySelector(":scope > img, :scope > video");
    if (!element || element.tagName.toLowerCase() !== desiredType) {
        element?.remove();
        element = document.createElement(desiredType);
        visual.append(element);
    }
    if (element.getAttribute("src") !== desiredSource) element.src = desiredSource;
    if (desiredType === "video") {
        Object.assign(element, { muted: true, autoplay: true, loop: true, playsInline: true });
        element.play().catch(() => {});
        return;
    }
    element.alt = "Stephanie mentoring real estate agents";
    element.style.setProperty("--agents-image-position", `${media?.focalX ?? 50}% ${media?.focalY ?? 50}%`);
    element.style.setProperty("--agents-image-fit", media?.desktopFit || "cover");
    element.style.setProperty("--agents-image-zoom", String((media?.desktopZoom ?? 100) / 100));
}

function updatePreview(content, resourceArticles = []) {
    if (!content) return;
    document.querySelector(".agents-hero__intro .eyebrow").lastChild.textContent = ` ${content.hero.eyebrow}`;
    updateHeading(document.querySelector(".agents-hero h1"), content.hero.heading);
    document.querySelector(".agents-hero__intro > p:last-child").textContent = content.hero.description;
    document.querySelectorAll(".agents-mentor-card li").forEach((item, index) => { const icon = item.querySelector("span"); item.replaceChildren(icon, document.createTextNode(content.hero.benefits[index] || "")); });
    updateHeroMedia(content.hero.media);

    const spotlightImage = document.querySelector(".agent-testimonial__visual img"); const spotlightSource = content.spotlight.image?.publicUrl || "/static/site/images/steph-testimonial-reviews.webp"; if (spotlightImage.getAttribute("src") !== spotlightSource) spotlightImage.src = spotlightSource; spotlightImage.style.setProperty("--agents-image-position", `${content.spotlight.image?.focalX ?? 50}% ${content.spotlight.image?.focalY ?? 50}%`); spotlightImage.style.setProperty("--agents-image-fit", content.spotlight.image?.fit || "cover"); spotlightImage.style.setProperty("--agents-image-zoom", String((content.spotlight.image?.zoom ?? 100) / 100));
    document.querySelector(".agent-testimonial h2").textContent = content.spotlight.heading; document.querySelector(".agent-testimonial blockquote").textContent = `“${content.spotlight.quote}”`; document.querySelector(".agent-testimonial__person strong").textContent = content.spotlight.agentName; document.querySelector(".agent-testimonial__person strong + span").textContent = content.spotlight.attribution;
    const stars = document.querySelector(".agent-testimonial__stars"); if (content.spotlight.rating) { stars.hidden = false; stars.textContent = "★".repeat(content.spotlight.rating); stars.setAttribute("aria-label", `${content.spotlight.rating} out of 5 stars`); } else stars.hidden = true;

    document.querySelector(".agent-application__intro h2").textContent = content.application.heading; document.querySelector(".agent-application__intro > p").textContent = content.application.description; document.querySelectorAll(".agent-application__intro li").forEach((item, index) => { item.textContent = content.application.benefits[index] || ""; });
    document.querySelector(".agent-resources h2").textContent = content.resources.heading;
    const grid = document.querySelector(".resource-grid");
    const nextResourceSignature = resourceArticles.map((article) => article.id).join(",");
    if (nextResourceSignature !== resourcePreviewSignature) {
        resourcePreviewSignature = nextResourceSignature;
        if (resourceArticles.length) grid.replaceChildren(...resourceArticles.map((article) => { const card = document.createElement("article"); card.className = "resource-card"; const link = document.createElement("a"); link.href = `/blog/${article.id}`; const image = document.createElement("img"); image.src = article.imageUrl; image.alt = ""; const category = document.createElement("span"); category.textContent = article.categoryLabel; const title = document.createElement("h3"); title.textContent = article.title; const time = document.createElement("time"); time.dateTime = article.publishedDateTime; time.textContent = article.publishedDate; link.append(image, category, title, time); card.append(link); return card; }));
        else { const empty = document.createElement("p"); empty.className = "resource-grid__empty"; empty.textContent = "No published articles match this filter yet."; grid.replaceChildren(empty); }
    }
    const final = document.querySelector(".agents-final-cta"); final.querySelector("h2").textContent = content.finalCta.heading; const button = final.querySelector(".button"); button.firstChild.textContent = `${content.finalCta.button.label} `; button.href = content.finalCta.button.href; if (content.finalCta.image?.publicUrl) { final.style.setProperty("--agents-cta-image", `url("${content.finalCta.image.publicUrl}")`); final.style.setProperty("--agents-cta-position", `${content.finalCta.image.focalX}% ${content.finalCta.image.focalY}%`); final.style.setProperty("--agents-cta-fit", content.finalCta.image.fit); final.style.setProperty("--agents-cta-zoom", String(content.finalCta.image.zoom / 100)); } else { ["--agents-cta-image", "--agents-cta-position", "--agents-cta-fit", "--agents-cta-zoom"].forEach((property) => final.style.removeProperty(property)); }
}

window.addEventListener("message", (event) => { if (event.origin !== window.location.origin || event.source !== window.parent) return; if (event.data?.type === "agents-editor:preview") updatePreview(event.data.content, event.data.resourceArticles); if (event.data?.type === "agents-editor:clear") document.querySelectorAll("[data-editor-region].is-selected").forEach((item) => item.classList.remove("is-selected")); });
window.parent.postMessage({ type: "agents-editor:ready" }, window.location.origin);
