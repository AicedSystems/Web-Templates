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

    const fallbackImages = {
        "market-updates": "/static/site/images/contactpagehero.webp",
        recruiting: "/static/site/images/agents-feature.jpg",
        "success-stories": "/static/site/images/steph-testimonial-reviews.webp",
        training: "/static/site/images/about-portrait.webp"
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
        image.addEventListener("error", () => {
            image.src = fallbackImages[post.category] || fallbackImages["market-updates"];
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
        image.addEventListener("error", () => {
            image.src = fallbackImages[post.category] || fallbackImages["market-updates"];
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
