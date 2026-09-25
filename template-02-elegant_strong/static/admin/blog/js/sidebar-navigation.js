document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".admin-nav-group--active").forEach((group) => {
        const summary = group.querySelector(":scope > summary");

        group.open = true;

        summary?.addEventListener("click", (event) => {
            if (group.open) {
                event.preventDefault();
            }
        });

        group.addEventListener("toggle", () => {
            if (!group.open) {
                group.open = true;
            }
        });
    });
});
