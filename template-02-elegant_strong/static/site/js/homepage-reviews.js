"use strict";

const homepageReviews = document.querySelector("[data-homepage-reviews]");

if (homepageReviews) {
    const feed = homepageReviews.querySelector("[data-homepage-reviews-feed]");
    const previousButton = homepageReviews.querySelector("[data-homepage-reviews-previous]");
    const nextButton = homepageReviews.querySelector("[data-homepage-reviews-next]");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let moving = false;
    let timer = null;

    function makeCard(review) {
        const card = document.createElement("figure");
        card.className = "review-card";
        const quote = document.createElement("blockquote");
        quote.textContent = `“${review.quote || ""}”`;
        const caption = document.createElement("figcaption");
        const name = document.createElement("strong");
        name.textContent = review.clientName || "Client";
        caption.append(name);
        if (review.clientType) {
            const type = document.createElement("span");
            type.textContent = review.clientType;
            caption.append(type);
        }
        const rating = Number(review.rating);
        if (Number.isFinite(rating) && rating > 0) {
            const stars = document.createElement("span");
            stars.className = "review-card__stars";
            stars.setAttribute("aria-label", `${rating} out of 5 stars`);
            for (let index = 0; index < Math.min(5, Math.max(1, rating)); index += 1) {
                window.siteIcons?.append(stars, "star");
            }
            caption.append(stars);
        }
        card.append(quote, caption);
        return card;
    }

    function cards() { return [...feed.querySelectorAll(":scope > .review-card")]; }
    function visibleCount() {
        if (window.matchMedia("(max-width: 620px)").matches) return 1;
        if (window.matchMedia("(max-width: 960px)").matches) return 2;
        return 3;
    }
    function configure() {
        const count = cards().length;
        feed.dataset.visible = String(Math.max(1, Math.min(count, visibleCount())));
        previousButton.disabled = count < 2;
        nextButton.disabled = count < 2;
    }
    function step() {
        const first = cards()[0];
        if (!first) return 0;
        return first.getBoundingClientRect().width + (parseFloat(getComputedStyle(feed).gap) || 0);
    }
    function next() {
        const items = cards();
        if (moving || items.length < 2) return;
        if (reducedMotion.matches) { feed.append(items[0]); return; }
        moving = true;
        feed.style.transform = `translateX(-${step()}px)`;
        let settled = false;
        const finish = () => { if (settled) return; settled = true; feed.removeEventListener("transitionend", finish); feed.style.transition = "none"; feed.append(items[0]); feed.style.transform = "none"; feed.getBoundingClientRect(); feed.style.removeProperty("transition"); moving = false; };
        feed.addEventListener("transitionend", finish);
        window.setTimeout(finish, 650);
    }
    function previous() {
        const items = cards();
        if (moving || items.length < 2) return;
        const last = items.at(-1);
        if (reducedMotion.matches) { feed.prepend(last); return; }
        moving = true;
        feed.style.transition = "none";
        feed.prepend(last);
        feed.style.transform = `translateX(-${step()}px)`;
        feed.getBoundingClientRect();
        feed.style.removeProperty("transition");
        requestAnimationFrame(() => { feed.style.transform = "translateX(0)"; });
        let settled = false;
        const finish = () => { if (settled) return; settled = true; feed.removeEventListener("transitionend", finish); feed.style.transform = "none"; moving = false; };
        feed.addEventListener("transitionend", finish);
        window.setTimeout(finish, 650);
    }
    function startTimer() {
        window.clearInterval(timer);
        if (reducedMotion.matches || cards().length < 2) return;
        timer = window.setInterval(() => {
            if (!document.hidden && !homepageReviews.matches(":hover") && !homepageReviews.matches(":focus-within")) next();
        }, 5600);
    }
    async function load() {
        try {
            const response = await fetch("/api/reviews", { headers: { Accept: "application/json" } });
            if (!response.ok) throw new Error("Unable to load reviews.");
            const reviews = await response.json();
            feed.replaceChildren();
            if (!Array.isArray(reviews) || reviews.length === 0) {
                const empty = document.createElement("p"); empty.className = "homepage-reviews__status"; empty.textContent = "Client stories will be shared here soon."; feed.append(empty); configure(); return;
            }
            reviews.forEach((review) => feed.append(makeCard(review)));
            configure(); startTimer();
        } catch (error) {
            feed.replaceChildren();
            const message = document.createElement("p"); message.className = "homepage-reviews__status"; message.textContent = "Client stories are unavailable right now."; feed.append(message); configure();
        }
    }

    previousButton.addEventListener("click", previous);
    nextButton.addEventListener("click", next);
    window.addEventListener("resize", configure);
    reducedMotion.addEventListener?.("change", startTimer);
    load();
}
