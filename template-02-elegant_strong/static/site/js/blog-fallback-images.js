(() => {
    "use strict";

    const images = Object.freeze({
        market: Object.freeze({ src: "/static/site/images/Marketupdateblgfallbackimg.webp", largePosition: "50% 60%", compactPosition: "42% 68%" }),
        agents: Object.freeze({ src: "/static/site/images/agentgrowthblogfallbackimg.webp", largePosition: "50% 50%", compactPosition: "50% 50%" }),
        buyers: Object.freeze({ src: "/static/site/images/buyersblogfallbackimg.webp", largePosition: "58% 50%", compactPosition: "57% 50%" }),
        sellers: Object.freeze({ src: "/static/site/images/sellersblogfallbackimg.webp", largePosition: "30% 48%", compactPosition: "25% 45%" }),
        guidance: Object.freeze({ src: "/static/site/images/generalguidancefallbackimg.webp", largePosition: "60% 50%", compactPosition: "27% 54%" })
    });

    function forPost(post) {
        const rawTags = Array.isArray(post?.tags) ? post.tags : String(post?.tags || "").split(",");
        const tags = rawTags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean);
        if (tags.some((tag) => ["buyer", "buyers", "buying"].includes(tag))) return images.buyers;
        if (tags.some((tag) => ["seller", "sellers", "selling"].includes(tag))) return images.sellers;
        if (post?.category === "market-updates") return images.market;
        if (post?.category === "recruiting") return images.agents;
        return images.guidance;
    }

    window.blogFallbackImages = Object.freeze({ forPost });
})();
