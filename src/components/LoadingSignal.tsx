"use client";

import { cn } from "@/lib/utils";

interface LoadingSignalProps {
    className?: string;
    size?: "sm" | "md" | "lg";
}

export default function LoadingSignal({ className, size = "md" }: LoadingSignalProps) {
    const sizeMap = {
        sm: "w-10 h-6",
        md: "w-16 h-10",
        lg: "w-28 h-18"
    };

    const configMap = {
        sm: { strokeWidth: 30, nodeRadius: 32 },
        md: { strokeWidth: 24, nodeRadius: 26 },
        lg: { strokeWidth: 18, nodeRadius: 20 }
    };

    const { strokeWidth, nodeRadius } = configMap[size];

    return (
        <div className={cn("flex flex-col items-center justify-center", className)}>
            <div className={cn("relative flex items-center justify-center", sizeMap[size])}>
                <svg
                    viewBox="-30 85 460 175"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full h-full overflow-visible"
                >
                    {/* Main Path */}
                    <path
                        className="loading-main-line"
                        d="M 0,160 C 40,155 60,110 100,110 S 150,180 200,180 S 250,110 300,110 S 360,110 400,150"
                        stroke="#4898cf"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                    />
                    {/* Branch Path */}
                    <path
                        className="loading-branch-line"
                        d="M 200,180 C 230,180 250,240 300,240"
                        stroke="#7add8f"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                    />

                    {/* Nodes */}
                    <circle className="loading-node-1" cx="100" cy="110" r={nodeRadius} fill="#4898cf" />
                    <circle className="loading-node-2" cx="200" cy="180" r={nodeRadius} fill="#58b3a4" />
                    <circle className="loading-node-3" cx="300" cy="110" r={nodeRadius} fill="#58b3a4" />
                    <circle className="loading-node-4" cx="300" cy="240" r={nodeRadius} fill="#7add8f" />
                </svg>

                <style dangerouslySetInnerHTML={{ __html: `
                    .loading-main-line {
                        stroke-dasharray: 450;
                        stroke-dashoffset: 450;
                        animation: loading-draw 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                    }
                    .loading-branch-line {
                        stroke-dasharray: 150;
                        stroke-dashoffset: 150;
                        animation: loading-draw-branch 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                    }
                    .loading-node-2 {
                        animation: loading-fade-node-center 2.2s ease-out infinite;
                        transform-origin: 200px 180px;
                    }
                    .loading-node-1 {
                        animation: loading-fade-node 2.2s ease-out infinite;
                        animation-delay: 0.3s;
                        transform-origin: 100px 110px;
                    }
                    .loading-node-3 {
                        animation: loading-fade-node 2.2s ease-out infinite;
                        animation-delay: 0.5s;
                        transform-origin: 300px 110px;
                    }
                    .loading-node-4 {
                        animation: loading-fade-node 2.2s ease-out infinite;
                        animation-delay: 0.7s;
                        transform-origin: 300px 240px;
                    }

                    @keyframes loading-draw {
                        0% { stroke-dashoffset: 450; }
                        35%, 75% { stroke-dashoffset: 0; }
                        100% { stroke-dashoffset: -450; }
                    }
                    @keyframes loading-draw-branch {
                        0% { stroke-dashoffset: 150; }
                        40%, 75% { stroke-dashoffset: 0; }
                        100% { stroke-dashoffset: -150; }
                    }
                    @keyframes loading-fade-node-center {
                        0% { opacity: 0; transform: scale(0); }
                        10%, 80% { opacity: 1; transform: scale(1); }
                        95%, 100% { opacity: 0; transform: scale(0); }
                    }
                    @keyframes loading-fade-node {
                        0% { opacity: 0; transform: scale(0); }
                        10%, 80% { opacity: 1; transform: scale(1); }
                        95%, 100% { opacity: 0; transform: scale(0); }
                    }
                `}} />
            </div>
        </div>
    );
}
