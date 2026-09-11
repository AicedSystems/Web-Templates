function forEachMatch(selector, callback) {
    document.querySelectorAll(selector).forEach(callback);
}

function setText(selector, value) {
    if (value === undefined || value === null) return;

    forEachMatch(selector, (element) => {
        element.textContent = value;
    });
}

function setImage(selector, src) {
    if (!src) return;

    forEachMatch(selector, (element) => {
        element.src = src;
    });
}

function setHref(selector, href) {
    if (!href) return;

    forEachMatch(selector, (element) => {
        element.href = href;
    });
}

setText("[data-realtor-name]", realtorData.name);
setText("[data-realtor-phone]", realtorData.phone);
setText("[data-realtor-email]", realtorData.email);
setText("[data-realtor-license]", realtorData.licenseNumber);
setText("[data-realtor-brokerage]", realtorData.brokerage);
setText("[data-hero-intro]", realtorData.hero?.intro);
setText("[data-footer-year]", new Date().getFullYear());

setImage("[data-logo-image]", realtorData.images?.logo);
setImage("[data-hero-image]", realtorData.images?.hero);
setImage("[data-clients-image]", realtorData.images?.clients);
setImage("[data-agents-image]", realtorData.images?.agents);
setImage("[data-about-image]", realtorData.images?.about);

const phoneHref = realtorData.phone
    ? `tel:${realtorData.phone.replace(/[^\d+]/g, "")}`
    : null;

setHref("[data-phone-link]", phoneHref);
setHref("[data-email-link]", realtorData.email ? `mailto:${realtorData.email}` : null);
setHref("[data-facebook-link]", realtorData.social?.facebook);
setHref("[data-instagram-link]", realtorData.social?.instagram);

const menuButton = document.querySelector("[data-menu-button]");
const mobileNav = document.querySelector("[data-mobile-nav]");

function closeMobileMenu() {
    if (!menuButton || !mobileNav) return;

    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open navigation menu");
    mobileNav.hidden = true;
}

if (menuButton && mobileNav) {
    menuButton.addEventListener("click", () => {
        const isOpen = menuButton.getAttribute("aria-expanded") === "true";

        if (isOpen) {
            closeMobileMenu();
            return;
        }

        menuButton.setAttribute("aria-expanded", "true");
        menuButton.setAttribute("aria-label", "Close navigation menu");
        mobileNav.hidden = false;
    });

    mobileNav.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", closeMobileMenu);
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeMobileMenu();
            menuButton.focus();
        }
    });
}
