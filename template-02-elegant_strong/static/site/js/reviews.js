const reviewsFeed = document.querySelector("[data-reviews-feed]");
const reviewsCarousel = document.querySelector("[data-reviews-carousel]");
const previousReviewButton = document.querySelector("[data-reviews-previous]");
const nextReviewButton = document.querySelector("[data-reviews-next]");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let carouselIsMoving = false;
let carouselTimer = null;

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

function makeReviewCard(review) {
    const card = document.createElement("article");
    card.className = `review-card${review.clientImageUrl ? "" : " review-card--text-only"}`;

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
    quote.textContent = `“${review.quote || ""}”`;

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
        stars.textContent = "★".repeat(Math.min(5, Math.max(1, Number(review.rating))));
        client.append(stars);
    }
    body.append(quote, client);
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
    reviewsFeed.dataset.visible = String(Math.max(1, Math.min(count, desiredVisibleCards())));
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
        reviews.forEach((review) => reviewsFeed.append(makeReviewCard(review)));
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
loadReviews();
