function forEachMatch(selector, callback) {
    document.querySelectorAll(selector).forEach(callback);
}

function setText(selector, value) {
    if (value === undefined || value === null) return;

    forEachMatch(selector, (element) => {
        if (element.dataset.cmsText === "true") return;
        element.textContent = value;
    });
}

function setImage(selector, src) {
    if (!src) return;

    forEachMatch(selector, (element) => {
        if (element.dataset.cmsImage === "true") return;
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
const siteHeader = document.querySelector(".site-header, .blog-header");
const reducedMotionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const motionBaseDuration = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--motion-base")) || 220;
let mobileNavHideTimer;

if (siteHeader) {
    let headerFrame;
    const compactAt = 88;
    const expandAt = 12;

    function updateStickyHeader() {
        const isCompact = siteHeader.classList.contains("is-scrolled");

        if (!isCompact && window.scrollY > compactAt) {
            siteHeader.classList.add("is-scrolled");
        } else if (isCompact && window.scrollY < expandAt) {
            siteHeader.classList.remove("is-scrolled");
        }

        headerFrame = null;
    }

    window.addEventListener("scroll", () => {
        if (headerFrame) return;
        headerFrame = window.requestAnimationFrame(updateStickyHeader);
    }, { passive: true });
    updateStickyHeader();
}

function closeMobileMenu({ restoreFocus = false } = {}) {
    if (!menuButton || !mobileNav) return;

    const wasOpen = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open navigation menu");
    mobileNav.classList.remove("is-open");
    mobileNav.inert = true;
    window.clearTimeout(mobileNavHideTimer);
    mobileNavHideTimer = window.setTimeout(() => {
        if (menuButton.getAttribute("aria-expanded") === "false") {
            mobileNav.hidden = true;
        }
    }, reducedMotionPreference.matches ? 0 : motionBaseDuration);
    if (restoreFocus && wasOpen) menuButton.focus();
}

function openMobileMenu() {
    if (!menuButton || !mobileNav) return;

    window.clearTimeout(mobileNavHideTimer);
    menuButton.setAttribute("aria-expanded", "true");
    menuButton.setAttribute("aria-label", "Close navigation menu");
    mobileNav.hidden = false;
    mobileNav.inert = false;
    window.requestAnimationFrame(() => mobileNav.classList.add("is-open"));
}

if (menuButton && mobileNav) {
    mobileNav.inert = true;
    menuButton.addEventListener("click", () => {
        const isOpen = menuButton.getAttribute("aria-expanded") === "true";

        if (isOpen) {
            closeMobileMenu();
            return;
        }

        openMobileMenu();
    });

    mobileNav.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", closeMobileMenu);
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeMobileMenu({ restoreFocus: true });
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 1180) closeMobileMenu();
    });
}

const heroCopy = document.querySelector(".hero__copy");
const heroDirectory = document.querySelector(".hero-directory");
const heroBlog = document.querySelector(".hero-blog");

if (heroCopy && heroDirectory && heroBlog) {
    const heroBlogPosition = document.createComment("hero blog desktop position");
    const compactHeroQuery = window.matchMedia("(max-width: 900px)");
    heroBlog.before(heroBlogPosition);

    function placeHeroBlog() {
        if (compactHeroQuery.matches) {
            heroDirectory.after(heroBlog);
        } else {
            heroBlogPosition.after(heroBlog);
        }
    }

    placeHeroBlog();
    compactHeroQuery.addEventListener("change", placeHeroBlog);
}
