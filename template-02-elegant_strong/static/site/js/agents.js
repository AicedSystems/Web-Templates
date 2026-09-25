const applicationForm = document.querySelector("[data-agent-application]");
const applicationStatus = document.querySelector("[data-form-status]");

function showFieldError(field) {
    const error = applicationForm.querySelector(`[data-error-for="${field.id}"]`);
    if (!error) return;
    field.setAttribute("aria-invalid", String(!field.validity.valid));
    if (field.validity.valueMissing) error.textContent = "Please complete this field.";
    else if (field.validity.typeMismatch) error.textContent = "Please enter a valid email address.";
    else error.textContent = "";
}

if (applicationForm) {
    const requiredFields = [...applicationForm.querySelectorAll("[required]")];
    requiredFields.forEach((field) => {
        field.addEventListener("blur", () => showFieldError(field));
        field.addEventListener("input", () => { if (field.validity.valid) showFieldError(field); });
    });
    applicationForm.addEventListener("submit", (event) => {
        event.preventDefault();
        requiredFields.forEach(showFieldError);
        if (!applicationForm.checkValidity()) {
            applicationStatus.textContent = "Please review the highlighted fields.";
            applicationForm.querySelector(":invalid")?.focus();
            return;
        }
        applicationStatus.textContent = "Your application looks ready. Online submission will be connected in the next phase.";
    });
}

const resourceViewport = document.querySelector(".resource-carousel__viewport");
const resourcePrevious = document.querySelector("[data-resource-previous]");
const resourceNext = document.querySelector("[data-resource-next]");
const resourceReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function resourceScrollAmount() {
    const card = resourceViewport?.querySelector(".resource-card");
    return card ? card.getBoundingClientRect().width + 26 : 300;
}

function updateResourceButtons() {
    if (!resourceViewport) return;
    const maximum = resourceViewport.scrollWidth - resourceViewport.clientWidth;
    resourcePrevious.disabled = resourceViewport.scrollLeft <= 2;
    resourceNext.disabled = resourceViewport.scrollLeft >= maximum - 2 || maximum <= 2;
}

if (resourceViewport && resourcePrevious && resourceNext) {
    const scrollBehavior = () => resourceReducedMotion.matches ? "auto" : "smooth";
    resourcePrevious.addEventListener("click", () => resourceViewport.scrollBy({ left: -resourceScrollAmount(), behavior: scrollBehavior() }));
    resourceNext.addEventListener("click", () => resourceViewport.scrollBy({ left: resourceScrollAmount(), behavior: scrollBehavior() }));
    resourceViewport.addEventListener("scroll", updateResourceButtons, { passive: true });
    window.addEventListener("resize", updateResourceButtons);
    updateResourceButtons();
}
