(function () {
    "use strict";

    const clamp = (value) => Math.min(100, Math.max(0, Math.round(value)));

    class ManagedImagePositionControl {
        constructor({ frame, image, getPosition, onChange }) {
            this.frame = frame;
            this.image = image;
            this.getPosition = getPosition;
            this.onChange = onChange;
            this.enabled = false;
            this.drag = null;
            image.draggable = false;

            frame.addEventListener("pointerdown", (event) => this.start(event));
            frame.addEventListener("pointermove", (event) => this.move(event));
            frame.addEventListener("pointerup", (event) => this.stop(event));
            frame.addEventListener("pointercancel", (event) => this.stop(event));
            frame.addEventListener("keydown", (event) => this.keydown(event));
        }

        setEnabled(enabled) {
            this.enabled = Boolean(enabled);
            this.frame.classList.toggle("is-positionable", this.enabled);
            if (this.enabled) {
                this.frame.tabIndex = 0;
                this.frame.setAttribute("aria-label", "Image position. Drag the image or use the arrow keys to reposition it.");
            } else {
                this.frame.removeAttribute("tabindex");
                this.frame.removeAttribute("aria-label");
                this.drag = null;
            }
        }

        start(event) {
            if (!this.enabled || event.button !== 0) return;
            const position = this.getPosition();
            if (!position) return;
            event.preventDefault();
            this.drag = {
                pointerId: event.pointerId,
                clientX: event.clientX,
                clientY: event.clientY,
                focalX: Number(position.focalX ?? 50),
                focalY: Number(position.focalY ?? 50)
            };
            this.frame.classList.add("is-positioning");
            this.frame.setPointerCapture(event.pointerId);
        }

        move(event) {
            if (!this.drag || event.pointerId !== this.drag.pointerId) return;
            const bounds = this.frame.getBoundingClientRect();
            if (!bounds.width || !bounds.height) return;
            const focalX = clamp(this.drag.focalX - ((event.clientX - this.drag.clientX) / bounds.width) * 100);
            const focalY = clamp(this.drag.focalY - ((event.clientY - this.drag.clientY) / bounds.height) * 100);
            this.apply(focalX, focalY);
        }

        stop(event) {
            if (!this.drag || event.pointerId !== this.drag.pointerId) return;
            this.frame.classList.remove("is-positioning");
            if (this.frame.hasPointerCapture(event.pointerId)) this.frame.releasePointerCapture(event.pointerId);
            this.drag = null;
        }

        keydown(event) {
            if (!this.enabled || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
            const position = this.getPosition();
            if (!position) return;
            event.preventDefault();
            const step = event.shiftKey ? 10 : 2;
            let focalX = Number(position.focalX ?? 50);
            let focalY = Number(position.focalY ?? 50);
            if (event.key === "ArrowLeft") focalX += step;
            if (event.key === "ArrowRight") focalX -= step;
            if (event.key === "ArrowUp") focalY += step;
            if (event.key === "ArrowDown") focalY -= step;
            this.apply(clamp(focalX), clamp(focalY));
        }

        apply(focalX, focalY) {
            this.image.style.objectPosition = `${focalX}% ${focalY}%`;
            this.image.style.transformOrigin = `${focalX}% ${focalY}%`;
            this.onChange({ focalX, focalY });
        }
    }

    window.ManagedImagePositionControl = ManagedImagePositionControl;
})();
