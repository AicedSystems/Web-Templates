const articlePage = document.querySelector("[data-post-id]");
const articleStatus = document.querySelector("#article-status");
const articleDetail = document.querySelector("#article-detail");
const articleCategory = document.querySelector("#article-category");
const articleTitle = document.querySelector("#article-title");
const articleExcerpt = document.querySelector("#article-excerpt");
const articleDate = document.querySelector("#article-date");
const articleMedia = document.querySelector("#article-media");
const articleImage = document.querySelector("#article-image");
const articleCoverFallback = document.querySelector("#article-cover-fallback");
const articleContent = document.querySelector("#article-content");
const articleTags = document.querySelector("#article-tags");
const articleToc = document.querySelector("#article-toc");
const articleTocList = document.querySelector("#article-toc-list");
const articleTocMobile = document.querySelector("#article-toc-mobile");
const articleTocMobileList = document.querySelector("#article-toc-mobile-list");

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

        const video = document.createElement("figure");
        video.className = "article-block__youtube-wrap";
        const frame = document.createElement("iframe");
        frame.className = "article-block__youtube";
        frame.src = embedUrl;
        frame.title = "YouTube video";
        frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
        frame.allowFullscreen = true;
        frame.loading = "lazy";
        const fallback = document.createElement("a");
        fallback.className = "article-block__youtube-fallback";
        fallback.href = embedUrl.replace("youtube-nocookie.com/embed/", "youtube.com/watch?v=");
        fallback.target = "_blank";
        fallback.rel = "noopener noreferrer";
        fallback.textContent = "Video not playing? Watch on YouTube →";
        video.append(frame, fallback);
        return video;
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

function headingSlug(value) {
    return value.normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "section";
}

function buildTableOfContents() {
    const headings = [...articleContent.querySelectorAll("h2")];
    if (headings.length < 2) return;

    const usedIds = new Map();
    const entries = headings.map((heading) => {
        const base = headingSlug(heading.textContent);
        const count = (usedIds.get(base) || 0) + 1;
        usedIds.set(base, count);
        heading.id = count === 1 ? base : `${base}-${count}`;
        return { id: heading.id, text: heading.textContent };
    });

    function linksFor(container) {
        return entries.map((entry) => {
            const item = document.createElement("li");
            const link = document.createElement("a");
            link.href = `#${entry.id}`;
            link.textContent = entry.text;
            item.append(link);
            return item;
        });
    }

    articleTocList.replaceChildren(...linksFor(articleTocList));
    articleTocMobileList.replaceChildren(...linksFor(articleTocMobileList));
    articleToc.hidden = false;
    articleTocMobile.hidden = false;

    if (!("IntersectionObserver" in window)) return;
    const desktopLinks = [...articleTocList.querySelectorAll("a")];
    const observer = new IntersectionObserver((observed) => {
        const visible = observed.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (!visible) return;
        desktopLinks.forEach((link) => {
            const active = link.hash === `#${visible.target.id}`;
            link.classList.toggle("is-active", active);
            if (active) link.setAttribute("aria-current", "location");
            else link.removeAttribute("aria-current");
        });
    }, { rootMargin: "-18% 0px -68%", threshold: 0 });
    headings.forEach((heading) => observer.observe(heading));
}

function renderArticleCover(post) {
    articleMedia.hidden = false;
    articleCoverFallback.hidden = true;
    articleImage.hidden = false;
    articleImage.alt = "";
    articleImage.src = `/api/posts/${post.id}/featured-image`;
    const settings = post.featuredImageSettings || {};
    const focalX = Number.isInteger(settings.focalX) ? settings.focalX : 50;
    const focalY = Number.isInteger(settings.focalY) ? settings.focalY : 50;
    const fit = ["cover", "contain"].includes(settings.fit) ? settings.fit : "cover";
    const zoom = Number.isInteger(settings.zoom) ? settings.zoom : 100;
    articleImage.style.objectFit = fit;
    articleImage.style.objectPosition = `${focalX}% ${focalY}%`;
    articleImage.style.transform = `scale(${zoom / 100})`;
    articleImage.addEventListener("error", () => {
        articleImage.hidden = true;
        articleCoverFallback.hidden = false;
    }, { once: true });
}

function renderArticle(post) {
    articleCategory.textContent = categoryLabels[post.category] || post.category || "Insights";
    articleTitle.textContent = post.title || "Untitled article";
    articleExcerpt.textContent = post.excerpt || "";
    articleExcerpt.hidden = !post.excerpt;
    articleDate.dateTime = post.publishedDate || "";
    articleDate.textContent = formatPublishedDate(post.publishedDate);
    renderContentBlocks(post);
    buildTableOfContents();
    renderArticleCover(post);
    document.title = `${post.title || "Article"} | Stephanie J Mendoza`;

    const tags = Array.isArray(post.tags) ? post.tags : [];
    articleTags.replaceChildren(...tags.map((tag) => {
        const item = document.createElement("li");
        item.textContent = tag;
        return item;
    }));
    articleTags.hidden = tags.length === 0;

    articleStatus.hidden = true;
    articleDetail.hidden = false;
}

document.querySelectorAll(".related-article__media img").forEach((image) => {
    image.addEventListener("error", () => image.hidden = true, { once: true });
});

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
