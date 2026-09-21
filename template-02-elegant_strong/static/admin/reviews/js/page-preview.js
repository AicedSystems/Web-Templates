const editableRegions = [
    { selector: ".reviews-hero__copy", target: "hero", label: "Edit Hero text" },
    { selector: ".reviews-hero__visual", target: "hero", label: "Edit Instagram Reel" },
    { selector: ".reviews-showcase", target: "carousel", label: "Manage Reviews" },
    { selector: ".reviews-about__copy", target: "about", label: "Edit About content" },
    { selector: ".reviews-about__image", target: "about", label: "Edit About image" },
    { selector: ".featured-story__copy", target: "featuredStory", label: "Edit Featured Story" },
    { selector: ".featured-story__image", target: "featuredStory", label: "Edit Featured image" },
    { selector: ".reviews-final-cta", target: "finalCta", label: "Edit Final CTA" }
];

function selectRegion(region, element) {
    document.querySelectorAll("[data-editor-region].is-selected").forEach((item) => item.classList.remove("is-selected"));
    element.classList.add("is-selected");
    window.parent.postMessage({ type: "reviews-editor:select", target: region.target }, window.location.origin);
}

editableRegions.forEach((region) => {
    const element = document.querySelector(region.selector);
    if (!element) return;
    element.dataset.editorRegion = region.target;
    element.dataset.editorLabel = region.label;
    element.tabIndex = 0;
    element.setAttribute("role", "button");
    element.setAttribute("aria-label", region.label);
    element.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectRegion(region, element);
    });
    element.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectRegion(region, element);
        }
    });
});

function replaceHeading(element, firstLine, secondLine, emphasized = false) {
    if (!element) return;
    const lineBreak = document.createElement("br");
    element.replaceChildren(document.createTextNode(firstLine), lineBreak);
    if (emphasized) {
        const emphasis = document.createElement("em");
        emphasis.textContent = secondLine;
        element.append(emphasis);
    } else {
        element.append(document.createTextNode(secondLine));
        if (element.matches(".reviews-about h2")) {
            const dash = document.createElement("span");
            dash.setAttribute("aria-hidden", "true");
            dash.textContent = " —";
            element.append(dash);
        }
    }
}

function updateValues(selector, values) {
    const container = document.querySelector(selector);
    if (!container || !Array.isArray(values)) return;
    const items = values.map((value) => {
        const item = document.createElement(selector.includes("dl") ? "div" : "li");
        if (selector.includes("dl")) {
            const title = document.createElement("dt");
            const subtitle = document.createElement("dd");
            title.textContent = value.title;
            subtitle.textContent = value.subtitle;
            item.append(title, subtitle);
        } else {
            item.append(document.createTextNode(`${value.title} `));
            const subtitle = document.createElement("span");
            subtitle.textContent = value.subtitle;
            item.append(subtitle);
        }
        return item;
    });
    container.replaceChildren(...items);
}

function updateManagedImage(selector, image) {
    const element = document.querySelector(selector);
    const img = element?.querySelector("img");
    if (!element || !img) return;
    if (!img.dataset.editorFallback) img.dataset.editorFallback = img.dataset.defaultSrc || img.src;
    img.src = image?.publicUrl || img.dataset.editorFallback;
    img.style.setProperty("--managed-image-position", `${image?.focalX ?? 50}% ${image?.focalY ?? 50}%`);
}

function updatePreview(content) {
    if (!content) return;
    const hero = content.hero;
    document.querySelector(".reviews-hero__copy .eyebrow").textContent = hero.eyebrow;
    replaceHeading(document.querySelector(".reviews-hero h1"), hero.titleLine1, hero.titleEmphasis, true);
    document.querySelector(".reviews-hero__copy > p:not(.eyebrow)").textContent = hero.description;
    const heroButton = document.querySelector(".reviews-hero__copy .button");
    heroButton.firstChild.textContent = `${hero.cta.label} `;
    heroButton.href = hero.cta.href;
    updateValues(".reviews-hero__values", hero.values);

    const about = content.about;
    document.querySelector(".reviews-about .eyebrow").textContent = about.eyebrow;
    replaceHeading(document.querySelector(".reviews-about h2"), about.titleLine1, about.titleLine2);
    document.querySelector(".reviews-about__copy > p:not(.eyebrow)").textContent = about.body;
    const aboutButton = document.querySelector(".reviews-about .button");
    aboutButton.firstChild.textContent = `${about.cta.label} `;
    aboutButton.href = about.cta.href;
    updateValues(".reviews-about__list", about.values);
    updateManagedImage(".reviews-about__image", about.image);

    const featured = content.featuredStory;
    document.querySelector(".featured-story .eyebrow").textContent = featured.eyebrow;
    replaceHeading(document.querySelector(".featured-story h2"), featured.titleLine1, featured.titleLine2);
    updateManagedImage(".featured-story__image", featured.image);
    if (content.featuredReview) {
        document.querySelector(".featured-story blockquote").textContent = `“${content.featuredReview.quote}”`;
        const client = document.querySelector(".featured-story__client");
        client.querySelector("strong").textContent = `— ${content.featuredReview.clientName}`;
        client.querySelector("span").textContent = content.featuredReview.clientType || "Client";
    }

    const finalCta = content.finalCta;
    document.querySelector(".reviews-final-cta .eyebrow").textContent = finalCta.eyebrow;
    document.querySelector(".reviews-final-cta h2").textContent = finalCta.title;
    const finalButton = document.querySelector(".reviews-final-cta .button");
    finalButton.firstChild.textContent = `${finalCta.cta.label} `;
    finalButton.href = finalCta.cta.href;
    const finalSection = document.querySelector(".reviews-final-cta");
    if (!finalSection.dataset.editorFallbackImage) {
        finalSection.dataset.editorFallbackImage = getComputedStyle(finalSection).getPropertyValue("--reviews-cta-image");
    }
    if (finalCta.image?.publicUrl) {
        finalSection.style.setProperty("--reviews-cta-image", `url("${finalCta.image.publicUrl}")`);
        finalSection.style.setProperty("--reviews-cta-position", `${finalCta.image.focalX}% ${finalCta.image.focalY}%`);
    } else {
        finalSection.style.removeProperty("--reviews-cta-image");
        finalSection.style.removeProperty("--reviews-cta-position");
    }
}

window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type === "reviews-editor:preview") updatePreview(event.data.content);
    if (event.data?.type === "reviews-editor:clear") {
        document.querySelectorAll("[data-editor-region].is-selected").forEach((item) => item.classList.remove("is-selected"));
    }
});

window.parent.postMessage({ type: "reviews-editor:ready" }, window.location.origin);
