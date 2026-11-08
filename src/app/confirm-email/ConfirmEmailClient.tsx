"use client";

import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getToken } from "@/lib/auth/storage";
import { refreshProfile } from "@/lib/profile";
import AuthShell, { AuthLink, AuthMessage, AuthSpinner } from "@/components/auth/AuthShell";

export default function ConfirmEmailClient({ token }: { token: string }) {
    const [state, setState] = useState<{ status: "working" | "done" | "error"; email?: string; message?: string }>(
        token ? { status: "working" } : { status: "error", message: "This link is missing its code. Open the link from your email again." }
    );
    const sent = useRef(false);

    useEffect(() => {
        if (!token || sent.current) return;
        sent.current = true;
        apiRequest("/api/auth/confirm-email", { method: "POST", body: { token }, quiet: true })
            .then((r: any) => {
                setState({ status: "done", email: r?.user?.email });
                if (getToken()) refreshProfile();
            })
            .catch((e) => setState({ status: "error", message: e.message || "This link is invalid or has expired." }));
    }, [token]);

    const signedIn = typeof window !== "undefined" && !!getToken();
    return (
        <AuthShell title="Confirm your new email">
            {state.status === "working" && <AuthSpinner label="Confirming…" />}
            {state.status === "done" && (
                <div className="space-y-4">
                    <AuthMessage tone="success">
                        Your email is now <b>{state.email || "updated"}</b>. Use it to sign in from now on.
                    </AuthMessage>
                    <AuthLink href={signedIn ? "/settings" : "/login"}>{signedIn ? "Back to settings" : "Sign in"}</AuthLink>
                </div>
            )}
            {state.status === "error" && (
                <div className="space-y-4">
                    <AuthMessage tone="error">{state.message}</AuthMessage>
                    <p className="text-sm text-gray-400">Request the change again from Settings → Profile.</p>
                    <AuthLink href={signedIn ? "/settings" : "/login"}>{signedIn ? "Go to settings" : "Sign in"}</AuthLink>
                </div>
            )}
        </AuthShell>
    );
}
