"use strict";

const homepageReviews = document.querySelector("[data-homepage-reviews]");

if (homepageReviews) {
    const feed = homepageReviews.querySelector("[data-homepage-reviews-feed]");
    const previousButton = homepageReviews.querySelector("[data-homepage-reviews-previous]");
    const nextButton = homepageReviews.querySelector("[data-homepage-reviews-next]");
    const reviewModal = document.querySelector("[data-homepage-review-modal]");
    const reviewModalClose = reviewModal?.querySelector("[data-homepage-review-modal-close]");
    const reviewModalMedia = reviewModal?.querySelector("[data-homepage-review-modal-media]");
    const reviewModalImage = reviewModal?.querySelector("[data-homepage-review-modal-image]");
    const reviewModalStars = reviewModal?.querySelector("[data-homepage-review-modal-stars]");
    const reviewModalQuote = reviewModal?.querySelector("[data-homepage-review-modal-quote]");
    const reviewModalName = reviewModal?.querySelector("[data-homepage-review-modal-name]");
    const reviewModalType = reviewModal?.querySelector("[data-homepage-review-modal-type]");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let moving = false;
    let timer = null;
    let loadedReviews = [];
    let modalTrigger = null;

    function clampPercentage(value, fallback = 50) {
        const number = Number(value);
        return Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : fallback;
    }

    function previewText(value, maximum = 180) {
        const text = String(value || "").trim();
        if (text.length <= maximum) return text;
        const shortened = text.slice(0, maximum + 1).replace(/\s+\S*$/, "").trim();
        return `${shortened || text.slice(0, maximum).trim()}…`;
    }

    function makeCard(review, reviewIndex) {
        const card = document.createElement("article");
        card.className = `review-card${review.clientImageUrl ? "" : " review-card--text-only"}`;
        card.dataset.reviewIndex = String(reviewIndex);
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.setAttribute("aria-haspopup", "dialog");
        card.setAttribute("aria-label", `Read the complete review from ${review.clientName || "this client"}`);

        const media = document.createElement("div");
        media.className = "review-card__media";
        if (review.clientImageUrl) {
            const image = document.createElement("img");
            image.src = review.clientImageUrl;
            image.alt = "";
            image.loading = "lazy";
            image.style.objectFit = review.clientImageFit === "contain" ? "contain" : "cover";
            image.style.objectPosition = `${clampPercentage(review.clientImageFocalX)}% ${clampPercentage(review.clientImageFocalY)}%`;
            image.addEventListener("error", () => {
                image.remove();
                card.classList.add("review-card--text-only");
            }, { once: true });
            media.append(image);
        }

        const body = document.createElement("div");
        body.className = "review-card__body";
        const quote = document.createElement("blockquote");
        quote.textContent = `“${previewText(review.quote)}”`;
        const showMore = document.createElement("span");
        showMore.className = "review-card__show-more";
        showMore.setAttribute("aria-hidden", "true");
        const showMoreLabel = document.createElement("span");
        showMoreLabel.textContent = "Show full review";
        const showMoreArrow = document.createElement("span");
        showMoreArrow.className = "review-card__show-more-arrow";
        showMore.append(showMoreLabel, showMoreArrow);
        const caption = document.createElement("div");
        caption.className = "review-card__client";
        const details = document.createElement("div");
        const name = document.createElement("strong");
        name.className = "review-card__name";
        name.textContent = review.clientName || "Client";
        details.append(name);
        if (review.clientType) {
            const type = document.createElement("span");
            type.className = "review-card__type";
            type.textContent = review.clientType;
            details.append(type);
        }
        caption.append(details);
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
        body.append(quote, showMore, caption);
        card.append(media, body);
        return card;
    }

    function openModal(review, trigger) {
        if (!reviewModal || !review || document.body.dataset.homePreview === "true") return;
        modalTrigger = trigger;
        reviewModalQuote.textContent = `“${review.quote || ""}”`;
        reviewModalName.textContent = review.clientName || "Client";
        reviewModalType.textContent = review.clientType || "Client story";
        const rating = Math.min(5, Math.max(0, Number(review.rating) || 0));
        reviewModalStars.replaceChildren();
        for (let index = 0; index < rating; index += 1) window.siteIcons?.append(reviewModalStars, "star");
        reviewModalStars.hidden = !rating;
        if (rating) reviewModalStars.setAttribute("aria-label", `${rating} out of 5 stars`);
        else reviewModalStars.removeAttribute("aria-label");
        reviewModalMedia.hidden = !review.clientImageUrl;
        reviewModal.classList.toggle("homepage-review-modal--text-only", !review.clientImageUrl);
        if (review.clientImageUrl) {
            reviewModalImage.src = review.clientImageUrl;
            reviewModalImage.alt = `${review.clientName || "Client"} testimonial`;
            reviewModalImage.style.objectFit = review.clientImageFit === "contain" ? "contain" : "cover";
            reviewModalImage.style.objectPosition = `${clampPercentage(review.clientImageFocalX)}% ${clampPercentage(review.clientImageFocalY)}%`;
        } else reviewModalImage.removeAttribute("src");
        window.clearInterval(timer);
        reviewModal.showModal();
        reviewModalClose.focus();
    }

    function cards() { return [...feed.querySelectorAll(":scope > .review-card")]; }
    function visibleCount() {
        if (window.matchMedia("(max-width: 620px)").matches) return 1;
        if (window.matchMedia("(max-width: 960px)").matches) return 2;
        return 3;
    }
    function configure() {
        const count = cards().length;
        feed.dataset.visible = String(visibleCount());
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
            loadedReviews = reviews;
            reviews.forEach((review, index) => feed.append(makeCard(review, index)));
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
    feed.addEventListener("click", (event) => {
        const card = event.target.closest(".review-card");
        if (card) openModal(loadedReviews[Number(card.dataset.reviewIndex)], card);
    });
    feed.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const card = event.target.closest(".review-card");
        if (!card) return;
        event.preventDefault();
        openModal(loadedReviews[Number(card.dataset.reviewIndex)], card);
    });
    reviewModalClose?.addEventListener("click", () => reviewModal.close());
    reviewModal?.addEventListener("click", (event) => { if (event.target === reviewModal) reviewModal.close(); });
    reviewModal?.addEventListener("close", () => {
        modalTrigger?.focus();
        modalTrigger = null;
        startTimer();
    });
    load();
}
