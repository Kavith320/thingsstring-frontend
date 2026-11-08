"use client";

/**
 * Layout for the pages opened from email links and other signed-out pages
 * (verify email, reset password, invitations…). Matches the login page.
 */
import React, { useId } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { CheckCircle2, CircleAlert } from "lucide-react";
import Logo from "@/components/common/Logo";
import { cn } from "@/lib/utils";

const SimpleDotsBackground = dynamic(() => import("@/components/common/SimpleDotsBackground"), { ssr: false });

export default function AuthShell({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-[#050508] via-[#07070a] to-[#0b0b12] text-white">
            <div className="absolute inset-0">
                <SimpleDotsBackground forceTheme="dark" />
                <div className="absolute inset-0 bg-black/40" />
            </div>
            <main className="relative z-10 flex min-h-dvh items-center justify-center px-4 py-10">
                <div className="w-full max-w-md">
                    <div className="mb-6 text-center">
                        <Link href="/" className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-[#17181a] p-2 shadow-lg shadow-white/5" aria-label="ThingsString home">
                            <Logo strokeWidth={24} nodeRadius={26} />
                        </Link>
                        <h1 className="mt-3 text-xl font-semibold sm:text-2xl">{title}</h1>
                        {subtitle && <p className="mt-1 text-sm text-gray-400">{subtitle}</p>}
                    </div>
                    <div className="rounded-3xl border border-white/15 bg-white/[0.06] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.6)] backdrop-blur-2xl sm:p-7">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}

export function AuthField({
    label,
    hint,
    ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
    const id = useId();
    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-gray-200">{label}</label>
            <input
                id={id}
                {...props}
                className={cn(
                    "mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/35 px-4 text-sm text-white outline-none placeholder:text-gray-500 focus:ring-2 focus:ring-white/15 disabled:opacity-60",
                    props.className
                )}
            />
            {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
        </div>
    );
}

export function AuthButton({ loading, children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
    return (
        <button
            {...props}
            disabled={props.disabled || loading}
            className={cn(
                "inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-60",
                className
            )}
        >
            {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/40 border-t-black" aria-hidden />}
            {children}
        </button>
    );
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
    return (
        <Link href={href} className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-white/15 text-sm font-semibold text-white hover:bg-white/10">
            {children}
        </Link>
    );
}

export function AuthMessage({ tone, children }: { tone: "success" | "error" | "info"; children: React.ReactNode }) {
    const Icon = tone === "success" ? CheckCircle2 : CircleAlert;
    return (
        <div
            role={tone === "error" ? "alert" : "status"}
            className={cn(
                "flex gap-2.5 rounded-2xl border px-3 py-3 text-sm",
                tone === "success" && "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
                tone === "error" && "border-red-400/25 bg-red-400/10 text-red-100",
                tone === "info" && "border-white/15 bg-white/5 text-gray-200"
            )}
        >
            {tone !== "info" && <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
            <div>{children}</div>
        </div>
    );
}

export function AuthSpinner({ label }: { label: string }) {
    return (
        <div className="flex flex-col items-center gap-3 py-6 text-sm text-gray-300" role="status">
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
            {label}
        </div>
    );
}

/** Read `?token=` from the URL (client only). */
export function readToken(): string {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("token") || "";
}
