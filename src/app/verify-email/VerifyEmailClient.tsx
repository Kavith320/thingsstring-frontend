"use client";

import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getToken } from "@/lib/auth/storage";
import { refreshProfile } from "@/lib/profile";
import AuthShell, { AuthLink, AuthMessage, AuthSpinner } from "@/components/auth/AuthShell";

export default function VerifyEmailClient({ token }: { token: string }) {
    const [state, setState] = useState<{ status: "working" | "done" | "error"; message?: string }>(
        token ? { status: "working" } : { status: "error", message: "This link is missing its code. Open the link from your email again." }
    );
    const sent = useRef(false);

    useEffect(() => {
        if (!token || sent.current) return;
        sent.current = true; // the link works once: don't send it twice (React dev double effects)
        apiRequest("/api/auth/verify-email", { method: "POST", body: { token }, quiet: true })
            .then(() => {
                setState({ status: "done" });
                if (getToken()) refreshProfile();
            })
            .catch((e) => setState({ status: "error", message: e.message || "This link is invalid or has expired." }));
    }, [token]);

    const signedIn = typeof window !== "undefined" && !!getToken();
    return (
        <AuthShell title="Verify your email">
            {state.status === "working" && <AuthSpinner label="Verifying…" />}
            {state.status === "done" && (
                <div className="space-y-4">
                    <AuthMessage tone="success">Your email is verified. Thanks!</AuthMessage>
                    <AuthLink href={signedIn ? "/dashboard" : "/login"}>{signedIn ? "Go to dashboard" : "Sign in"}</AuthLink>
                </div>
            )}
            {state.status === "error" && (
                <div className="space-y-4">
                    <AuthMessage tone="error">{state.message}</AuthMessage>
                    <p className="text-sm text-gray-400">You can ask for a new link from the banner at the top of the dashboard.</p>
                    <AuthLink href={signedIn ? "/dashboard" : "/login"}>{signedIn ? "Go to dashboard" : "Sign in"}</AuthLink>
                </div>
            )}
        </AuthShell>
    );
}
