const postGrid = document.querySelector("#post-grid");
const postFeedStatus = document.querySelector("#post-feed-status");
const postCardTemplate = document.querySelector("#post-card-template");

const categoryLabels = {
    "market-updates": "Market Updates",
    recruiting: "Recruiting",
    "success-stories": "Success Stories",
    training: "Training"
};

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
    const article = card.querySelector(".post-card");
    const link = card.querySelector(".post-card__link");
    const image = card.querySelector(".post-card__image");
    const placeholder = card.querySelector(".post-card__image-placeholder");
    const category = card.querySelector(".post-card__category");
    const date = card.querySelector(".post-card__date");
    const title = card.querySelector(".post-card__title");
    const excerpt = card.querySelector(".post-card__excerpt");

    if (index === 0) article.classList.add("post-card--featured");

    link.href = `/blog/${post.id}`;
    category.textContent = categoryLabels[post.category] || post.category || "Insights";
    title.textContent = post.title || "Untitled article";
    excerpt.textContent = post.excerpt || "Read Stephanie's latest real estate insight.";
    date.dateTime = post.publishedDate || "";
    date.textContent = formatPublishedDate(post.publishedDate);

    if (isDisplayableImage(post.featuredImage)) {
        image.src = post.featuredImage;
        image.alt = `Featured image for ${post.title || "article"}`;
        placeholder.hidden = true;
    } else {
        image.hidden = true;
    }

    return card;
}

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
            postFeedStatus.textContent = "No articles have been published yet. Please check back soon.";
            return;
        }

        postGrid.replaceChildren(...posts.map(createPostCard));
        postGrid.hidden = false;
        postFeedStatus.hidden = true;
    } catch (error) {
        console.error("Unable to load published posts:", error);
        postFeedStatus.textContent = "Articles could not be loaded right now. Please try again soon.";
    }
}

loadPublishedPosts();
