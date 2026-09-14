const postGrid = document.querySelector("#post-grid");
const postFeedStatus = document.querySelector("#post-feed-status");
const postCardTemplate = document.querySelector("#post-card-template");
const featuredPost = document.querySelector("#featured-post");
const featuredPostStatus = document.querySelector("#featured-post-status");
const featuredPostCounter = document.querySelector("#featured-post-counter");
const featuredPostLink = document.querySelector("#featured-post-link");
const featuredPostImage = document.querySelector("#featured-post-image");
const featuredPostCategory = document.querySelector("#featured-post-category");
const featuredPostDate = document.querySelector("#featured-post-date");
const featuredPostTitle = document.querySelector("#featured-post-title");
const featuredPostExcerpt = document.querySelector("#featured-post-excerpt");
const postFilter = document.querySelector("[data-post-filter]");
const postFilterButton = postFilter.querySelector(".post-filter__button");
const postFilterMenu = postFilter.querySelector(".post-filter__menu");
const postFilterOptions = [...postFilterMenu.querySelectorAll("[data-category]")];
let latestArticles = [];

const categoryLabels = {
    "market-updates": "Market Updates",
    recruiting: "Recruiting",
    "success-stories": "Success Stories",
    training: "Training"
};

const categoryImages = {
    "market-updates": "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=82",
    recruiting: "static/site/images/agents-feature.jpg",
    "success-stories": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=82",
    training: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=82"
};

function getListingImage(post) {
    return categoryImages[post.category] || categoryImages["market-updates"];
}

function formatPublishedDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Date unavailable";
    }

    return new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
    }).format(date);
}

function isDisplayableImage(value) {
    if (typeof value !== "string") return false;

    if (/^data:image\/(?:jpeg|png|webp);base64,/i.test(value)) return true;

    try {
        return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
        return false;
    }
}

function createPostCard(post, index) {
    const card = postCardTemplate.content.cloneNode(true);
    const link = card.querySelector(".post-card__link");
    const number = card.querySelector(".post-card__number");
    const image = card.querySelector(".post-card__image");
    const placeholder = card.querySelector(".post-card__image-placeholder");
    const category = card.querySelector(".post-card__category");
    const date = card.querySelector(".post-card__date");
    const title = card.querySelector(".post-card__title");
    const excerpt = card.querySelector(".post-card__excerpt");

    link.href = `/blog/${post.id}`;
    number.textContent = String(index + 1).padStart(2, "0");
    category.textContent = categoryLabels[post.category] || post.category || "Insights";
    title.textContent = post.title || "Untitled article";
    excerpt.textContent = post.excerpt || "Read Stephanie's latest real estate insight.";
    date.dateTime = post.publishedDate || "";
    date.textContent = formatPublishedDate(post.publishedDate);

    const listingImage = isDisplayableImage(post.featuredImage)
        ? post.featuredImage
        : getListingImage(post);

    if (listingImage) {
        image.src = listingImage;
        image.alt = `Featured image for ${post.title || "article"}`;
        placeholder.hidden = true;
    } else {
        image.hidden = true;
    }

    return card;
}

function renderFeaturedPost(post, postCount) {
    featuredPostLink.href = `/blog/${post.id}`;
    featuredPostImage.src = getListingImage(post);
    featuredPostImage.alt = `Featured image for ${post.title || "article"}`;
    featuredPostCategory.textContent = categoryLabels[post.category] || post.category || "Insights";
    featuredPostDate.dateTime = post.publishedDate || "";
    featuredPostDate.textContent = formatPublishedDate(post.publishedDate);
    featuredPostTitle.textContent = post.title || "Untitled article";
    featuredPostExcerpt.textContent = post.excerpt || "Read Stephanie's latest real estate insight.";
    featuredPostCounter.textContent = `01 / ${String(postCount).padStart(2, "0")}`;
    featuredPost.hidden = false;
    featuredPostStatus.hidden = true;
}

function renderLatestArticles(category = "all") {
    const filteredArticles = category === "all"
        ? latestArticles
        : latestArticles.filter((post) => post.category === category);

    postGrid.replaceChildren(...filteredArticles.map(createPostCard));
    postGrid.hidden = filteredArticles.length === 0;
    postFeedStatus.hidden = filteredArticles.length > 0;
    postFeedStatus.textContent = filteredArticles.length
        ? ""
        : "No published articles match this filter yet.";
}

function closePostFilter() {
    postFilterButton.setAttribute("aria-expanded", "false");
    postFilterMenu.hidden = true;
}

postFilterButton.addEventListener("click", () => {
    const isOpen = postFilterButton.getAttribute("aria-expanded") === "true";
    postFilterButton.setAttribute("aria-expanded", String(!isOpen));
    postFilterMenu.hidden = isOpen;
});

postFilterOptions.forEach((option) => {
    option.addEventListener("click", () => {
        const selectedCategory = option.dataset.category;
        postFilterOptions.forEach((item) => {
            item.setAttribute("aria-pressed", String(item === option));
        });
        postFilterButton.querySelector("span:first-child").textContent = option.textContent;
        renderLatestArticles(selectedCategory);
        closePostFilter();
    });
});

document.addEventListener("click", (event) => {
    if (!postFilter.contains(event.target)) closePostFilter();
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closePostFilter();
        postFilterButton.focus();
    }
});

async function loadPublishedPosts() {
    try {
        const response = await fetch("/api/posts", {
            headers: { Accept: "application/json" }
        });

        if (!response.ok) {
            throw new Error(`Posts request failed with status ${response.status}`);
        }

        const posts = await response.json();

        if (!Array.isArray(posts) || posts.length === 0) {
            featuredPostStatus.textContent = "A featured article will appear here soon.";
            postFeedStatus.textContent = "No articles have been published yet. Please check back soon.";
            return;
        }

        const [featuredArticle, ...remainingArticles] = posts;
        latestArticles = remainingArticles;
        renderFeaturedPost(featuredArticle, posts.length);

        if (latestArticles.length) {
            renderLatestArticles();
        } else {
            postFeedStatus.textContent = "More insights are coming soon.";
        }
    } catch (error) {
        console.error("Unable to load published posts:", error);
        featuredPostStatus.textContent = "The featured article could not be loaded right now.";
        postFeedStatus.textContent = "Articles could not be loaded right now. Please try again soon.";
    }
}

loadPublishedPosts();
