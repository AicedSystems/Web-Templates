document.querySelectorAll("[data-realtor-name]").forEach((element) => {
    element.textContent = realtorData.name;
});

document.querySelector("[data-hero-intro]").textContent = realtorData.heroIntro;
document.querySelectorAll("[data-logo-image]").forEach((element) => {
    element.src = realtorData.images.logo;
});
document.querySelector("[data-hero-image]").src = realtorData.images.hero;
document.querySelector("[data-clients-image]").src = realtorData.images.clients;
document.querySelector("[data-agents-image]").src = realtorData.images.agents;

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

document.querySelector("[data-facebook-link]").href = realtorData.facebookUrl;
document.querySelector("[data-instagram-link]").href = realtorData.instagramUrl;
document.querySelector("[data-footer-year]").textContent = new Date().getFullYear();
