"use client";

/** Small client-only pieces of the landing page (the rest is server-rendered). */
import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getToken } from "@/lib/auth/storage";

const noop = () => () => {};
function useSignedIn() {
    return useSyncExternalStore(noop, () => !!getToken(), () => false);
}

/** Header buttons: Sign in + Get started, or Open dashboard when signed in. */
export function HeaderActions() {
    const signedIn = useSignedIn();
    if (signedIn) {
        return (
            <Link href="/dashboard" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
                Open dashboard <ArrowRight className="h-4 w-4" />
            </Link>
        );
    }
    return (
        <div className="flex items-center gap-1 sm:gap-2">
            <Link href="/login" className="inline-flex h-10 items-center rounded-xl px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800">
                Sign in
            </Link>
            <Link href="/login?mode=register" className="inline-flex h-10 items-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
                Get started
            </Link>
        </div>
    );
}

/** Main call to action, used in the hero and the closing band. */
export function PrimaryCta({ className = "" }: { className?: string }) {
    const signedIn = useSignedIn();
    return (
        <Link
            href={signedIn ? "/dashboard" : "/login?mode=register"}
            className={`group inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-6 text-base font-semibold text-white transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-white dark:focus-visible:ring-offset-zinc-950 ${className}`}
        >
            {signedIn ? "Open your dashboard" : "Create your account"}
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
        </Link>
    );
}
