(() => {
    "use strict";

    const token = document.querySelector('meta[name="csrf-token"]')?.content || "";
    const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
    const isSameOrigin = (url) => {
        try {
            return new URL(url, window.location.href).origin === window.location.origin;
        } catch (_) {
            return false;
        }
    };

    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
        const request = input instanceof Request ? input : null;
        const url = request ? request.url : input;
        const method = String(init.method || request?.method || "GET").toUpperCase();
        if (!token || !unsafeMethods.has(method) || !isSameOrigin(url)) return originalFetch(input, init);

        const headers = new Headers(request?.headers || undefined);
        new Headers(init.headers || undefined).forEach((value, key) => headers.set(key, value));
        headers.set("X-CSRF-Token", token);
        return originalFetch(input, { ...init, headers });
    };

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        this.__adminCsrfRequired = Boolean(token && unsafeMethods.has(String(method).toUpperCase()) && isSameOrigin(url));
        return originalOpen.call(this, method, url, ...args);
    };
    XMLHttpRequest.prototype.send = function(body) {
        if (this.__adminCsrfRequired) this.setRequestHeader("X-CSRF-Token", token);
        return originalSend.call(this, body);
    };
})();
