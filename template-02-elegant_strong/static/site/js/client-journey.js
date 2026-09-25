const buyerInquiryForm = document.querySelector("[data-buyer-inquiry]");

if (buyerInquiryForm) {
    const status = buyerInquiryForm.querySelector("[data-buyer-form-status]");
    const requiredFields = [...buyerInquiryForm.querySelectorAll("[required]")];

    function updateBuyerField(field) {
        const error = buyerInquiryForm.querySelector(`[data-error-for="${field.id}"]`);
        const invalid = !field.validity.valid;
        field.setAttribute("aria-invalid", String(invalid));
        if (!error) return;
        if (field.validity.valueMissing) error.textContent = "Please complete this field.";
        else if (field.validity.typeMismatch) error.textContent = "Please enter a valid email address.";
        else error.textContent = "";
    }

    requiredFields.forEach((field) => {
        field.addEventListener("blur", () => updateBuyerField(field));
        field.addEventListener("input", () => {
            if (field.validity.valid) updateBuyerField(field);
        });
    });

    buyerInquiryForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        requiredFields.forEach(updateBuyerField);
        if (!buyerInquiryForm.checkValidity()) {
            status.textContent = "Please review the highlighted fields.";
            buyerInquiryForm.querySelector(":invalid")?.focus();
            return;
        }
        const submitButton = buyerInquiryForm.querySelector('button[type="submit"]');
        const payload = Object.fromEntries(new FormData(buyerInquiryForm).entries());
        payload.audience = buyerInquiryForm.dataset.audience;
        submitButton.disabled = true;
        submitButton.setAttribute("aria-busy", "true");
        status.textContent = "Sending your inquiry…";

        try {
            const response = await fetch("/api/inquiries", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.message || "We could not send your inquiry right now.");
            buyerInquiryForm.reset();
            requiredFields.forEach((field) => {
                field.setAttribute("aria-invalid", "false");
                const error = buyerInquiryForm.querySelector(`[data-error-for="${field.id}"]`);
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
