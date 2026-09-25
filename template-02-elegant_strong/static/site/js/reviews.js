const reviewsFeed = document.querySelector("[data-reviews-feed]");
const reviewsCarousel = document.querySelector("[data-reviews-carousel]");
const previousReviewButton = document.querySelector("[data-reviews-previous]");
const nextReviewButton = document.querySelector("[data-reviews-next]");
const reviewModal = document.querySelector("[data-review-modal]");
const reviewModalClose = document.querySelector("[data-review-modal-close]");
const reviewModalMedia = document.querySelector("[data-review-modal-media]");
const reviewModalImage = document.querySelector("[data-review-modal-image]");
const reviewModalStars = document.querySelector("[data-review-modal-stars]");
const reviewModalQuote = document.querySelector("[data-review-modal-quote]");
const reviewModalName = document.querySelector("[data-review-modal-name]");
const reviewModalType = document.querySelector("[data-review-modal-type]");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let carouselIsMoving = false;
let carouselTimer = null;
let loadedReviews = [];
let reviewModalTrigger = null;

function clampPercentage(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : fallback;
}

function configureManagedImage(name, settings) {
    const frame = document.querySelector(`[data-managed-image="${name}"]`);
    const image = frame?.querySelector("img");
    if (!frame || !image || !settings) return;

    if (frame.dataset.managedSource === "cms") return;

    if (settings.src) image.src = settings.src;

    const supportedFits = new Set(["cover", "contain", "scale-down"]);
    const fit = supportedFits.has(settings.fit) ? settings.fit : "cover";
    const focalX = clampPercentage(settings.focalX, 50);
    const focalY = clampPercentage(settings.focalY, 50);

    frame.style.setProperty("--managed-image-fit", fit);
    frame.style.setProperty("--managed-image-position", `${focalX}% ${focalY}%`);
}

configureManagedImage("about", realtorData.reviewsPage?.aboutImage);
configureManagedImage("featuredStory", realtorData.reviewsPage?.featuredStoryImage);

function reviewPreviewText(value, maximum = 180) {
    const text = String(value || "").trim();
    if (text.length <= maximum) return text;
    const shortened = text.slice(0, maximum + 1).replace(/\s+\S*$/, "").trim();
    return `${shortened || text.slice(0, maximum).trim()}…`;
}

function openReviewModal(review, trigger) {
    if (!reviewModal || !review) return;
    reviewModalTrigger = trigger;
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
    reviewModal.classList.toggle("review-modal--text-only", !review.clientImageUrl);
    if (review.clientImageUrl) {
        reviewModalImage.src = review.clientImageUrl;
        reviewModalImage.alt = `${review.clientName || "Client"} testimonial`;
        reviewModalImage.style.objectFit = review.clientImageFit === "contain" ? "contain" : "cover";
        reviewModalImage.style.objectPosition = `${clampPercentage(review.clientImageFocalX, 50)}% ${clampPercentage(review.clientImageFocalY, 50)}%`;
    } else reviewModalImage.removeAttribute("src");
    window.clearInterval(carouselTimer);
    reviewModal.showModal();
    reviewModalClose.focus();
}

function makeReviewCard(review, reviewIndex) {
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
        const coverImage = document.createElement("img");
        coverImage.src = review.clientImageUrl;
        coverImage.alt = "";
        coverImage.style.objectFit = review.clientImageFit === "contain" ? "contain" : "cover";
        coverImage.style.objectPosition = `${clampPercentage(review.clientImageFocalX, 50)}% ${clampPercentage(review.clientImageFocalY, 50)}%`;
        coverImage.addEventListener("error", () => {
            coverImage.remove();
            card.classList.add("review-card--text-only");
        }, { once: true });
        media.prepend(coverImage);
    }

    const body = document.createElement("div");
    body.className = "review-card__body";

    const quote = document.createElement("blockquote");
    quote.textContent = `“${reviewPreviewText(review.quote)}”`;

    const showMore = document.createElement("span");
    showMore.className = "review-card__show-more";
    showMore.setAttribute("aria-hidden", "true");
    const showMoreLabel = document.createElement("span");
    showMoreLabel.textContent = "Show full review";
    const showMoreArrow = document.createElement("span");
    showMoreArrow.className = "review-card__show-more-arrow";
    showMore.append(showMoreLabel, showMoreArrow);

    const client = document.createElement("div");
    client.className = "review-card__client";
    const details = document.createElement("div");
    const name = document.createElement("p");
    name.className = "review-card__name";
    name.textContent = review.clientName || "Client";
    details.append(name);
    if (review.clientType) {
        const type = document.createElement("p");
        type.className = "review-card__type";
        type.textContent = review.clientType;
        details.append(type);
    }
    client.append(details);
    if (Number.isFinite(Number(review.rating)) && Number(review.rating) > 0) {
        const stars = document.createElement("p");
        stars.className = "review-card__stars";
        stars.setAttribute("aria-label", `${review.rating} out of 5 stars`);
        for (let index = 0; index < Math.min(5, Math.max(1, Number(review.rating))); index += 1) {
            window.siteIcons?.append(stars, "star");
        }
        client.append(stars);
    }
    body.append(quote, showMore, client);
    card.append(media, body);
    return card;
}

function reviewCards() {
    return [...reviewsFeed.querySelectorAll(":scope > .review-card:not([data-carousel-clone])")];
}

function desiredVisibleCards() {
    if (window.matchMedia("(max-width: 540px)").matches) return 1;
    if (window.matchMedia("(max-width: 850px)").matches) return 2;
    return 3;
}

function updateFeaturedReviewCard() {
    const cards = reviewCards();
    cards.forEach((card) => card.classList.remove("is-carousel-featured"));
    const visible = Number(reviewsFeed.dataset.visible || 1);
    const featuredIndex = visible === 1 ? 0 : Math.min(cards.length - 1, Math.floor(visible / 2));
    cards[featuredIndex]?.classList.add("is-carousel-featured");
}

function configureCarouselSize() {
    const count = reviewCards().length;
    reviewsFeed.dataset.visible = String(desiredVisibleCards());
    const disabled = count < 2;
    previousReviewButton.disabled = disabled;
    nextReviewButton.disabled = disabled;
    updateFeaturedReviewCard();
}

function carouselStep() {
    const firstCard = reviewCards()[0];
    if (!firstCard) return 0;
    const gap = parseFloat(getComputedStyle(reviewsFeed).columnGap) || 0;
    return firstCard.getBoundingClientRect().width + gap;
}

function finishCarouselMove(callback) {
    const finish = () => {
        reviewsFeed.classList.remove("is-moving");
        reviewsFeed.style.transform = "none";
        callback();
        carouselIsMoving = false;
    };
    const fallback = window.setTimeout(finish, 760);
    reviewsFeed.addEventListener("transitionend", (event) => {
        if (event.propertyName !== "transform" || !carouselIsMoving) return;
        window.clearTimeout(fallback);
        finish();
    }, { once: true });
}

function showNextReview() {
    const cards = reviewCards();
    if (carouselIsMoving || cards.length < 2) return;
    if (prefersReducedMotion.matches) {
        reviewsFeed.append(cards[0]);
        updateFeaturedReviewCard();
        return;
    }
    carouselIsMoving = true;
    const clone = cards[0].cloneNode(true);
    clone.dataset.carouselClone = "true";
    clone.setAttribute("aria-hidden", "true");
    clone.tabIndex = -1;
    reviewsFeed.append(clone);
    requestAnimationFrame(() => {
        reviewsFeed.classList.add("is-moving");
        reviewsFeed.style.transform = `translateX(-${carouselStep()}px)`;
    });
    finishCarouselMove(() => {
        clone.remove();
        reviewsFeed.append(cards[0]);
        updateFeaturedReviewCard();
    });
}

function showPreviousReview() {
    const cards = reviewCards();
    if (carouselIsMoving || cards.length < 2) return;
    const lastCard = cards[cards.length - 1];
    if (prefersReducedMotion.matches) {
        reviewsFeed.prepend(lastCard);
        updateFeaturedReviewCard();
        return;
    }
    carouselIsMoving = true;
    const clone = lastCard.cloneNode(true);
    clone.dataset.carouselClone = "true";
    clone.setAttribute("aria-hidden", "true");
    clone.tabIndex = -1;
    reviewsFeed.prepend(clone);
    reviewsFeed.style.transform = `translateX(-${carouselStep()}px)`;
    reviewsFeed.getBoundingClientRect();
    requestAnimationFrame(() => {
        reviewsFeed.classList.add("is-moving");
        reviewsFeed.style.transform = "translateX(0)";
    });
    finishCarouselMove(() => {
        clone.remove();
        reviewsFeed.prepend(lastCard);
        updateFeaturedReviewCard();
    });
}

function startCarouselTimer() {
    window.clearInterval(carouselTimer);
    if (prefersReducedMotion.matches || reviewCards().length < 2) return;
    carouselTimer = window.setInterval(() => {
        if (document.hidden || reviewsCarousel.matches(":hover") || reviewsCarousel.matches(":focus-within")) return;
        showNextReview();
    }, 5200);
}

async function loadReviews() {
    if (!reviewsFeed) return;
    try {
        const response = await fetch("/api/reviews", { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error("Unable to load reviews.");
        const reviews = await response.json();
        reviewsFeed.replaceChildren();
        if (!Array.isArray(reviews) || reviews.length === 0) {
            const empty = document.createElement("p");
            empty.className = "reviews-feed__empty";
            empty.textContent = "Client stories will be shared here soon.";
            reviewsFeed.append(empty);
            return;
        }
        loadedReviews = reviews;
        reviews.forEach((review, index) => reviewsFeed.append(makeReviewCard(review, index)));
        configureCarouselSize();
        startCarouselTimer();
    } catch (error) {
        reviewsFeed.replaceChildren();
        const message = document.createElement("p");
        message.className = "reviews-feed__error";
        message.textContent = "Client stories are unavailable right now. Please check back soon.";
        reviewsFeed.append(message);
    }
}

previousReviewButton.addEventListener("click", showPreviousReview);
nextReviewButton.addEventListener("click", showNextReview);
window.addEventListener("resize", configureCarouselSize);
prefersReducedMotion.addEventListener?.("change", startCarouselTimer);
reviewsFeed?.addEventListener("click", (event) => {
    const card = event.target.closest(".review-card:not([data-carousel-clone])");
    if (!card) return;
    openReviewModal(loadedReviews[Number(card.dataset.reviewIndex)], card);
});
reviewsFeed?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest(".review-card:not([data-carousel-clone])");
    if (!card) return;
    event.preventDefault();
    openReviewModal(loadedReviews[Number(card.dataset.reviewIndex)], card);
});
reviewModalClose?.addEventListener("click", () => reviewModal.close());
reviewModal?.addEventListener("click", (event) => { if (event.target === reviewModal) reviewModal.close(); });
reviewModal?.addEventListener("close", () => {
    reviewModalTrigger?.focus();
    reviewModalTrigger = null;
    startCarouselTimer();
});
loadReviews();
