"use strict";

(() => {
    const allowedIcons = new Set(["arrow-right", "star"]);

    function clone(name) {
        if (!allowedIcons.has(name)) return null;
        const template = document.querySelector(`[data-site-icon-template="${name}"]`);
        return template?.content.firstElementChild?.cloneNode(true) || null;
    }

    function append(parent, name) {
        const svg = clone(name);
        if (svg) parent.append(svg);
        return svg;
    }

    window.siteIcons = Object.freeze({ append, clone });
})();
