const postStorageKeys = {
    draft: "cmsPostDraft",
    publishedPosts: "cmsPublishedPosts"
};

function readStoredJson(key, fallbackValue) {
    const storedValue = localStorage.getItem(key);

    if (!storedValue) return fallbackValue;

    try {
        return JSON.parse(storedValue);
    } catch (error) {
        console.error(`Unable to read local data for ${key}:`, error);
        return fallbackValue;
    }
}

const postStorage = {
    saveDraft(post) {
        localStorage.setItem(postStorageKeys.draft, JSON.stringify(post));
    },

    getDraft() {
        return readStoredJson(postStorageKeys.draft, null);
    },

    getPublishedPosts() {
        const publishedPosts = readStoredJson(postStorageKeys.publishedPosts, []);
        return Array.isArray(publishedPosts) ? publishedPosts : [];
    },

    findPublishedPost(postId) {
        return this.getPublishedPosts().find((post) => post.id === postId) || null;
    },

    savePublishedPost(post) {
        const publishedPosts = this.getPublishedPosts();
        publishedPosts.unshift(post);
        localStorage.setItem(postStorageKeys.publishedPosts, JSON.stringify(publishedPosts));
    }
};
