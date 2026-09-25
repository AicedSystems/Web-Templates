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
    applicationForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        requiredFields.forEach(showFieldError);
        if (!applicationForm.checkValidity()) {
            applicationStatus.textContent = "Please review the highlighted fields.";
            applicationForm.querySelector(":invalid")?.focus();
            return;
        }
        const submitButton = applicationForm.querySelector('button[type="submit"]');
        const payload = Object.fromEntries(new FormData(applicationForm).entries());
        payload.formType = "agent";
        submitButton.disabled = true;
        submitButton.setAttribute("aria-busy", "true");
        applicationStatus.textContent = "Sending your application…";

        try {
            const response = await fetch("/api/inquiries", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.message || "We could not send your application right now.");
            applicationForm.reset();
            requiredFields.forEach((field) => {
                field.setAttribute("aria-invalid", "false");
                const error = applicationForm.querySelector(`[data-error-for="${field.id}"]`);
                if (error) error.textContent = "";
            });
            applicationStatus.textContent = result.message || "Thank you. Stephanie will be in touch soon.";
        } catch (error) {
            applicationStatus.textContent = error.message;
        } finally {
            submitButton.disabled = false;
            submitButton.removeAttribute("aria-busy");
        }
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

const agentReviewsCarousel = document.querySelector("[data-agent-reviews-carousel]");
const agentReviewsTrack = document.querySelector("[data-agent-reviews-track]");
const agentReviewsViewport = agentReviewsCarousel?.querySelector(".agent-reviews__viewport");
const agentReviewsPrevious = document.querySelector("[data-agent-reviews-previous]");
const agentReviewsNext = document.querySelector("[data-agent-reviews-next]");
const agentReviewsEmpty = document.querySelector("[data-agent-reviews-empty]");
const agentReviewModal = document.querySelector("[data-agent-review-modal]");
const agentReviewModalClose = document.querySelector("[data-agent-review-modal-close]");
const agentReviewModalMedia = document.querySelector("[data-agent-review-modal-media]");
const agentReviewModalImage = document.querySelector("[data-agent-review-modal-image]");
const agentReviewModalStars = document.querySelector("[data-agent-review-modal-stars]");
const agentReviewModalQuote = document.querySelector("[data-agent-review-modal-quote]");
const agentReviewModalName = document.querySelector("[data-agent-review-modal-name]");
const agentReviewModalRole = document.querySelector("[data-agent-review-modal-role]");
let agentReviewsTimer = null;
let agentReviewModalTrigger = null;

function reviewPreviewText(value, maximum = 180) {
    const text = String(value || "").trim();
    if (text.length <= maximum) return text;
    const shortened = text.slice(0, maximum + 1).replace(/\s+\S*$/, "").trim();
    return `${shortened || text.slice(0, maximum).trim()}…`;
}

function closeAgentReviewModal() {
    if (!agentReviewModal?.open) return;
    agentReviewModal.close();
}

function openAgentReviewModal(review, trigger) {
    if (!agentReviewModal) return;
    agentReviewModalTrigger = trigger;
    agentReviewModalQuote.textContent = `“${review.quote}”`;
    agentReviewModalName.textContent = review.clientName;
    agentReviewModalRole.textContent = review.clientType || "Agent";
    agentReviewModalStars.textContent = review.rating ? "★".repeat(review.rating) : "";
    agentReviewModalStars.hidden = !review.rating;
    if (review.rating) agentReviewModalStars.setAttribute("aria-label", `${review.rating} out of 5 stars`);
    else agentReviewModalStars.removeAttribute("aria-label");
    agentReviewModalMedia.hidden = !review.clientImageUrl;
    agentReviewModal.classList.toggle("agent-review-modal--text-only", !review.clientImageUrl);
    if (review.clientImageUrl) {
        agentReviewModalImage.src = review.clientImageUrl;
        agentReviewModalImage.alt = `${review.clientName} testimonial`;
        agentReviewModalImage.style.objectFit = review.clientImageFit === "contain" ? "contain" : "cover";
        agentReviewModalImage.style.objectPosition = `${review.clientImageFocalX ?? 50}% ${review.clientImageFocalY ?? 50}%`;
    } else agentReviewModalImage.removeAttribute("src");
    window.clearInterval(agentReviewsTimer);
    agentReviewModal.showModal();
    agentReviewModalClose.focus();
}

function createAgentReviewCard(review) {
    const card = document.createElement("article");
    card.className = `agent-review-card${review.clientImageUrl ? "" : " agent-review-card--text-only"}`;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-haspopup", "dialog");
    card.setAttribute("aria-label", `Read the complete review from ${review.clientName}`);
    if (review.clientImageUrl) {
        const media = document.createElement("div");
        media.className = "agent-review-card__media";
        const image = document.createElement("img");
        image.src = review.clientImageUrl;
        image.alt = `${review.clientName} testimonial`;
        image.loading = "lazy";
        image.style.objectFit = review.clientImageFit === "contain" ? "contain" : "cover";
        image.style.objectPosition = `${review.clientImageFocalX ?? 50}% ${review.clientImageFocalY ?? 50}%`;
        media.append(image);
        card.append(media);
    }
    const body = document.createElement("div");
    body.className = "agent-review-card__body";
    if (review.rating) {
        const stars = document.createElement("p");
        stars.className = "agent-review-card__stars";
        stars.setAttribute("aria-label", `${review.rating} out of 5 stars`);
        stars.textContent = "★".repeat(review.rating);
        body.append(stars);
    }
    const quote = document.createElement("blockquote");
    quote.textContent = `“${reviewPreviewText(review.quote)}”`;
    const showMore = document.createElement("span");
    showMore.className = "agent-review-card__show-more";
    showMore.setAttribute("aria-hidden", "true");
    const showMoreLabel = document.createElement("span");
    showMoreLabel.textContent = "Show full review";
    const showMoreArrow = document.createElement("span");
    showMoreArrow.className = "agent-review-card__show-more-arrow";
    showMore.append(showMoreLabel, showMoreArrow);
    const person = document.createElement("p");
    person.className = "agent-review-card__person";
    const name = document.createElement("strong");
    name.textContent = review.clientName;
    const role = document.createElement("span");
    role.textContent = review.clientType || "Agent";
    person.append(name, role);
    body.append(quote, showMore, person);
    card.append(body);
    card.addEventListener("click", () => openAgentReviewModal(review, card));
    card.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openAgentReviewModal(review, card);
    });
    return card;
}

function agentReviewScrollAmount() {
    const card = agentReviewsTrack?.querySelector(".agent-review-card");
    if (!card) return 320;
    return card.getBoundingClientRect().width + 22;
}

function scrollAgentReviews(direction = 1) {
    if (!agentReviewsViewport) return;
    const maximum = agentReviewsViewport.scrollWidth - agentReviewsViewport.clientWidth;
    const atEnd = agentReviewsViewport.scrollLeft >= maximum - 3;
    const atStart = agentReviewsViewport.scrollLeft <= 3;
    if (direction > 0 && atEnd) agentReviewsViewport.scrollTo({ left: 0, behavior: resourceReducedMotion.matches ? "auto" : "smooth" });
    else if (direction < 0 && atStart) agentReviewsViewport.scrollTo({ left: maximum, behavior: resourceReducedMotion.matches ? "auto" : "smooth" });
    else agentReviewsViewport.scrollBy({ left: direction * agentReviewScrollAmount(), behavior: resourceReducedMotion.matches ? "auto" : "smooth" });
}

function startAgentReviewsTimer() {
    window.clearInterval(agentReviewsTimer);
    if (!resourceReducedMotion.matches && agentReviewsTrack?.children.length > 1) {
        agentReviewsTimer = window.setInterval(() => scrollAgentReviews(1), 6500);
    }
}

async function loadAgentReviews() {
    if (!agentReviewsTrack) return;
    try {
        const response = await fetch("/api/agent-reviews", { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error("Agent reviews are unavailable.");
        const reviews = await response.json();
        if (!Array.isArray(reviews) || !reviews.length) return;
        agentReviewsTrack.replaceChildren(...reviews.map(createAgentReviewCard));
        agentReviewsCarousel.hidden = false;
        agentReviewsEmpty.hidden = true;
        startAgentReviewsTimer();
    } catch (error) {
        console.error("Unable to load agent reviews:", error);
    }
}

agentReviewsPrevious?.addEventListener("click", () => { scrollAgentReviews(-1); startAgentReviewsTimer(); });
agentReviewsNext?.addEventListener("click", () => { scrollAgentReviews(1); startAgentReviewsTimer(); });
agentReviewsCarousel?.addEventListener("mouseenter", () => window.clearInterval(agentReviewsTimer));
agentReviewsCarousel?.addEventListener("mouseleave", startAgentReviewsTimer);
agentReviewsCarousel?.addEventListener("focusin", () => window.clearInterval(agentReviewsTimer));
agentReviewsCarousel?.addEventListener("focusout", startAgentReviewsTimer);
resourceReducedMotion.addEventListener?.("change", startAgentReviewsTimer);
agentReviewModalClose?.addEventListener("click", closeAgentReviewModal);
agentReviewModal?.addEventListener("click", (event) => { if (event.target === agentReviewModal) closeAgentReviewModal(); });
agentReviewModal?.addEventListener("close", () => {
    agentReviewModalTrigger?.focus();
    agentReviewModalTrigger = null;
    startAgentReviewsTimer();
});
loadAgentReviews();
