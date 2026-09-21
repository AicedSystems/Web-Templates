const reviewsFeed = document.querySelector("[data-reviews-feed]");

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

function initialsFrom(name) {
    return (name || "Client").split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

function makeReviewCard(review) {
    const card = document.createElement("article");
    card.className = "review-card";

    const media = document.createElement("div");
    media.className = "review-card__media";

    if (review.clientImageUrl) {
        const coverImage = document.createElement("img");
        coverImage.src = review.clientImageUrl;
        coverImage.alt = "";
        coverImage.style.objectPosition = `${clampPercentage(review.clientImageFocalX, 50)}% ${clampPercentage(review.clientImageFocalY, 50)}%`;
        coverImage.addEventListener("error", () => coverImage.remove(), { once: true });
        media.prepend(coverImage);
    }

    const body = document.createElement("div");
    body.className = "review-card__body";

    const quote = document.createElement("blockquote");
    quote.textContent = `“${review.quote || ""}”`;

    const client = document.createElement("div");
    client.className = "review-card__client";
    const avatar = document.createElement("div");
    avatar.className = "review-card__avatar";
    if (review.clientImageUrl) {
        const image = document.createElement("img");
        image.src = review.clientImageUrl;
        image.alt = "";
        image.style.objectPosition = `${clampPercentage(review.clientImageFocalX, 50)}% ${clampPercentage(review.clientImageFocalY, 50)}%`;
        image.addEventListener("error", () => { avatar.textContent = initialsFrom(review.clientName); image.remove(); }, { once: true });
        avatar.append(image);
    } else {
        avatar.textContent = initialsFrom(review.clientName);
    }

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
    client.append(avatar, details);
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
    } catch (error) {
        reviewsFeed.replaceChildren();
        const message = document.createElement("p");
        message.className = "reviews-feed__error";
        message.textContent = "Client stories are unavailable right now. Please check back soon.";
        reviewsFeed.append(message);
    }
}

loadReviews();
