"use strict";

(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const previewSelector = [
        "[data-home-preview='true']",
        ".reviews-page--editor-preview",
        ".agents-page--editor-preview",
        ".client-journey-page--editor-preview"
    ].join(",");
    const revealElements = [...document.querySelectorAll("[data-reveal]")];

    function reveal(element) {
        element.classList.add("is-revealed");
    }

    if (revealElements.length && !document.body.matches(previewSelector)) {
        revealElements.forEach((element) => {
            const requestedDelay = Number.parseInt(element.dataset.revealDelay || "0", 10);
            const delay = Number.isFinite(requestedDelay) ? Math.min(400, Math.max(0, requestedDelay)) : 0;
            element.style.setProperty("--reveal-delay", `${delay}ms`);
        });

        document.documentElement.classList.add("motion-ready");

        if (reducedMotion.matches || !("IntersectionObserver" in window)) {
            revealElements.forEach(reveal);
        } else {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    reveal(entry.target);
                    observer.unobserve(entry.target);
                });
            }, { rootMargin: "0px 0px -8%", threshold: .08 });

            revealElements.forEach((element) => observer.observe(element));
        }
    }

    const decorativeVideos = [...document.querySelectorAll("video[autoplay][muted]:not([data-hero-video])")];

    function applyVideoPreference() {
        decorativeVideos.forEach((video) => {
            if (reducedMotion.matches) {
                video.pause();
            } else if (!document.hidden) {
                video.play().catch(() => {});
            }
        });
    }

    if (decorativeVideos.length) {
        reducedMotion.addEventListener?.("change", applyVideoPreference);
        applyVideoPreference();
    }
})();
