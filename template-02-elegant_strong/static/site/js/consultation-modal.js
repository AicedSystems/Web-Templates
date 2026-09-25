"use strict";

const consultationModal = document.querySelector("[data-consultation-modal]");

if (consultationModal) {
    const dialog = consultationModal.querySelector("[role='dialog']");
    const openButtons = [...document.querySelectorAll("[data-consultation-open]")];
    const closeButtons = [...consultationModal.querySelectorAll("[data-consultation-close]")];
    const focusableSelector = "a[href], button:not([disabled])";
    let previousFocus = null;

    function openConsultation(event) {
        event?.preventDefault();
        previousFocus = document.activeElement;
        consultationModal.hidden = false;
        document.body.classList.add("has-consultation-modal");
        dialog.focus();
    }

    function closeConsultation() {
        consultationModal.hidden = true;
        document.body.classList.remove("has-consultation-modal");
        previousFocus?.focus();
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
