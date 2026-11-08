"use client";

/**
 * Scroll animations for the landing page:
 * - elements with [data-reveal] fade up when they scroll into view (once)
 * - html[data-scrolled] is set after the first few pixels (header shadow)
 * Content is only hidden for the reveal when html.ts-js is set by the inline script,
 * so it stays visible if scripts fail; reduced motion skips the effect in CSS.
 */
import { useEffect } from "react";

export default function ScrollEffects() {
    useEffect(() => {
        const root = document.documentElement;
        const onScroll = () => root.toggleAttribute("data-scrolled", window.scrollY > 8);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });

        const io = new IntersectionObserver(
            (entries) => {
                for (const e of entries) {
                    if (!e.isIntersecting) continue;
                    e.target.classList.add("is-visible");
                    io.unobserve(e.target);
                }
            },
            { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
        );
        document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));

        return () => {
            window.removeEventListener("scroll", onScroll);
            io.disconnect();
        };
    }, []);
    return null;
}
