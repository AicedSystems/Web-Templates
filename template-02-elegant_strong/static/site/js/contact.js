"use strict";

const contactForm = document.querySelector("[data-contact-form]");

if (contactForm) {
    const status = contactForm.querySelector("[data-contact-status]");
    const requiredFields = [...contactForm.querySelectorAll("[required]")];

    function updateField(field) {
        const error = contactForm.querySelector(`[data-error-for="${field.id}"]`);
        const invalid = !field.validity.valid;
        field.setAttribute("aria-invalid", String(invalid));
        if (!error) return;
        if (field.validity.valueMissing) error.textContent = "Please complete this field.";
        else if (field.validity.typeMismatch) error.textContent = "Please enter a valid email address.";
        else error.textContent = "";
    }

    requiredFields.forEach((field) => {
        field.addEventListener("blur", () => updateField(field));
        field.addEventListener("input", () => { if (field.validity.valid) updateField(field); });
        field.addEventListener("change", () => updateField(field));
    });

    contactForm.addEventListener("submit", (event) => {
        event.preventDefault();
        requiredFields.forEach(updateField);
        if (!contactForm.checkValidity()) {
            status.textContent = "Please review the highlighted fields.";
            contactForm.querySelector(":invalid")?.focus();
            return;
        }
        status.textContent = "Thank you—online message delivery will be connected in the contact integration phase.";
    });
}
