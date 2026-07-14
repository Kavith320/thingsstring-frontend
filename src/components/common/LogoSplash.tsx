"use client";

import { useEffect, useRef } from "react";
import anime from "animejs";

interface LogoSplashProps {
    onComplete: () => void;
}

export default function LogoSplash({ onComplete }: LogoSplashProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Initialize dashoffset for paths to make sure line drawing works correctly
        const mainLine = document.getElementById("main-line");
        const branchLine = document.getElementById("branch-line");
        if (mainLine) {
            mainLine.setAttribute("stroke-dasharray", String(anime.setDashoffset(mainLine)));
        }
        if (branchLine) {
            branchLine.setAttribute("stroke-dasharray", String(anime.setDashoffset(branchLine)));
        }

        const tl = anime.timeline({
            loop: false,
            complete: () => {
                // Smoothly fade out the splash screen before hiding it completely
                anime({
                    targets: containerRef.current,
                    opacity: 0,
                    duration: 600,
                    easing: "easeOutQuad",
                    complete: () => {
                        onComplete();
                    },
                });
            },
        });

        // 1. Center Hub (n2) appears, expands, then shrinks to original size
        tl.add({
            targets: "#n2",
            opacity: [0, 1],
            scale: [2.5, 1], // Start big, shrink to original
            duration: 800,
            easing: "easeOutElastic(1, .5)",
        })

        // 2. Lines grow outward from center, spawning other nodes
        .add({
            targets: ["#main-line", "#branch-line"],
            strokeDashoffset: [anime.setDashoffset, 0],
            duration: 1000,
            easing: "easeInOutQuad",
        })
        .add(
            {
                targets: ["#n1", "#n3", "#n4"],
                opacity: [0, 1],
                duration: 600,
                delay: anime.stagger(200),
            },
            "-=800"
        )

        // 3. Dust particles ignite
        .add({
            targets: ".dust",
            opacity: [0, 1],
            duration: 400,
        })

        // 4. Zoom Reveal
        .add({
            targets: "#zoom-target",
            scale: 10,
            opacity: 0,
            duration: 600,
            easing: "easeInExpo",
            delay: 400,
        })
        .add({
            targets: "#brand-name",
            opacity: [0, 1],
            duration: 800,
            easing: "easeOutCubic",
        })
        .add({
            targets: "#brand-name",
            opacity: 0,
            delay: 1500,
            duration: 800,
        });

        return () => {
            tl.pause();
        };
    }, [onComplete]);

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 z-[9999] bg-[#17181a] flex items-center justify-center overflow-hidden select-none"
        >
            <div className="relative w-[500px] h-[350px] flex items-center justify-center">
                <div id="zoom-target" className="absolute flex items-center justify-center transform origin-center">
                    <svg viewBox="-50 0 500 300" className="w-[500px] h-[350px] overflow-visible">
                        {/* Main Path */}
                        <path
                            id="main-line"
                            d="M 0,160 C 40,155 60,110 100,110 S 150,180 200,180 S 250,110 300,110 S 360,110 400,150"
                            stroke="#4898cf"
                            strokeWidth="7"
                            strokeLinecap="round"
                            fill="none"
                        />
                        {/* Branch Path */}
                        <path
                            id="branch-line"
                            d="M 200,180 C 230,180 250,240 300,240"
                            stroke="#7add8f"
                            strokeWidth="7"
                            strokeLinecap="round"
                            fill="none"
                        />

                        {/* Nodes */}
                        <circle className="node origin-[100px_110px]" id="n1" cx="100" cy="110" r="11" fill="#4898cf" style={{ opacity: 0 }} />
                        <circle className="dust" id="d1" cx="100" cy="110" r="3.5" style={{ opacity: 0, fill: "#ffffff" }} />

                        <circle className="node origin-[200px_180px]" id="n2" cx="200" cy="180" r="11" fill="#58b3a4" style={{ opacity: 0 }} />
                        <circle className="dust" id="d2" cx="200" cy="180" r="3.5" style={{ opacity: 0, fill: "#ffffff" }} />

                        <circle className="node origin-[300px_110px]" id="n3" cx="300" cy="110" r="11" fill="#58b3a4" style={{ opacity: 0 }} />
                        <circle className="dust" id="d3" cx="300" cy="110" r="3.5" style={{ opacity: 0, fill: "#ffffff" }} />

                        <circle className="node origin-[300px_240px]" id="n4" cx="300" cy="240" r="11" fill="#7add8f" style={{ opacity: 0 }} />
                        <circle className="dust" id="d4" cx="300" cy="240" r="3.5" style={{ opacity: 0, fill: "#ffffff" }} />
                    </svg>
                </div>
                <div
                    id="brand-name"
                    className="absolute text-[64px] font-black tracking-wider opacity-0 whitespace-nowrap bg-clip-text text-transparent bg-gradient-to-r from-[#4898cf] via-[#58b3a4] to-[#7add8f] select-none font-sans"
                    style={{
                        backgroundSize: "200% auto",
                    }}
                >
                    ThingsString
                </div>
            </div>
        </div>
    );
}
