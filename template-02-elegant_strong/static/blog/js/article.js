const articlePage = document.querySelector("[data-post-id]");
const articleStatus = document.querySelector("#article-status");
const articleDetail = document.querySelector("#article-detail");
const articleCategory = document.querySelector("#article-category");
const articleTitle = document.querySelector("#article-title");
const articleExcerpt = document.querySelector("#article-excerpt");
const articleDate = document.querySelector("#article-date");
const articleMedia = document.querySelector("#article-media");
const articleImage = document.querySelector("#article-image");
const articleContent = document.querySelector("#article-content");
const articleTags = document.querySelector("#article-tags");

const categoryLabels = {
    "market-updates": "Market Updates",
    recruiting: "Recruiting",
    "success-stories": "Success Stories",
    training: "Training"
};

function formatPublishedDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Date unavailable";

    return new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
    }).format(date);
}

function getYouTubeEmbedUrl(value) {
    try {
        const url = new URL(value);
        const host = url.hostname.replace(/^www\./, "");
        let videoId;

        if (host === "youtu.be") {
            videoId = url.pathname.slice(1).split("/")[0];
        } else if (host === "youtube.com" || host === "m.youtube.com") {
            if (url.pathname === "/watch") {
                videoId = url.searchParams.get("v");
            } else {
                const [prefix, id] = url.pathname.split("/").filter(Boolean);
                if (["embed", "shorts", "live"].includes(prefix)) videoId = id;
            }
        }

        return /^[A-Za-z0-9_-]{11}$/.test(videoId || "")
            ? `https://www.youtube-nocookie.com/embed/${videoId}`
            : null;
    } catch {
        return null;
    }
}

function isSafeWebUrl(value) {
    try {
        return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
        return false;
    }
}

function isSafeImageSource(value) {
    return typeof value === "string" && (
        /^data:image\/(?:jpeg|png|webp);base64,/i.test(value) || isSafeWebUrl(value)
    );
}

function createArticleBlock(block) {
    if (!block || typeof block !== "object") return null;

    if (["heading", "paragraph", "quote"].includes(block.type) && typeof block.text !== "string") {
        return null;
    }

    if (block.type === "heading") {
        const heading = document.createElement("h2");
        heading.className = "article-block__heading";
        heading.textContent = block.text;
        return heading;
    }

    if (block.type === "paragraph") {
        const paragraph = document.createElement("p");
        paragraph.className = "article-block__paragraph";
        paragraph.textContent = block.text;
        return paragraph;
    }

    if (block.type === "quote") {
        const quote = document.createElement("blockquote");
        quote.className = "article-block__quote";
        quote.textContent = block.text;
        return quote;
    }

    if (block.type === "image" && isSafeImageSource(block.url)) {
        const image = document.createElement("img");
        image.className = "article-block__image";
        image.src = block.url;
        image.alt = "Article image";
        image.loading = "lazy";
        return image;
    }

    if (block.type === "youtube") {
        const embedUrl = getYouTubeEmbedUrl(block.url);
        if (!embedUrl) return null;

        const frame = document.createElement("iframe");
        frame.className = "article-block__youtube";
        frame.src = embedUrl;
        frame.title = "YouTube video";
        frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
        frame.allowFullscreen = true;
        frame.loading = "lazy";
        return frame;
    }

    if (block.type === "cta" && typeof block.text === "string" && isSafeWebUrl(block.url)) {
        const link = document.createElement("a");
        link.className = "article-block__cta";
        link.href = block.url;
        link.textContent = block.text;
        return link;
    }

    return null;
}

function renderContentBlocks(post) {
    const blocks = Array.isArray(post.contentBlocks) && post.contentBlocks.length
        ? post.contentBlocks
        : [{ type: "paragraph", text: post.content || "" }];

    articleContent.replaceChildren(...blocks.map(createArticleBlock).filter(Boolean));
}

function renderArticle(post) {
    articleCategory.textContent = categoryLabels[post.category] || post.category || "Insights";
    articleTitle.textContent = post.title || "Untitled article";
    articleExcerpt.textContent = post.excerpt || "";
    articleExcerpt.hidden = !post.excerpt;
    articleDate.dateTime = post.publishedDate || "";
    articleDate.textContent = formatPublishedDate(post.publishedDate);
    renderContentBlocks(post);
    document.title = `${post.title || "Article"} | Stephanie J Mendoza`;

    const tags = Array.isArray(post.tags) ? post.tags : [];
    articleTags.replaceChildren(...tags.map((tag) => {
        const item = document.createElement("li");
        item.textContent = tag;
        return item;
    }));
    articleTags.hidden = tags.length === 0;

    if (isSafeImageSource(post.featuredImage)) {
        articleImage.src = post.featuredImage;
        articleImage.alt = `Featured image for ${post.title || "article"}`;
        articleMedia.hidden = false;
    }

    articleStatus.hidden = true;
    articleDetail.hidden = false;
}

async function loadArticle() {
    try {
        const response = await fetch(`/api/posts/${articlePage.dataset.postId}`, {
            headers: { Accept: "application/json" }
        });

        if (response.status === 404) {
            articleStatus.textContent = "This article could not be found.";
            return;
        }

        if (!response.ok) {
            articleStatus.textContent = "This article could not be loaded right now.";
            return;
        }

        renderArticle(await response.json());
    } catch (error) {
        console.error("Unable to load article:", error);
        articleStatus.textContent = "This article could not be loaded right now.";
    }
}

loadArticle();
