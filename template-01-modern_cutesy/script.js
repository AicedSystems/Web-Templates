const firstName = realtorData.name.split(" ")[0];

document.querySelectorAll("[data-realtor-name]").forEach((element) => {
    element.textContent = realtorData.name;
});

document.querySelectorAll("[data-realtor-first-name]").forEach((element) => {
    element.textContent = firstName;
});

document.querySelector("[data-hero-intro]").textContent = realtorData.heroIntro;
document.querySelectorAll("[data-logo-image]").forEach((element) => {
    element.src = realtorData.images.logo;
});
document.querySelector("[data-portrait-image]").src = realtorData.images.portrait;
document.querySelector("[data-client-image]").src = realtorData.images.clients;
document.querySelector("[data-agent-image]").src = realtorData.images.agents;

const reviewsTrack = document.querySelector("[data-reviews-track]");

reviewsTrack.innerHTML = realtorData.testimonials.map((testimonial) => {
    const stars = "★".repeat(testimonial.rating);

    return `
        <article class="testimonial-card">
            <span class="testimonial-card__quote" aria-hidden="true">“</span>
            <blockquote>${testimonial.quote}</blockquote>
            <p class="testimonial-card__author">— ${testimonial.name}</p>
            <p class="testimonial-card__role">${testimonial.role}</p>
            <p class="testimonial-card__stars" aria-label="${testimonial.rating} out of 5 stars">${stars}</p>
        </article>
    `;
}).join("");

document.querySelectorAll("[data-review-direction]").forEach((button) => {
    button.addEventListener("click", () => {
        const direction = Number(button.dataset.reviewDirection);
        const cardWidth = reviewsTrack.querySelector(".testimonial-card").offsetWidth;

        reviewsTrack.scrollBy({
            left: direction * (cardWidth + 24),
            behavior: "smooth"
        });
    });
});

const blogGrid = document.querySelector("[data-blog-grid]");

blogGrid.innerHTML = realtorData.blogPosts.map((post) => `
    <article class="blog-card">
        <img class="blog-card__image" src="${post.image}" alt="${post.alt}">
        <div class="blog-card__content">
            <p class="blog-card__category">${post.category}</p>
            <h3>${post.title}</h3>
            <a href="#contact">Read More <span aria-hidden="true">→</span></a>
        </div>
    </article>
`).join("");

document.querySelectorAll("[data-realtor-phone]").forEach((element) => {
    element.textContent = realtorData.phone;
});

document.querySelectorAll("[data-phone-link]").forEach((element) => {
    element.href = `tel:${realtorData.phone.replace(/[^\d+]/g, "")}`;
});

document.querySelectorAll("[data-realtor-email]").forEach((element) => {
    element.textContent = realtorData.email;
});

document.querySelectorAll("[data-email-link]").forEach((element) => {
    element.href = `mailto:${realtorData.email}`;
});

document.querySelector("[data-instagram-link]").href = realtorData.instagramUrl;
document.querySelector("[data-facebook-link]").href = realtorData.facebookUrl;
document.querySelector("[data-footer-year]").textContent = new Date().getFullYear();

const navToggle = document.querySelector(".nav-toggle");
const mainNav = document.querySelector(".main-nav");

function closeMobileMenu() {
    mainNav.classList.remove("main-nav--open");
    navToggle.classList.remove("nav-toggle--open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "Open navigation menu");
}

navToggle.addEventListener("click", () => {
    const menuIsOpen = navToggle.getAttribute("aria-expanded") === "true";

    if (menuIsOpen) {
        closeMobileMenu();
        return;
    }

    mainNav.classList.add("main-nav--open");
    navToggle.classList.add("nav-toggle--open");
    navToggle.setAttribute("aria-expanded", "true");
    navToggle.setAttribute("aria-label", "Close navigation menu");
});

mainNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMobileMenu);
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closeMobileMenu();
    }
});
