"use client";

import React from "react";
import { LucideIcon } from "lucide-react";

interface SwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    label?: string;
    size?: "xs" | "sm" | "md" | "lg";
    variant?: "indigo" | "emerald" | "amber" | "rose" | "blue" | "zinc";
    icon?: LucideIcon;
}

export default function Switch({
    checked,
    onChange,
    disabled = false,
    label = "",
    size = "md",
    variant = "indigo",
    icon: Icon
}: SwitchProps) {
    const sizes = {
        xs: { track: "w-9 h-5", dot: "w-4 h-4", translate: "translate-x-4", iconSize: "w-3 h-3" },
        sm: { track: "w-11 h-6", dot: "w-5 h-5", translate: "translate-x-5", iconSize: "w-3.5 h-3.5" },
        md: { track: "w-14 h-8", dot: "w-6.5 h-6.5", translate: "translate-x-6.5", iconSize: "w-4 h-4" },
        lg: { track: "w-24 h-13", dot: "w-11 h-11", translate: "translate-x-12", iconSize: "w-7 h-7" },
    };

    const variants = {
        indigo: "bg-indigo-600 dark:bg-indigo-500",
        emerald: "bg-emerald-600 dark:bg-emerald-500",
        amber: "bg-amber-500 dark:bg-amber-400",
        rose: "bg-rose-600 dark:bg-rose-500",
        blue: "bg-blue-600 dark:bg-blue-500",
        zinc: "bg-zinc-600 dark:bg-zinc-500",
    };

    const { track, dot, translate, iconSize } = sizes[size] || sizes.md;
    const activeBg = variants[variant] || variants.indigo;

    return (
        <label
            className={`group flex items-center justify-between gap-3 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            onClick={(e) => {
                if (disabled) return;
                e.stopPropagation();
            }}
        >
            {label && (
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 transition-colors group-hover:text-zinc-900 dark:group-hover:text-zinc-100">
                    {label}
                </span>
            )}
            <div className="relative inline-flex items-center">
                <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={(e) => {
                        if (!disabled) {
                            onChange(e.target.checked);
                        }
                    }}
                    disabled={disabled}
                />
                <div
                    className={`${track} rounded-full transition-all duration-300 ease-in-out ${checked
                        ? `${activeBg} shadow-inner`
                        : "bg-zinc-200 dark:bg-zinc-800"
                        } ${!disabled && "group-active:scale-95"}`}
                />
                <div
                    className={`absolute left-1 top-1 ${dot} bg-white rounded-full transition-all duration-300 ease-in-out shadow-sm flex items-center justify-center ${checked ? translate : ""
                        }`}
                >
                    {Icon && (
                        <Icon
                            className={`${iconSize} transition-colors duration-300 ${checked
                                ? (variant === 'amber' ? 'text-amber-600' : `text-${variant}-600 dark:text-${variant}-400`)
                                : 'text-zinc-400'
                                }`}
                        />
                    )}
                </div>
            </div>
        </label>
    );
}
