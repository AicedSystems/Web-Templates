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

    buyerInquiryForm.addEventListener("submit", (event) => {
        event.preventDefault();
        requiredFields.forEach(updateBuyerField);
        if (!buyerInquiryForm.checkValidity()) {
            status.textContent = "Please review the highlighted fields.";
            buyerInquiryForm.querySelector(":invalid")?.focus();
            return;
        }
        status.textContent = "Your information is ready. Online submission will be connected with the future page editor phase.";
    });
}
