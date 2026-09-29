const homepageBlogList = document.querySelector("[data-blog-list]");
const heroBlogList = document.querySelector("[data-blog-preview]");
const homepageArticlesData = document.querySelector("#homepage-articles-data");

if (homepageBlogList || heroBlogList) {
    const categoryLabels = {
        "market-updates": "Market Updates",
        recruiting: "Agent Growth",
        "success-stories": "Success Stories",
        training: "Guidance"
    };

    function formatDate(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        return new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        }).format(date);
    }

    function clamp(value, minimum, maximum, fallback) {
        const number = Number(value);
        return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
    }

    function configureArticleImage(image, post) {
        const focalX = clamp(post.imageFocalX, 0, 100, 50);
        const focalY = clamp(post.imageFocalY, 0, 100, 50);
        const zoom = clamp(post.imageZoom, 100, 200, 100) / 100;
        image.style.objectFit = post.imageFit === "contain" ? "contain" : "cover";
        image.style.objectPosition = `${focalX}% ${focalY}%`;
        image.style.transformOrigin = `${focalX}% ${focalY}%`;
        image.style.setProperty("--article-image-zoom", String(zoom));
        image.style.setProperty("--article-image-hover-zoom", String(zoom * 1.025));
    }

    function fallbackForPost(post) {
        return window.blogFallbackImages.forPost(post);
    }

    function useFallbackImage(image, post, presentation) {
        const fallback = fallbackForPost(post);
        image.classList.add("is-fallback");
        image.src = fallback.src;
        image.style.objectFit = "cover";
        image.style.objectPosition = presentation === "compact" ? fallback.compactPosition : fallback.largePosition;
        image.style.transformOrigin = image.style.objectPosition;
        image.style.setProperty("--article-image-zoom", "1");
        image.style.setProperty("--article-image-hover-zoom", "1.025");
    }

    function createArticleCard(post) {
        const article = document.createElement("article");
        article.className = "homepage-blog-card";

        const link = document.createElement("a");
        link.href = `/blog/${post.id}`;

        const media = document.createElement("div");
        media.className = "homepage-blog-card__media";
        const image = document.createElement("img");
        image.src = `/api/posts/${post.id}/featured-image`;
        image.alt = `Cover image for ${post.title || "article"}`;
        image.loading = "lazy";
        configureArticleImage(image, post);
        image.addEventListener("error", () => {
            useFallbackImage(image, post, "large");
        }, { once: true });
        media.append(image);

        const copy = document.createElement("div");
        copy.className = "homepage-blog-card__copy";
        const meta = document.createElement("p");
        meta.className = "homepage-blog-card__meta";
        meta.textContent = [categoryLabels[post.category] || post.category || "Insights", formatDate(post.publishedDate)]
            .filter(Boolean)
            .join(" · ");
        const title = document.createElement("h3");
        title.textContent = post.title || "Untitled article";
        const excerpt = document.createElement("p");
        excerpt.className = "homepage-blog-card__excerpt";
        excerpt.textContent = post.excerpt || "Read Stephanie's latest real estate insight.";
        const read = document.createElement("span");
        read.className = "homepage-blog-card__read";
        read.append(document.createTextNode("Read Article "));
        window.siteIcons?.append(read, "arrow-right");

        copy.append(meta, title, excerpt, read);
        link.append(media, copy);
        article.append(link);
        return article;
    }

    function createHeroArticle(post) {
        const link = document.createElement("a");
        link.className = "hero-blog__card";
        link.href = `/blog/${post.id}`;

        const image = document.createElement("img");
        image.src = `/api/posts/${post.id}/featured-image`;
        image.alt = `Cover image for ${post.title || "article"}`;
        image.loading = "lazy";
        configureArticleImage(image, post);
        image.addEventListener("error", () => {
            useFallbackImage(image, post, "compact");
        }, { once: true });

        const content = document.createElement("div");
        content.className = "hero-blog__content";
        const category = document.createElement("p");
        category.textContent = categoryLabels[post.category] || post.category || "Insights";
        const title = document.createElement("h2");
        title.textContent = post.title || "Untitled article";
        const read = document.createElement("span");
        read.append(document.createTextNode("Read Article "));
        window.siteIcons?.append(read, "arrow-right");

        content.append(category, title, read);
        link.append(image, content);
        return link;
    }

    try {
        const posts = JSON.parse(homepageArticlesData?.textContent || "[]");
        const latestPosts = Array.isArray(posts) ? posts : [];
        if (!latestPosts.length) {
            if (homepageBlogList) homepageBlogList.innerHTML = '<p class="homepage-blog__status">New insights are coming soon.</p>';
            if (heroBlogList) heroBlogList.innerHTML = '<p class="hero-blog__status">New insights are coming soon.</p>';
        } else {
            if (homepageBlogList) homepageBlogList.replaceChildren(...latestPosts.map(createArticleCard));
            if (heroBlogList) heroBlogList.replaceChildren(...latestPosts.map(createHeroArticle));
        }
    } catch (error) {
        console.error("Unable to read homepage articles:", error);
        if (homepageBlogList) homepageBlogList.innerHTML = '<p class="homepage-blog__status">Articles could not be loaded right now.</p>';
        if (heroBlogList) heroBlogList.innerHTML = '<p class="hero-blog__status">Articles could not be loaded right now.</p>';
    }
}
