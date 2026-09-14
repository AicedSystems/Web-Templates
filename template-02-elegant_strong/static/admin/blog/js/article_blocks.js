function classifyArticleSection(section) {
    const markdownHeading = section.match(/^#{1,6}\s+(.+)$/);
    if (markdownHeading) return { type: "heading", text: markdownHeading[1].trim() };

    const wordCount = section.split(/\s+/).length;
    const isHeadingCandidate = section.length <= 120 && wordCount <= 14 && !/[.!?]$/.test(section);
    return { type: isHeadingCandidate ? "heading" : "paragraph", text: section };
}

function articleToContentBlocks(articleText) {
    return articleText
        .split(/\r?\n\s*\r?\n/)
        .map((section) => section.trim().replace(/\s*\r?\n\s*/g, " "))
        .filter(Boolean)
        .map(classifyArticleSection);
}

function shortenSeoSummary(text) {
    if (text.length <= 160) return text;
    return `${text.slice(0, 157).replace(/\s+\S*$/, "").trim()}...`;
}

function articleToPostImport(articleText) {
    const contentBlocks = articleToContentBlocks(articleText);
    const firstBlock = contentBlocks[0];
    const title = firstBlock?.type === "heading" ? firstBlock.text : "";
    if (title) contentBlocks.shift();

    const firstParagraphIndex = contentBlocks.findIndex((block) => block.type === "paragraph");
    const [firstParagraph] = firstParagraphIndex >= 0 ? contentBlocks.splice(firstParagraphIndex, 1) : [];
    return {
        title,
        excerpt: firstParagraph ? shortenSeoSummary(firstParagraph.text) : "",
        contentBlocks
    };
}

if (typeof window !== "undefined") {
    window.articleToContentBlocks = articleToContentBlocks;
    window.articleToPostImport = articleToPostImport;
}

if (typeof module !== "undefined") module.exports = { articleToContentBlocks, articleToPostImport };
