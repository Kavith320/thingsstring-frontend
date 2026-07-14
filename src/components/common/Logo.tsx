import React from "react";

interface LogoProps {
    className?: string;
    strokeWidth?: number;
    nodeRadius?: number;
}

export default function Logo({
    className = "w-full h-full",
    strokeWidth = 24,
    nodeRadius = 26,
}: LogoProps) {
    return (
        <svg
            viewBox="-30 85 460 175"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            {/* Main Path */}
            <path
                d="M 0,160 C 40,155 60,110 100,110 S 150,180 200,180 S 250,110 300,110 S 360,110 400,150"
                stroke="#4898cf"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
            />
            {/* Branch Path */}
            <path
                d="M 200,180 C 230,180 250,240 300,240"
                stroke="#7add8f"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
            />

            {/* Nodes */}
            <circle cx="100" cy="110" r={nodeRadius} fill="#4898cf" />
            <circle cx="200" cy="180" r={nodeRadius} fill="#58b3a4" />
            <circle cx="300" cy="110" r={nodeRadius} fill="#58b3a4" />
            <circle cx="300" cy="240" r={nodeRadius} fill="#7add8f" />
        </svg>
    );
}
