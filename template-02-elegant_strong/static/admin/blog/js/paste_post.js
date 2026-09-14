const pastedArticleInput = document.querySelector("#pasted-article");
const wordCount = document.querySelector("#paste-word-count");
const continueAsIsButton = document.querySelector("#continue-as-is");
const enhanceWithAiButton = document.querySelector("#enhance-with-ai");
const enhancementStatus = document.querySelector("#paste-enhancement-status");
const pastedPostImportStorageKey = "cmsPastedPostImport";
let isEnhancing = false;

function getWordCount(text) {
    const trimmedText = text.trim();
    return trimmedText ? trimmedText.split(/\s+/).length : 0;
}

function updatePasteState() {
    const count = getWordCount(pastedArticleInput.value);
    wordCount.textContent = `${count.toLocaleString()} ${count === 1 ? "word" : "words"}`;
    const hasArticle = count > 0;
    continueAsIsButton.disabled = !hasArticle || isEnhancing;
    enhanceWithAiButton.disabled = !hasArticle || isEnhancing;
}

pastedArticleInput.addEventListener("input", updatePasteState);

continueAsIsButton.addEventListener("click", () => {
    const article = pastedArticleInput.value.trim();
    if (!article) return;

    const postImport = articleToPostImport(article);
    sessionStorage.setItem(pastedPostImportStorageKey, JSON.stringify(postImport));
    window.location.assign("/admin/blog/new/build?import=pasted");
});

function isUsableEnhancement(enhancement) {
    return (
        enhancement
        && typeof enhancement.title === "string"
        && typeof enhancement.excerpt === "string"
        && typeof enhancement.category === "string"
        && Array.isArray(enhancement.tags)
        && Array.isArray(enhancement.contentBlocks)
        && enhancement.contentBlocks.every((block) => (
            block
            && ["heading", "paragraph", "quote"].includes(block.type)
            && typeof block.text === "string"
        ))
    );
}

enhanceWithAiButton.addEventListener("click", async () => {
    const article = pastedArticleInput.value.trim();

    if (!article) {
        enhancementStatus.textContent = "Paste an article before enhancing it.";
        return;
    }

    isEnhancing = true;
    enhanceWithAiButton.textContent = "Enhancing article…";
    enhancementStatus.textContent = "Enhancing article…";
    updatePasteState();

    try {
        const response = await fetch("/api/posts/enhance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ article })
        });
        const enhancement = await response.json().catch(() => null);

        if (!response.ok) throw new Error(enhancement?.message || "The article could not be enhanced.");
        if (!isUsableEnhancement(enhancement)) throw new Error("The enhancement result could not be used.");

        sessionStorage.setItem(pastedPostImportStorageKey, JSON.stringify(enhancement));
        enhancementStatus.textContent = "Article enhanced. Opening the editor…";
        window.location.assign("/admin/blog/new/build?import=enhanced");
    } catch (error) {
        enhancementStatus.textContent = error instanceof TypeError
            ? "Unable to reach the enhancement service. Please try again."
            : error.message || "The article could not be enhanced. Please try again.";
        isEnhancing = false;
        enhanceWithAiButton.textContent = "✦ Enhance With AI";
        updatePasteState();
    }
});

updatePasteState();
