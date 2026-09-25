"use strict";

const consultationModal = document.querySelector("[data-consultation-modal]");

if (consultationModal) {
    const dialog = consultationModal.querySelector("[role='dialog']");
    const openButtons = [...document.querySelectorAll("[data-consultation-open]")];
    const closeButtons = [...consultationModal.querySelectorAll("[data-consultation-close]")];
    const focusableSelector = "a[href], button:not([disabled])";
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motionBaseDuration = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--motion-base")) || 220;
    let previousFocus = null;
    let closeTimer = null;
    let openFrame = null;

    consultationModal.classList.add("motion-enabled");
    consultationModal.setAttribute("aria-hidden", "true");
    consultationModal.inert = true;

    function openConsultation(event) {
        event?.preventDefault();
        window.clearTimeout(closeTimer);
        previousFocus = document.activeElement;
        consultationModal.classList.remove("is-closing");
        consultationModal.hidden = false;
        consultationModal.inert = false;
        consultationModal.setAttribute("aria-hidden", "false");
        document.body.classList.add("has-consultation-modal");
        window.cancelAnimationFrame(openFrame);
        openFrame = window.requestAnimationFrame(() => {
            consultationModal.classList.add("is-open");
            openFrame = null;
        });
        dialog.focus();
    }

    function closeConsultation() {
        if (consultationModal.hidden) return;
        window.cancelAnimationFrame(openFrame);
        openFrame = null;
        consultationModal.classList.remove("is-open");
        consultationModal.classList.add("is-closing");
        consultationModal.inert = true;
        consultationModal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("has-consultation-modal");
        previousFocus?.focus();
        window.clearTimeout(closeTimer);
        closeTimer = window.setTimeout(() => {
            consultationModal.hidden = true;
            consultationModal.classList.remove("is-closing");
        }, reducedMotion.matches ? 0 : motionBaseDuration);
    }

    openButtons.forEach((button) => {
        if (button.tagName === "BUTTON" && !button.hasAttribute("type")) button.type = "button";
        button.addEventListener("click", openConsultation);
    });
    closeButtons.forEach((button) => button.addEventListener("click", closeConsultation));
    consultationModal.querySelectorAll("[data-consultation-choice]").forEach((choice) => choice.addEventListener("click", closeConsultation));
    document.addEventListener("keydown", (event) => {
        if (consultationModal.hidden) return;
        if (event.key === "Escape") { event.preventDefault(); closeConsultation(); return; }
        if (event.key !== "Tab") return;
        const focusable = [...consultationModal.querySelectorAll(focusableSelector)];
        const first = focusable[0]; const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
}
