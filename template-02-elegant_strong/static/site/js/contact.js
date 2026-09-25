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

    contactForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        requiredFields.forEach(updateField);
        if (!contactForm.checkValidity()) {
            status.textContent = "Please review the highlighted fields.";
            contactForm.querySelector(":invalid")?.focus();
            return;
        }
        const submitButton = contactForm.querySelector('button[type="submit"]');
        const payload = Object.fromEntries(new FormData(contactForm).entries());
        payload.formType = "contact";
        submitButton.disabled = true;
        submitButton.setAttribute("aria-busy", "true");
        status.textContent = "Sending your message…";

        try {
            const response = await fetch("/api/inquiries", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.message || "We could not send your message right now.");
            contactForm.reset();
            requiredFields.forEach((field) => {
                field.setAttribute("aria-invalid", "false");
                const error = contactForm.querySelector(`[data-error-for="${field.id}"]`);
                if (error) error.textContent = "";
            });
            status.textContent = result.message || "Thank you. Stephanie will be in touch soon.";
        } catch (error) {
            status.textContent = error.message;
        } finally {
            submitButton.disabled = false;
            submitButton.removeAttribute("aria-busy");
        }
    });
}
