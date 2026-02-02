"use client";

import { cn } from "@/lib/utils";
import { Radio } from "lucide-react";

interface LoadingSignalProps {
    className?: string;
    size?: "sm" | "md" | "lg";
}

export default function LoadingSignal({ className, size = "md" }: LoadingSignalProps) {
    const sizeMap = {
        sm: "w-8 h-8",
        md: "w-12 h-12",
        lg: "w-20 h-20"
    };

    const iconSizeMap = {
        sm: "w-4 h-4",
        md: "w-5 h-5",
        lg: "w-8 h-8"
    };

    return (
        <div className={cn("flex flex-col items-center justify-center", className)}>
            <div className={cn("relative flex items-center justify-center", sizeMap[size])}>
                {/* Expanding Signal Rings (Very subtle backdrop) */}
                <div className="absolute inset-0 rounded-full bg-indigo-500/5 animate-ts-signal" />

                {/* Custom Animated SVG Signal */}
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={cn("text-indigo-600 dark:text-indigo-400 z-10", iconSizeMap[size])}
                >
                    {/* Core Dot */}
                    <circle cx="12" cy="18" r="1.5" fill="currentColor">
                        <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
                    </circle>

                    {/* Signal Waves */}
                    <path d="M8.5 14.5A5 5 0 0 1 15.5 14.5">
                        <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite" />
                    </path>
                    <path d="M5 11A10 10 0 0 1 19 11">
                        <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite" begin="0.4s" />
                    </path>
                    <path d="M2 8A14 14 0 0 1 22 8">
                        <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite" begin="0.8s" />
                    </path>
                </svg>

                {/* Glass Background */}
                <div className="absolute inset-0 rounded-full bg-white/10 dark:bg-white/5 backdrop-blur-3xl border border-indigo-500/10 dark:border-white/5 shadow-inner" />
            </div>
        </div>
    );
}
