"use strict";

(() => {
    const video = document.querySelector("[data-hero-video]");
    if (!video) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const showLoadFailure = () => {
        video.pause();
        video.hidden = true;
        video.closest("[data-home-hero-media-frame]")?.classList.add("hero__media-frame--error");
    };
    const showVideo = () => {
        video.closest("[data-home-hero-media-frame]")?.classList.remove("hero__media-frame--error");
        video.hidden = false;
        if (!document.hidden) video.play().catch(() => {});
    };
    const applyPreference = () => {
        if (!reducedMotion.matches) {
            showVideo();
            return;
        }
        video.hidden = false;
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) video.pause();
        else video.addEventListener("loadeddata", () => video.pause(), { once: true });
    };

    video.addEventListener("error", showLoadFailure);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) video.pause();
        else if (!reducedMotion.matches && !video.hidden) video.play().catch(() => {});
    });
    reducedMotion.addEventListener?.("change", applyPreference);
    applyPreference();
})();
