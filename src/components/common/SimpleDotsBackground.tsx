"use client";

import { useEffect, useRef } from "react";

export default function SimpleDotsBackground({ forceTheme }: { forceTheme?: "dark" | "light" }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let animationFrameId: number;
        let width = 0;
        let height = 0;
        let particles: Particle[] = [];

        interface Particle {
            x: number;
            y: number;
            size: number;
            speedY: number;
            opacity: number;
            fadeSpeed: number;
        }

        const init = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;

            // Create particles (dots)
            const particleCount = Math.floor((width * height) / 8000); // Adjust density
            particles = [];

            for (let i = 0; i < particleCount; i++) {
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    size: Math.random() * 1.5 + 0.5, // 0.5 to 2px
                    speedY: Math.random() * 0.5 - 0.25, // Slow vertical float
                    opacity: Math.random() * 0.5 + 0.1,
                    fadeSpeed: Math.random() * 0.01 - 0.005,
                });
            }
        };

        const draw = () => {
            ctx.clearRect(0, 0, width, height);

            const isDark = forceTheme === "dark" || (forceTheme !== "light" && document.documentElement.classList.contains("dark"));

            particles.forEach((p) => {
                // Update
                p.y -= p.speedY; // Float up or down
                p.opacity += p.fadeSpeed;

                if (p.opacity <= 0.1 || p.opacity >= 0.6) {
                    p.fadeSpeed = -p.fadeSpeed;
                }

                // Wrap around
                if (p.y < 0) p.y = height;
                if (p.y > height) p.y = 0;

                // Draw
                ctx.fillStyle = isDark
                    ? `rgba(255, 255, 255, ${p.opacity})`
                    : `rgba(20, 20, 30, ${p.opacity * 0.6})`;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            });

            animationFrameId = requestAnimationFrame(draw);
        };

        window.addEventListener("resize", init);
        const observer = new MutationObserver(() => {
            // Redraw immediately if theme likely changed, though RequestAnimationFrame handles updates.
            // We check theme inside draw loop, so just ensuring init happens is key.
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

        init();
        draw();

        return () => {
            window.removeEventListener("resize", init);
            cancelAnimationFrame(animationFrameId);
            observer.disconnect();
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none z-0"
            style={{ opacity: 0.6 }} // Global slight transparency
        />
    );
}
