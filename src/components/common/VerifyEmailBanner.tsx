"use client";

import { useState } from "react";
import { MailWarning, X } from "lucide-react";
import { ApiError, apiRequest } from "@/lib/api";
import { useProfile } from "@/lib/profile";

/** Shown while the signed-in user's email isn't verified (needed e.g. to share devices). */
export default function VerifyEmailBanner() {
    const { profile } = useProfile();
    const [state, setState] = useState<"idle" | "sending" | "sent" | "error" | "hidden">("idle");
    const [message, setMessage] = useState("");

    if (!profile || profile.emailVerified !== false || state === "hidden") return null;

    async function resend() {
        setState("sending");
        try {
            await apiRequest("/api/auth/verify-email/send", { method: "POST", quiet: true });
            setState("sent");
        } catch (e: any) {
            if (e instanceof ApiError && e.status === 404) return setState("hidden"); // server without email support
            if (e instanceof ApiError && e.status === 400) return setState("hidden"); // already verified
            setMessage(e.message || "Couldn't send the email.");
            setState("error");
        }
    }

    return (
        <div role="status" className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2.5 sm:px-6">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 text-sm text-amber-900 dark:text-amber-200">
                <MailWarning className="h-4 w-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                    {state === "sent" ? (
                        <>Verification email sent to <b>{profile.email}</b>. Open the link in it to finish.</>
                    ) : state === "error" ? (
                        message
                    ) : (
                        <>Please verify your email <b className="[overflow-wrap:anywhere]">{profile.email}</b> to share devices and receive alerts.</>
                    )}
                </span>
                {state !== "sent" && (
                    <button
                        type="button"
                        onClick={resend}
                        disabled={state === "sending"}
                        className="h-8 rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                    >
                        {state === "sending" ? "Sending…" : "Resend email"}
                    </button>
                )}
                <button type="button" onClick={() => setState("hidden")} aria-label="Dismiss" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-amber-500/15">
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
